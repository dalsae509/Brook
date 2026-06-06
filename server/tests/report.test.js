import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcrypt";
import { app, connectTestDB, disconnectTestDB, clearDB, makeToken } from "./helpers.js";
import User from "../src/models/User.js";

before(connectTestDB);
after(disconnectTestDB);
beforeEach(clearDB);

const createUser = async (name, email) =>
  User.create({ name, email, password: await bcrypt.hash("password123", 10) });

test("신고: 정상 접수", async () => {
  const reporter = await createUser("신고자", "r@e.com");
  const target = await createUser("대상", "t@e.com");
  const res = await request(app)
    .post("/api/reports")
    .set("Authorization", `Bearer ${makeToken(reporter)}`)
    .send({ reportedUserId: target._id.toString(), reason: "사기 의심" });
  assert.equal(res.status, 201);
});

test("신고: 본인 신고 불가(400)", async () => {
  const reporter = await createUser("신고자", "r@e.com");
  const res = await request(app)
    .post("/api/reports")
    .set("Authorization", `Bearer ${makeToken(reporter)}`)
    .send({ reportedUserId: reporter._id.toString(), reason: "사기 의심" });
  assert.equal(res.status, 400);
});

test("신고: '기타' 사유는 상세 내용 필수(400)", async () => {
  const reporter = await createUser("신고자", "r@e.com");
  const target = await createUser("대상", "t@e.com");
  const res = await request(app)
    .post("/api/reports")
    .set("Authorization", `Bearer ${makeToken(reporter)}`)
    .send({ reportedUserId: target._id.toString(), reason: "기타" });
  assert.equal(res.status, 400);
});

test("신고: 7일 내 동일 사용자 중복 신고 차단(409)", async () => {
  const reporter = await createUser("신고자", "r@e.com");
  const target = await createUser("대상", "t@e.com");
  const token = makeToken(reporter);
  const body = { reportedUserId: target._id.toString(), reason: "허위 상품" };

  const first = await request(app).post("/api/reports").set("Authorization", `Bearer ${token}`).send(body);
  assert.equal(first.status, 201);
  const second = await request(app).post("/api/reports").set("Authorization", `Bearer ${token}`).send(body);
  assert.equal(second.status, 409);
});
