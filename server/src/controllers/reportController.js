import mongoose from "mongoose";
import Report from "../models/Report.js";
import User from "../models/User.js";
import { recalculateBrookScore } from "../utils/brookScoreUtil.js";
import { createNotification } from "../utils/notificationService.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const createReport = async (req, res) => {
  try {
    const { reportedUserId, reason, description, productId } = req.body;

    if (!reportedUserId || !reason) {
      return res.status(400).json({ message: "신고 대상과 사유를 입력해주세요." });
    }
    if (reportedUserId === req.user._id.toString()) {
      return res.status(400).json({ message: "본인을 신고할 수 없습니다." });
    }
    if (reason === "기타" && !description?.trim()) {
      return res.status(400).json({ message: "'기타' 선택 시 상세 내용을 입력해주세요." });
    }

    const reportedUser = await User.findById(reportedUserId).select("_id");
    if (!reportedUser) {
      return res.status(404).json({ message: "신고 대상 사용자를 찾을 수 없습니다." });
    }

    // 7일 내 동일 유저 재신고 차단
    const existing = await Report.findOne({
      reporter: req.user._id,
      reportedUser: reportedUserId,
      createdAt: { $gte: new Date(Date.now() - SEVEN_DAYS_MS) },
    });
    if (existing) {
      return res.status(409).json({ message: "7일 내에 이미 신고한 사용자입니다." });
    }

    const report = await Report.create({
      reporter: req.user._id,
      reportedUser: reportedUserId,
      reason,
      description: description?.trim() || "",
      product: productId || null,
    });

    return res.status(201).json({ message: "신고가 접수되었습니다.", report });
  } catch (error) {
    console.error("createReport error:", error.message);
    return res.status(500).json({ message: "서버 오류" });
  }
};

// 내 신고 내역 조회
export const getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ reporter: req.user._id })
      .populate("reportedUser", "name")
      .populate("product", "title")
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({ reports });
  } catch (error) {
    console.error("getMyReports error:", error.message);
    return res.status(500).json({ message: "서버 오류" });
  }
};

// 관리자: 전체 신고 목록
export const getReports = async (req, res) => {
  try {
    const { status = "pending", page = 1 } = req.query;
    const limit = 20;
    const query = status !== "all" ? { status } : {};

    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate("reporter", "name email")
        .populate("reportedUser", "name email brookScore")
        .populate("product", "title _id")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Report.countDocuments(query),
    ]);

    return res.status(200).json({ reports, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("getReports error:", error.message);
    return res.status(500).json({ message: "서버 오류" });
  }
};

// 관리자: 신고 처리
export const processReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body; // "reviewed" | "dismissed"

    if (!["reviewed", "dismissed"].includes(status)) {
      return res.status(400).json({ message: "잘못된 상태값입니다." });
    }

    const report = await Report.findById(reportId).populate("reporter", "_id name");
    if (!report) return res.status(404).json({ message: "신고를 찾을 수 없습니다." });
    if (report.status !== "pending") return res.status(400).json({ message: "이미 처리된 신고입니다." });

    const prevStatus = report.status;
    const isConfirming = status === "reviewed";

    // 트랜잭션으로 상태 변경 + reportCount 동기화
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      report.status = status;
      await report.save({ session });

      if (isConfirming) {
        await User.findByIdAndUpdate(
          report.reportedUser,
          { $inc: { reportCount: 1 } },
          { session }
        );
      }

      await session.commitTransaction();
    } catch (txError) {
      await session.abortTransaction();
      console.error("processReport transaction error:", txError.message);
      return res.status(500).json({ message: "서버 오류" });
    } finally {
      session.endSession();
    }

    // 브룩 지수 재계산 (트랜잭션 밖)
    if (isConfirming) {
      recalculateBrookScore(report.reportedUser).catch(() => {});
    }

    // 신고자에게 처리 결과 알림
    const io = req.app.get("io");
    const notifMessage = isConfirming
      ? "신고가 확인되어 처리되었습니다. 감사합니다."
      : "접수하신 신고가 검토 후 기각되었습니다.";
    await createNotification(io, report.reporter._id, {
      type: "report_processed",
      message: notifMessage,
    });

    return res.status(200).json({ message: "처리 완료", report });
  } catch (error) {
    console.error("processReport error:", error.message);
    return res.status(500).json({ message: "서버 오류" });
  }
};
