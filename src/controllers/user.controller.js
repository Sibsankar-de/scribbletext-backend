import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { deleteFromClodinary, uploadOnClodinary } from "../utils/cloudinary-connects.js";
import { ApiResponse } from "../utils/api-response.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Message } from "../models/message.model.js";
import { getIo } from "../setupSocket.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Error on generating access and refresh tokens")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    const { userName, fullName, password } = req.body;

    if ([userName, fullName, password].some(e => e === '')) {
        throw new ApiError(400, 'Fields are required')
    }

    const existedUser = await User.findOne({ userName })

    if (existedUser) throw new ApiError(401, 'User already exist')

    let avatarLocalpath;
    if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
        avatarLocalpath = req.files.avatar[0].path
    }

    const avatar = await uploadOnClodinary(avatarLocalpath);

    const user = await User.create({
        userName,
        fullName,
        password,
        avatar: avatar?.url
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    return (
        res.status(200)
            .json(new ApiResponse(200, createdUser, "User created sucessfully"))
    )
})

const loginUser = asyncHandler(async (req, res) => {

    const { userName, password } = req.body;

    if (!userName) {
        throw new ApiError(400, "Fields are required")
    }

    const user = await User.findOne({ userName: userName });

    if (!user) { throw new ApiError(401, "User does not exist") }

    const validatePassword = await user.isPasswordCorrect(password);
    if (!validatePassword) { throw new ApiError(401, "Mismatched credentials") }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 20 * 24 * 60 * 60 * 1000,
    }

    return (
        res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(200, { accessToken }, "Log in sucessfull")
            )
    )

})

const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id).select("-password -refreshToken")

    if (!user) throw new ApiError(401, "Unauthorised request")
    return (
        res.status(200)
            .json(new ApiResponse(200, user, "Current user fetched sucessfully"))
    )
})

const userChangeStream = async () => {
    const changeStream = User.watch([], { fullDocument: 'updateLookup' });
    const io = getIo()
    const filterUser = (user) => {
        const filteredUser = { ...user }
        delete filteredUser.password
        delete filteredUser.accessToken
        delete filteredUser.refreshToken
        return filteredUser
    }
    changeStream.on('change', async (change) => {
        const forwardDocument = filterUser(change?.fullDocument)

        await io?.emit("userChange", forwardDocument)
    })

    changeStream.on('error', (error) => console.log('A error on changestream', error))
    changeStream.on('end', () => consloe.log("changestream ended"))
}

const logoutUser = asyncHandler(async (req, res,) => {
    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 20 * 24 * 60 * 60 * 1000,
    }

    return (
        res.status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(
                new ApiResponse(200, {}, "Logout sucessfull")
            )
    )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken
    if (!incomingRefreshToken) { throw new ApiError(401, "Unauthorised request") }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id)

        if (!user) { throw new ApiError(401, "Invalid refresh token") }
        if (incomingRefreshToken !== user?.refreshToken) { throw new ApiError("Refresh token expired") }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user?._id)

        const options = {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 20 * 24 * 60 * 60 * 1000,
        }

        return (
            res.status(200)
                .cookie("accessToken", accessToken, options)
                .cookie("refreshToken", newRefreshToken, options)
                .json(
                    new ApiResponse(200, { user: accessToken, newRefreshToken }, "Accesstoken Refreshed")
                )
        )
    } catch (error) {
        throw new ApiError(401, "Error geting refreh token")
    }


})

const updateUserName = asyncHandler(async (req, res) => {
    const { userName } = req.body
    if (!userName) { throw new ApiError(400, "fields are required") }
    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                userName
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    return (
        res.status(200)
            .json(new ApiResponse(200, updatedUser, "Username updated Successfully"))
    )
})

const updatePassword = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id)

    const { oldPassword, newPassword } = req.body
    if ([oldPassword, newPassword].some(e => e === '')) { throw new ApiError(400, "password is required") }

    const validateOldpassword = await user.isPasswordCorrect(oldPassword)
    if (!validateOldpassword) { throw new ApiError(401, "Old password is incorect") }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return (
        res.status(200)
            .json(new ApiResponse(200, {}, "Password updated Successfully"))
    )
})

const updateAvatar = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id)
    const avatarPath = req.file?.path

    if (!avatarPath) { throw new ApiError(400, "Avatar is required") }

    const newAvatar = await uploadOnClodinary(avatarPath)

    if (user.avatar) {
        const oldAvatar = user.avatar
        await deleteFromClodinary(oldAvatar)
    }

    user.avatar = newAvatar?.url

    await user.save({ validateBeforeSave: false })

    return (
        res.status(200)
            .json(new ApiResponse(200, { avatar: newAvatar?.url }, "Avatar updated Successfully"))
    )

})

const removeAvatar = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id)

    if (user.avatar) {
        const oldAvatar = user.avatar
        await deleteFromClodinary(oldAvatar)
    }

    user.avatar = null;
    await user.save({ validateBeforeSave: false })

    return (
        res.status(200)
            .json(new ApiResponse(200, "Avatar Removed Successfully"))
    )

})

const getUserDetails = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!userId) throw new ApiError(400, "User id is required")

    const user = await User.findById(userId).select("-password -refreshToken")

    if (!user) throw new ApiError(400, "User does not exist")

    return (
        res.status(200)
            .json(new ApiResponse(200, user, "User fetched successfully"))
    )
})

const getContactList = asyncHandler(async (req, res) => {

    const userObjectId = new mongoose.Types.ObjectId(req.user?._id)

    const contactList = await Message.aggregate([
        {
            $match: {
                $or: [
                    { senderId: userObjectId },
                    { recipientId: userObjectId }
                ]
            }
        },
        {
            $project: {
                _id: 0,
                otherUserId: {
                    $cond: {
                        if: { $eq: ["$senderId", userObjectId] },
                        then: "$recipientId",
                        else: "$senderId"
                    }
                },
                createdAt: 1,
                lastMessage: "$$ROOT",
                isNotDelivered: {
                    $cond: {
                        if: {
                            $and: [
                                { $eq: ["$recipientId", userObjectId] },
                                {
                                    $or: [
                                        { $eq: ["$receiveStatus", "un received"] },
                                        { $eq: ["$receiveStatus", "received"] }
                                    ]
                                }
                            ]
                        },
                        then: 1,
                        else: 0
                    }
                }
            }
        },
        {
            $match: {
                $and: [
                    { "lastMessage.deletedFromSender": false },
                    { "lastMessage.deletedFromRecipient": false }
                ]
            }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $group: {
                _id: "$otherUserId",
                lastMessageTimestamp: { $first: "$createdAt" },
                lastMessage: { $first: "$lastMessage" },
                unseenMessagesCount: { $sum: "$isNotDelivered" }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "otherUser",
            }
        },
        {
            $unwind: "$otherUser"
        },
        {
            $project: {
                _id: "$otherUser._id",
                recipientId: "$otherUser._id",
                fullName: "$otherUser.fullName",
                userName: "$otherUser.userName",
                avatar: "$otherUser.avatar",
                lastMessageTimestamp: 1,
                lastMessage: 1,
                unseenMessagesCount: 1
            }
        },
        {
            $sort: { lastMessageTimestamp: -1 }
        }
    ])

    const user = await User.findById(req.user?._id)

    if (contactList) {
        user.contactList = contactList;
    }

    await user.save({ validateBeforeSave: false })

    const response = {
        _id: req.user?._id,
        contactList
    }
    return (
        res.status(200)
            .json(new ApiResponse(200, response, "Contactlist Fetched successfully"))
    )
})

const getUserList = asyncHandler(async (req, res) => {
    const userList = await User.aggregate([
        {
            $project: {
                _id: "$_id",
                userName: "$userName",
                fullName: "$fullName",
                avatar: "$avatar"
            }
        }
    ])

    return (
        res.status(200)
            .json(new ApiResponse(200, userList, "User list Fetched successfully!"))
    )
})

const addToArchiveList = asyncHandler(async (req, res) => {
    const { userId } = req.params

    const user = await User.findById(req.user?._id)
    const addUser = await User.findById(userId)

    if (!userId) throw new ApiError(400, "User id is required")
    if (!addUser) throw new ApiError(400, "User does not exist")
    if (!user) throw new ApiError(401, "Unauthorised request")

    const archivedList = user.archivedList


    const index = user.archivedList?.findIndex(e => e._id === userId)
    if (index !== -1) {
        return (
            res.status(201)
                .json(new ApiResponse(200, {}, "User already added to archive list"))
        )
    }
    else {
        user.archivedList = [...archivedList, {
            _id: userId,
            userName: addUser.userName,
            fullName: addUser.fullName,
            avatar: addUser.avatar
        }]
    }

    await user.save({ validateBeforeSave: false })

    return (
        res.status(200)
            .json(new ApiResponse(200, "User added to Archived list"))
    )
})

const removeFromArchiveList = asyncHandler(async (req, res) => {
    const { userId } = req.params

    const user = await User.findById(req.user?._id)

    if (!userId) throw new ApiError(400, "User id is required")
    if (!user) throw new ApiError(401, "Unauthorised request")

    const index = user.archivedList?.findIndex(e => e._id === userId)
    if (index !== -1) {
        const newList = user.archivedList?.filter(e => e !== user.archivedList[index])

        user.archivedList = newList
    }

    await user.save({ validateBeforeSave: false })

    return (
        res.status(200)
            .json(new ApiResponse(200, {}, "User removed Archived list"))
    )
})

const updateUserStatus = asyncHandler(async (req, res) => {
    const { status } = req.body
    if (!status) throw new ApiError(400, 'status required')
    await User.findByIdAndUpdate(
        req?.user?._id,
        { activeStatus: status }
    )

    return (
        res.status(200)
            .json(new ApiResponse(200, {}, "active status updated successfully"))
    )
})

export {
    registerUser,
    loginUser,
    getCurrentUser,
    userChangeStream,
    logoutUser,
    refreshAccessToken,
    updateUserName,
    updatePassword,
    updateAvatar,
    removeAvatar,
    getUserDetails,
    getContactList,
    getUserList,
    addToArchiveList,
    removeFromArchiveList,
    updateUserStatus
}