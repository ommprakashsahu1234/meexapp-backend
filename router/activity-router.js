const express = require("express");
const router = express.Router();
const { getUserActivities } = require("../controllers/activity-controller");
const verifyToken = require("../middleware/verifyToken");

router.get("/activities", verifyToken, getUserActivities);

module.exports = router;
