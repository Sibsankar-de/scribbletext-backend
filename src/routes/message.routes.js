import { Router } from "express";
import {
    createMessage,
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
router.route('/get-message/:messageId').get(getMessage)
router.route('/update-status').post(updateMessageStatus)
router.route('/g-croom/:contactId').get(verifyJwt, getMessageRoom)
router.route('/del-mes/:messageId').get(verifyJwt, deleteMessageFromOne)
router.route('/del-mesev/:messageId').get(verifyJwt, deleteMessageFromEveryone)

export default router