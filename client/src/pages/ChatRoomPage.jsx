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
  const [closedNotice, setClosedNotice] = useState("");
  const messagesEndRef = useRef(null);

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

    const handleClosed = (payload) => {
      if (payload.chatId !== chatId) return;
      setChat((prev) => prev ? { ...prev, isActive: false } : prev);
      setClosedNotice(payload.reason);
    };

    // 소켓 재연결 시 룸 재구독
    const handleReconnect = () => {
      socket.emit("chat:join", chatId);
    };

    socket.on("connect", handleReconnect);
    socket.on("chat:message", handleMessage);
    socket.on("chat:closed", handleClosed);

    return () => {
      socket.emit("chat:leave", chatId);
      socket.off("connect", handleReconnect);
      socket.off("chat:message", handleMessage);
      socket.off("chat:closed", handleClosed);
      // socket.disconnect() 제거 — App.jsx가 인증 상태에 따라 관리
    };
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await axiosInstance.post(`/api/chats/${chatId}/messages`, { content });
      setContent("");
    } catch (error) {
      toast.error(error.response?.data?.message || "메시지 전송 실패");
    }
  };

  const handleClose = async () => {
    if (!window.confirm("대화를 종료하시겠습니까?")) return;
    try {
      await axiosInstance.patch(`/api/chats/${chatId}/close`);
      setChat((prev) => prev ? { ...prev, isActive: false } : prev);
      setClosedNotice("대화를 종료했습니다.");
    } catch (error) {
      toast.error(error.response?.data?.message || "종료 실패");
    }
  };

  if (loading) return <div>불러오는 중...</div>;
  if (!chat) return <div>채팅방을 찾을 수 없습니다.</div>;

  const other = user.id === chat.buyer._id ? chat.seller : chat.buyer;
  const isActive = chat.isActive;

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-120px)]">
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
          <p className="text-xs text-slate-400 truncate">{chat.product?.title}</p>
        </div>

        {isActive && (
          <button
            onClick={handleClose}
            className="text-xs text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-300 px-3 py-1.5 rounded-lg"
          >
            대화 종료
          </button>
        )}
      </div>

      {/* 종료 알림 배너 */}
      {!isActive && (
        <div className="bg-slate-100 text-slate-500 text-sm text-center py-2 px-4">
          {closedNotice || "종료된 대화입니다."}
        </div>
      )}

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
                  <div className={`px-4 py-2 rounded-2xl text-sm max-w-xs lg:max-w-md ${
                    isMine
                      ? "bg-slate-800 text-white rounded-tr-sm"
                      : "bg-white text-slate-800 shadow-sm rounded-tl-sm"
                  }`}>
                    {msg.content}
                  </div>
                  <p className={`text-xs text-slate-400 mt-1 ${isMine ? "text-right" : "ml-1"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      {isActive ? (
        <form onSubmit={handleSend} className="bg-white rounded-b-2xl shadow px-4 py-3 flex gap-3">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="메시지 입력..."
            className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-slate-400"
          />
          <button
            type="submit"
            disabled={!content.trim()}
            className="bg-slate-800 text-white px-5 py-2 rounded-xl text-sm hover:bg-slate-700 disabled:opacity-40"
          >
            전송
          </button>
        </form>
      ) : (
        <div className="bg-white rounded-b-2xl shadow px-4 py-4 text-center text-slate-400 text-sm">
          종료된 대화입니다.
        </div>
      )}
    </div>
  );
}

export default ChatRoomPage;
