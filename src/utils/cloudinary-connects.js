import { v2 as cloudinary } from "cloudinary"
import { ApiError } from "./api-error.js"
import fs from "fs"

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

const uploadOnClodinary = async (localPath) => {
    try {
        if (!localPath) return null
        const response = await cloudinary.uploader.upload(localPath, {
            resource_type: 'auto'
        })
        
        fs.unlinkSync(localPath)
        return response;
    } catch (error) {
        fs.unlinkSync(localPath)
        throw new ApiError(400, "Cloudinary upload failed")
    }

}

const getPublicIdFromLUrl = (url) => {
    const regex = /\/(?:v\d+\/)?([^\/]+)\.[a-zA-Z]+$/;
    const match = url?.match(regex);
    return match ? match[1] : null;
}

const deleteFromClodinary = async (fileUrl) => {
    const publicId = getPublicIdFromLUrl(fileUrl)
    if (!publicId) return null
    try {
        await cloudinary.uploader.destroy(publicId)

    } catch (error) {
        console.error(400, "Failed deletion from Cloudinary")
    }

}

export { uploadOnClodinary, deleteFromClodinary }