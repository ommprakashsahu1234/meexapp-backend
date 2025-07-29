const jwt = require("jsonwebtoken");

const verifyAdminToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Admin token missing or invalid" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = {
      id: decoded.id,
      username: decoded.username,
      demo: typeof decoded.demo === "boolean" ? decoded.demo : false
    };
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired admin token" });
  }
};

module.exports = verifyAdminToken;
