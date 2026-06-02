import Notification from "../models/Notification.js";

export const createNotification = async (io, userId, { type, message, productId, productTitle }) => {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      message,
      product: productId ?? null,
      productTitle: productTitle ?? null,
    });

    io.to(`user:${userId}`).emit("notification:new", {
      _id: String(notification._id),
      type: notification.type,
      message: notification.message,
      product: productId ? String(productId) : null,
      productTitle: notification.productTitle,
      isRead: false,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (error) {
    console.error("createNotification error:", error.message);
  }
};
