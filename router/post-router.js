const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { createPost, searchUsernames, getPostsByUser, likePost, deletePost, getPostById, getOwnPosts } = require("../controllers/post-controller");
const { unlikePost, getPostComments, addPostComment, getCommentCount, getPostLike, getFeedPosts, reportPost } = require("../controllers/post-controller");
const { uploadImage } = require("../controllers/upload-controller");
const { getTotalPostViews, getPostViewCount, recordViewOnPost } = require('../controllers/postview-controller')
const { updatePostCaptionVisibility } = require('../controllers/post-controller')


const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/create", verifyToken, upload.single("media"), createPost);
router.get("/search-usernames", verifyToken, searchUsernames);
router.get("/feed", verifyToken, getFeedPosts);
router.post("/upload", verifyToken, upload.single("media"), uploadImage);
router.post("/report-post", verifyToken, reportPost);

router.get("/user/:userId", verifyToken, getPostsByUser);
router.get("/self/:userId", verifyToken, getOwnPosts);
router.delete("/deletepost/:id", verifyToken, deletePost);
router.get("/total-post-views/:userId", verifyToken, getTotalPostViews);


router.post("/:id/like", verifyToken, likePost);
router.post("/:id/unlike", verifyToken, unlikePost);
router.post("/:id/comment", verifyToken, addPostComment);
router.get("/:id/comments", verifyToken, getPostComments);
router.get("/:id/comments/count", verifyToken, getCommentCount);
router.get("/:id/likes", verifyToken, getPostLike);
router.get("/:id/viewcount", verifyToken, getPostViewCount);
router.post("/:id/record-view", verifyToken, recordViewOnPost);
router.put("/:id/edit", verifyToken, updatePostCaptionVisibility);

router.get("/:id", verifyToken, getPostById);


module.exports = router;
