import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import axiosInstance from "../api/axios";
import { getCloudinaryUrl } from "../utils/cloudinary";

const AUCTION_STATUS_LABELS = { pending: "대기중", live: "진행중", ended: "종료됨" };
const FIXED_STATUS_LABELS = { available: "판매중", reserved: "예약중", sold: "판매완료" };
const FIXED_STATUS_COLORS = {
  available: "bg-green-100 text-green-700",
  reserved: "bg-yellow-100 text-yellow-700",
  sold: "bg-slate-100 text-slate-500",
};
const AUCTION_STATUS_COLORS = {
  pending: "bg-slate-100 text-slate-500",
  live: "bg-red-100 text-red-600",
  ended: "bg-slate-100 text-slate-500",
};

function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") || "all";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const filters = {
    search: searchParams.get("search") || "",
    category: searchParams.get("category") || "",
    status: searchParams.get("status") || "",
    sort: searchParams.get("sort") || "latest",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
  };

  const [searchInput, setSearchInput] = useState(filters.search);
  const [minPriceInput, setMinPriceInput] = useState(filters.minPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(filters.maxPrice);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  const searchDebounceRef = useRef(null);
  const priceDebounceRef = useRef(null);

  const updateParams = useCallback((updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/api/products/categories");
      setCategories(res.data.categories || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.category) params.append("category", filters.category);
      if (filters.sort) params.append("sort", filters.sort);
      if (filters.minPrice) params.append("minPrice", filters.minPrice);
      if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
      params.append("page", page);

      if (activeTab === "fixed") {
        params.append("saleType", "fixed");
        if (filters.status) params.append("fixedStatus", filters.status);
      } else if (activeTab === "auction") {
        params.append("saleType", "auction");
        if (filters.status) params.append("status", filters.status);
      }

      const res = await axiosInstance.get(`/api/products?${params.toString()}`);
      setProducts(res.data.products || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (error) {
      toast.error(error.response?.data?.message || "상품 목록 불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.category, filters.sort, filters.minPrice, filters.maxPrice, filters.status, activeTab, page]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      updateParams({ search: value, page: "" });
    }, 400);
  };

  const handlePriceChange = (field, value) => {
    if (field === "minPrice") setMinPriceInput(value);
    else setMaxPriceInput(value);

    clearTimeout(priceDebounceRef.current);
    priceDebounceRef.current = setTimeout(() => {
      updateParams({
        [field]: value,
        page: "",
      });
    }, 400);
  };

  const handleChange = (e) => {
    updateParams({ [e.target.name]: e.target.value, page: "" });
  };

  const handleTabChange = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      next.delete("status");
      next.delete("page");
      return next;
    }, { replace: true });
  };

  const handleReset = () => {
    setSearchInput("");
    setMinPriceInput("");
    setMaxPriceInput("");
    setSearchParams({ tab: activeTab }, { replace: true });
  };

  const displayPrice = (product) => {
    if (product.saleType === "fixed") return product.fixedPrice;
    return product.currentPrice;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold">상품 목록</h1>

      {/* 탭 */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "전체" },
          { key: "fixed", label: "즉시 판매" },
          { key: "auction", label: "경매" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-5 py-2 rounded-full font-medium transition ${
              activeTab === tab.key
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 border hover:border-slate-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-2xl shadow p-5 space-y-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="상품명 검색"
            value={searchInput}
            onChange={handleSearchChange}
            className="border rounded-lg px-4 py-3"
          />

          <select
            name="category"
            value={filters.category}
            onChange={handleChange}
            className="border rounded-lg px-4 py-3"
          >
            <option value="">전체 카테고리</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {activeTab !== "all" && (
            <select
              name="status"
              value={filters.status}
              onChange={handleChange}
              className="border rounded-lg px-4 py-3"
            >
              <option value="">전체 상태</option>
              {activeTab === "fixed" ? (
                <>
                  <option value="available">판매중</option>
                  <option value="reserved">예약중</option>
                  <option value="sold">판매완료</option>
                </>
              ) : (
                <>
                  <option value="pending">대기중</option>
                  <option value="live">진행중</option>
                  <option value="ended">종료됨</option>
                </>
              )}
            </select>
          )}

          <select
            name="sort"
            value={filters.sort}
            onChange={handleChange}
            className="border rounded-lg px-4 py-3"
          >
            <option value="latest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="priceHigh">가격 높은순</option>
            <option value="priceLow">가격 낮은순</option>
            <option value="popular">인기순</option>
          </select>
        </div>

        {/* 가격 범위 */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 shrink-0">가격 범위</span>
          <input
            type="number"
            placeholder="최소 금액"
            value={minPriceInput}
            min={0}
            onChange={(e) => handlePriceChange("minPrice", e.target.value)}
            className="border rounded-lg px-4 py-2 w-36 text-sm"
          />
          <span className="text-slate-400">~</span>
          <input
            type="number"
            placeholder="최대 금액"
            value={maxPriceInput}
            min={0}
            onChange={(e) => handlePriceChange("maxPrice", e.target.value)}
            className="border rounded-lg px-4 py-2 w-36 text-sm"
          />
          <span className="text-sm text-slate-500">원</span>
          <button
            onClick={handleReset}
            className="ml-auto bg-slate-800 text-white rounded-lg px-4 py-2 text-sm hover:bg-slate-700"
          >
            필터 초기화
          </button>
        </div>
      </div>

      {/* 상품 목록 */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow p-5 animate-pulse">
              <div className="h-48 bg-slate-200 rounded-xl mb-4" />
              <div className="h-5 bg-slate-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
              <div className="h-4 bg-slate-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow text-center text-slate-500">
          조건에 맞는 상품이 없습니다.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {products.map((product) => (
              <Link
                key={product._id}
                to={`/products/${product._id}`}
                className="bg-white rounded-2xl shadow p-3 sm:p-5 hover:shadow-lg transition"
              >
                <div className="h-32 sm:h-48 bg-slate-100 rounded-xl mb-3 sm:mb-4 overflow-hidden relative">
                  {product.images?.[0] ? (
                    <img
                      src={getCloudinaryUrl(product.images[0], { width: 400, height: 300 })}
                      alt={product.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                      이미지 없음
                    </div>
                  )}
                  <span className={`absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    product.saleType === "fixed"
                      ? "bg-blue-500 text-white"
                      : "bg-purple-500 text-white"
                  }`}>
                    {product.saleType === "fixed" ? "즉시구매" : "경매"}
                  </span>
                </div>

                <h2 className="text-sm sm:text-lg font-semibold mb-1 truncate">{product.title}</h2>
                <p className="text-slate-500 text-xs sm:text-sm mb-1 truncate">{product.category}</p>
                <p className="text-slate-800 font-medium text-sm sm:text-base mb-1">
                  {displayPrice(product)?.toLocaleString()}원
                </p>

                {product.saleType === "fixed" ? (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    FIXED_STATUS_COLORS[product.fixedStatus] ?? ""
                  }`}>
                    {FIXED_STATUS_LABELS[product.fixedStatus]}
                  </span>
                ) : (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    AUCTION_STATUS_COLORS[product.auctionStatus] ?? ""
                  }`}>
                    {AUCTION_STATUS_LABELS[product.auctionStatus]}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-2">
              <button
                onClick={() => updateParams({ page: String(page - 1) })}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg border hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                이전
              </button>
              <span className="text-slate-600">{page} / {totalPages}</span>
              <button
                onClick={() => updateParams({ page: String(page + 1) })}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg border hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default HomePage;
