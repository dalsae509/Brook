import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import axiosInstance from "../api/axios";

const PIE_COLORS = ["#60a5fa", "#fbbf24", "#34d399", "#a78bfa", "#f87171", "#94a3b8", "#f472b6", "#38bdf8"];

const SALE_TYPE_LABELS = { fixed: "즉시구매", auction: "경매" };
const STATUS_LABELS = {
  available: "판매중", reserved: "예약중", sold: "판매완료",
  pending: "대기중", live: "진행중", ended: "종료됨",
};

function AdminPage() {
  const [tab, setTab] = useState("analytics");

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [productTotal, setProductTotal] = useState(0);
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [productSearch, setProductSearch] = useState("");
  const [productsLoading, setProductsLoading] = useState(true);

  const [wantedPosts, setWantedPosts] = useState([]);
  const [wantedTotal, setWantedTotal] = useState(0);
  const [wantedPage, setWantedPage] = useState(1);
  const [wantedTotalPages, setWantedTotalPages] = useState(1);
  const [wantedSearch, setWantedSearch] = useState("");
  const [wantedLoading, setWantedLoading] = useState(true);

  const [reports, setReports] = useState([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [reportTotalPages, setReportTotalPages] = useState(1);
  const [reportStatus, setReportStatus] = useState("pending");
  const [reportsLoading, setReportsLoading] = useState(true);

  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const searchDebounceRef = useRef(null);

  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const res = await axiosInstance.get("/api/admin/users");
      setUsers(res.data.users || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "사용자 목록 불러오기 실패");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      const res = await axiosInstance.get("/api/admin/products", {
        params: { page: productPage, search: productSearch },
      });
      setProducts(res.data.products || []);
      setProductTotal(res.data.total || 0);
      setProductTotalPages(res.data.totalPages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "상품 목록 불러오기 실패");
    } finally {
      setProductsLoading(false);
    }
  }, [productPage, productSearch]);

  const fetchWantedPosts = useCallback(async () => {
    try {
      setWantedLoading(true);
      const res = await axiosInstance.get("/api/admin/wanted", {
        params: { page: wantedPage, search: wantedSearch },
      });
      setWantedPosts(res.data.posts || []);
      setWantedTotal(res.data.total || 0);
      setWantedTotalPages(res.data.totalPages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "삽니다 목록 불러오기 실패");
    } finally {
      setWantedLoading(false);
    }
  }, [wantedPage, wantedSearch]);

  const fetchReports = useCallback(async () => {
    try {
      setReportsLoading(true);
      const res = await axiosInstance.get("/api/reports", {
        params: { status: reportStatus, page: reportPage },
      });
      setReports(res.data.reports || []);
      setReportTotal(res.data.total || 0);
      setReportTotalPages(res.data.totalPages || 1);
    } catch (error) {
      console.error("fetchReports error:", error);
      toast.error("신고 목록 불러오기 실패");
    } finally {
      setReportsLoading(false);
    }
  }, [reportStatus, reportPage]);

  const handleProcessReport = async (reportId, status) => {
    try {
      await axiosInstance.patch(`/api/reports/${reportId}`, { status });
      setReports((prev) => prev.filter((r) => r._id !== reportId));
      setReportTotal((prev) => prev - 1);
      toast.success(status === "reviewed" ? "신고 확인 처리됨" : "신고 기각 처리됨");
    } catch (error) {
      toast.error(error.response?.data?.message || "처리 실패");
    }
  };

  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      const res = await axiosInstance.get("/api/admin/analytics");
      setAnalytics(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "분석 데이터 불러오기 실패");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchWantedPosts(); }, [fetchWantedPosts]);
  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`"${userName}" 사용자를 삭제하시겠습니까?`)) return;
    try {
      await axiosInstance.delete(`/api/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
    } catch (error) {
      toast.error(error.response?.data?.message || "삭제 실패");
    }
  };

  const handleForceDeleteWanted = async (postId, title) => {
    if (!window.confirm(`"${title}" 게시글을 강제 삭제하시겠습니까?`)) return;
    try {
      await axiosInstance.delete(`/api/admin/wanted/${postId}`);
      setWantedPosts((prev) => prev.filter((p) => p._id !== postId));
      setWantedTotal((prev) => prev - 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "삭제 실패");
    }
  };

  const handleForceDeleteProduct = async (productId, title) => {
    if (!window.confirm(`"${title}" 상품을 강제 삭제하시겠습니까?`)) return;
    try {
      await axiosInstance.delete(`/api/admin/products/${productId}`);
      setProducts((prev) => prev.filter((p) => p._id !== productId));
      setProductTotal((prev) => prev - 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "삭제 실패");
    }
  };

  const handleForceEndAuction = async (productId, title) => {
    if (!window.confirm(`"${title}" 경매를 강제 종료하시겠습니까?`)) return;
    try {
      await axiosInstance.post(`/api/admin/products/${productId}/end-auction`);
      await fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || "강제 종료 실패");
    }
  };

  const handleProductSearchChange = (e) => {
    const value = e.target.value;
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setProductPage(1);
      setProductSearch(value);
    }, 400);
  };

  const productStatus = (p) => {
    if (p.saleType === "fixed") return STATUS_LABELS[p.fixedStatus] ?? "-";
    return STATUS_LABELS[p.auctionStatus] ?? "-";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold">관리자 대시보드</h1>

      {/* 탭 */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "analytics", label: "📊 분석" },
          { key: "users", label: `사용자 관리 (${users.length})` },
          { key: "products", label: `상품 관리 (${productTotal})` },
          { key: "wanted", label: `삽니다 관리 (${wantedTotal})` },
          { key: "reports", label: `신고 관리 (${reportTotal})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-full font-medium transition ${
              tab === t.key
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 border hover:border-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 분석 */}
      {tab === "analytics" && (
        analyticsLoading || !analytics ? (
          <div className="bg-white rounded-2xl shadow p-6 text-slate-500">불러오는 중...</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white rounded-2xl shadow p-5">
                <p className="text-sm text-slate-400">총 거래액 (GMV)</p>
                <p className="text-2xl font-bold mt-1 text-green-600">{analytics.summary.gmv.toLocaleString()}원</p>
              </div>
              <div className="bg-white rounded-2xl shadow p-5">
                <p className="text-sm text-slate-400">총 거래 건수</p>
                <p className="text-2xl font-bold mt-1">{analytics.summary.transactions.toLocaleString()}건</p>
              </div>
              <div className="bg-white rounded-2xl shadow p-5">
                <p className="text-sm text-slate-400">총 사용자</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">{analytics.summary.totalUsers.toLocaleString()}명</p>
              </div>
              <div className="bg-white rounded-2xl shadow p-5">
                <p className="text-sm text-slate-400">총 상품</p>
                <p className="text-2xl font-bold mt-1">{analytics.summary.totalProducts.toLocaleString()}개</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="font-semibold mb-4">월별 거래액 (GMV)</h2>
              {analytics.salesByMonth.length === 0 ? (
                <p className="text-slate-400 text-sm py-10 text-center">거래 완료 데이터가 없습니다.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics.salesByMonth} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" fontSize={12} stroke="#94a3b8" />
                    <YAxis fontSize={12} stroke="#94a3b8" tickFormatter={(v) => `${(v / 10000).toLocaleString()}만`} />
                    <Tooltip formatter={(v) => `${v.toLocaleString()}원`} />
                    <Bar dataKey="gmv" fill="#34d399" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow p-5">
                <h2 className="font-semibold mb-4">신규 가입자 추이</h2>
                {analytics.usersByMonth.length === 0 ? (
                  <p className="text-slate-400 text-sm py-10 text-center">데이터가 없습니다.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={analytics.usersByMonth} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" fontSize={12} stroke="#94a3b8" />
                      <YAxis fontSize={12} stroke="#94a3b8" allowDecimals={false} />
                      <Tooltip formatter={(v) => `${v}명`} />
                      <Line type="monotone" dataKey="count" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow p-5">
                <h2 className="font-semibold mb-4">카테고리 분포</h2>
                {analytics.categoryDistribution.length === 0 ? (
                  <p className="text-slate-400 text-sm py-10 text-center">데이터가 없습니다.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={analytics.categoryDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {analytics.categoryDistribution.map((entry, i) => (
                          <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${v}개`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* 사용자 관리 */}
      {tab === "users" && (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          {usersLoading ? (
            <div className="p-6 text-slate-500">불러오는 중...</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-5 py-3">이름</th>
                  <th className="text-left px-5 py-3">이메일</th>
                  <th className="text-left px-5 py-3">역할</th>
                  <th className="text-left px-5 py-3">브룩 지수</th>
                  <th className="text-left px-5 py-3">가입일</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">
                      <Link to={`/users/${u._id}`} className="hover:underline text-blue-600">
                        {u.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === "admin" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {u.role === "admin" ? "관리자" : "일반"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {u.brookScore?.toFixed(1) ?? "-"}점
                    </td>
                    <td className="px-5 py-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      {u.role !== "admin" && (
                        <button
                          onClick={() => handleDeleteUser(u._id, u.name)}
                          className="text-red-500 hover:text-red-700 text-xs border border-red-200 hover:border-red-400 px-3 py-1 rounded-lg"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* 상품 관리 */}
      {tab === "products" && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="상품명 검색"
            onChange={handleProductSearchChange}
            className="border rounded-lg px-4 py-2 w-64"
          />
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            {productsLoading ? (
              <div className="p-6 text-slate-500">불러오는 중...</div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-5 py-3">상품명</th>
                    <th className="text-left px-5 py-3">판매자</th>
                    <th className="text-left px-5 py-3">유형</th>
                    <th className="text-left px-5 py-3">상태</th>
                    <th className="text-left px-5 py-3">등록일</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium">
                        <Link to={`/products/${p._id}`} className="hover:underline text-blue-600">
                          {p.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{p.seller?.name}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.saleType === "fixed" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        }`}>
                          {SALE_TYPE_LABELS[p.saleType]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{productStatus(p)}</td>
                      <td className="px-5 py-3 text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          {p.saleType === "auction" && p.auctionStatus === "live" && (
                            <button
                              onClick={() => handleForceEndAuction(p._id, p.title)}
                              className="text-orange-500 hover:text-orange-700 text-xs border border-orange-200 hover:border-orange-400 px-3 py-1 rounded-lg"
                            >
                              경매 종료
                            </button>
                          )}
                          <button
                            onClick={() => handleForceDeleteProduct(p._id, p.title)}
                            className="text-red-500 hover:text-red-700 text-xs border border-red-200 hover:border-red-400 px-3 py-1 rounded-lg"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {productTotalPages > 1 && (
            <div className="flex justify-center items-center gap-4">
              <button
                onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                disabled={productPage === 1}
                className="px-4 py-2 rounded-lg border hover:border-slate-400 disabled:opacity-40"
              >
                이전
              </button>
              <span className="text-slate-600">{productPage} / {productTotalPages}</span>
              <button
                onClick={() => setProductPage((p) => Math.min(productTotalPages, p + 1))}
                disabled={productPage === productTotalPages}
                className="px-4 py-2 rounded-lg border hover:border-slate-400 disabled:opacity-40"
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}

      {/* 삽니다 관리 */}
      {tab === "wanted" && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="제목 검색"
            onChange={(e) => {
              clearTimeout(searchDebounceRef.current);
              searchDebounceRef.current = setTimeout(() => {
                setWantedPage(1);
                setWantedSearch(e.target.value);
              }, 400);
            }}
            className="border rounded-lg px-4 py-2 w-64"
          />
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            {wantedLoading ? (
              <div className="p-6 text-slate-500">불러오는 중...</div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-5 py-3">제목</th>
                    <th className="text-left px-5 py-3">작성자</th>
                    <th className="text-left px-5 py-3">카테고리</th>
                    <th className="text-left px-5 py-3">상태</th>
                    <th className="text-left px-5 py-3">등록일</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {wantedPosts.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium max-w-[180px] truncate">
                        <a href={`/wanted/${p._id}`} className="hover:underline text-blue-600">{p.title}</a>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{p.author?.name}</td>
                      <td className="px-5 py-3 text-slate-500">{p.category}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === "open" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          {p.status === "open" ? "구매중" : "거래완료"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleForceDeleteWanted(p._id, p.title)}
                          className="text-red-500 hover:text-red-700 text-xs border border-red-200 hover:border-red-400 px-3 py-1 rounded-lg"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
          {wantedTotalPages > 1 && (
            <div className="flex justify-center items-center gap-4">
              <button onClick={() => setWantedPage((p) => Math.max(1, p - 1))} disabled={wantedPage === 1} className="px-4 py-2 rounded-lg border hover:border-slate-400 disabled:opacity-40">이전</button>
              <span className="text-slate-600">{wantedPage} / {wantedTotalPages}</span>
              <button onClick={() => setWantedPage((p) => Math.min(wantedTotalPages, p + 1))} disabled={wantedPage === wantedTotalPages} className="px-4 py-2 rounded-lg border hover:border-slate-400 disabled:opacity-40">다음</button>
            </div>
          )}
        </div>
      )}

      {/* 신고 관리 */}
      {tab === "reports" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {[
              { v: "pending", l: "대기 중" },
              { v: "reviewed", l: "처리됨" },
              { v: "dismissed", l: "기각됨" },
              { v: "all", l: "전체" },
            ].map((s) => (
              <button
                key={s.v}
                onClick={() => { setReportStatus(s.v); setReportPage(1); }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition border ${
                  reportStatus === s.v ? "bg-slate-800 text-white" : "text-slate-600 hover:border-slate-400"
                }`}
              >
                {s.l}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            {reportsLoading ? (
              <div className="p-6 text-slate-500">불러오는 중...</div>
            ) : reports.length === 0 ? (
              <div className="p-8 text-center text-slate-400">신고 내역이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-5 py-3">신고자</th>
                    <th className="text-left px-5 py-3">피신고자</th>
                    <th className="text-left px-5 py-3">사유</th>
                    <th className="text-left px-5 py-3">내용</th>
                    <th className="text-left px-5 py-3">연관 상품</th>
                    <th className="text-left px-5 py-3">상태</th>
                    <th className="text-left px-5 py-3">일시</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reports.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-500">{r.reporter?.name}</td>
                      <td className="px-5 py-3 font-medium">
                        <Link to={`/users/${r.reportedUser?._id}`} className="hover:underline text-blue-600">
                          {r.reportedUser?.name}
                        </Link>
                        <span className="ml-1 text-xs text-slate-400">({r.reportedUser?.brookScore?.toFixed(1) ?? "-"}점)</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{r.reason}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 max-w-[150px] truncate">{r.description || "-"}</td>
                      <td className="px-5 py-3">
                        {r.product ? (
                          <Link to={`/products/${r.product._id}`} className="text-xs text-blue-500 hover:underline">
                            {r.product.title}
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.status === "pending" ? "bg-yellow-100 text-yellow-700"
                          : r.status === "reviewed" ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-500"
                        }`}>
                          {r.status === "pending" ? "대기" : r.status === "reviewed" ? "확인" : "기각"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        {r.status === "pending" && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleProcessReport(r._id, "reviewed")}
                              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                            >
                              확인
                            </button>
                            <button
                              onClick={() => handleProcessReport(r._id, "dismissed")}
                              className="text-xs border border-slate-300 px-2 py-1 rounded hover:bg-slate-50"
                            >
                              기각
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
          {reportTotalPages > 1 && (
            <div className="flex justify-center items-center gap-4">
              <button onClick={() => setReportPage((p) => Math.max(1, p - 1))} disabled={reportPage === 1} className="px-4 py-2 rounded-lg border hover:border-slate-400 disabled:opacity-40">이전</button>
              <span className="text-slate-600">{reportPage} / {reportTotalPages}</span>
              <button onClick={() => setReportPage((p) => Math.min(reportTotalPages, p + 1))} disabled={reportPage === reportTotalPages} className="px-4 py-2 rounded-lg border hover:border-slate-400 disabled:opacity-40">다음</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminPage;
