import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcrypt";
import { app, connectTestDB, disconnectTestDB, clearDB, makeToken } from "./helpers.js";
import User from "../src/models/User.js";
import Product from "../src/models/Product.js";

before(connectTestDB);
after(disconnectTestDB);
beforeEach(clearDB);

const createUser = async (name, email) =>
  User.create({ name, email, password: await bcrypt.hash("password123", 10) });

test("대시보드: 매출/판매수/조회수/진행중 집계", async () => {
  const seller = await createUser("판매자", "seller@example.com");
  await Product.create([
    { seller: seller._id, title: "판매완료A", description: "d", category: "전자기기", saleType: "fixed", fixedPrice: 10000, fixedStatus: "sold", soldAt: new Date(), views: 50 },
    { seller: seller._id, title: "판매완료B", description: "d", category: "전자기기", saleType: "fixed", fixedPrice: 20000, fixedStatus: "sold", soldAt: new Date(), views: 30 },
    { seller: seller._id, title: "판매중", description: "d", category: "전자기기", saleType: "fixed", fixedPrice: 5000, fixedStatus: "available", views: 10 },
  ]);

  const res = await request(app)
    .get("/api/users/me/dashboard")
    .set("Authorization", `Bearer ${makeToken(seller)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.summary.soldCount, 2);
  assert.equal(res.body.summary.totalRevenue, 30000);
  assert.equal(res.body.summary.totalViews, 90);
  assert.equal(res.body.summary.activeListings, 1);
  assert.equal(res.body.salesByMonth.length, 1); // 같은 달 2건 → 1개 버킷
  assert.equal(res.body.topViewed[0].title, "판매완료A"); // 조회수 최다
});

test("대시보드: 인증 없으면 401", async () => {
  const res = await request(app).get("/api/users/me/dashboard");
  assert.equal(res.status, 401);
});
