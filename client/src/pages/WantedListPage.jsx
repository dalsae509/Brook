import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axiosInstance from "../api/axios";
import useAuthStore from "../store/authStore";
import { CATEGORIES } from "../utils/categories";

function WantedListPage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const category = searchParams.get("category") || "";

  const [posts, setPosts] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, status: "open" });
      if (category) params.append("category", category);
      const res = await axiosInstance.get(`/api/wanted?${params}`);
      setPosts(res.data.posts || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const updateParams = (updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k));
      return next;
    }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">삽니다</h1>
        {user && (
          <Link
            to="/wanted/new"
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700"
          >
            + 글쓰기
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-4 flex gap-3 overflow-x-auto">
        <button
          onClick={() => updateParams({ category: "", page: "" })}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
            !category ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          전체
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => updateParams({ category: c, page: "" })}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
              category === c ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 shadow text-center">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-slate-700 font-medium mb-1">등록된 구매 요청이 없습니다</p>
          {user && (
            <p className="text-slate-400 text-sm">
              원하는 물건이 있다면 직접 글을 올려보세요.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Link
              key={post._id}
              to={`/wanted/${post._id}`}
              className="block bg-white rounded-2xl shadow p-5 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0">
                      삽니다
                    </span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                      {post.category}
                    </span>
                  </div>
                  <h2 className="font-semibold text-slate-800 truncate">{post.title}</h2>
                  <p className="text-sm text-slate-500 truncate mt-0.5">{post.description}</p>
                </div>
                <div className="text-right shrink-0">
                  {post.targetPrice && (
                    <p className="text-sm font-medium text-slate-800">
                      ~{post.targetPrice.toLocaleString()}원
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {post.author.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={() => updateParams({ page: String(page - 1) })}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border hover:border-slate-400 disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-slate-600">{page} / {totalPages}</span>
          <button
            onClick={() => updateParams({ page: String(page + 1) })}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg border hover:border-slate-400 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

export default WantedListPage;
