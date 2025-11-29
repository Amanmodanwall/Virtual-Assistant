import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const isAuth = async (req, res, next) => {
  try {
    // Log cookies for debugging
    console.log("Cookies received:", req.cookies);

    // 1️⃣ Get token from cookies
    const token = req.cookies.token;

    if (!token) {
      console.log("❌ No token found");
      return res.status(401).json({ message: "Token not found" });
    }

    // 2️⃣ Verify token (must be a string)
    if (typeof token !== "string") {
      console.log("❌ Invalid token type:", typeof token);
      return res.status(400).json({ message: "Invalid token format" });
    }

    // 3️⃣ Decode token using your JWT secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("✅ Token decoded:", decoded);

    // 4️⃣ Fetch user from database
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      console.log("❌ User not found for token ID:", decoded.userId);
      return res.status(404).json({ message: "User not found" });
    }

    // 5️⃣ Attach user info to request for later use
    req.user = user;
    req.userId = decoded.userId;

    console.log("✅ Authenticated user:", user.email);
    next();
  } catch (error) {
    console.error("❌ isAuth error:", error.message);
    return res.status(500).json({ message: "is Auth error", error: error.message });
  }
};

export default isAuth;
