import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axiosInstance from "../api/axios";
import { getCloudinaryUrl } from "../utils/cloudinary";
import BrookScore from "../components/BrookScore";
import ReportModal from "../components/ReportModal";
import useAuthStore from "../store/authStore";

const FIXED_STATUS_LABELS = { available: "판매중", reserved: "예약중", sold: "판매완료" };
const AUCTION_STATUS_LABELS = { pending: "대기중", live: "진행중", ended: "종료됨" };

function SellerProfilePage() {
  const { userId } = useParams();
  const { user } = useAuthStore();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [userRes, productsRes, reviewsRes] = await Promise.all([
        axiosInstance.get(`/api/users/${userId}`),
        axiosInstance.get(`/api/products?seller=${userId}&limit=50`),
        axiosInstance.get(`/api/reviews/user/${userId}`),
      ]);
      setSeller(userRes.data.user);
      setProducts(productsRes.data.products || []);
      setReviews(reviewsRes.data.reviews || []);
      setAverageRating(reviewsRes.data.averageRating);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <div>불러오는 중...</div>;
  if (!seller) return <div>사용자를 찾을 수 없습니다.</div>;

  const activeProducts = products.filter(
    (p) => !(p.saleType === "fixed" && p.fixedStatus === "sold") &&
            !(p.saleType === "auction" && p.auctionStatus === "ended")
  );
  const closedProducts = products.filter(
    (p) => (p.saleType === "fixed" && p.fixedStatus === "sold") ||
            (p.saleType === "auction" && p.auctionStatus === "ended")
  );

  return (
    <div className="space-y-8">
      {/* 프로필 헤더 */}
      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-500 shrink-0">
            {seller.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{seller.name}</h1>
              {user && user.id !== userId && (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-3 py-1 rounded-lg"
                >
                  신고
                </button>
              )}
            </div>
            <p className="text-slate-500 text-sm mt-1">가입일: {new Date(seller.createdAt).toLocaleDateString()}</p>
            {averageRating !== null && (
              <p className="text-yellow-500 mt-1 text-sm">
                {"★".repeat(Math.round(averageRating))}{"☆".repeat(5 - Math.round(averageRating))}{" "}
                <span className="text-slate-600">{averageRating}점 ({reviews.length}건)</span>
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <BrookScore
            score={seller.brookScore}
            completedDeals={seller.completedDeals}
            totalDeals={seller.totalDeals}
            cancelledDeals={seller.cancelledDeals}
            size="lg"
          />
        </div>
      </div>

      {showReportModal && (
        <ReportModal
          reportedUserId={userId}
          reportedUserName={seller.name}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* 판매 중 상품 */}
      <section>
        <h2 className="text-xl font-semibold mb-3">판매 중인 상품 ({activeProducts.length})</h2>
        {activeProducts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-slate-500">판매 중인 상품이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {activeProducts.map((product) => (
              <Link
                key={product._id}
                to={`/products/${product._id}`}
                className="bg-white rounded-2xl shadow p-4 hover:shadow-lg transition"
              >
                <div className="h-36 bg-slate-100 rounded-xl mb-3 overflow-hidden">
                  {product.images?.[0] ? (
                    <img
                      src={getCloudinaryUrl(product.images[0], { width: 400, height: 200 })}
                      alt={product.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">이미지 없음</div>
                  )}
                </div>
                <p className="font-semibold truncate">{product.title}</p>
                <p className="text-slate-500 text-sm">{product.category}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="font-medium text-sm">
                    {(product.saleType === "fixed" ? product.fixedPrice : product.currentPrice)?.toLocaleString()}원
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    product.saleType === "fixed" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                  }`}>
                    {product.saleType === "fixed"
                      ? FIXED_STATUS_LABELS[product.fixedStatus]
                      : AUCTION_STATUS_LABELS[product.auctionStatus]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 거래 후기 */}
      <section>
        <h2 className="text-xl font-semibold mb-3">거래 후기 ({reviews.length})</h2>
        {reviews.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-6 text-slate-500">아직 받은 후기가 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review._id} className="bg-white rounded-2xl shadow p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{review.reviewer?.name ?? "탈퇴한 사용자"}</span>
                  <span className="text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-yellow-500 text-sm">
                  {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                </p>
                {review.comment && <p className="text-slate-700 text-sm mt-1">{review.comment}</p>}
                {review.product && (
                  <Link to={`/products/${review.product._id}`} className="text-xs text-blue-500 hover:underline mt-1 block">
                    {review.product.title}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 판매 완료 상품 */}
      {closedProducts.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3 text-slate-500">거래 완료 ({closedProducts.length})</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {closedProducts.map((product) => (
              <Link
                key={product._id}
                to={`/products/${product._id}`}
                className="bg-white rounded-2xl shadow p-4 hover:shadow-lg transition opacity-60"
              >
                <p className="font-semibold truncate">{product.title}</p>
                <p className="text-slate-500 text-sm">{product.category}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default SellerProfilePage;
