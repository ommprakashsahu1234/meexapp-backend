const Notification = require('../models/Notification');

const createNotification = async ({ userId, fromUserId, type, postId = null }) => {
  if (userId.toString() === fromUserId.toString()) return;

  await Notification.create({
    userId,
    fromUserId,
    type,
    postId: postId || null,
    isRead: false,
    isGot: false,
  });
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const newNotificationsRaw = await Notification.find({ userId, isGot: false })
      .populate("fromUserId", "username profileImageURL isVerified")
      .populate("postId", "_id caption media");

    const oldNotifications = await Notification.find({ userId, isGot: true })
      .populate("fromUserId", "username profileImageURL isVerified")
      .populate("postId", "_id caption media");

    const notifications = [...newNotificationsRaw, ...oldNotifications].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json({
      notifications,
      unreadCount: newNotificationsRaw.length
    });

    if (newNotificationsRaw.length > 0) {
      setTimeout(() => {
        Notification.updateMany(
          { userId, isGot: false },
          { $set: { isGot: true } }
        ).catch(err => console.error("Failed to update isGot:", err));
      }, 500);
    }

  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ message: "Server error" });
  }
};


const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isGot: true, isRead: false },
      { $set: { isRead: true } }
    );
    res.status(200).json({ message: "All marked as read" });
  } catch (err) {
    console.error("Error marking notifications as read:", err);
    res.status(500).json({ message: "Failed to update" });
  }
};

const getMessagesByUsername = async (req, res) => {
  const currentUserId = req.user.id;
  const { username } = req.params;

  try {
    const otherUser = await User.findOne({ username });
    if (!otherUser) return res.status(404).json({ message: "User not found" });

    const messages = await Message.find({
      $or: [
        { from: currentUserId, to: otherUser._id },
        { from: otherUser._id, to: currentUserId }
      ]
    }).sort({ createdAt: 1 });

    res.status(200).json({ messages, userId: otherUser._id });
  } catch (err) {
    console.error("Error fetching messages by username", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  markAllAsRead,
  getMessagesByUsername
};
