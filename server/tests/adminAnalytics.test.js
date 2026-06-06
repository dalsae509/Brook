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

test("관리자 분석: GMV/거래수/유저/카테고리 집계", async () => {
  const admin = await User.create({ name: "관리자", email: "admin@e.com", password: await bcrypt.hash("password123", 10), role: "admin" });
  const seller = await User.create({ name: "판매자", email: "s@e.com", password: await bcrypt.hash("password123", 10) });

  await Product.create([
    { seller: seller._id, title: "판매A", description: "d", category: "전자기기", saleType: "fixed", fixedPrice: 100000, fixedStatus: "sold", soldAt: new Date() },
    { seller: seller._id, title: "판매B", description: "d", category: "전자기기", saleType: "auction", currentPrice: 50000, auctionStatus: "ended", auctionTradeConfirmed: true, soldAt: new Date() },
    { seller: seller._id, title: "판매중", description: "d", category: "의류", saleType: "fixed", fixedPrice: 30000, fixedStatus: "available" },
  ]);

  const res = await request(app)
    .get("/api/admin/analytics")
    .set("Authorization", `Bearer ${makeToken(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.summary.gmv, 150000); // 100000 + 50000
  assert.equal(res.body.summary.transactions, 2);
  assert.equal(res.body.summary.totalUsers, 2);
  assert.equal(res.body.summary.totalProducts, 3);
  // 카테고리 분포: 전자기기 2 + 의류 1
  const electronics = res.body.categoryDistribution.find((c) => c.name === "전자기기");
  assert.equal(electronics.value, 2);
});

test("관리자 분석: 일반 사용자는 접근 불가", async () => {
  const user = await User.create({ name: "일반", email: "u@e.com", password: await bcrypt.hash("password123", 10) });
  const res = await request(app)
    .get("/api/admin/analytics")
    .set("Authorization", `Bearer ${makeToken(user)}`);
  assert.notEqual(res.status, 200);
});
