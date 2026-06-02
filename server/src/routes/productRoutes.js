import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  createProduct,
  getProducts,
  getProductDetail,
  updateProduct,
  deleteProduct,
  getCategories,
} from "../controllers/productController.js";
import {
  purchaseProduct,
  confirmTrade,
  cancelPurchase,
  confirmAuctionTrade,
} from "../controllers/purchaseController.js";

const router = express.Router();

router.get("/categories", getCategories);
router.get("/", getProducts);
router.get("/:id", getProductDetail);
router.post("/", authMiddleware, createProduct);
router.patch("/:id", authMiddleware, updateProduct);
router.delete("/:id", authMiddleware, deleteProduct);

router.post("/:id/purchase", authMiddleware, purchaseProduct);
router.post("/:id/confirm", authMiddleware, confirmTrade);
router.post("/:id/cancel", authMiddleware, cancelPurchase);
router.post("/:id/confirm-auction", authMiddleware, confirmAuctionTrade);

export default router;