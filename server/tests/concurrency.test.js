import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app, connectTestDB, disconnectTestDB, clearDB, makeToken } from "./helpers.js";
import User from "../src/models/User.js";
import Product from "../src/models/Product.js";
import Bid from "../src/models/Bid.js";

before(connectTestDB);
after(disconnectTestDB);
beforeEach(clearDB);

const createLiveAuction = (seller) =>
  Product.create({
    seller: seller._id,
    title: "동시성 테스트 경매",
    description: "d",
    category: "전자기기",
    saleType: "auction",
    auctionStatus: "live",
    startPrice: 10000,
    currentPrice: 10000,
    endTime: new Date(Date.now() + 60 * 60 * 1000),
    bidTiers: [{ upTo: null, unit: 1000 }],
  });

test("동시성: 50건 동시 입찰 시 충돌 없이 정확히 1건만 낙찰 (중복 낙찰 없음)", async () => {
  const N = 50;
  const seller = await User.create({ name: "판매자", email: "seller@e.com", password: "password123" });
  const product = await createLiveAuction(seller);

  // 서로 다른 입찰자 N명
  const bidders = await User.insertMany(
    Array.from({ length: N }, (_, i) => ({ name: `bidder${i}`, email: `bidder${i}@e.com`, password: "password123" }))
  );

  // 전원이 동시에 같은 금액(11,000원)으로 입찰
  const statuses = await Promise.all(
    bidders.map((b) =>
      request(app)
        .post(`/api/auctions/${product._id}/bid`)
        .set("Authorization", `Bearer ${makeToken(b)}`)
        .send({ amount: 11000 })
        .then((r) => r.status)
    )
  );

  const success = statuses.filter((s) => s === 201).length;
  const bidCount = await Bid.countDocuments({ product: product._id });
  const updated = await Product.findById(product._id);

  // 핵심 불변식: 단 1건만 성공, 입찰 레코드도 1건, 현재가 정확히 1단위만 상승
  assert.equal(success, 1, "동시 입찰 중 정확히 1건만 성공해야 한다");
  assert.equal(bidCount, 1, "입찰 레코드가 1건이어야 한다 (중복 낙찰 없음)");
  assert.equal(updated.currentPrice, 11000, "현재가는 정확히 11,000원이어야 한다");
});

test("동시성: 증가하는 금액으로 동시 입찰해도 현재가 정합성 유지 (로스트 업데이트 없음)", async () => {
  const N = 30;
  const seller = await User.create({ name: "판매자", email: "seller@e.com", password: "password123" });
  const product = await createLiveAuction(seller);
  const bidders = await User.insertMany(
    Array.from({ length: N }, (_, i) => ({ name: `bidder${i}`, email: `bidder${i}@e.com`, password: "password123" }))
  );

  // 각자 서로 다른 금액(11,000 ~ 40,000)으로 동시 입찰
  await Promise.all(
    bidders.map((b, i) =>
      request(app)
        .post(`/api/auctions/${product._id}/bid`)
        .set("Authorization", `Bearer ${makeToken(b)}`)
        .send({ amount: 11000 + i * 1000 })
        .then(() => {})
        .catch(() => {})
    )
  );

  const updated = await Product.findById(product._id);
  const topBid = await Bid.findOne({ product: product._id }).sort({ amount: -1 });

  // 현재가는 항상 성공한 최고 입찰가와 일치해야 한다 (원자적 갱신으로 갱신 누락 없음)
  assert.equal(updated.currentPrice, topBid.amount, "현재가 = 최고 입찰가 (정합성 유지)");
  // 모든 입찰 기록의 금액은 유일해야 한다 (중복 금액 낙찰 없음)
  const amounts = (await Bid.find({ product: product._id })).map((b) => b.amount);
  assert.equal(new Set(amounts).size, amounts.length, "중복 금액 입찰 기록이 없어야 한다");
});
