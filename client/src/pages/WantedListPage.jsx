import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axiosInstance from "../api/axios";
import useAuthStore from "../store/authStore";
import { CATEGORIES } from "../utils/categories";

function WantedListPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const category = searchParams.get("category") || "";
  const status = searchParams.get("status") || "open";
  const search = searchParams.get("search") || "";

  const [searchInput, setSearchInput] = useState(search);
  const [posts, setPosts] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const searchDebounceRef = useRef(null);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, status });
      if (category) params.append("category", category);
      if (search) params.append("search", search);
      const res = await axiosInstance.get(`/api/wanted?${params}`);
      setPosts(res.data.posts || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, category, status, search]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const updateParams = (updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k));
      return next;
    }, { replace: true });
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      updateParams({ search: value, page: "" });
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* 상단 탭 — 홈과 동일한 구조 */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "전체", path: "/?tab=all" },
          { label: "즉시 판매", path: "/?tab=fixed" },
          { label: "경매", path: "/?tab=auction" },
        ].map((tab) => (
          <button
            key={tab.label}
            onClick={() => navigate(tab.path)}
            className="px-5 py-2 rounded-full font-medium transition bg-white text-slate-600 border hover:border-slate-400"
          >
            {tab.label}
          </button>
        ))}
        <button className="px-5 py-2 rounded-full font-medium transition bg-slate-800 text-white">
          삽니다
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">삽니다</h1>
        {user && (
          <Link to="/wanted/new" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">
            + 글쓰기
          </Link>
        )}
      </div>

      {/* 검색 + 상태 필터 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="제목 검색"
          className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={() => updateParams({ status: "open", page: "" })}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium border transition ${
              status === "open" ? "bg-slate-800 text-white border-slate-800" : "text-slate-600 hover:border-slate-400"
            }`}
          >
            진행 중
          </button>
          <button
            onClick={() => updateParams({ status: "all", page: "" })}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium border transition ${
              status === "all" ? "bg-slate-800 text-white border-slate-800" : "text-slate-600 hover:border-slate-400"
            }`}
          >
            전체 보기
          </button>
        </div>
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
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      post.status === "open" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {post.status === "open" ? "구매중" : "거래완료"}
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
