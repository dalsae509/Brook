import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import axiosInstance from "../api/axios";
import useAuthStore from "../store/authStore";
import socket from "../socket/socket";

function ChatRoomPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [chatRes, msgRes] = await Promise.all([
          axiosInstance.get(`/api/chats/${chatId}`),
          axiosInstance.get(`/api/chats/${chatId}/messages`),
        ]);
        setChat(chatRes.data.chat);
        setMessages(msgRes.data.messages || []);
      } catch (error) {
        toast.error(error.response?.data?.message || "채팅 불러오기 실패");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [chatId]);

  useEffect(() => {
    socket.emit("chat:join", chatId);

    const handleMessage = (payload) => {
      if (payload.chatId !== chatId) return;
      setMessages((prev) => [...prev, payload.message]);
    };

    const handleReconnect = () => { socket.emit("chat:join", chatId); };

    const handleRead = (payload) => {
      if (payload.chatId !== chatId) return;
      if (payload.readBy === user.id) return;
      setMessages((prev) =>
        prev.map((m) => (m.sender._id === user.id ? { ...m, isRead: true } : m))
      );
    };

    socket.on("connect", handleReconnect);
    socket.on("chat:message", handleMessage);
    socket.on("chat:read", handleRead);

    return () => {
      socket.emit("chat:leave", chatId);
      socket.off("connect", handleReconnect);
      socket.off("chat:message", handleMessage);
      socket.off("chat:read", handleRead);
    };
  }, [chatId, user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("이미지 크기는 10MB 이하여야 합니다.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim() && !imageFile) return;

    try {
      setUploading(true);
      let imageUrl = null;

      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        const res = await axiosInstance.post("/api/uploads/image", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        imageUrl = res.data.imageUrl;
        handleRemoveImage();
      }

      await axiosInstance.post(`/api/chats/${chatId}/messages`, {
        content,
        imageUrl,
      });
      setContent("");
    } catch (error) {
      toast.error(error.response?.data?.message || "메시지 전송 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("채팅방을 나가면 내 목록에서 사라집니다. 나가시겠습니까?")) return;
    try {
      await axiosInstance.delete(`/api/chats/${chatId}`);
      navigate("/chats");
    } catch (error) {
      toast.error(error.response?.data?.message || "나가기 실패");
    }
  };

  if (loading) return <div className="max-w-2xl mx-auto text-center py-10 text-slate-400">불러오는 중...</div>;
  if (!chat) return <div>채팅방을 찾을 수 없습니다.</div>;

  const other = user.id === chat.buyer._id ? chat.seller : chat.buyer;

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-120px)]">
      {/* 헤더 */}
      <div className="bg-white rounded-t-2xl shadow px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/chats")}
          className="text-slate-500 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-100"
          aria-label="뒤로 가기"
        >
          ← 목록
        </button>
        <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center font-semibold text-slate-600 flex-shrink-0">
          {other.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold leading-tight">{other.name}</p>
          <p className="text-xs text-slate-400 truncate">
            {chat.product?.title ?? chat.wantedPost?.title ?? ""}
          </p>
        </div>
        <button
          onClick={handleLeave}
          className="text-xs text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-300 px-3 py-1.5 rounded-lg"
        >
          나가기
        </button>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-slate-400 text-sm mt-8">첫 메시지를 보내보세요.</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender._id === user.id;
            return (
              <div key={msg._id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                {!isMine && (
                  <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center text-xs font-medium mr-2 flex-shrink-0 self-end">
                    {msg.sender.name[0]}
                  </div>
                )}
                <div>
                  {!isMine && (
                    <p className="text-xs text-slate-500 mb-1 ml-1">{msg.sender.name}</p>
                  )}
                  <div className={`rounded-2xl text-sm max-w-xs lg:max-w-md overflow-hidden ${
                    isMine ? "rounded-tr-sm" : "rounded-tl-sm"
                  }`}>
                    {/* 이미지 */}
                    {msg.imageUrl && (
                      <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={msg.imageUrl}
                          alt="첨부 이미지"
                          className="max-w-[240px] rounded-2xl cursor-pointer hover:opacity-90 transition"
                        />
                      </a>
                    )}
                    {/* 텍스트 */}
                    {msg.content && (
                      <div className={`px-4 py-2 ${
                        isMine ? "bg-slate-800 text-white" : "bg-white text-slate-800 shadow-sm"
                      } ${msg.imageUrl ? "rounded-b-2xl rounded-t-none mt-1" : "rounded-2xl"} ${
                        isMine ? "rounded-tr-sm" : "rounded-tl-sm"
                      }`}>
                        {msg.content}
                      </div>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start ml-1"}`}>
                    {isMine && (
                      <span className={`text-xs ${msg.isRead ? "text-blue-400" : "text-slate-300"}`}>
                        {msg.isRead ? "읽음" : "안읽음"}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      <div className="bg-white rounded-b-2xl shadow px-4 py-3 space-y-2">
        {/* 이미지 미리보기 */}
        {imagePreview && (
          <div className="relative inline-block">
            <img src={imagePreview} alt="미리보기" className="h-20 w-20 object-cover rounded-xl border" />
            <button
              onClick={handleRemoveImage}
              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 items-center">
          {/* 이미지 첨부 버튼 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 shrink-0"
            aria-label="이미지 첨부"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="메시지 입력..."
            className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-slate-400"
          />
          <button
            type="submit"
            disabled={(!content.trim() && !imageFile) || uploading}
            className="bg-slate-800 text-white px-5 py-2 rounded-xl text-sm hover:bg-slate-700 disabled:opacity-40 shrink-0"
          >
            {uploading ? "전송 중..." : "전송"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatRoomPage;
