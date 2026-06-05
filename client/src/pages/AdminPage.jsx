import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import axiosInstance from "../api/axios";

const SALE_TYPE_LABELS = { fixed: "즉시구매", auction: "경매" };
const STATUS_LABELS = {
  available: "판매중", reserved: "예약중", sold: "판매완료",
  pending: "대기중", live: "진행중", ended: "종료됨",
};

function AdminPage() {
  const [tab, setTab] = useState("users");

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [productTotal, setProductTotal] = useState(0);
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [productSearch, setProductSearch] = useState("");
  const [productsLoading, setProductsLoading] = useState(true);
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

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`"${userName}" 사용자를 삭제하시겠습니까?`)) return;
    try {
      await axiosInstance.delete(`/api/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
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
      <div className="flex gap-2">
        {[
          { key: "users", label: `사용자 관리 (${users.length})` },
          { key: "products", label: `상품 관리 (${productTotal})` },
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
    </div>
  );
}

export default AdminPage;
