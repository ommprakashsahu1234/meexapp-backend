const Post = require('../models/Post');
const Postview = require('../models/PostView');
const jwt = require('jsonwebtoken');
const User = require('../models/User')
const Like = require("../models/Like");
const Comment = require('../models/Comment')
const createNotification = require('../utils/createnotification')
const Activity = require('../models/ActivityLog')
const recordPostView = require('../utils/recordPostView');
const ReportPost = require('../models/ReportPost');
const Notification = require('../models/Notification')

const imagekit = require('../utils/imagekit')

const createPost = async (req, res) => {
  try {
    const { caption, tags, location, visibility, mediaType, mediaURL, fileId } = req.body;
    const userId = req.user.id;

    const newPost = new Post({
      authorId: userId,
      caption,
      location,
      visibility,
      media: [{
        type: mediaType,
        url: mediaURL,
        fileId
      }],
      suspended: false,
      tags: JSON.parse(tags),
    });

    await newPost.save();
    await Activity.create({
      userId: userId,
      action: "post",
      meta: {
        Post: `${newPost._id}`
      },
    });
    res.status(201).json({ message: "Post created successfully", post: newPost });
  } catch (error) {
    res.status(500).json({ message: "Error creating post", error: error.message });
  }
};

const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find({
      $or: [
        { suspended: { $exists: false } },
        { suspended: false }
      ]
    }).sort({ createdAt: -1 });

    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching posts', error: error.message });
  }
};

const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("authorId", "username profileImageURL")
      .populate("tags", "username profileImageURL");

    if (!post) return res.status(404).json({ message: 'Post not found' });

    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving post', error: error.message });
  }
};


const searchUsernames = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(200).json([]);

    const users = await User.find({
      username: { $regex: `^${query}`, $options: "i" },
      $or: [
        { "isbanned.banned": { $exists: false } },
        { "isbanned.banned": false }
      ]
    })
      .limit(10)
      .select("_id username");


    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to search users", details: err.message });
    console.log(err.message);

  }
};

const getPostsByUser = async (req, res) => {
  const profileUserId = req.params.userId;
  const viewerId = req.user.id;

  try {
    const [profileUser, viewer] = await Promise.all([
      User.findById(profileUserId),
      User.findById(viewerId)
    ]);

    if (!profileUser || !viewer) {
      return res.status(404).json({ message: "User not found" });
    }

    const isSelf = profileUserId === viewerId;
    const isFollowing = profileUser.followers.some(f => f.toString() === viewerId.toString());


    const posts = await Post.find({
      authorId: profileUserId,
      $or: [
        { suspended: { $exists: false } },
        { suspended: false }
      ]
    })
      .populate('authorId', 'username profileImageURL')
      .populate('tags', 'username profileImageURL')
      .sort({ createdAt: -1 });

    const filtered = posts.filter(post => {
      if (post.visibility === "public") return true;
      if (post.visibility === "followers" && isFollowing) return true;
      if (post.visibility === "private" && isSelf) return true;
      return false;
    });


    res.status(200).json({
      posts: filtered,
      user: {
        username: profileUser.username,
        profileImageURL: profileUser.profileImageURL
      }
    });

  } catch (err) {
    console.error("Error in getPostsByUser:", err);
    res.status(500).json({
      message: "Error fetching posts",
      error: err.message
    });
  }
};

const getOwnPosts = async (req, res) => {
  const profileUserId = req.params.userId;
  const viewerId = req.user.id;

  try {
    const [profileUser, viewer] = await Promise.all([
      User.findById(profileUserId),
      User.findById(viewerId)
    ]);

    if (!profileUser || !viewer) {
      return res.status(404).json({ message: "User not found" });
    }
    const posts = await Post.find({
      authorId: profileUserId, $or: [
        { suspended: { $exists: false } },
        { suspended: false }
      ]
    })
      .populate('authorId', 'username profileImageURL')
      .populate('tags', 'username profileImageURL')
      .sort({ createdAt: -1 });

    const isSelf = profileUserId.toString() === viewerId.toString();
    const isFollowing = profileUser.followers.some(f => f.toString() === viewerId.toString());
    const filtered = posts.filter(post => {
      const visibility = post.visibility || "public";
      if (visibility === "public") return true;
      if (visibility === "followers" && (isSelf || isFollowing)) return true;
      if (visibility === "private" && isSelf) return true;
      return false;
    });
    res.status(200).json({
      posts: filtered,
      user: {
        username: profileUser.username,
        profileImageURL: profileUser.profileImageURL
      }
    });

  } catch (err) {
    console.error("Error in getOwnPosts:", err);
    res.status(500).json({
      message: "Error fetching posts",
      error: err.message
    });
  }
};


const likePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    const post = await Post.findById(postId).select("authorId");
    if (!post) return res.status(404).json({ message: "Post not found" });
    const likedPostUserId = post.authorId;
    const alreadyLiked = await Like.findOne({ postId, userId });
    if (alreadyLiked) {
      return res.status(400).json({ message: "Already liked" });
    }

    await Like.create({ postId, userId });
    await recordPostView(userId, postId);

    res.status(200).json({ message: "Post liked" });

    await createNotification({
      userId: likedPostUserId,
      fromUserId: userId,
      type: "like",
      postId,
    });

    await Activity.create({
      userId: userId,
      action: "like",
      meta: {
        likedPost: postId
      },
    });

  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ message: "Error liking post", error: error.message });
  }
};


const unlikePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    await Like.findOneAndDelete({ postId, userId });

    await Activity.create({
      userId: userId,
      action: "unlike",
      meta: {
        unlikedPost: postId
      },
    });
    res.status(200).json({ message: "Post unliked" });
  } catch (error) {
    res.status(500).json({ message: "Error unliking post", error: error.message });
  }
};


const getPostComments = async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.id })
      .sort({ createdAt: -1 })
      .populate("userId", "username profileImageURL isVerified")
      .lean();

    const formatted = comments.map((c) => ({
      _id: c._id,
      text: c.text,
      createdAt: c.createdAt,
      user: {
        _id: c.userId._id,
        username: c.userId.username,
        profileImageURL: c.userId.profileImageURL,
        isVerified: c.userId.isVerified,
      },
    }));


    res.status(200).json({ comments: formatted });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch comments", error: error.message });
  }
};

const addPostComment = async (req, res) => {
  try {
    const { text } = req.body;
    const postId = req.params.id;
    const userId = req.user.id;

    if (!text?.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }



    const newComment = new Comment({
      postId,
      userId,
      text,
    });

    await newComment.save();
    await recordPostView(userId, postId);
    const user = await User.findById(userId).select("username profileImageURL isVerified");

    const post = await Post.findById(postId).select("authorId");
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    const PostUserId = post.authorId;
    await createNotification({
      userId: PostUserId,
      fromUserId: userId,
      type: "comment",
      message: text,
      postId,
    });

    await Activity.create({
      userId: user._id,
      action: "comment",
      meta: {
        commentedOn: post._id,
        comment: text
      },
    });

    res.status(201).json({
      message: "Comment added",
      comment: {
        _id: newComment._id,
        text: newComment.text,
        createdAt: newComment.createdAt,
        user: {
          _id: user._id,
          username: user.username,
          profileImageURL: user.profileImageURL,
          isVerified: user.isVerified,
        }
        ,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add comment", error: error.message });
  }
};

const getPostLike = async (req, res) => {
  try {
    const likes = await Like.find({ postId: req.params.id })
      .sort({ likedAt: -1 })
      .populate("userId", "username profileImageURL isVerified")
      .lean();

    const formatted = likes.map((l) => ({
      _id: l._id,
      likedAt: l.likedAt,
      user: {
        _id: l.userId._id,
        username: l.userId.username,
        profileImageURL: l.userId.profileImageURL,
        isVerified: l.userId.isVerified,
      },
    }));


    res.status(200).json({ likes: formatted });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch likes", error: error.message });
  }
};


const getCommentCount = async (req, res) => {
  try {
    const count = await Comment.countDocuments({ postId: req.params.id });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: "Error getting comment count", error });
  }
};

const deletePost = async (req, res) => {
  try {
    if (req.user.demo) {
      return res.status(500).json({ message: "Demo Users Cannot do this action." });
    }
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    if (post.authorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to delete this post' });
    }
    try {
      await Promise.all(post.media.map(async (mediaItem) => {
        if (mediaItem?.fileId) {
          await imagekit.deleteFile(mediaItem.fileId);
        }
      }));
    } catch (imgErr) {
      console.error("ImageKit delete error:", imgErr);
    }

    await Activity.create({
      userId: req.user.id,
      action: "delete_post",
      meta: {
        deletedPost: post._id
      },
    });
    await Promise.all([
      Comment.deleteMany({ postId: post._id }),
      Like.deleteMany({ postId: post._id }),
      Postview.deleteMany({ postId: post._id }),
      Notification.deleteMany({ postId: post._id }),
      ReportPost.deleteMany({ postId: post._id })
    ]);

    await Post.findByIdAndDelete(post._id);


    res.status(200).json({ message: "Post deleted successfully" });

  } catch (error) {
    console.error("🔥 Delete post failed:", error);
    res.status(500).json({ message: "Error deleting post", error: error.message });
  }
};


const getFeedPosts = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("following");
    if (!user) return res.status(404).json({ message: "User not found" });

    const userFollowing = user.following.map(id => id.toString());

    const allPosts = await Post.find({
      $or: [
        { suspended: { $exists: false } },
        { suspended: false }
      ]
    })
      .populate("authorId", "username profileImageURL isVerified")
      .populate("tags", "username")
      .sort({ createdAt: -1 });

    const viewedPostIds = await Postview.find({ userId }).distinct("postId");

    const unviewed = allPosts.filter((post) => {
      const isViewed = viewedPostIds.includes(post._id.toString());
      if (isViewed) return false;

      if (post.visibility === "public") return true;
      if (post.visibility === "followers") {
        return userFollowing.includes(post.authorId._id.toString());
      }
      return false;
    });

    const viewed = allPosts.filter((post) => {
      const isViewed = viewedPostIds.includes(post._id.toString());
      if (!isViewed) return false;

      if (post.visibility === "public") return true;
      if (post.visibility === "followers") {
        return userFollowing.includes(post.authorId._id.toString());
      }
      return false;
    });

    for (let i = unviewed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unviewed[i], unviewed[j]] = [unviewed[j], unviewed[i]];
    }

    const allVisiblePosts = [...unviewed, ...viewed];
    const postIds = allVisiblePosts.map(post => post._id);

    const commentCounts = await Comment.aggregate([
      { $match: { postId: { $in: postIds } } },
      { $group: { _id: "$postId", count: { $sum: 1 } } }
    ]);
    const commentCountMap = {};
    commentCounts.forEach(c => {
      commentCountMap[c._id.toString()] = c.count;
    });

    const attachCommentCounts = (posts) =>
      posts.map(p => {
        const count = commentCountMap[p._id.toString()] || 0;
        return {
          ...p.toObject(),
          commentCount: count
        };
      });

    res.status(200).json({
      unviewed: attachCommentCounts(unviewed),
      viewed: attachCommentCounts(viewed)
    });

  } catch (err) {
    console.error("🔥 Error in getFeedPosts:", err);
    res.status(500).json({ message: "Failed to load feed", error: err.message });
  }
};

const reportPost = async (req, res) => {
  try {
    if (req.user.demo) {
      return res.status(500).json({ message: "Demo Users Cannot do this action." });
    }
    const { postId, message } = req.body;
    const reporterId = req.user.id;

    if (!postId || !message) {
      return res.status(400).json({ message: "Post ID and message are required." });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }
    const alreadyReported = await ReportPost.findOne({ reporterId, postId });
    if (alreadyReported) {
      return res.status(400).json({ message: "You have already reported this post." });
    }

    const report = new ReportPost({
      reporterId,
      postId,
      message
    });

    await report.save();

    await Activity.create({
      userId: reporterId,
      action: "report_post",
      meta: {
        reportedPost: postId
      },
    });
    res.status(201).json({ message: "Post reported successfully." });

  } catch (err) {
    console.error("Error reporting post:", err);
    res.status(500).json({ message: "Failed to report post." });
  }
};


const updatePostCaptionVisibility = async (req, res) => {
  try {
    if (req.user.demo) {
      return res.status(500).json({ message: "Demo Users Cannot do this action." });
    }
    const { id } = req.params;
    const { caption, visibility } = req.body;

    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.authorId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized to edit this post" });
    }

    post.caption = caption || post.caption;
    post.visibility = visibility || post.visibility;

    await post.save();

    await Activity.create({
      userId: post.authorId,
      action: "update_post",
      meta: {
        updatedPost: post._id
      },
    });

    res.status(200).json({ message: "Post updated successfully" });
  } catch (err) {
    console.error("Update post error:", err);
    res.status(500).json({ message: "Failed to update post", error: err.message });
  }
};


module.exports = {
  createPost,
  searchUsernames,
  getAllPosts,
  getPostById,
  deletePost,
  getPostsByUser,
  likePost,
  unlikePost,
  getPostComments,
  addPostComment,
  getCommentCount,
  getPostLike,
  getOwnPosts,
  getFeedPosts,
  reportPost,
  updatePostCaptionVisibility,
};
