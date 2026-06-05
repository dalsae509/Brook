import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import axiosInstance from "../api/axios";
import useAuthStore from "../store/authStore";
import { getCloudinaryUrl } from "../utils/cloudinary";

function ChatListPage() {
  const { user } = useAuthStore();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await axiosInstance.get("/api/chats");
        setChats(res.data.chats || []);
      } catch (error) {
        toast.error(error.response?.data?.message || "채팅 목록 불러오기 실패");
      } finally {
        setLoading(false);
      }
    };
    fetchChats();
  }, []);

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 bg-white rounded-2xl shadow p-4 animate-pulse">
          <div className="w-14 h-14 bg-slate-200 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
            <div className="h-3 bg-slate-200 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold">채팅</h1>

      {chats.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 shadow text-center">
          <p className="text-4xl mb-3">💬</p>
          <p className="text-slate-700 font-medium mb-1">진행 중인 채팅이 없습니다</p>
          <p className="text-slate-400 text-sm">낙찰되거나 구매한 상품이 있으면 채팅방이 생성됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chats.map((chat) => {
            const other = user.id === chat.buyer._id ? chat.seller : chat.buyer;
            return (
              <Link
                key={chat._id}
                to={`/chats/${chat._id}`}
                className="flex items-center gap-4 bg-white rounded-2xl shadow p-4 hover:shadow-md transition"
              >
                <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                  {chat.product?.images?.[0] ? (
                    <img src={getCloudinaryUrl(chat.product.images[0], { width: 80, height: 80 })} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : chat.wantedPost ? (
                    <div className="w-full h-full flex items-center justify-center bg-orange-50 text-2xl">🛒</div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">없음</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold truncate">{other.name}</p>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {chat.unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 font-medium">
                          {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                        </span>
                      )}
                      <p className="text-xs text-slate-400">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 truncate">
                    {chat.product?.title ?? chat.wantedPost?.title ?? ""}
                  </p>
                  {chat.lastMessage && (
                    <p className={`text-sm truncate ${chat.unreadCount > 0 ? "text-slate-800 font-medium" : "text-slate-400"}`}>
                      {chat.lastMessage.content || "📷 이미지"}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ChatListPage;
