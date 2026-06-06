import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import axiosInstance from "../api/axios";
import useAuthStore from "../store/authStore";
import { CATEGORIES } from "../utils/categories";
import ReportModal from "../components/ReportModal";

function WantedDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [chattedSellerIds, setChattedSellerIds] = useState(new Set());

  // 수정 모드
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [reportTarget, setReportTarget] = useState(null);

  const fetchPost = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/api/wanted/${id}`);
      setPost(res.data.post);
      setComments(res.data.comments);
    } catch (error) {
      toast.error(error.response?.data?.message || "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 작성자인 경우 이미 채팅 시작된 판매자 목록 로드
  useEffect(() => {
    if (!user) return;
    axiosInstance.get("/api/chats").then((res) => {
      const ids = new Set(
        (res.data.chats || [])
          .filter((c) => c.wantedPost?._id === id || c.wantedPost === id)
          .map((c) => c.seller._id)
      );
      setChattedSellerIds(ids);
    }).catch(() => {});
  }, [id, user]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      setSubmitting(true);
      const res = await axiosInstance.post(`/api/wanted/${id}/comments`, { content });
      setComments((prev) => [...prev, res.data.comment]);
      setContent("");
    } catch (error) {
      toast.error(error.response?.data?.message || "댓글 등록 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      await axiosInstance.delete(`/api/wanted/${id}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (error) {
      toast.error(error.response?.data?.message || "삭제 실패");
    }
  };

  const handleStartChat = async (commentId, sellerId) => {
    try {
      const res = await axiosInstance.post(`/api/wanted/${id}/comments/${commentId}/chat`);
      setChattedSellerIds((prev) => new Set([...prev, sellerId]));
      navigate(`/chats/${res.data.chat._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "채팅 시작 실패");
    }
  };

  const handleClose = async () => {
    if (!window.confirm("거래 완료 처리하시겠습니까? 글이 마감됩니다.")) return;
    try {
      await axiosInstance.patch(`/api/wanted/${id}/close`);
      setPost((prev) => ({ ...prev, status: "closed" }));
      toast.success("거래 완료 처리되었습니다.");
    } catch (error) {
      toast.error(error.response?.data?.message || "처리 실패");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("게시글을 삭제하시겠습니까?")) return;
    try {
      await axiosInstance.delete(`/api/wanted/${id}`);
      toast.success("삭제되었습니다.");
      navigate("/wanted");
    } catch (error) {
      toast.error(error.response?.data?.message || "삭제 실패");
    }
  };

  const handleEditStart = () => {
    setEditForm({
      title: post.title,
      description: post.description,
      category: post.category,
      targetPrice: post.targetPrice ?? "",
    });
    setIsEditing(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosInstance.patch(`/api/wanted/${id}`, {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        targetPrice: editForm.targetPrice !== "" ? Number(editForm.targetPrice) : null,
      });
      setPost(res.data.post);
      setIsEditing(false);
      toast.success("수정되었습니다.");
    } catch (error) {
      toast.error(error.response?.data?.message || "수정 실패");
    }
  };

  const isAuthor = user && post?.author._id === user.id;

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-2/3" />
      <div className="bg-white rounded-2xl shadow p-6 h-48 bg-slate-200 rounded-xl" />
    </div>
  );
  if (!post) return <div>게시글을 찾을 수 없습니다.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      {/* 게시글 */}
      <div className="bg-white rounded-2xl shadow p-5 sm:p-6">
        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <input
              value={editForm.title}
              onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="제목"
              required
              maxLength={100}
              className="w-full border rounded-lg px-4 py-3"
            />
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="내용"
              required
              maxLength={2000}
              className="w-full border rounded-lg px-4 py-3 h-32 resize-none"
            />
            <select
              value={editForm.category}
              onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
              required
              className="w-full border rounded-lg px-4 py-3"
            >
              <option value="">카테고리 선택</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editForm.targetPrice}
                onChange={(e) => setEditForm((p) => ({ ...p, targetPrice: e.target.value }))}
                placeholder="희망가격 (선택)"
                min={0}
                className="flex-1 border rounded-lg px-4 py-3"
              />
              <span className="text-slate-500 shrink-0">원 이하</span>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-slate-800 text-white py-2.5 rounded-lg hover:bg-slate-700">저장</button>
              <button type="button" onClick={() => setIsEditing(false)} className="flex-1 border py-2.5 rounded-lg hover:bg-slate-50">취소</button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    post.status === "open" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {post.status === "open" ? "구매중" : "거래완료"}
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{post.category}</span>
                </div>
                <h1 className="text-xl font-bold text-slate-800">{post.title}</h1>
              </div>
              {isAuthor && post.status === "open" && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={handleEditStart} className="text-xs border border-slate-300 px-3 py-1.5 rounded-lg hover:border-slate-500">수정</button>
                  <button onClick={handleClose} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">거래완료</button>
                  <button onClick={handleDelete} className="text-xs border border-red-300 text-red-500 px-3 py-1.5 rounded-lg hover:border-red-500">삭제</button>
                </div>
              )}
              {isAuthor && post.status === "closed" && (
                <button onClick={handleDelete} className="text-xs border border-red-300 text-red-500 px-3 py-1.5 rounded-lg hover:border-red-500 shrink-0">삭제</button>
              )}
            </div>

            <p className="text-slate-700 whitespace-pre-wrap mb-4">{post.description}</p>

            <div className="flex items-center justify-between text-sm text-slate-400 pt-3 border-t">
              <div className="flex items-center gap-2">
                <span>{post.author.name}</span>
                {user && !isAuthor && (
                  <button
                    onClick={() => setReportTarget({ userId: post.author._id, userName: post.author.name })}
                    className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-0.5 rounded-lg"
                  >
                    신고
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {post.targetPrice && (
                  <span className="text-slate-600 font-medium">희망가: {post.targetPrice.toLocaleString()}원 이하</span>
                )}
                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 댓글 */}
      <div className="bg-white rounded-2xl shadow p-5 sm:p-6 space-y-4">
        <h2 className="font-bold text-slate-800">
          댓글 {comments.length > 0 && <span className="text-slate-400 font-normal text-sm">({comments.length})</span>}
        </h2>

        {comments.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">아직 댓글이 없습니다. 판매 가능하다면 댓글을 남겨보세요!</p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment._id} className={`border rounded-xl p-4 ${
                chattedSellerIds.has(comment.author._id) ? "border-blue-200 bg-blue-50" : ""
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{comment.author.name}</span>
                      {chattedSellerIds.has(comment.author._id) && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">채팅 중</span>
                      )}
                      <span className="text-xs text-slate-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-700 text-sm">{comment.content}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 items-start">
                    {isAuthor && post.status === "open" && comment.author._id !== user.id && (
                      chattedSellerIds.has(comment.author._id) ? (
                        <button
                          onClick={() => navigate("/chats")}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                        >
                          채팅 보기
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartChat(comment._id, comment.author._id)}
                          className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700"
                        >
                          채팅하기
                        </button>
                      )
                    )}
                    {user && comment.author._id !== user.id && (
                      <button
                        onClick={() => setReportTarget({ userId: comment.author._id, userName: comment.author.name })}
                        className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg"
                      >
                        신고
                      </button>
                    )}
                    {user && comment.author._id === user.id && (
                      <button onClick={() => handleDeleteComment(comment._id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {user && !isAuthor && post.status === "open" && (
          <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="판매 가능하다면 댓글을 남겨보세요"
              maxLength={500}
              className="flex-1 border rounded-lg px-4 py-2.5 text-sm min-w-0"
            />
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50 shrink-0"
            >
              등록
            </button>
          </form>
        )}

        {post.status === "closed" && (
          <p className="text-center text-slate-400 text-sm pt-2 border-t">거래가 완료된 글입니다.</p>
        )}
        {!user && (
          <p className="text-center text-slate-400 text-sm pt-2 border-t">댓글을 달려면 로그인이 필요합니다.</p>
        )}
      </div>

      {reportTarget && (
        <ReportModal
          reportedUserId={reportTarget.userId}
          reportedUserName={reportTarget.userName}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

export default WantedDetailPage;
