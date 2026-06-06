import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app, connectTestDB, disconnectTestDB, clearDB } from "./helpers.js";

before(connectTestDB);
after(disconnectTestDB);
beforeEach(clearDB);

const validUser = { name: "테스터", email: "tester@example.com", password: "password123" };

test("회원가입: 성공 시 201과 사용자 정보 반환", async () => {
  const res = await request(app).post("/api/auth/register").send(validUser);
  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, "tester@example.com");
  assert.equal(res.body.user.brookScore, 36.5);
});

test("회원가입: 8자 미만 비밀번호는 400", async () => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ ...validUser, password: "short" });
  assert.equal(res.status, 400);
});

test("회원가입: 중복 이메일은 409", async () => {
  await request(app).post("/api/auth/register").send(validUser);
  const res = await request(app).post("/api/auth/register").send(validUser);
  assert.equal(res.status, 409);
});

test("로그인: 올바른 자격증명으로 토큰 반환", async () => {
  await request(app).post("/api/auth/register").send(validUser);
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: validUser.email, password: validUser.password });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.ok(res.body.refreshToken);
});

test("로그인: 잘못된 비밀번호는 401", async () => {
  await request(app).post("/api/auth/register").send(validUser);
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: validUser.email, password: "wrongpassword" });
  assert.equal(res.status, 401);
});

test("로그인: 이메일 대소문자가 달라도 성공해야 한다", async () => {
  await request(app).post("/api/auth/register").send(validUser);
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "TESTER@example.com", password: validUser.password });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});
