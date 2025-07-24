const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ReportUser = require('../models/ReportUser')
const Activity = require('../models/ActivityLog')
const nodemailer = require('nodemailer')
const crypto = require("crypto");
const passwordResetTokens = {};
const createNotification = require('../utils/createnotification')
const Complaint = require("../models/Complaint");


const otpMap = new Map();
const otpStore = {};
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});



const login = async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (user.isbanned?.banned) {
    return res.status(403).json({
      message: `You are banned: Reason - ${user.isbanned.reason || "No reason provided"}. Try contacting support.`,
    });
  }

  const token = jwt.sign(
    {
      id: user._id,
      username: user.username,
      demo: user.demo
    },
    process.env.JWT_SECRET,
    { expiresIn: "5d" }
  );

  await Activity.create({
    userId: user._id,
    action: "login",
    meta: {},
  });

  res.status(200).json({ token, user });
};



const register = async (req, res) => {
  const { username, email, password } = req.body;

  const newUser = new User({ username, email, password });
  await newUser.save();

  const token = jwt.sign(
    { id: newUser._id, username: newUser.username },
    process.env.JWT_SECRET,
    { expiresIn: "10d" }
  );

  await Activity.create({
    userId: newUser._id,
    action: "register",
    meta: {}
  });
  res.status(201).json({ token, user: newUser });
};

const sendOtp = async (req, res) => {
  const { email, username, mobile } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (await User.findOne({ email: normalizedEmail })) {
    return res.status(400).json({ message: "email" });
  }
  if (await User.findOne({ username: { $regex: `^${username}$`, $options: "i" } })) {
    return res.status(400).json({ message: "username" });
  }
  if (await User.findOne({ mobile })) {
    return res.status(400).json({ message: "mobile" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[email.toLowerCase()] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: email,
    subject: "MeetX Registration",
    html: `
    <div style="font-family: Arial, sans-serif; text-align: center;">
      <img src="https://ik.imagekit.io/ommprakashsahu/logo.png?updatedAt=1752065287771" alt="MeetX Logo" width="40" style="margin-bottom: 10px;" />
      <h2><strong>MeetX Registration</strong></h2>
      <p>Your OTP for MeetX User Registration is:</p>
      <h2><strong>${otp}</strong></h2>
    </div>
  `,
  });


  return res.json({ success: true });
};


const normalizeEmail = (email) => {
  const [local, domain] = email.toLowerCase().split("@");
  const cleanLocal = domain === "gmail.com"
    ? local.replace(/\+.*$/, "").replace(/\./g, "")
    : local;
  return `${cleanLocal}@${domain}`;
};

const verifyOtpAndRegister = async (req, res) => {
  const {
    otp, email, name, username, password,
    mobile, gender, website, demo, profileImageURL, interests, location
  } = req.body;

  const stored = otpStore[email.toLowerCase()];
  if (!stored || stored.otp !== otp || stored.expiresAt < Date.now()) {
    return res.status(401).json({ message: "Invalid or expired OTP" });
  }

  const normalizedEmail = normalizeEmail(email);

  if (await User.findOne({ email: normalizedEmail })) {
    return res.status(400).json({ message: "Email already exists" });
  }
  if (await User.findOne({ username: { $regex: `^${username}$`, $options: "i" } })) {
    return res.status(400).json({ message: "Username already exists" });
  }
  if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ message: "Mobile must be exactly 10 digits" });
  }
  if (await User.findOne({ mobile })) {
    return res.status(400).json({ message: "Mobile already exists" });
  }

  const newUser = new User({
    name,
    username,
    password,
    email: normalizedEmail,
    mobile,
    gender,
    location,
    bio: "",
    website,
    demo,
    profileImageURL,
    isVerified: false,
    interests,
  });

  await newUser.save();
  delete otpStore[email.toLowerCase()];

  const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "10d" });

  res.status(201).json({ token, user: newUser });
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


const getUserByUsername = async (req, res) => {
  try {
    const usernameParam = req.params.username;

    const user = await User.findOne({
      username: { $regex: `^${usernameParam}$`, $options: "i" },
    }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const followUser = async (req, res) => {
  const followerId = req.user.id;
  const followedId = req.params.id;

  if (followerId === followedId)
    return res.status(400).json({ message: "You can't follow yourself" });

  await User.findByIdAndUpdate(followerId, { $addToSet: { following: followedId } });
  await User.findByIdAndUpdate(followedId, { $addToSet: { followers: followerId } });

  res.status(200).json({ message: "Followed" });

  await createNotification({
    userId: followedId,
    fromUserId: followerId,
    type: "follow",
  });


};

const unfollowUser = async (req, res) => {
  const followerId = req.user.id;
  const unfollowedId = req.params.id;

  await User.findByIdAndUpdate(followerId, { $pull: { following: unfollowedId } });
  await User.findByIdAndUpdate(unfollowedId, { $pull: { followers: followerId } });
  res.status(200).json({ message: "Unfollowed" });
};


const reportUser = async (req, res) => {
  const reporterId = req.user.id;
  const reportedId = req.params.id;
  const { message } = req.body;

  if (req.user.demo) {
    return res.status(500).json({ message: "Demo Users Cannot do this action." });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ message: "Please provide a reason for reporting." });
  }

  const existing = await ReportUser.findOne({ reporterId, reportedId });
  if (existing) {
    return res.status(400).json({ message: "You have already reported this user." });
  }

  const report = new ReportUser({
    reporterId,
    reportedId,
    message: message.trim(),
  });
  await report.save();
  res.status(201).json({ message: "Report submitted successfully. Our moderators will review the report." });


  await createNotification({
    userId: reporterId,
    fromUserId: null,
    type: "action",
    message: "We have received your report. Our moderators will review and respond shortly."
  });

  await Activity.create({
    userId: reporterId,
    action: "report_user",
    meta: {
      reportedId: reportedId
    }
  });

  console.log("Current user in reportUser:", req.user);


};


const getFollowersWithMutuals = async (req, res) => {
  const { id } = req.params;
  const loggedInUserId = req.user.id;

  try {
    const targetUser = await User.findById(id).populate("followers", "username profileImageURL followers");
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    const followersList = targetUser.followers.map(follower => {
      const isMutual = follower.followers.includes(loggedInUserId);
      return {
        _id: follower._id,
        username: follower.username,
        profileImageURL: follower.profileImageURL,
        isMutual,
      };
    });

    followersList.sort((a, b) => b.isMutual - a.isMutual);

    res.status(200).json(followersList);
  } catch (err) {
    res.status(500).json({ message: "Failed to get followers", error: err.message });
  }
};

const getFollowersList = async (req, res) => {
  try {
    const { username } = req.params;
    const loggedInUserId = req.user.id;

    const user = await User.findOne({ username }).populate("followers", "_id username profileImageURL isVerified");

    if (!user) return res.status(404).json({ message: "User not found" });

    const followers = user.followers;
    const currentUser = await User.findById(loggedInUserId).select("following");
    const currentFollowingSet = new Set(currentUser.following.map(id => id.toString()));

    const sortedFollowers = followers
      .map((follower) => ({
        ...follower._doc,
        isMutual: currentFollowingSet.has(follower._id.toString()),
      }))
      .sort((a, b) => {
        if (a.isMutual && !b.isMutual) return -1;
        if (!a.isMutual && b.isMutual) return 1;
        return 0;
      });

    res.status(200).json(sortedFollowers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch followers", error: error.message });
  }
};

const getFollowingList = async (req, res) => {
  try {
    const { username } = req.params;
    const loggedInUserId = req.user.id;

    const user = await User.findOne({ username }).populate(
      "following",
      "_id username profileImageURL isVerified"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    const following = user.following;

    const currentUser = await User.findById(loggedInUserId).select("following");
    const currentFollowingSet = new Set(
      currentUser.following.map((id) => id.toString())
    );

    const sortedFollowing = following
      .map((followee) => ({
        ...followee._doc,
        isMutual: currentFollowingSet.has(followee._id.toString()),
      }))
      .sort((a, b) => {
        if (a.isMutual && !b.isMutual) return -1;
        if (!a.isMutual && b.isMutual) return 1;
        return 0;
      });

    res.status(200).json(sortedFollowing);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch following", error: error.message });
  }
};

const getFollowingWithMutuals = async (req, res) => {
  const { id } = req.params;
  const loggedInUserId = req.user.id;

  try {
    const targetUser = await User.findById(id).populate({
      path: "following",
      select: "username profileImageURL followers",
      populate: {
        path: "followers",
        select: "_id",
      },
    });

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const followingList = targetUser.following.map((followee) => {
      const isMutual = followee.followers.some(
        (follower) => follower._id.toString() === loggedInUserId
      );
      return {
        _id: followee._id,
        username: followee.username,
        profileImageURL: followee.profileImageURL,
        isMutual,
      };
    });

    followingList.sort((a, b) => b.isMutual - a.isMutual);

    res.status(200).json(followingList);
  } catch (err) {
    res.status(500).json({
      message: "Failed to get following list",
      error: err.message,
    });
  }
};


const sendUpdateEmailOtp = async (req, res) => {
  const { oldEmail, newEmail } = req.body;

  const existing = await User.findOne({ email: newEmail });
  if (existing) {
    return res.status(400).json({ message: "Email already exists." });
  }

  const normalize = (email) => {
    const [local, domain] = email.toLowerCase().split("@");
    const cleanLocal = domain === "gmail.com"
      ? local.replace(/\+.*$/, "").replace(/\./g, "")
      : local;
    return `${cleanLocal}@${domain}`;
  };

  const normalizedOld = normalize(oldEmail);
  const normalizedNew = normalize(newEmail);

  if (normalizedOld === normalizedNew) {
    return res.status(400).json({ message: "New email must be different from current email." });
  }

  const otpOld = Math.floor(100000 + Math.random() * 900000).toString();
  const otpNew = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[normalizedOld] = {
    otp: otpOld,
    expiresAt: Date.now() + 5 * 60 * 1000
  };
  otpStore[normalizedNew] = {
    otp: otpNew,
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: normalizedOld,
    subject: "MeetX Email Update",
    html: `
    <div style="font-family: Arial, sans-serif; text-align: center;">
      <img src="https://ik.imagekit.io/ommprakashsahu/logo.png?updatedAt=1752065287771" alt="MeetX Logo" width="40" style="margin-bottom: 10px;" />
      <h2><strong>MeetX Email Update</strong></h2>
      <p>Your OTP for MeetX Email Update is : (Old Email)</p>
      <h2><strong>${otpOld}</strong></h2>
    </div>
  `
  });

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: normalizedNew,
    subject: "MeetX Email Update",
    html: `
    <div style="font-family: Arial, sans-serif; text-align: center;">
      <img src="https://ik.imagekit.io/ommprakashsahu/logo.png?updatedAt=1752065287771" alt="MeetX Logo" width="40" style="margin-bottom: 10px;" />
      <h2><strong>MeetX Email Update</strong></h2>
      <p>Your OTP for MeetX Email Update is : (New Email)</p>
      <h2><strong>${otpNew}</strong></h2>
    </div>
  `
  });

  res.json({ message: "OTP sent to both emails." });
};


const verifyUpdateEmail = async (req, res) => {
  try {
    if (req.user.demo) {
      return res.status(500).json({ message: "Demo Users Cannot do this action." });
    }
    const { oldEmail, newEmail, otpOld, otpNew } = req.body;

    const normalize = (email) => {
      const [local, domain] = email.toLowerCase().split("@");
      const cleanLocal = domain === "gmail.com"
        ? local.replace(/\+.*$/, "").replace(/\./g, "")
        : local;
      return `${cleanLocal}@${domain}`;
    };

    const normalizedOld = normalize(oldEmail);
    const normalizedNew = normalize(newEmail);

    const storedOld = otpStore[normalizedOld];
    const storedNew = otpStore[normalizedNew];

    if (!storedOld || !storedNew) {
      return res.status(400).json({ message: "OTPs not found or expired." });
    }

    if (
      storedOld.otp !== otpOld ||
      storedNew.otp !== otpNew ||
      storedOld.expiresAt < Date.now() ||
      storedNew.expiresAt < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTPs." });
    }

    const user = await User.findOne({ email: normalizedOld });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const existing = await User.findOne({ email: normalizedNew });
    if (existing) {
      return res.status(400).json({ message: "New email is already in use." });
    }

    user.email = normalizedNew;
    await user.save();

    await Activity.create({
      userId: User._id,
      action: "update_profile",
      meta: {
        msg: "Email Update"
      }
    });

    delete otpStore[normalizedOld];
    delete otpStore[normalizedNew];

    res.json({ message: "Email updated successfully." });
  }
  catch (err) {
    res.status(500).json({ message: err })
  }
};




const requestPasswordReset = async (req, res) => {
  try {

    if (req.user.demo) {
      return res.status(500).json({ message: "Demo Users Cannot do this action." });
    }
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const token = crypto.randomBytes(12).toString("hex");
    passwordResetTokens[token] = {
      userId: user._id.toString(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: user.email,
      subject: "MeetX Password Update",
      html: `
    <div style="font-family: Arial, sans-serif; text-align: center;">
      <img src="https://ik.imagekit.io/ommprakashsahu/logo.png?updatedAt=1752065287771" alt="MeetX Logo" width="40" style="margin-bottom: 10px;" />
      <h2><strong>MeetX Password Update</strong></h2>
      <p>Your token for MeetX Password Update is:</p>
      <h2><strong>${token}</strong></h2>
    </div>
  `
    });


    res.status(200).json({ message: "Reset token sent to email." });
  } catch (err) {
    console.error("Password reset error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updatePassword = async (req, res) => {
  const { token, newPassword } = req.body;

  const record = passwordResetTokens[token];
  if (!record) {
    return res.status(400).json({ message: "Invalid or expired token." });
  }

  if (record.expiresAt < Date.now()) {
    delete passwordResetTokens[token];
    return res.status(400).json({ message: "Token expired." });
  }

  const user = await User.findById(record.userId);
  if (!user) return res.status(404).json({ message: "User not found." });

  if (user.demo) {
    return res.status(403).json({ message: "Demo Users Cannot do this action." });
  }

  if (user.password === newPassword) {
    return res.status(400).json({ message: "New password must be different from the old one." });
  }

  user.password = newPassword;
  await user.save();

  await Activity.create({
    userId: user._id,
    action: "update_profile",
    meta: {
      msg: "Password Update"
    }
  });

  delete passwordResetTokens[token];
  res.json({ message: "Password updated successfully." });
};

const updateProfile = async (req, res) => {
  try {

    if (req.user.demo) {
      return res.status(500).json({ message: "Demo Users Cannot do this action." });
    }
    const userId = req.user.id;
    const updates = req.body;

    const allowedFields = ["name", "username", "mobile", "website", "gender", "bio"];
    const filteredUpdates = {};

    for (let key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, filteredUpdates, {
      new: true,
    }).select("-password");

    await Activity.create({
      userId: updatedUser._id,
      action: "update_profile",
      meta: {
        msg: "Profile Update"
      }
    });

    res.status(200).json({ message: "Profile updated", user: updatedUser });
  } catch (err) {
    console.error("🔥 Error updating profile:", err);
    res.status(500).json({ message: "Failed to update profile", error: err.message });
  }
};




const getSuggestedUsers = async (req, res) => {
  const userId = req.params.userId;

  try {
    const currentUser = await User.findById(userId);
    if (!currentUser) return res.status(404).json({ message: "User not found" });

    const allUsers = await User.find({ _id: { $ne: userId } });

    const sort1 = allUsers.filter(u =>
      u.interests?.filter(i => currentUser.interests?.includes(i)).length >= 3
    );

    const sort2 = allUsers.filter(u =>
      u.interests?.filter(i => currentUser.interests?.includes(i)).length === 2
    );

    const sort3 = allUsers.filter(u => u.location === currentUser.location);

    const sort4 = allUsers.filter(u => {
      const mutuals = u.followers?.filter(f => currentUser.followers?.includes(f));
      return mutuals?.length >= 1;
    });

    const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

    const sorts = shuffle([shuffle(sort1), shuffle(sort2), shuffle(sort3), shuffle(sort4)]);
    const randomSortedUsers = sorts.find(s => s.length > 0) || [];

    const result = randomSortedUsers.slice(0, 15).map(user => ({
      _id: user._id,
      username: user.username,
      name: user.name,
      profileImageURL: user.profileImageURL || "",
      isVerified:user.isVerified
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error("Suggestion error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


const submitComplaint = async (req, res) => {
  const { issueType, description } = req.body;
  const userId = req.user.id;

  if (!issueType || !description) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const newComplaint = new Complaint({
      userId,
      issueType,
      description,
    });

    await newComplaint.save();

    res.status(201).json({
      message: "Complaint submitted successfully",
      complaintId: newComplaint._id,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};








module.exports = {
  login,
  register,
  sendOtp,
  verifyOtpAndRegister,
  getProfile,
  getUserByUsername,
  followUser,
  unfollowUser,
  reportUser,
  getFollowersWithMutuals,
  getFollowersList,
  getFollowingList,
  getFollowingWithMutuals,
  updatePassword,
  requestPasswordReset,
  verifyUpdateEmail,
  sendUpdateEmailOtp,
  updateProfile,
  getSuggestedUsers,
  submitComplaint,
};

