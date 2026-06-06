import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcrypt";
import { app, connectTestDB, disconnectTestDB, clearDB, makeToken } from "./helpers.js";
import User from "../src/models/User.js";
import Product from "../src/models/Product.js";
import Bid from "../src/models/Bid.js";

before(connectTestDB);
after(disconnectTestDB);
beforeEach(clearDB);

const createUser = async (name, email) =>
  User.create({ name, email, password: await bcrypt.hash("password123", 10) });

// 시작가 10000, 단위 1000인 라이브 경매 생성
const createLiveAuction = (seller) =>
  Product.create({
    seller: seller._id,
    title: "경매 상품",
    description: "설명",
    category: "전자기기",
    saleType: "auction",
    auctionStatus: "live",
    startPrice: 10000,
    currentPrice: 10000,
    endTime: new Date(Date.now() + 60 * 60 * 1000),
    bidTiers: [{ upTo: null, unit: 1000 }],
  });

test("자동 입찰: 단독 설정 시 시작가로 선점", async () => {
  const seller = await createUser("판매자", "s@e.com");
  const buyer = await createUser("구매자", "b@e.com");
  const product = await createLiveAuction(seller);

  const res = await request(app)
    .post(`/api/auctions/${product._id}/auto-bid`)
    .set("Authorization", `Bearer ${makeToken(buyer)}`)
    .send({ maxAmount: 50000 });

  assert.equal(res.status, 200);
  // 경쟁자가 없으므로 현재가는 시작가 유지
  assert.equal(res.body.currentPrice, 10000);
  const bids = await Bid.find({ product: product._id });
  assert.equal(bids.length, 1);
  assert.equal(bids[0].amount, 10000);
});

test("자동 입찰: 수동 입찰이 들어오면 2등+단위로만 자동 대응", async () => {
  const seller = await createUser("판매자", "s@e.com");
  const proxyBuyer = await createUser("자동", "auto@e.com");
  const manualBuyer = await createUser("수동", "manual@e.com");
  const product = await createLiveAuction(seller);

  // 자동 입찰자: 최대 50000 설정 → 10000 선점
  await request(app)
    .post(`/api/auctions/${product._id}/auto-bid`)
    .set("Authorization", `Bearer ${makeToken(proxyBuyer)}`)
    .send({ maxAmount: 50000 });

  // 수동 입찰자가 20000 입찰
  const bidRes = await request(app)
    .post(`/api/auctions/${product._id}/bid`)
    .set("Authorization", `Bearer ${makeToken(manualBuyer)}`)
    .send({ amount: 20000 });
  assert.equal(bidRes.status, 201);

  // 자동 입찰자가 21000(20000+단위)으로 자동 재선점해야 함
  const updated = await Product.findById(product._id);
  assert.equal(updated.currentPrice, 21000);
  const topBid = await Bid.findOne({ product: product._id }).sort({ amount: -1 });
  assert.equal(topBid.bidder.toString(), proxyBuyer._id.toString());
  assert.equal(topBid.amount, 21000);
});

test("자동 입찰: 두 자동 입찰자 경쟁 시 낮은 max+단위에서 정산", async () => {
  const seller = await createUser("판매자", "s@e.com");
  const a = await createUser("A", "a@e.com");
  const b = await createUser("B", "b@e.com");
  const product = await createLiveAuction(seller);

  await request(app)
    .post(`/api/auctions/${product._id}/auto-bid`)
    .set("Authorization", `Bearer ${makeToken(a)}`)
    .send({ maxAmount: 30000 });

  await request(app)
    .post(`/api/auctions/${product._id}/auto-bid`)
    .set("Authorization", `Bearer ${makeToken(b)}`)
    .send({ maxAmount: 50000 });

  // B(50000)가 리더, 가격은 A의 max(30000) + 단위(1000) = 31000
  const updated = await Product.findById(product._id);
  assert.equal(updated.currentPrice, 31000);
  const topBid = await Bid.findOne({ product: product._id }).sort({ amount: -1 });
  assert.equal(topBid.bidder.toString(), b._id.toString());
});

test("자동 입찰: 본인 상품에는 설정 불가(403)", async () => {
  const seller = await createUser("판매자", "s@e.com");
  const product = await createLiveAuction(seller);

  const res = await request(app)
    .post(`/api/auctions/${product._id}/auto-bid`)
    .set("Authorization", `Bearer ${makeToken(seller)}`)
    .send({ maxAmount: 50000 });
  assert.equal(res.status, 403);
});

test("자동 입찰: 현재가+단위 미만 max는 400", async () => {
  const seller = await createUser("판매자", "s@e.com");
  const buyer = await createUser("구매자", "b@e.com");
  const product = await createLiveAuction(seller);

  const res = await request(app)
    .post(`/api/auctions/${product._id}/auto-bid`)
    .set("Authorization", `Bearer ${makeToken(buyer)}`)
    .send({ maxAmount: 10500 }); // 현재가 10000 + 단위 1000 = 11000 미만
  assert.equal(res.status, 400);
});
