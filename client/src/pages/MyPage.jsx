import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import axiosInstance from "../api/axios";
import useAuthStore from "../store/authStore";

const FIXED_STATUS_LABELS = { available: "판매중", reserved: "예약중", sold: "판매완료" };
const AUCTION_STATUS_LABELS = { pending: "대기중", live: "진행중", ended: "종료됨" };

function getProductPrice(product) {
  if (product.saleType === "fixed") return product.fixedPrice;
  return product.currentPrice;
}

function getProductStatus(product) {
  if (product.saleType === "fixed") return FIXED_STATUS_LABELS[product.fixedStatus] ?? "-";
  return AUCTION_STATUS_LABELS[product.auctionStatus] ?? "-";
}

function MyPage() {
  const { user } = useAuthStore();
  const [myProducts, setMyProducts] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [myWins, setMyWins] = useState([]);
  const [myPurchases, setMyPurchases] = useState([]);
  const [myWishlist, setMyWishlist] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleDelete = async (productId) => {
    if (!window.confirm("상품을 삭제하시겠습니까?")) return;
    try {
      await axiosInstance.delete(`/api/products/${productId}`);
      setMyProducts((prev) => prev.filter((p) => p._id !== productId));
    } catch (error) {
      toast.error(error.response?.data?.message || "삭제 실패");
    }
  };

  const fetchMyPageData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      const [productsRes, bidsRes, winsRes, purchasesRes, wishlistRes, reviewsRes] = await Promise.all([
        axiosInstance.get("/api/users/me/products"),
        axiosInstance.get("/api/users/me/bids"),
        axiosInstance.get("/api/users/me/wins"),
        axiosInstance.get("/api/users/me/purchases"),
        axiosInstance.get("/api/users/me/wishlist"),
        axiosInstance.get(`/api/reviews/user/${user.id}`),
      ]);

      setMyProducts(productsRes.data.products || []);
      setMyBids(bidsRes.data.bids || []);
      setMyWins(winsRes.data.products || []);
      setMyPurchases(purchasesRes.data.products || []);
      setMyWishlist(wishlistRes.data.wishlist || []);
      setMyReviews(reviewsRes.data.reviews || []);
      setAverageRating(reviewsRes.data.averageRating);
    } catch (error) {
      toast.error(error.response?.data?.message || "마이페이지 불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyPageData();
  }, [fetchMyPageData]);

  if (loading) {
    return (
      <div className="space-y-10 animate-pulse">
        <div className="h-9 bg-slate-200 rounded w-40" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-4">
            <div className="h-7 bg-slate-200 rounded w-48" />
            <div className="grid md:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="bg-white rounded-2xl shadow p-5 space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-3/4" />
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <h1 className="text-2xl sm:text-3xl font-bold">마이페이지</h1>

      <section>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">내가 등록한 상품</h2>
        {myProducts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-slate-500">
            등록한 상품이 없습니다.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {myProducts.map((product) => (
              <div key={product._id} className="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition relative">
                <Link to={`/products/${product._id}`}>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-semibold">{product.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    product.saleType === "fixed"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-purple-100 text-purple-700"
                  }`}>
                    {product.saleType === "fixed" ? "즉시구매" : "경매"}
                  </span>
                </div>
                <p className="text-slate-500">{product.category}</p>
                <p className="mt-2">
                  {product.saleType === "fixed" ? "판매가" : "현재가"}:{" "}
                  {getProductPrice(product)?.toLocaleString() ?? "-"}원
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  상태: {getProductStatus(product)}
                </p>
                </Link>
                {!(product.saleType === "auction" && product.auctionStatus === "live") &&
                  !(product.saleType === "fixed" && product.fixedStatus === "reserved") && (
                  <button
                    onClick={() => handleDelete(product._id)}
                    className="mt-3 text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg px-3 py-1"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">내 입찰 내역</h2>
        {myBids.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-slate-500">
            입찰한 내역이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {myBids.map((bid) => (
              <div key={bid._id} className="bg-white rounded-2xl shadow p-5">
                <Link
                  to={`/products/${bid.product?._id}`}
                  className="text-xl font-semibold text-blue-600"
                >
                  {bid.product?.title || "삭제된 상품"}
                </Link>
                <p className="mt-2">입찰 금액: {bid.amount.toLocaleString()}원</p>
                <p className="text-sm text-slate-500 mt-1">
                  입찰 시간: {new Date(bid.createdAt).toLocaleString()}
                </p>
                <p className="text-sm mt-1">
                  상품 상태:{" "}
                  {bid.product?.auctionStatus === "pending" && "대기중"}
                  {bid.product?.auctionStatus === "live" && "진행중"}
                  {bid.product?.auctionStatus === "ended" && "종료됨"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">내가 낙찰받은 상품</h2>
        {myWins.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-slate-500">
            낙찰받은 상품이 없습니다.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {myWins.map((product) => (
              <Link
                key={product._id}
                to={`/products/${product._id}`}
                className="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition"
              >
                <h3 className="text-xl font-semibold">{product.title}</h3>
                <p className="mt-2">
                  낙찰가: {product.currentPrice?.toLocaleString() ?? "-"}원
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  판매자: {product.seller?.name}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">즉시구매 내역</h2>
        {myPurchases.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-slate-500">
            즉시구매한 상품이 없습니다.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {myPurchases.map((product) => (
              <Link
                key={product._id}
                to={`/products/${product._id}`}
                className="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition"
              >
                <h3 className="text-xl font-semibold mb-1">{product.title}</h3>
                <p className="text-slate-500 text-sm">{product.category}</p>
                <p className="mt-2">구매가: {product.fixedPrice?.toLocaleString()}원</p>
                <p className="mt-1 text-sm">
                  판매자: <span className="text-slate-600">{product.seller?.name}</span>
                </p>
                <p className="mt-1 text-sm">
                  상태:{" "}
                  <span className={product.fixedStatus === "sold" ? "text-slate-400" : "text-yellow-600"}>
                    {product.fixedStatus === "sold" ? "거래완료" : "예약중"}
                  </span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-semibold">내가 받은 후기</h2>
          {averageRating !== null && (
            <span className="text-slate-500 text-sm">
              ★ {averageRating} ({myReviews.length}건)
            </span>
          )}
        </div>
        {myReviews.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-slate-500">
            받은 후기가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {myReviews.map((review) => (
              <div key={review._id} className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{review.reviewer.name}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-yellow-500">
                  {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                </p>
                {review.comment && (
                  <p className="text-slate-700 text-sm mt-1">{review.comment}</p>
                )}
                {review.product && (
                  <Link
                    to={`/products/${review.product._id}`}
                    className="text-xs text-blue-500 hover:underline mt-2 block"
                  >
                    {review.product.title}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">찜한 상품</h2>
        {myWishlist.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-slate-500">
            찜한 상품이 없습니다.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {myWishlist.map((product) => (
              <Link
                key={product._id}
                to={`/products/${product._id}`}
                className="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-semibold">{product.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    product.saleType === "fixed"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-purple-100 text-purple-700"
                  }`}>
                    {product.saleType === "fixed" ? "즉시구매" : "경매"}
                  </span>
                </div>
                <p className="text-slate-500 text-sm">{product.category}</p>
                <p className="mt-2">
                  {product.saleType === "fixed"
                    ? `${product.fixedPrice?.toLocaleString()}원`
                    : `현재가 ${product.currentPrice?.toLocaleString()}원`}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default MyPage;