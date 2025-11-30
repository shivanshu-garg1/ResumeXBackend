const { verifyToken } = require("../Utils/jwt");

module.exports = (req, res, next) => {
  try {
    const token = req.cookies?.token; 

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }
    const user = verifyToken(token); 

    req.user = user;

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
