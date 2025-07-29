const Message = require("../models/Message");
const User = require('../models/User');

const saveMessage = async ({ from, to, message }) => {
  return await Message.create({ from, to, message });
};

const getMessagesBetweenUsers = async (req, res) => {
  const { userId } = req.user;
  const { otherUserId } = req.params;

  try {
    const messages = await Message.find({
      $or: [
        { from: userId, to: otherUserId },
        { from: otherUserId, to: userId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json({ messages });
  } catch (err) {
    console.error("Error getting messages:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const markMessagesAsSeen = async ({ from, to }) => {
  await Message.updateMany(
    { from, to, seen: false },
    { $set: { seen: true } }
  );
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

    // res.status(200).json({ messages, userId: otherUser._id });
    res.status(200).json({
      messages,
      userId: otherUser._id,
      chatWithUser: {
        username: otherUser.username,
        name: otherUser.name,
        profileImageURL: otherUser.profileImageURL,
        isVerified: otherUser.isVerified,
      }
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const getChatUsers = async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const messages = await Message.find({
      $or: [{ from: currentUserId }, { to: currentUserId }],
    });

    const userIdsSet = new Set();

    messages.forEach((msg) => {
      if (msg.from.toString() !== currentUserId) userIdsSet.add(msg.from.toString());
      if (msg.to.toString() !== currentUserId) userIdsSet.add(msg.to.toString());
    });

    const users = await User.find({ _id: { $in: [...userIdsSet] } }).select("username name profileImageURL isVerified");

    res.status(200).json({ users });
  } catch (err) {
    console.error("Error getting chat users:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const getUnseenMessagesCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const unseenCount = await Message.countDocuments({
      to: userId,
      seen: false,
    });

    res.status(200).json({ unseenCount });
  } catch (err) {
    console.error("Error fetching unseen messages:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const getChatUsersWithUnseen = async (req, res) => {
  const currentUserId = req.user.id;

  try {
    const messages = await Message.find({
      $or: [{ from: currentUserId }, { to: currentUserId }],
    }).sort({ createdAt: -1 });

    const userMap = new Map();

    for (const msg of messages) {
      const otherUserId =
        msg.from.toString() === currentUserId
          ? msg.to.toString()
          : msg.from.toString();

      if (!userMap.has(otherUserId)) {
        userMap.set(otherUserId, msg.createdAt);
      }
    }

    const users = await User.find({ _id: { $in: [...userMap.keys()] } }).select(
      "_id username name profileImageURL isVerified"
    );

    const usersWithTimestamps = users.map((user) => ({
      ...user.toObject(),
      lastMessageTime: userMap.get(user._id.toString()),
    }));

    const usersWithUnseen = await Promise.all(
      usersWithTimestamps.map(async (user) => {
        const unseenCount = await Message.countDocuments({
          from: user._id,
          to: currentUserId,
          seen: false,
        });
        return { ...user, hasUnseen: unseenCount > 0 };
      })
    );

    // 🔽 Sort users by most recent message time
    usersWithUnseen.sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );

    res.status(200).json({ users: usersWithUnseen });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


const searchUsernames = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(200).json([]);

    const users = await User.find({
      username: { $regex: `^${query}`, $options: "i" }
    }).limit(10).select("_id username profileImageURL");

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to search users", details: err.message });
    console.log(err.message);

  }
};



module.exports = {
  saveMessage,
  getMessagesBetweenUsers,
  markMessagesAsSeen,
  getMessagesByUsername,
  getChatUsers,
  getUnseenMessagesCount,
  getChatUsersWithUnseen,
  searchUsernames,
};
