const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const {
    getMessagesByUsername,
    getChatUsersWithUnseen,
    getUnseenMessagesCount,
    searchUsernames,

} = require("../controllers/message-controller");

router.get("/by-username/:username", verifyToken, getMessagesByUsername);
router.get("/chat-users", verifyToken, getChatUsersWithUnseen); // ✅ KEEP THIS ONLY
router.get("/unseen-count", verifyToken, getUnseenMessagesCount);
router.get("/search-usernames", verifyToken, searchUsernames);

module.exports = router;
