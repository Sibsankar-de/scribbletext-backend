import mongoose from "mongoose";
import { Message } from "../models/message.model.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteFromClodinary, uploadOnClodinary } from "../utils/cloudinary-connects.js";
import { getConnectionObj, getIo } from "../setupSocket.js";
import webPush from "web-push";
import { User } from "../models/user.model.js";


// message on changes through socket
const emitMessageChange = async (message) => {
    const user1 = message?.senderId;
    const user2 = message?.recipientId;
    // emit message
    const io = getIo();
    const connectedUserList = getConnectionObj();
    if (user1 && user2) {
        if (connectedUserList[user1]) {
            await io.to(connectedUserList[user1]).emit("messageChange", message);
        }
        if (connectedUserList[user2]) {
            await io.to(connectedUserList[user2]).emit("messageChange", message);
        }
    }
}

// creates a new message 
const createMessage = asyncHandler(async (req, res) => {
    const { text, recipientId, messageId, repliedTo } = req.body

    if ([recipientId, messageId].some(e => e === '')) {
        throw new ApiError(400, "Recipient id is required")
    }

    var filePath
    if (req.files && req.files.file && req.files.file[0]) {
        filePath = req.files.file[0].path
    }

    const file = await uploadOnClodinary(filePath)
    // set the receive status
    let receiveStatus = "un received";
    const connectedUserList = getConnectionObj();
    if (Object.keys(connectedUserList)?.includes[recipientId]) receiveStatus = "received"

    const message = await Message.create({
        messageId,
        content: {
            text,
            file: {
                original_filename: file?.original_filename,
                url: file?.url,
                bytes: file?.bytes,
                format: file?.format,
                resource_type: file?.resource_type
            }
        },
        senderId: req.user?._id,
        recipientId: new mongoose.Types.ObjectId(recipientId),
        receiveStatus,
        repliedTo: JSON.parse(repliedTo) || {}
    })

    await emitMessageChange(message);

    return (
        res.status(200)
            .json(new ApiResponse(200, { id: message?._id }, "message created successfully"))
    )

})

// config for web push
webPush.setVapidDetails(
    "mailto:sibsankar2005@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
)

// create notification
const createNotification = asyncHandler(async (req, res) => {
    const { messageId } = req.body;
    const message = await Message.findById(messageId);
    if (!message) throw new ApiError(400, "Message does not exist");
    // intialise the receiver and sender
    const receiver = await User.findById(message.recipientId);
    if (!receiver) throw new ApiError(400, "Recipient does not exist");
    const sender = await User.findById(message.senderId);
    // get the subscription
    const subscription = receiver.notificationSubscription;
    // the payload for the notification
    const playload = JSON.stringify({
        title: sender.fullName,
        body: message.content?.text || message.content?.file?.original_filename,
        url: `${process.env.CORS_ORIGIN}/home/chats/${message.senderId}`
    })
    webPush.sendNotification(subscription, playload)
        .then(() =>
            res.status(200)
                .json(new ApiResponse(200, {}, "Notification sent"))
        )
        .catch((error) => {
            console.log(error);
        })
})

// get message through id
const getMessage = asyncHandler(async (req, res) => {
    const { messageId } = req?.params
    if (!messageId) throw new ApiError(400, "Message Id is required")

    const message = await Message.findById(messageId)

    return (
        res.status(200)
            .json(new ApiResponse(200, message, "Message fetched successfully"))
    )
})

// update message seen status
const updateMessageStatus = asyncHandler(async (req, res) => {
    const { receiveStatus, messageId } = req.body
    if (!messageId) throw new ApiError(400, "message id is required")
    const message = await Message.findById(messageId);

    if (!message) throw new ApiError(400, "Message does not exist")
    if (!receiveStatus) throw new ApiError(400, "Receive status rewuired")

    message.receiveStatus = receiveStatus

    await message.save({ validateBeforeSave: false });
    await emitMessageChange(message);
    return (
        res.status(200)
            .json(new ApiResponse(200, {}, "Message Status updated Sucessfully"))
    )
})

// update message delevery status  on user online
const updateMessageStatusOnUserOnline = async (userId) => {
    await Message.aggregate([
        {
            $match: {
                recipientId: new mongoose.Types.ObjectId(userId),
                receiveStatus: "un received"
            },
        },
        {
            $set: {
                receiveStatus: "received"
            }
        }

    ])
}

// creates a chat room
const getMessageRoom = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const contactId = new mongoose.Types.ObjectId(id);
    const userId = new mongoose.Types.ObjectId(req.user?._id);

    // create a room for two users

    // filter to get messages
    const filterStage = {
        // filters the messages deleted
        $or: [
            {
                $and: [
                    { senderId: userId, recipientId: contactId },
                    { deletedFromSender: false }
                ]
            },
            {
                $and: [
                    { senderId: contactId, recipientId: userId },
                    { deletedFromRecipient: false }
                ]
            }
        ]
    }
    // creates the chat list
    const chatList = await Message.aggregate([
        {
            $match: filterStage
        },
        {
            $addFields: {
                createdAtDate: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" }
                },

            }
        },
        {
            $group: {
                _id: "$createdAtDate",
                messages: {
                    $push: "$$ROOT"
                }
            }
        },
        {
            $project: {
                _id: 0,
                chatDate: "$_id",
                messages: 1
            }
        },
        {
            $sort: {
                chatDate: 1
            }
        }
    ])
    // creates a list of unseen messages
    const unreadMessageList = await Message.aggregate([
        {
            $match: {
                // filters unread messages
                $or: [
                    { receiveStatus: "received" },
                    { receiveStatus: "un received" }
                ],

                $and: [
                    { senderId: contactId, recipientId: userId },
                    { deletedFromRecipient: false }
                ]
            }
        },
        {
            $project: {
                _id: 1
            }
        }
    ])

    const room = {
        unreadsLength: unreadMessageList?.length || 0,
        unreadStartId: unreadMessageList[0]?._id || null,
        userId: userId,
        contactId: contactId,
        chatList
    }

    return (
        res.status(200)
            .json(new ApiResponse(200, room, "Room created successfully"))
    )
})

// removes message from one
const deleteMessageFromOne = asyncHandler(async (req, res) => {
    const { messageId } = req.params
    const message = await Message.findById(messageId)

    if (req.user?._id?.toString() === message.senderId?.toString()) {
        message.deletedFromSender = true
    }
    else if (req.user?._id?.toString() === message.recipientId?.toString()) {
        message.deletedFromRecipient = true
    }
    else {
        throw new ApiError(400, "Incorrect sender and recipient")
    }

    await message.save({ validateBeforeSave: false });
    await emitMessageChange(message);

    return (
        res.status(200).json(new ApiResponse(200, {}, "Message deleted "))
    )
})

// removes messege for all
const deleteMessageFromEveryone = asyncHandler(async (req, res) => {
    const { messageId } = req.params
    const message = await Message.findById(messageId)

    if (!message) { throw new ApiError(400, "Invalid message") }

    if (req.user?._id.toString() === message.senderId.toString()) {
        message.deletedFromSender = true
        message.deletedFromRecipient = true

        try {
            if (message.content?.file) {
                await deleteFromClodinary(message.content?.file)
            }
        } catch (error) {
            console.log(error);
        }
    }

    await message.save({ validateBeforeSave: false })
    await emitMessageChange(message);

    return (
        res.status(200).json(new ApiResponse(200, {}, "Message deleted from Everyone"))
    )
})

const deleteManyChats = asyncHandler(async (req, res) => {
    const { messageList } = req.body;
    if (!messageList) throw new ApiError(400, "Message list is required");
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const idList = [];
    messageList?.forEach(id => {
        idList.push(new mongoose.Types.ObjectId(id));
    })
    console.log(idList?.length)
    const message = await Message.updateMany(
        { _id: { $in: idList } },
        [
            {
                $set: {
                    deletedFromSender: {
                        $cond: {
                            if: { $eq: ["$senderId", userId] },
                            then: true,
                            else: "$deletedFromSender"
                        }
                    },
                    deletedFromRecipient: {
                        $cond: {
                            if: { $eq: ["$recipientId", userId] },
                            then: true,
                            else: "$deletedFromRecipient"
                        }
                    }
                }
            }
        ]
    )

    return (
        res.status(200)
            .json(new ApiResponse(200, message, "Messages deleted"))
    )
})

export {
    createMessage,
    getMessage,
    updateMessageStatus,
    getMessageRoom,
    deleteMessageFromOne,
    deleteMessageFromEveryone,
    deleteManyChats,
    updateMessageStatusOnUserOnline,
    createNotification
}