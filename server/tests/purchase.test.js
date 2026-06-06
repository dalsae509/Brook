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

const createReservedProduct = (seller, buyer) =>
  Product.create({
    seller: seller._id,
    title: "테스트 상품",
    description: "설명",
    category: "기타",
    saleType: "fixed",
    fixedPrice: 10000,
    fixedStatus: "reserved",
    buyer: buyer._id,
    reservedAt: new Date(),
  });

test("거래 완료: 판매자가 확정하면 sold + completedDeals 증가", async () => {
  const seller = await createUser("판매자", "seller@example.com");
  const buyer = await createUser("구매자", "buyer@example.com");
  const product = await createReservedProduct(seller, buyer);

  const res = await request(app)
    .post(`/api/products/${product._id}/confirm`)
    .set("Authorization", `Bearer ${makeToken(seller)}`);

  assert.equal(res.status, 200);
  const updated = await Product.findById(product._id);
  assert.equal(updated.fixedStatus, "sold");
  const updatedSeller = await User.findById(seller._id);
  assert.equal(updatedSeller.completedDeals, 1);
});

test("거래 완료: 구매자도 수령 확인으로 확정할 수 있다", async () => {
  const seller = await createUser("판매자", "seller@example.com");
  const buyer = await createUser("구매자", "buyer@example.com");
  const product = await createReservedProduct(seller, buyer);

  const res = await request(app)
    .post(`/api/products/${product._id}/confirm`)
    .set("Authorization", `Bearer ${makeToken(buyer)}`);

  assert.equal(res.status, 200);
  const updated = await Product.findById(product._id);
  assert.equal(updated.fixedStatus, "sold");
});

test("거래 완료: 제3자는 403", async () => {
  const seller = await createUser("판매자", "seller@example.com");
  const buyer = await createUser("구매자", "buyer@example.com");
  const stranger = await createUser("제3자", "stranger@example.com");
  const product = await createReservedProduct(seller, buyer);

  const res = await request(app)
    .post(`/api/products/${product._id}/confirm`)
    .set("Authorization", `Bearer ${makeToken(stranger)}`);

  assert.equal(res.status, 403);
});

test("거래 완료: 인증 토큰 없으면 401", async () => {
  const seller = await createUser("판매자", "seller@example.com");
  const buyer = await createUser("구매자", "buyer@example.com");
  const product = await createReservedProduct(seller, buyer);

  const res = await request(app).post(`/api/products/${product._id}/confirm`);
  assert.equal(res.status, 401);
});
