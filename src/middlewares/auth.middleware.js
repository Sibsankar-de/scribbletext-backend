import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";

import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const verifyJwt = asyncHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace('Bearer ', '')
        if (!token) { throw new ApiError(401, "Unauthorised request") }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken._id).select("-password -refreshToken")
        if (!user) { throw new ApiError(401, "Invalid accesstoken") }

        req.user = user;
        next()
    } catch (error) {
        throw new ApiError(401, "Invalid request")
    }
})