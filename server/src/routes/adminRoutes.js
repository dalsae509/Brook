import express from "express";
import adminMiddleware from "../middlewares/adminMiddleware.js";
import {
  getUsers, deleteUser,
  getAdminProducts, forceDeleteProduct, forceEndAuction,
  getAdminWantedPosts, forceDeleteWantedPost,
  getAnalytics,
} from "../controllers/adminController.js";

const router = express.Router();

router.use(adminMiddleware);

router.get("/analytics", getAnalytics);
router.get("/users", getUsers);
router.delete("/users/:userId", deleteUser);
router.get("/products", getAdminProducts);
router.delete("/products/:productId", forceDeleteProduct);
router.post("/products/:productId/end-auction", forceEndAuction);
router.get("/wanted", getAdminWantedPosts);
router.delete("/wanted/:postId", forceDeleteWantedPost);

export default router;
