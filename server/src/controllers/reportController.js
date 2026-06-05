import Report from "../models/Report.js";
import User from "../models/User.js";
import { recalculateBrookScore } from "../utils/brookScoreUtil.js";

export const createReport = async (req, res) => {
  try {
    const { reportedUserId, reason, description, productId } = req.body;

    if (!reportedUserId || !reason) {
      return res.status(400).json({ message: "신고 대상과 사유를 입력해주세요." });
    }
    if (reportedUserId === req.user._id.toString()) {
      return res.status(400).json({ message: "본인을 신고할 수 없습니다." });
    }

    const existing = await Report.findOne({
      reporter: req.user._id,
      reportedUser: reportedUserId,
      product: productId || null,
    });
    if (existing) {
      return res.status(409).json({ message: "이미 신고한 내역이 있습니다." });
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
        .populate("product", "title")
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

// 관리자: 신고 처리 (confirmed → reportCount 증가 + 브룩 지수 재계산)
export const processReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body; // "reviewed" | "dismissed"

    if (!["reviewed", "dismissed"].includes(status)) {
      return res.status(400).json({ message: "잘못된 상태값입니다." });
    }

    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ message: "신고를 찾을 수 없습니다." });
    if (report.status !== "pending") return res.status(400).json({ message: "이미 처리된 신고입니다." });

    report.status = status;
    await report.save();

    if (status === "reviewed") {
      await User.findByIdAndUpdate(report.reportedUser, { $inc: { reportCount: 1 } });
      recalculateBrookScore(report.reportedUser).catch(() => {});
    }

    return res.status(200).json({ message: "처리 완료", report });
  } catch (error) {
    console.error("processReport error:", error.message);
    return res.status(500).json({ message: "서버 오류" });
  }
};
