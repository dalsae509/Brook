import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import { createReview, getProductReviews, getUserReviews } from "../controllers/reviewController.js";

const router = express.Router();

router.post("/", authMiddleware, createReview);
router.get("/product/:productId", getProductReviews);
router.get("/user/:userId", getUserReviews);

export default router;
