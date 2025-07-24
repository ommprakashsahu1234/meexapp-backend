const PostView = require('../models/PostView')

const addPostViewIfNotExists = async (userId, postId) => {
    try {
        const existing = await PostView.findOne({ userId, postId });
        if (!existing) {
            await PostView.create({ userId, postId });
        }
    } catch (error) {
        console.error("Error storing post view:", error);
    }
};


const getTotalPostViews = async (req, res) => {
    const { userId } = req.params;

    try {
        const userPosts = await Post.find({ user: userId }, "_id");
        const postIds = userPosts.map((post) => post._id);
        const totalViews = await PostView.countDocuments({ postId: { $in: postIds } });

        res.status(200).json({ totalViews });
    } catch (error) {
        console.error("Error getting total views:", error);
        res.status(500).json({ message: "Failed to get post views" });
    }
};

const getPostViewCount = async (req, res) => {
    try {
        const { postId } = req.params;
        const distinctViews = await PostView.distinct("userId", { postId });
        res.json({ count: distinctViews.length });
    } catch (err) {
        console.error("View count error", err);
        res.status(500).json({ message: "Failed to get view count" });
    }
};

const recordViewOnPost = async (req, res) => {
    try {
        const userId = req.user.id;
        const postId = req.params.id;

        const exists = await PostView.findOne({ userId, postId });
        if (!exists) {
            await PostView.create({ userId, postId });
        }

        res.status(200).json({ message: "View recorded" });
    } catch (error) {
        console.error("Failed to record view:", error);
        res.status(500).json({ message: "Failed to record view" });
    }
};
module.exports = { addPostViewIfNotExists, getTotalPostViews, getPostViewCount, recordViewOnPost };
