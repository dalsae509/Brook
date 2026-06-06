import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import app from "../src/app.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret";

// 컨트롤러의 req.app.get("io") 호출용 스텁 (소켓 emit no-op)
app.set("io", { to: () => ({ emit: () => {} }) });

let mongod;

export const connectTestDB = async () => {
  // 거래 컨트롤러가 트랜잭션을 쓰므로 레플리카셋 모드 필요
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
};

export const disconnectTestDB = async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};

export const clearDB = async () => {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};

// 컨트롤러 login과 동일한 페이로드로 액세스 토큰 발급
export const makeToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

export { app };
