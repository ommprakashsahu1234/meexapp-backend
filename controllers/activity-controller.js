const Activity = require("../models/ActivityLog");
const User = require("../models/User");
const Post = require("../models/Post");

const getUserActivities = async (req, res) => {
  try {
    const userId = req.user.id;

    const activities = await Activity.find({ userId })
      .sort({ timestamp: -1 })
      .lean();

    const postIds = [];
    const userIds = [];

    activities.forEach((act) => {
      if (["comment", "like", "report_post"].includes(act.action)) {
        if (act.meta?.postId) postIds.push(act.meta.postId);
      }
      if (["report_user"].includes(act.action)) {
        if (act.meta?.reportedUserId) userIds.push(act.meta.reportedUserId);
      }
    });

    const posts = await Post.find({ _id: { $in: postIds } })
      .populate("authorId", "username")
      .lean();

    const users = await User.find({ _id: { $in: userIds } })
      .select("username")
      .lean();

    const postMap = {};
    posts.forEach((p) => (postMap[p._id.toString()] = p));
    const userMap = {};
    users.forEach((u) => (userMap[u._id.toString()] = u));

    const formatted = activities.map((act) => {
      let description = "";

      if (act.action === "comment") {
        const post = postMap[act.meta?.postId];
        description = post
          ? `Commented on @${post.authorId?.username}'s post`
          : "Commented on a post";
      } else if (act.action === "like") {
        const post = postMap[act.meta?.postId];
        description = post
          ? `Liked @${post.authorId?.username}'s post`
          : "Liked a post";
      } else if (act.action === "report_post") {
        const post = postMap[act.meta?.postId];
        description = post
          ? `Reported @${post.authorId?.username}'s post`
          : "Reported a post";
      } else if (act.action === "report_user") {
        const user = userMap[act.meta?.reportedUserId];
        description = user
          ? `Reported @${user.username}'s account`
          : "Reported a user";
      } else if (act.action === "post") {
        description = "Created a new post";
      } else if (act.action === "register") {
        description = "Account Created";
      }
      else if (act.action === "update_profile") {
        description = "Profile Updated";
      }
      else if (act.action === "delete_post") {
        description = "Deleted a Post";
      }
      else if (act.action === "delete_account") {
        description = "Deleted Account";
      }
      else if (act.action === "unlike") {
        description = "Unliked a Post";
      }
      else if (act.action === "update_post") {
        description = "Updated Post Details";
      }
      else if (act.action === "login") {
        description = "Logged In";
      }

      return {
        description,
        time: act.timestamp,
      };
    });

    res.status(200).json({ activities: formatted });
  } catch (err) {
    console.error("🔥 Error getting activities:", err);
    res.status(500).json({ message: "Failed to load activities" });
  }
};

module.exports = { getUserActivities };
