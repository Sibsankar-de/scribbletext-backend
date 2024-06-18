import mongoose from "mongoose";
import { Message } from "../models/message.model.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteFromClodinary, uploadOnClodinary } from "../utils/cloudinary-connects.js";
import { getIo } from "../setupSocket.js";


const createMessage = asyncHandler(async (req, res) => {
    const { text, recipientId } = req.body

    if ([recipientId].some(e => e === '')) {
        throw new ApiError(400, "Recipient id is required")
    }

    var filePath
    if (req.files && req.files.file && req.files.file[0]) {
        filePath = req.files.file[0].path
    }

    const file = await uploadOnClodinary(filePath)


    const message = await Message.create({
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
        recipientId: new mongoose.Types.ObjectId(recipientId)
    })


    return (
        res.status(200)
            .json(new ApiResponse(200, message, "message created successfully"))
    )

})

const getMessage = asyncHandler(async (req, res) => {
    const { messageId } = req?.params
    if (!messageId) throw new ApiError(400, "Message Id is required")

    const message = await Message.findById(messageId)

    return (
        res.status(200)
            .json(new ApiResponse(200, message, "Message fetched successfully"))
    )
})

const messageChangeStream = async () => {
    const changeStream = Message.watch([], { fullDocument: 'updateLookup' });
    const io = getIo()
    try {
        changeStream.on('change', async (change) => {
            await io.emit("messageChange", change.fullDocument)
        })
    } catch (error) {
        console.log(error);
    }

    changeStream.on('error', (error) => console.log('A error on changestream', error))
    changeStream.on('end', () => consloe.log("changestream ended"))
}

const updateMessageStatus = asyncHandler(async (req, res) => {
    const { receiveStatus, messageId } = req.body
    if (!messageId) throw new ApiError(400, "message id is required")
    const message = await Message.findById(new mongoose.Types.ObjectId(messageId));

    if (!message) throw new ApiError(400, "Message does not exist")
    if (!receiveStatus) throw new ApiError(400, "Receive status rewuired")

    message.receiveStatus = receiveStatus

    await message.save({ validateBeforeSave: false })
    return (
        res.status(200)
            .json(new ApiResponse(200, {}, "Message Status updated Sucessfully"))
    )
})

const getMessageRoom = asyncHandler(async (req, res) => {
    const { contactId } = req.params
    const recipientId = new mongoose.Types.ObjectId(contactId)
    const senderId = new mongoose.Types.ObjectId(req.user?._id)

    const room = await Message.aggregate([
        {
            $match: {
                $or: [
                    { senderId: senderId, recipientId: recipientId },
                    { senderId: recipientId, recipientId: senderId }
                ]
            }
        },
        {
            $addFields: {
                sortedIds: {
                    $cond: {
                        if: { $gt: ["$senderId", "$recipientId"] },
                        then: { firstId: "$recipientId", secondId: "$senderId" },
                        else: { firstId: "$senderId", secondId: "$recipientId" }
                    }
                }
            }
        },
        {
            $group: {
                _id: {
                    senderId: "$sortedIds.firstId",
                    recipientId: "$sortedIds.secondId"
                },
                messages: {
                    $push: "$$ROOT"
                },
                count: { $sum: 1 }
            }
        },
        {
            $unset: "messages.sortedIds"
        },
        {
            $project: {
                _id: 0,
                senderId: "$_id.senderId",
                recipientId: "$_id.recipientId",
                messages: 1,
                count: 1
            }
        }
    ])

    return (
        res.status(200)
            .json(new ApiResponse(200, room && room[0], "Room created successfully"))
    )
})

const deleteMessageFromOne = asyncHandler(async (req, res) => {
    const { messageId } = req.params
    const message = await Message.findById(messageId)

    if (req.user?._id.toString() === message.senderId.toString()) {
        message.deletedFromSender = true
    }
    else if (req.user?._id.toString() === message.recipientId.toString()) {
        message.deletedFromRecipient = true
    }
    else {
        throw new ApiError(400, "Incorrect sender and recipient")
    }

    await message.save({ validateBeforeSave: false })

    return (
        res.status(200).json(new ApiResponse(200, "Message deleted "))
    )
})

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

    return (
        res.status(200).json(new ApiResponse(200, "Message deleted from Everyone"))
    )
})


export {
    createMessage,
    getMessage,
    messageChangeStream,
    updateMessageStatus,
    getMessageRoom,
    deleteMessageFromOne,
    deleteMessageFromEveryone
}