const express = require("express");
const router = express.Router();
const verifyAdminToken = require("../middleware/verifyAdminToken");
const { login, register, getAllUsers, banUser, unbanUser,
    getUserByUsername, getReportedPosts, getReportsForPost,
    suspendPost, unsuspendPost, getReportsForUser, getReportedUsers,
    updateComplaint, getAllComplaints,setVerifiedUsersList, toggleUserVerification
    ,notifyAllUsers
} = require('../controllers/admin-controller');

router.post('/login', login)
router.post('/registermeetxadmin', register)
router.get('/getAllUsers', verifyAdminToken, getAllUsers)
router.post('/ban/:userId', verifyAdminToken, banUser);
router.post('/unban/:userId', verifyAdminToken, unbanUser);
router.get("/reported-posts", verifyAdminToken, getReportedPosts);
router.get("/get-reports/:postId", verifyAdminToken, getReportsForPost);
router.get('/username/:username', getUserByUsername)
router.patch("/suspend-post/:postId", verifyAdminToken, suspendPost);
router.patch("/unsuspend-post/:postId", verifyAdminToken, unsuspendPost);
router.get("/reported-users", verifyAdminToken, getReportedUsers);
router.get("/all-complaints", verifyAdminToken, getAllComplaints);  
router.get("/verified-users", verifyAdminToken, setVerifiedUsersList);
router.patch("/toggle-verify/:userId", verifyAdminToken,toggleUserVerification);
router.post("/notifyAllUser", verifyAdminToken, notifyAllUsers);


router.put("/update-complaint/:complaintId", verifyAdminToken, updateComplaint);
router.get("/get-user-reports/:userId", verifyAdminToken, getReportsForUser);




module.exports = router;