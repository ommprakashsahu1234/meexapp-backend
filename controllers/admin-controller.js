const jwt = require("jsonwebtoken");
const Admin = require('../models/Admin');
const nodemailer = require('nodemailer')
const crypto = require("crypto");
const createNotification = require('../utils/createnotification')
const Complaint = require("../models/Complaint");
const User = require('../models/User')
const Post = require('../models/Post')
const ReportPost = require('../models/ReportPost')
const ReportUser = require('../models/ReportUser')


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});



const login = async (req, res) => {
  const { username, password } = req.body;

  const admin = await Admin.findOne({ username });

  if (!admin || admin.password !== password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    {
      id: admin._id,
      username: admin.username,
      demo: admin.demo
    },
    process.env.JWT_SECRET,
    { expiresIn: "5d" }
  );

  res.status(200).json({ token, admin });
};

const register = async (req, res) => {
  try {
    const { username, email, password, mobile, name, gender, addedBy } = req.body;

    if (!username || !email || !password || !mobile || !name) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    const existingAdmin = await Admin.findOne({ $or: [{ email }, { username }] });
    if (existingAdmin) {
      return res.status(409).json({ message: "Admin with same email or username already exists" });
    }

    const newAdmin = new Admin({
      username,
      email,
      password,
      mobile,
      name,
      gender,
      addedBy,
    });

    await newAdmin.save();

    const token = jwt.sign(
      { id: newAdmin._id, username: newAdmin.username },
      process.env.JWT_SECRET,
      { expiresIn: "10d" }
    );

    res.status(201).json({
      message: "Admin registered successfully",
      token,
      admin: {
        id: newAdmin._id,
        username: newAdmin.username,
        email: newAdmin.email,
        name: newAdmin.name,
        gender: newAdmin.gender,
        mobile: newAdmin.mobile,
        addedBy: newAdmin.addedBy,
      },
    });

  } catch (err) {
    console.error("Error registering admin:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
};


const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.status(200).json({ users });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users", error: err });
  }
};

const banUser = async (req, res) => {
  const userId = req.params.userId;
  const { reason } = req.body;

  if (!reason || reason.trim() === "") {
    return res.status(400).json({ message: "Ban reason is required" });
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        isbanned: {
          banned: true,
          reason: reason,
        },
      },
      { new: true }
    );
    if (user) {

      const email = user.email;

      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: email,
        subject: "MeetX Warning",
        html: `
    <div style="font-family: Arial, sans-serif; text-align: center;">
    <img src="https://ik.imagekit.io/ommprakashsahu/logo.png?updatedAt=1752065287771" alt="MeetX Logo" width="40" style="margin-bottom: 10px;" />
    <h2><strong>MeetX Warning</strong></h2>
    <p>You are Banned Because of the Following Reason : ${reason}</p>
    <h5>For Further Informations and Actions , Contact us at <a href="mailto:ommprakashsahu.work@gmail.com">ommprakashsahu.work@gmail.com</a> </h5>
    </div>
    `,
      });
    }
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User banned successfully", user });
  } catch (err) {
    res.status(500).json({ message: "Failed to ban user", error: err });
  }
};


const unbanUser = async (req, res) => {
  const userId = req.params.userId;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        isbanned: {
          banned: false,
          reason: "",
        },
      },
      { new: true }
    );

    if (user) {

      const email = user.email;

      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: email,
        subject: "MeetX Update",
        html: `
    <div style="font-family: Arial, sans-serif; text-align: center;">
    <img src="https://ik.imagekit.io/ommprakashsahu/logo.png?updatedAt=1752065287771" alt="MeetX Logo" width="40" style="margin-bottom: 10px;" />
    <h2><strong>MeetX Update</strong></h2>
    <p>You are Unbanned !<br/>Wish a Happy Exploring.</p>
    <h5>For Further Informations , Contact us at <a href="mailto:ommprakashsahu.work@gmail.com">ommprakashsahu.work@gmail.com</a> </h5>
    </div>
    `,
      });
    }

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User unbanned successfully", user });
  } catch (err) {
    res.status(500).json({ message: "Failed to unban user", error: err });
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


const getReportedPosts = async (req, res) => {
  try {
    const reports = await ReportPost.find()
      .populate({
        path: "postId",
        populate: { path: "tags", select: "username" },
      })
      .lean();

    const postsMap = {};
    const postCounts = {};

    for (const r of reports) {
      if (r.postId) {
        const id = r.postId._id.toString();
        if (!postsMap[id]) {
          postsMap[id] = r.postId;
          postCounts[id] = 1;
        } else {
          postCounts[id]++;
        }
      }
    }

    const uniquePosts = Object.values(postsMap).map((post) => ({
      post,
      count: postCounts[post._id.toString()] || 0,
    }));

    res.json(uniquePosts);
  } catch (err) {
    console.error("Failed to fetch reported posts:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


const getReportsForPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const reports = await ReportPost.find({ postId })
      .populate("reporterId", "username profile profileImageURL")
      .lean();
    const reportsCount = await ReportPost.countDocuments({ postId });
    res.json({ reports, reportsCount });
  } catch (err) {
    console.error("Failed to fetch reports:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


const suspendPost = async (req, res) => {
  const { postId } = req.params;

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.suspended) {
      return res.status(400).json({ message: "Post is already suspended." });
    }

    post.suspended = true;
    await post.save();

    const author = await User.findById(post.authorId);
    if (author) {
      await createNotification({
        userId: author._id,
        fromUserId: null,
        type: "action",
        message: "🚫 Your post has been suspended. Please contact support for more information.",
      });

      const email = author.email;

      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: email,
        subject: "MeetX Warning",
        html: `
    <div style="font-family: Arial, sans-serif; text-align: center;">
    <img src="https://ik.imagekit.io/ommprakashsahu/logo.png?updatedAt=1752065287771" alt="MeetX Logo" width="40" style="margin-bottom: 10px;" />
    <h2><strong>MeetX Warning</strong></h2>
    <p>Your Post has been Banned.</p>
    <h5>For Further Informations and Actions , Contact us at <a href="mailto:ommprakashsahu.work@gmail.com">ommprakashsahu.work@gmail.com</a> </h5>
    </div>
    `,
      });
    }

    res.status(200).json({ message: "✅ Post suspended successfully" });
  } catch (error) {
    console.error("❌ Error suspending post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


const unsuspendPost = async (req, res) => {
  const { postId } = req.params;

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    post.suspended = false;
    await post.save();

    const author = await User.findById(post.authorId);
    if (author) {
      await createNotification({
        userId: author._id,
        fromUserId: null,
        type: "action",
        message: "Your post has been Unsuspended.",
      });



      const email = author.email;

      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: email,
        subject: "MeetX Update",
        html: `
    <div style="font-family: Arial, sans-serif; text-align: center;">
    <img src="https://ik.imagekit.io/ommprakashsahu/logo.png?updatedAt=1752065287771" alt="MeetX Logo" width="40" style="margin-bottom: 10px;" />
    <h2><strong>MeetX Update</strong></h2>
    <p>Your Post has been Unbanned.</p>
    <h5>For Further Informations , Contact us at <a href="mailto:ommprakashsahu.work@gmail.com">ommprakashsahu.work@gmail.com</a> </h5>
    </div>
    `,
      });
    }

    res.json({ message: "Post unsuspended successfully", suspended: false });
  } catch (err) {
    console.error("❌ Error unsuspending post:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};



const getReportedUsers = async (req, res) => {
  try {
    const reports = await ReportUser.find()
      .populate("reportedId", "username profileImageURL profile")
      .lean();

    const userMap = {};

    for (const report of reports) {
      const user = report.reportedId;
      if (!user || !user._id) continue;

      if (!userMap[user._id]) {
        userMap[user._id] = {
          _id: user._id,
          username: user.username,
          profileImageURL: user.profileImageURL,
          profile: user.profile,
          reportCount: 1,
        };
      } else {
        userMap[user._id].reportCount += 1;
      }
    }

    const reportedUsers = Object.values(userMap);
    res.json(reportedUsers);
  } catch (err) {
    console.error("Failed to fetch reported users:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getReportsForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const reports = await ReportUser.find({ reportedId: userId })
      .populate("reporterId", "username profileImageURL")
      .lean();

    res.json({ user, reports });
  } catch (err) {
    console.error("Error fetching reported user:", err);
    res.status(500).json({ error: "Server error" });
  }
};


const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate("userId", "username profileImageURL")
      .sort({ createdAt: -1 });

    res.status(200).json(complaints);
  } catch (err) {
    console.error("❌ Error fetching complaints:", err);
    res.status(500).json({ message: "Server error" });
  }
};


const updateComplaint = async (req, res) => {
  const { complaintId } = req.params;
  const { response, status } = req.body;

  try {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    if (response !== undefined) complaint.response = response;
    if (status !== undefined) complaint.status = status;

    await complaint.save();

    const author = await User.findById(complaint.userId);
    if (author) {
      await createNotification({
        userId: author._id,
        fromUserId: null,
        type: "action",
        message: "We have reviewed your issue and provided a resolution.",
      });

      const email = author.email;
      const issue = complaint.description;

      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: email,
        subject: "MeetX Update",
        html: `
          <div style="font-family: Arial, sans-serif; text-align: center;">
            <img src="https://ik.imagekit.io/ommprakashsahu/logo.png?updatedAt=1752065287771" alt="MeetX Logo" width="40" style="margin-bottom: 10px;" />
            <h2><strong>MeetX Update</strong></h2>
            <p>Your complaint with ID <strong>${complaintId}</strong> has been responded to.</p>
            <br/><br/>
            <h3>
              Issue: ${issue} <br/>
              Resolution: ${response || "N/A"} <br/>
              Status: ${status || complaint.status} <br/>
            </h3>
            <h5>For further information or action, contact us at <a href="mailto:ommprakashsahu.work@gmail.com">ommprakashsahu.work@gmail.com</a></h5>
          </div>
        `,
      });
    }

    res.status(200).json({ message: "Complaint updated successfully" });
  } catch (err) {
    console.error("❌ Error updating complaint:", err);
    res.status(500).json({ message: "Server error" });
  }
};


const setVerifiedUsersList = async (req, res) => {
  try {
    const users = await User.find()
      .select("username email isbanned.isBanned isbanned.reason verified profileImageURL")
      .sort({ createdAt: -1 });

    res.status(200).json({ users });
  } catch (err) {
    console.error("❌ Error fetching verified users:", err);
    res.status(500).json({ message: "Failed to get verified users", error: err });
  }
};

const toggleUserVerification = async (req, res) => {
  const { verify } = req.body;
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.isVerified = verify;
    await user.save();

    const messageText = verify
      ? "✅ Your account has been verified by admin."
      : "⚠️ Your account verification has been removed by admin.";

    res.status(200).json({
      message: `User has been ${verify ? "verified" : "unverified"}`,
      user,
    });

    await createNotification({
      userId: userId,
      fromUserId: null,
      type: "action",
      message: messageText,
    });

    const email = user.email;

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: "MeetX Account Verification Update",
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center;">
          <img src="https://ik.imagekit.io/ommprakashsahu/logo.png?updatedAt=1752065287771" alt="MeetX Logo" width="40" style="margin-bottom: 10px;" />
          <h2><strong>MeetX Verification Update</strong></h2>
          <p>${verify
          ? "🎉 Congratulations! Your account has been successfully verified."
          : "⚠️ Your account verification has been removed by the admin."
        }</p>
          <h5>If you have questions, contact us at <a href="mailto:ommprakashsahu.work@gmail.com">ommprakashsahu.work@gmail.com</a></h5>
        </div>
      `,
    });

  } catch (err) {
    console.error("❌ Error toggling verification:", err);
    res.status(500).json({ message: "Verification toggle failed", error: err });
  }
};




const notifyAllUsers = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Notification message is required" });
    }

    const users = await User.find({ "isbanned.banned": false }).select("email");

    if (!users.length) {
      return res.status(404).json({ error: "No eligible users found" });
    }

    const subject = "MeetX Admin Notification";
    const html = `
      <div style="font-family: Arial, sans-serif; text-align: center;">
        <img src="https://ik.imagekit.io/ommprakashsahu/logo.png?updatedAt=1752065287771" alt="MeetX Logo" width="40" style="margin-bottom: 10px;" />
        <h2><strong>MeetX Admin Notice</strong></h2>
        <p>${message}</p>
        <br/>
        <h5>If you have questions, contact us at 
          <a href="mailto:ommprakashsahu.work@gmail.com">ommprakashsahu.work@gmail.com</a>
        </h5>
      </div>
    `;

    const sendResults = await Promise.allSettled(
      users.map((user) =>
        transporter.sendMail({
          from: process.env.MAIL_USER,
          to: user.email,
          subject,
          html,
        })
      )
    );

    const failed = sendResults.filter((r) => r.status === "rejected");

    res.status(200).json({
      success: true,
      total: users.length,
      failed: failed.length,
      message: "Notification emails sent",
    });
  } catch (err) {
    console.error("notifyAllUsers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};







module.exports = {
  login, register, getAllUsers, banUser, unbanUser, getUserByUsername, getReportedPosts, getReportsForPost
  , suspendPost, unsuspendPost, getReportedUsers, getReportsForUser, updateComplaint, getAllComplaints
  , setVerifiedUsersList, toggleUserVerification, notifyAllUsers
}