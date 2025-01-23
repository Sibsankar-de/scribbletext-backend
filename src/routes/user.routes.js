import { Router } from "express";
import { addToArchiveList, checkAuth, getContactList, getCurrentUser, getUserDetails, getUserList, loginUser, logoutUser, notificationSubscription, refreshAccessToken, registerUser, removeAvatar, removeFromArchiveList, updateAvatar, updatePassword, updateUserName, updateUserStatus } from "../controllers/user.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route('/register-user').post(upload.fields([{ name: "avatar", maxCount: 1 }]), registerUser)
router.route('/login-user').post(loginUser)
router.route('/current-user').get(verifyJwt, getCurrentUser)

router.route('/logout-user').get(verifyJwt, logoutUser)
router.route('/refresh-token').get(refreshAccessToken)

router.route("/check-auth").get(verifyJwt, checkAuth);

router.route('/update-username').patch(verifyJwt, updateUserName)
router.route('/update-password').patch(verifyJwt, updatePassword)
router.route('/update-avatar').patch(verifyJwt, upload.single("avatar"), updateAvatar)
router.route('/remove-avatar').patch(verifyJwt, removeAvatar)
router.route('/active-status').patch(verifyJwt, updateUserStatus)

router.route('/notification-subscription').post(verifyJwt, notificationSubscription);

router.route('/user-details/:userId').get(getUserDetails)
router.route('/contactlist').get(verifyJwt, getContactList)
router.route('/userlist').get(getUserList)
router.route('/add-archive/:userId').get(verifyJwt, addToArchiveList)
router.route('/remove-archive/:userId').get(verifyJwt, removeFromArchiveList)


export default router