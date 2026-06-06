import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  MAX_REFRESH_TOKENS,
  BCRYPT_SALT_ROUNDS,
} from "../config/constants.js";

const signAccessToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

const signRefreshToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });

export const register = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = req.body.email?.trim().toLowerCase();

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "이름, 이메일, 비밀번호를 모두 입력해주세요.",
      });
    }

    if (name.trim().length < 1 || name.trim().length > 50) {
      return res.status(400).json({ message: "이름은 1자 이상 50자 이하여야 합니다." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "올바른 이메일 형식이 아닙니다." });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "비밀번호는 8자 이상이어야 합니다.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "이미 가입된 이메일입니다.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // 회원가입 직후 바로 로그인되도록 토큰 발급
    const token = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    user.refreshTokens = [refreshToken];
    await user.save();

    return res.status(201).json({
      message: "회원가입 성공",
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        brookScore: user.brookScore,
        completedDeals: user.completedDeals,
        totalDeals: user.totalDeals,
        cancelledDeals: user.cancelledDeals,
      },
    });
  } catch (error) {
    console.error("register error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.body.email?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        message: "이메일과 비밀번호를 입력해주세요.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    const token = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // 멀티 디바이스: 토큰을 추가하되 최대 개수 초과 시 오래된 것부터 제거
    user.refreshTokens = [...user.refreshTokens, refreshToken].slice(-MAX_REFRESH_TOKENS);
    await user.save();

    return res.status(200).json({
      message: "로그인 성공",
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        brookScore: user.brookScore,
        completedDeals: user.completedDeals,
        totalDeals: user.totalDeals,
        cancelledDeals: user.cancelledDeals,
      },
    });
  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};

export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: "리프레시 토큰이 없습니다." });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: "유효하지 않은 리프레시 토큰입니다." });
    }

    const user = await User.findById(decoded.id);

    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ message: "유효하지 않은 리프레시 토큰입니다." });
    }

    const newToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    // 사용한 토큰만 교체(로테이션), 다른 기기의 토큰은 유지
    user.refreshTokens = user.refreshTokens
      .filter((t) => t !== refreshToken)
      .concat(newRefreshToken);
    await user.save();

    return res.status(200).json({ token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error("refresh error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await User.findOneAndUpdate(
        { refreshTokens: refreshToken },
        { $pull: { refreshTokens: refreshToken } }
      );
    }

    return res.status(200).json({ message: "로그아웃 성공" });
  } catch (error) {
    console.error("logout error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      message: "내 정보 조회 성공",
      user: req.user,
    });
  } catch (error) {
    console.error("getMe error:", error);
    return res.status(500).json({
      message: "서버 오류",
    });
  }
};