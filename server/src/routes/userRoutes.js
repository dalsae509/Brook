import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  getMyProducts,
  getMyBids,
  getMyWins,
  getMyPurchases,
  toggleWishlist,
  getMyWishlist,
  getUserProfile,
  getSellerDashboard,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/me/products", authMiddleware, getMyProducts);
router.get("/me/bids", authMiddleware, getMyBids);
router.get("/me/wins", authMiddleware, getMyWins);
router.get("/me/purchases", authMiddleware, getMyPurchases);
router.get("/me/wishlist", authMiddleware, getMyWishlist);
router.get("/me/dashboard", authMiddleware, getSellerDashboard);
router.post("/me/wishlist/:productId", authMiddleware, toggleWishlist);
router.get("/:userId", getUserProfile);

export default router;