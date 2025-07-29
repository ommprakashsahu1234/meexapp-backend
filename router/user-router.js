const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const postController = require("../controllers/post-controller");
const authController = require("../controllers/auth-controller");
const { uploadImage } = require('../controllers/upload-controller')
const { sendOtp, verifyOtpAndRegister, getProfile, followUser, unfollowUser, reportUser, getFollowersWithMutuals, getFollowingWithMutuals, getFollowersList, getFollowingList, getSuggestedUsers } = require("../controllers/auth-controller");
const { getNotifications, markAllAsRead } = require('../controllers/notification-controller')




const multer = require('multer')
const storage = multer.memoryStorage();
const upload = multer({ storage });


router.post("/register", authController.register);
router.post("/login", authController.login);


router.post("/send-update-email-otp", verifyToken, authController.sendUpdateEmailOtp);
router.post("/verify-update-email", verifyToken, authController.verifyUpdateEmail);
router.post("/request-password-reset", verifyToken, authController.requestPasswordReset);
router.post("/update-password", authController.updatePassword);



router.post("/post", postController.createPost);
router.post("/post", verifyToken, postController.createPost);
router.get("/profile", verifyToken, getProfile);
router.post("/update-profile", verifyToken, authController.updateProfile);

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtpAndRegister);
router.get("/username/:username", authController.getUserByUsername);
router.get("/:username/followers", verifyToken, getFollowersList);
router.get("/:username/following", verifyToken, getFollowingList);
router.get("/:id/followers", verifyToken, getFollowersWithMutuals);
router.get("/:id/following", verifyToken, getFollowingWithMutuals);
router.get("/notifications", verifyToken, getNotifications);
router.post("/contact", verifyToken, authController.submitComplaint);
router.put("/mark-read", verifyToken, markAllAsRead);
router.get("/suggestions/:userId", getSuggestedUsers);
router.post("/upload", upload.single("file"), uploadImage);
router.post("/upload", verifyToken, upload.single("file"), uploadImage);
router.post("/follow/:id", verifyToken, followUser);
router.post("/unfollow/:id", verifyToken, unfollowUser);
router.post("/report/:id", verifyToken, reportUser);






module.exports = router;
