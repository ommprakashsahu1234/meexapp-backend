const PostView = require("../models/PostView");

const recordPostView = async (userId, postId) => {
  try {
    const exists = await PostView.findOne({ userId, postId });
    if (!exists) {
      await PostView.create({ userId, postId });
    }
  } catch (err) {
    console.error("Error recording post view:", err.message);
  }
};

module.exports = recordPostView;
