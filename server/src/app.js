import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import auctionRoutes from "./routes/auctionRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import wantedRoutes from "./routes/wantedRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

const app = express();

const isProduction = process.env.NODE_ENV === "production";

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { message: "로그인/회원가입 시도가 너무 많습니다. 15분 후 다시 시도해주세요." },
});

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Brook API server",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Server is running",
  });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/products", apiLimiter, productRoutes);
app.use("/api/auctions", apiLimiter, auctionRoutes);
app.use("/api/users", apiLimiter, userRoutes);
app.use("/api/uploads", apiLimiter, uploadRoutes);
app.use("/api/chats", apiLimiter, chatRoutes);
app.use("/api/notifications", apiLimiter, notificationRoutes);
app.use("/api/reviews", apiLimiter, reviewRoutes);
app.use("/api/admin", apiLimiter, adminRoutes);
app.use("/api/wanted", apiLimiter, wantedRoutes);
app.use("/api/reports", apiLimiter, reportRoutes);

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(err.status ?? 500).json({ message: err.message || "서버 오류가 발생했습니다." });
});

export default app;