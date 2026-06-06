import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcrypt";
import { app, connectTestDB, disconnectTestDB, clearDB } from "./helpers.js";
import User from "../src/models/User.js";
import Product from "../src/models/Product.js";

before(connectTestDB);
after(disconnectTestDB);
beforeEach(clearDB);

const seedProducts = async () => {
  const seller = await User.create({ name: "판매자", email: "s@e.com", password: await bcrypt.hash("password123", 10) });
  await Product.create([
    { seller: seller._id, title: "아이폰 15 프로", description: "d", category: "전자기기", saleType: "fixed", fixedPrice: 1000000, fixedStatus: "available" },
    { seller: seller._id, title: "아이폰 14", description: "d", category: "전자기기", saleType: "fixed", fixedPrice: 800000, fixedStatus: "available" },
    { seller: seller._id, title: "갤럭시 S24", description: "d", category: "전자기기", saleType: "fixed", fixedPrice: 900000, fixedStatus: "available" },
    { seller: seller._id, title: "아이폰 13 (판매완료)", description: "d", category: "전자기기", saleType: "fixed", fixedPrice: 700000, fixedStatus: "sold" },
  ]);
};

test("자동완성: 입력과 일치하는 구매 가능 상품명 제안", async () => {
  await seedProducts();
  const res = await request(app).get("/api/products/suggestions").query({ q: "아이폰" });
  assert.equal(res.status, 200);
  assert.ok(res.body.suggestions.includes("아이폰 15 프로"));
  assert.ok(res.body.suggestions.includes("아이폰 14"));
  assert.ok(!res.body.suggestions.includes("갤럭시 S24"));
  assert.ok(!res.body.suggestions.includes("아이폰 13 (판매완료)")); // sold 제외
});

test("자동완성: 빈 쿼리는 빈 배열", async () => {
  const res = await request(app).get("/api/products/suggestions").query({ q: "" });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.suggestions, []);
});

test("인기 검색어: 검색 시 집계되어 상위 노출", async () => {
  await seedProducts();
  // "아이폰" 2회, "갤럭시" 1회 검색
  await request(app).get("/api/products").query({ search: "아이폰" });
  await request(app).get("/api/products").query({ search: "아이폰" });
  await request(app).get("/api/products").query({ search: "갤럭시" });

  const res = await request(app).get("/api/products/popular-searches");
  assert.equal(res.status, 200);
  assert.equal(res.body.keywords[0].keyword, "아이폰");
  assert.equal(res.body.keywords[0].count, 2);
});
