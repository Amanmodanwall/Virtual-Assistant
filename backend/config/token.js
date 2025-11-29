import jwt from "jsonwebtoken";

const genToken = (userId) => {
  try {
    // 🔹 Create JWT string with 7-day expiry
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    return token;
  } catch (error) {
    console.error("Token generation error:", error.message);
  }
};

export default genToken;
