import Review from "../models/Review.js";
import Product from "../models/Product.js";
import { recalculateBrookScore } from "../utils/brookScoreUtil.js";

export const createReview = async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;

    const numRating = Number(rating);
    if (!productId || Number.isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: "상품 ID와 1~5점 사이의 평점을 입력해주세요." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "상품을 찾을 수 없습니다." });
    }

    const isAuctionWinner =
      product.saleType === "auction" &&
      product.auctionStatus === "ended" &&
      product.winner?.toString() === req.user._id.toString();

    const isFixedBuyer =
      product.saleType === "fixed" &&
      product.fixedStatus === "sold" &&
      product.buyer?.toString() === req.user._id.toString();

    if (!isAuctionWinner && !isFixedBuyer) {
      return res.status(403).json({ message: "거래가 완료된 상품의 구매자만 리뷰를 작성할 수 있습니다." });
    }

    const existing = await Review.findOne({ product: productId, reviewer: req.user._id });
    if (existing) {
      return res.status(409).json({ message: "이미 리뷰를 작성하셨습니다." });
    }

    const review = await Review.create({
      product: productId,
      reviewer: req.user._id,
      reviewee: product.seller,
      rating: numRating,
      comment: comment?.trim() || "",
    });

    const populated = await Review.findById(review._id).populate("reviewer", "name");

    recalculateBrookScore(product.seller).catch(() => {});

    return res.status(201).json({ message: "리뷰 작성 성공", review: populated });
  } catch (error) {
    console.error("createReview error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ product: productId })
      .populate("reviewer", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ reviews });
  } catch (error) {
    console.error("getProductReviews error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;

    const reviews = await Review.find({ reviewee: userId })
      .populate("reviewer", "name")
      .populate("product", "title")
      .sort({ createdAt: -1 });

    const averageRating =
      reviews.length
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
        : null;

    return res.status(200).json({ reviews, averageRating, reviewCount: reviews.length });
  } catch (error) {
    console.error("getUserReviews error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};
