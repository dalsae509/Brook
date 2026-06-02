import http from "http";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import app from "./app.js";
import { restoreAuctionTimers, restoreAuctionStartTimers, getAuctionRoom } from "./utils/auctionScheduler.js";

dotenv.config();

const REQUIRED_ENV = [
  "MONGODB_URI",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "CLIENT_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`필수 환경변수 누락: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

app.set("io", io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = decoded.id;
    } catch {
      // 토큰 만료/위조 시 userId 없이 연결 허용 (경매 공개 관람은 인증 불필요)
    }
  }
  next();
});

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("user:join", () => {
    if (socket.data.userId) {
      socket.join(`user:${socket.data.userId}`);
    }
  });

  socket.on("auction:join", (productId) => {
    socket.join(getAuctionRoom(productId));
    console.log(`socket ${socket.id} joined ${getAuctionRoom(productId)}`);
  });

  socket.on("auction:leave", (productId) => {
    socket.leave(getAuctionRoom(productId));
    console.log(`socket ${socket.id} left ${getAuctionRoom(productId)}`);
  });

  socket.on("chat:join", (chatId) => {
    socket.join(`chat:${chatId}`);
  });

  socket.on("chat:leave", (chatId) => {
    socket.leave(`chat:${chatId}`);
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
  });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("MongoDB connected");

    await restoreAuctionTimers(io);
    await restoreAuctionStartTimers(io);

    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  });