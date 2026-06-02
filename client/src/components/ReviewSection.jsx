import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import axiosInstance from "../api/axios";

const STARS = [1, 2, 3, 4, 5];

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="text-2xl"
        >
          {star <= (hovered || value) ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

function ReviewSection({ productId, product, user }) {
  const [reviews, setReviews] = useState([]);
  const [myReview, setMyReview] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canReview = user && (
    (product.saleType === "auction" &&
      product.auctionStatus === "ended" &&
      product.winner?._id === user.id) ||
    (product.saleType === "fixed" &&
      product.fixedStatus === "sold" &&
      (product.buyer?._id ?? product.buyer) === user.id)
  );

  const fetchReviews = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/api/reviews/product/${productId}`);
      const list = res.data.reviews || [];
      setReviews(list);
      if (user) {
        setMyReview(list.find((r) => r.reviewer._id === user.id) ?? null);
      }
    } catch (error) {
      console.error(error);
    }
  }, [productId, user]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) { toast.error("별점을 선택해주세요."); return; }
    try {
      setSubmitting(true);
      await axiosInstance.post("/api/reviews", { productId, rating, comment });
      toast.success("후기가 등록되었습니다.");
      setRating(0);
      setComment("");
      await fetchReviews();
    } catch (error) {
      toast.error(error.response?.data?.message || "리뷰 작성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const averageRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;

  return (
    <div className="bg-white rounded-2xl shadow p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">거래 후기</h2>
        {averageRating !== null && (
          <span className="text-sm text-slate-500">
            ★ {averageRating} ({reviews.length}건)
          </span>
        )}
      </div>

      {canReview && !myReview && (
        <form onSubmit={handleSubmit} className="space-y-3 border rounded-xl p-4 bg-slate-50">
          <p className="text-sm font-medium text-slate-700">판매자에게 후기를 남겨주세요</p>
          <StarRating value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="후기를 작성해주세요 (선택)"
            maxLength={500}
            className="w-full border rounded-lg px-4 py-2 text-sm h-24 resize-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-slate-800 text-white px-5 py-2 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50"
          >
            후기 등록
          </button>
        </form>
      )}

      {myReview && (
        <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 text-sm">
          <p className="font-medium text-blue-700 mb-1">내가 작성한 후기</p>
          <p>{"★".repeat(myReview.rating)}{"☆".repeat(5 - myReview.rating)}</p>
          {myReview.comment && <p className="mt-1 text-slate-700">{myReview.comment}</p>}
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-slate-400 text-sm">아직 후기가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review._id} className="border rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{review.reviewer.name}</span>
                <span className="text-xs text-slate-400">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-yellow-500 text-sm">
                {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
              </p>
              {review.comment && (
                <p className="text-slate-700 text-sm mt-1">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReviewSection;
