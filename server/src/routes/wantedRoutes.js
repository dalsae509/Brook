import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  getMyPosts, getPosts, getPost, createPost, closePost, deletePost,
  addComment, deleteComment, startChatWithCommenter,
} from "../controllers/wantedController.js";

const router = express.Router();

router.get("/my", authMiddleware, getMyPosts);
router.get("/", getPosts);
router.get("/:id", getPost);
router.post("/", authMiddleware, createPost);
router.patch("/:id/close", authMiddleware, closePost);
router.delete("/:id", authMiddleware, deletePost);
router.post("/:id/comments", authMiddleware, addComment);
router.delete("/:id/comments/:commentId", authMiddleware, deleteComment);
router.post("/:id/comments/:commentId/chat", authMiddleware, startChatWithCommenter);

export default router;
