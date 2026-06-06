import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import Product from "../models/Product.js";

export const createChat = async (req, res) => {
  try {
    const { productId } = req.body;

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
      product.buyer?.toString() === req.user._id.toString();

    if (!isAuctionWinner && !isFixedBuyer) {
      return res.status(403).json({ message: "채팅을 시작할 권한이 없습니다." });
    }

    const existing = await Chat.findOne({ product: productId, buyer: req.user._id });

    if (existing) {
      return res.status(200).json({ message: "기존 채팅방", chat: existing });
    }

    const chat = await Chat.create({
      product: product._id,
      buyer: req.user._id,
      seller: product.seller,
    });

    return res.status(201).json({ message: "채팅방 생성 성공", chat });
  } catch (error) {
    console.error("createChat error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getChatDetail = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId)
      .populate("product", "title images saleType")
      .populate("buyer", "name")
      .populate("seller", "name");

    if (!chat) {
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }

    const isParticipant =
      chat.buyer._id.toString() === req.user._id.toString() ||
      chat.seller._id.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ message: "접근 권한이 없습니다." });
    }

    return res.status(200).json({ chat });
  } catch (error) {
    console.error("getChatDetail error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getMyChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      $or: [{ buyer: req.user._id }, { seller: req.user._id }],
      deletedBy: { $ne: req.user._id },
    })
      .populate("product", "title images saleType")
      .populate("wantedPost", "title")
      .populate("buyer", "name")
      .populate("seller", "name")
      .populate("lastMessage", "content createdAt")
      .sort({ updatedAt: -1 });

    const chatIds = chats.map((c) => c._id);
    const unreadCounts = await Message.aggregate([
      { $match: { chat: { $in: chatIds }, sender: { $ne: req.user._id }, isRead: false } },
      { $group: { _id: "$chat", count: { $sum: 1 } } },
    ]);
    const unreadMap = {};
    unreadCounts.forEach((u) => { unreadMap[String(u._id)] = u.count; });

    const result = chats.map((c) => ({
      ...c.toObject(),
      unreadCount: unreadMap[String(c._id)] || 0,
    }));

    return res.status(200).json({ message: "채팅 목록 조회 성공", chats: result });
  } catch (error) {
    console.error("getMyChats error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }

    const isParticipant =
      chat.buyer.toString() === req.user._id.toString() ||
      chat.seller.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ message: "접근 권한이 없습니다." });
    }

    const messages = await Message.find({ chat: chatId })
      .populate("sender", "name")
      .sort({ createdAt: 1 });

    const hasUnread = await Message.exists({
      chat: chatId, sender: { $ne: req.user._id }, isRead: false,
    });

    await Message.updateMany(
      { chat: chatId, sender: { $ne: req.user._id }, isRead: false },
      { $set: { isRead: true } }
    );

    if (hasUnread) {
      const io = req.app.get("io");
      io.to(`chat:${chatId}`).emit("chat:read", {
        chatId,
        readBy: String(req.user._id),
      });
    }

    return res.status(200).json({ message: "메시지 목록 조회 성공", messages });
  } catch (error) {
    console.error("getChatMessages error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }

    const isParticipant =
      chat.buyer.toString() === req.user._id.toString() ||
      chat.seller.toString() === req.user._id.toString();
    if (!isParticipant) {
      return res.status(403).json({ message: "접근 권한이 없습니다." });
    }

    await Chat.findByIdAndUpdate(chatId, { $addToSet: { deletedBy: req.user._id } });
    return res.status(200).json({ message: "채팅방 나가기 완료" });
  } catch (error) {
    console.error("deleteChat error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, imageUrl } = req.body;

    if (!content?.trim() && !imageUrl) {
      return res.status(400).json({ message: "메시지 내용 또는 이미지를 입력해주세요." });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }

    const isParticipant =
      chat.buyer.toString() === req.user._id.toString() ||
      chat.seller.toString() === req.user._id.toString();

    if (!isParticipant) {
      return res.status(403).json({ message: "접근 권한이 없습니다." });
    }

    const message = await Message.create({
      chat: chatId,
      sender: req.user._id,
      content: content?.trim() || "",
      imageUrl: imageUrl || null,
    });

    const populated = await Message.findById(message._id).populate("sender", "name");

    await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

    const io = req.app.get("io");
    io.to(`chat:${chatId}`).emit("chat:message", {
      chatId,
      message: populated,
    });

    return res.status(201).json({ message: "메시지 전송 성공", data: populated });
  } catch (error) {
    console.error("sendMessage error:", error);
    return res.status(500).json({ message: "서버 오류" });
  }
};
