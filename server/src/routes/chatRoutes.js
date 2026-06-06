import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  createChat,
  getMyChats,
  getChatDetail,
  getChatMessages,
  sendMessage,
  deleteChat,
} from "../controllers/chatController.js";

const router = express.Router();

router.get("/", authMiddleware, getMyChats);
router.post("/", authMiddleware, createChat);
router.get("/:chatId", authMiddleware, getChatDetail);
router.delete("/:chatId", authMiddleware, deleteChat);
router.get("/:chatId/messages", authMiddleware, getChatMessages);
router.post("/:chatId/messages", authMiddleware, sendMessage);

export default router;
