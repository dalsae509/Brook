import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { connectTestDB, disconnectTestDB, clearDB } from "./helpers.js";
import User from "../src/models/User.js";
import Review from "../src/models/Review.js";
import Report from "../src/models/Report.js";
import { recalculateBrookScore } from "../src/utils/brookScoreUtil.js";

before(connectTestDB);
after(disconnectTestDB);
beforeEach(clearDB);

const createUser = async (deals = {}) =>
  User.create({
    name: "판매자", email: "s@e.com", password: await bcrypt.hash("password123", 10),
    completedDeals: deals.completed ?? 0,
    cancelledDeals: deals.cancelled ?? 0,
    totalDeals: deals.total ?? 0,
  });

const addReview = (revieweeId, rating) =>
  Review.create({
    product: new mongoose.Types.ObjectId(),
    reviewer: new mongoose.Types.ObjectId(),
    reviewee: revieweeId,
    rating,
  });

test("브룩 지수: 데이터 없으면 기본 36.5", async () => {
  const user = await createUser();
  const score = await recalculateBrookScore(user._id);
  assert.equal(score, 36.5);
});

test("브룩 지수: 후기 + 완료율 + 확인된 신고 합산", async () => {
  // 완료 4 / 취소 1 → 완료율 0.8 → +8, 후기 5점 2개 → +2.0, 확인 신고 1건 → -3
  const user = await createUser({ completed: 4, cancelled: 1, total: 5 });
  await addReview(user._id, 5);
  await addReview(user._id, 5);
  await Report.create({
    reporter: new mongoose.Types.ObjectId(),
    reportedUser: user._id,
    reason: "사기 의심",
    status: "reviewed",
  });

  const score = await recalculateBrookScore(user._id);
  // 36.5 + 2.0 + 8 - 3 = 43.5
  assert.equal(score, 43.5);
});

test("브룩 지수: 미확인(pending) 신고는 점수에 영향 없음", async () => {
  const user = await createUser();
  await Report.create({
    reporter: new mongoose.Types.ObjectId(),
    reportedUser: user._id,
    reason: "사기 의심",
    status: "pending",
  });
  const score = await recalculateBrookScore(user._id);
  assert.equal(score, 36.5);
});

test("브룩 지수: 0~99 범위로 고정", async () => {
  const user = await createUser();
  // 낮은 평점 후기를 다수 → 음수로 가도 0 미만으로 내려가지 않음
  for (let i = 0; i < 50; i++) await addReview(user._id, 1);
  const score = await recalculateBrookScore(user._id);
  assert.ok(score >= 0 && score <= 99);
});
