import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../api/axios";
import useNotificationStore from "../store/notificationStore";

const TYPE_LABELS = {
  auction_won: "낙찰",
  auction_ended: "경매 종료",
  outbid: "입찰 초과",
  wishlist_auction_started: "찜 경매 시작",
  trade_confirmed: "거래 완료",
  chat_created: "채팅방 생성",
};

const TYPE_COLORS = {
  auction_won: "text-green-600",
  auction_ended: "text-slate-500",
  outbid: "text-orange-500",
  wishlist_auction_started: "text-purple-600",
  trade_confirmed: "text-green-600",
  chat_created: "text-blue-600",
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, setNotifications, markOneRead, markAllRead, removeOne, removeAll } =
    useNotificationStore();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    axiosInstance
      .get("/api/notifications")
      .then((res) => setNotifications(res.data.notifications))
      .catch(() => {});
  }, [setNotifications]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    await axiosInstance.patch("/api/notifications/read-all");
    markAllRead();
  };

  const handleClickNotification = async (n) => {
    if (!n.isRead) {
      await axiosInstance.patch(`/api/notifications/${n._id}/read`);
      markOneRead(n._id);
    }
    setOpen(false);
    if (n.type === "chat_created") {
      navigate("/chats");
    } else if (n.product) {
      navigate(`/products/${n.product}`);
    }
  };

  const handleDeleteOne = async (e, id) => {
    e.stopPropagation();
    try {
      await axiosInstance.delete(`/api/notifications/${id}`);
      removeOne(id);
    } catch {
      // 삭제 실패 시 무시
    }
  };

  const handleDeleteAll = async () => {
    try {
      await axiosInstance.delete("/api/notifications");
      removeAll();
    } catch {
      // 삭제 실패 시 무시
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 text-slate-700 hover:text-slate-900"
        aria-label="알림"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(320px,calc(100vw-1rem))] bg-white rounded-xl shadow-lg border z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-slate-800">알림</span>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  모두 읽음
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  전체 삭제
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">알림이 없습니다.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => handleClickNotification(n)}
                  className={`relative w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-slate-50 transition-colors cursor-pointer ${
                    !n.isRead ? "bg-blue-50" : ""
                  }`}
                >
                  <button
                    onClick={(e) => handleDeleteOne(e, n._id)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-slate-500 leading-none text-lg"
                    aria-label="알림 삭제"
                  >
                    ×
                  </button>
                  <div className="flex items-center gap-2 mb-1 pr-4">
                    <span className={`text-xs font-semibold ${TYPE_COLORS[n.type]}`}>
                      {TYPE_LABELS[n.type]}
                    </span>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 ml-auto shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-snug pr-4">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
