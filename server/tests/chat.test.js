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

const setup = async () => {
  const seller = await createUser("판매자", "s@e.com");
  const buyer = await createUser("구매자", "b@e.com");
  const product = await Product.create({
    seller: seller._id, title: "상품", description: "d", category: "기타",
    saleType: "fixed", fixedPrice: 10000, fixedStatus: "available",
  });
  const chat = await Chat.create({ product: product._id, buyer: buyer._id, seller: seller._id });
  return { seller, buyer, product, chat };
};

test("채팅: 메시지 전송 시 상대방 deletedBy에서 제거(재노출)", async () => {
  const { seller, buyer, chat } = await setup();
  // 판매자가 채팅방을 나감(소프트 삭제)
  await Chat.findByIdAndUpdate(chat._id, { $addToSet: { deletedBy: seller._id } });

  // 구매자가 메시지 전송 → 판매자가 다시 노출되어야 함
  const res = await request(app)
    .post(`/api/chats/${chat._id}/messages`)
    .set("Authorization", `Bearer ${makeToken(buyer)}`)
    .send({ content: "안녕하세요" });

  assert.equal(res.status, 201);
  const updated = await Chat.findById(chat._id);
  assert.equal(updated.deletedBy.length, 0);
});

test("채팅: 나가기는 내 목록에서만 숨김", async () => {
  const { seller, buyer, chat } = await setup();
  const res = await request(app)
    .delete(`/api/chats/${chat._id}`)
    .set("Authorization", `Bearer ${makeToken(buyer)}`);
  assert.equal(res.status, 200);

  const myChats = await request(app).get("/api/chats").set("Authorization", `Bearer ${makeToken(buyer)}`);
  assert.equal(myChats.body.chats.length, 0); // 구매자 목록엔 없음
  const sellerChats = await request(app).get("/api/chats").set("Authorization", `Bearer ${makeToken(seller)}`);
  assert.equal(sellerChats.body.chats.length, 1); // 판매자 목록엔 그대로
});

test("채팅: 양쪽 모두 거래 종료해야 송신 차단", async () => {
  const { seller, buyer, chat } = await setup();

  // 한쪽만 종료 → 아직 송신 가능
  const close1 = await request(app).post(`/api/chats/${chat._id}/close`).set("Authorization", `Bearer ${makeToken(buyer)}`);
  assert.equal(close1.body.bothClosed, false);
  const send1 = await request(app).post(`/api/chats/${chat._id}/messages`).set("Authorization", `Bearer ${makeToken(seller)}`).send({ content: "still ok" });
  assert.equal(send1.status, 201);

  // 양쪽 종료 → 송신 차단
  const close2 = await request(app).post(`/api/chats/${chat._id}/close`).set("Authorization", `Bearer ${makeToken(seller)}`);
  assert.equal(close2.body.bothClosed, true);
  const send2 = await request(app).post(`/api/chats/${chat._id}/messages`).set("Authorization", `Bearer ${makeToken(buyer)}`).send({ content: "blocked" });
  assert.equal(send2.status, 403);
});

test("채팅: 참여자가 아니면 메시지 전송 403", async () => {
  const { chat } = await setup();
  const stranger = await createUser("제3자", "x@e.com");
  const res = await request(app)
    .post(`/api/chats/${chat._id}/messages`)
    .set("Authorization", `Bearer ${makeToken(stranger)}`)
    .send({ content: "hi" });
  assert.equal(res.status, 403);
});
