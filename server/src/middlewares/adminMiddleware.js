import jwt from "jsonwebtoken";
import User from "../models/User.js";

const adminMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "인증 토큰이 없습니다." });
    }

    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password -refreshTokens");

    if (!user) {
      return res.status(401).json({ message: "유효하지 않은 사용자입니다." });
    }
    if (user.role !== "admin") {
      return res.status(403).json({ message: "관리자 권한이 필요합니다." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
  }
};

export default adminMiddleware;
