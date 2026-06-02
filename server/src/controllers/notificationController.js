import Notification from "../models/Notification.js";

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    return res.status(200).json({ notifications });
  } catch (error) {
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true }
    );
    return res.status(200).json({ message: "읽음 처리 완료" });
  } catch (error) {
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    return res.status(200).json({ message: "전체 읽음 처리 완료" });
  } catch (error) {
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!deleted) {
      return res.status(404).json({ message: "알림을 찾을 수 없습니다." });
    }
    return res.status(200).json({ message: "알림 삭제 완료" });
  } catch (error) {
    return res.status(500).json({ message: "서버 오류" });
  }
};

export const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    return res.status(200).json({ message: "전체 알림 삭제 완료" });
  } catch (error) {
    return res.status(500).json({ message: "서버 오류" });
  }
};
