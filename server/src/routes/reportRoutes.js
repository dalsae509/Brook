import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import adminMiddleware from "../middlewares/adminMiddleware.js";
import { createReport, getMyReports, getReports, processReport } from "../controllers/reportController.js";

const router = express.Router();

router.post("/", authMiddleware, createReport);
router.get("/me", authMiddleware, getMyReports);
router.get("/", adminMiddleware, getReports);
router.patch("/:reportId", adminMiddleware, processReport);

export default router;
