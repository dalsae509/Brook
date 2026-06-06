import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcrypt";
import { app, connectTestDB, disconnectTestDB, clearDB, makeToken } from "./helpers.js";
import User from "../src/models/User.js";
import Product from "../src/models/Product.js";
import Chat from "../src/models/Chat.js";

before(connectTestDB);
after(disconnectTestDB);
beforeEach(clearDB);

const createUser = async (name, email) =>
  User.create({ name, email, password: await bcrypt.hash("password123", 10) });

test("상품 삭제: 다른 사용자 찜 목록 + 연관 채팅 정리", async () => {
  const seller = await createUser("판매자", "seller@example.com");
  const buyer = await createUser("구매자", "buyer@example.com");

  const product = await Product.create({
    seller: seller._id,
    title: "삭제될 상품",
    description: "설명",
    category: "기타",
    saleType: "fixed",
    fixedPrice: 10000,
    fixedStatus: "available",
  });

  // 구매자가 찜 + 채팅 보유
  await User.findByIdAndUpdate(buyer._id, { $addToSet: { wishlist: product._id } });
  await Chat.create({ product: product._id, buyer: buyer._id, seller: seller._id });

  const res = await request(app)
    .delete(`/api/products/${product._id}`)
    .set("Authorization", `Bearer ${makeToken(seller)}`);

  assert.equal(res.status, 200);
  const updatedBuyer = await User.findById(buyer._id);
  assert.equal(updatedBuyer.wishlist.length, 0);
  const remainingChats = await Chat.countDocuments({ product: product._id });
  assert.equal(remainingChats, 0);
});

test("상품 삭제: 예약 중(reserved)인 상품은 삭제 불가", async () => {
  const seller = await createUser("판매자", "seller@example.com");
  const buyer = await createUser("구매자", "buyer@example.com");
  const product = await Product.create({
    seller: seller._id,
    title: "예약 상품",
    description: "설명",
    category: "기타",
    saleType: "fixed",
    fixedPrice: 10000,
    fixedStatus: "reserved",
    buyer: buyer._id,
  });

  const res = await request(app)
    .delete(`/api/products/${product._id}`)
    .set("Authorization", `Bearer ${makeToken(seller)}`);

  assert.equal(res.status, 400);
});
