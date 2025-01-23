import { Router } from "express";
import {
    createMessage,
    createNotification,
    deleteManyChats,
    deleteMessageFromEveryone,
    deleteMessageFromOne,
    getMessage,
    getMessageRoom,
    updateMessageStatus
} from "../controllers/message.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route('/create-message').post(verifyJwt, upload.fields([{ name: "file", maxCount: 1 }]), createMessage)
router.route('/send-notification').post(verifyJwt, createNotification)
router.route('/get-message/:messageId').get(verifyJwt, getMessage)
router.route('/update-status').post(verifyJwt, updateMessageStatus)
router.route('/g-croom/:id').get(verifyJwt, getMessageRoom)
router.route('/del-mes/:messageId').get(verifyJwt, deleteMessageFromOne)
router.route('/del-mesev/:messageId').get(verifyJwt, deleteMessageFromEveryone)
router.route('/del-many').post(verifyJwt, deleteManyChats)

export default router