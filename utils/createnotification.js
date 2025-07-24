const Notification = require('../models/Notification')


const createNotification = async ({ userId, fromUserId, type, postId = null, message = "" }) => {
  if (userId.toString() === fromUserId?.toString()) return; 

  await Notification.create({
    userId,
    fromUserId,
    type,
    postId,
    message,
    isRead: false,
    isGot: false,
  });
};


module.exports = createNotification;