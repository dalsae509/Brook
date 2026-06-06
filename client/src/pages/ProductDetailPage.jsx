import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import axiosInstance from "../api/axios";
import useAuthStore from "../store/authStore";
import socket from "../socket/socket";
import ReviewSection from "../components/ReviewSection";
import { getBidUnit } from "../utils/bidUnit";
import { CATEGORIES } from "../utils/categories";
import { getCloudinaryUrl } from "../utils/cloudinary";
import ReportModal from "../components/ReportModal";

const FIXED_STATUS_LABELS = { available: "판매중", reserved: "예약중", sold: "판매완료" };
const FIXED_STATUS_COLORS = {
  available: "text-green-600",
  reserved: "text-yellow-600",
  sold: "text-slate-400",
};

function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [bidAmount, setBidAmount] = useState("");
  const [proxyMax, setProxyMax] = useState(null);
  const [proxyInput, setProxyInput] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [timeLeft, setTimeLeft] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editImages, setEditImages] = useState([]);
  const [editImageFiles, setEditImageFiles] = useState([]);
  const [editPreviewUrls, setEditPreviewUrls] = useState([]);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledStartInput, setScheduledStartInput] = useState("");
  const [scheduleMinTime, setScheduleMinTime] = useState("");

  const enableScheduleMode = () => {
    setScheduleMinTime(new Date(Date.now() + 60000).toISOString().slice(0, 16));
    setScheduleMode(true);
  };
  const [scheduledDurationInput, setScheduledDurationInput] = useState(60);

  const isSeller = useMemo(() => {
    if (!user || !product?.seller) return false;
    return user.id === product.seller._id;
  }, [user, product]);

  const isWinner = useMemo(() => {
    if (!user || !product?.winner) return false;
    return user.id === product.winner._id;
  }, [user, product]);

  const isBuyer = useMemo(() => {
    if (!user || !product?.buyer) return false;
    return user.id === (product.buyer._id ?? product.buyer);
  }, [user, product]);

  const canEdit = useMemo(() => {
    if (!product) return false;
    return (
      (product.saleType === "fixed" && product.fixedStatus === "available") ||
      (product.saleType === "auction" && product.auctionStatus === "pending")
    );
  }, [product]);

  const bidUnit = useMemo(() => {
    if (!product || product.saleType !== "auction" || product.currentPrice == null) return null;
    return getBidUnit(product.currentPrice, product.bidTiers);
  }, [product]);

  const minBidAmount = useMemo(() => {
    if (bidUnit == null || product?.currentPrice == null) return null;
    return product.currentPrice + bidUnit;
  }, [product, bidUnit]);

  const fetchProductDetail = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/api/products/${id}`);
      setProduct(res.data.product);
    } catch (error) {
      if (error.response?.status === 404) {
        setNotFound(true);
      } else {
        toast.error(error.response?.data?.message || "상품 상세 조회 실패");
      }
    }
  }, [id]);

  const fetchBids = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/api/auctions/${id}/bids`);
      setBids(res.data.bids || []);
    } catch (error) {
      console.error(error);
    }
  }, [id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchProductDetail(), fetchBids()]);
      setLoading(false);
    };
    load();
  }, [fetchProductDetail, fetchBids]);

  useEffect(() => {
    if (!user) return;
    axiosInstance
      .get("/api/users/me/wishlist")
      .then((res) => {
        const ids = res.data.wishlist.map((p) => p._id);
        setIsWishlisted(ids.includes(id));
      })
      .catch(() => {});
  }, [user, id]);

  // 라이브 경매에서 내 자동 입찰 설정값 조회
  useEffect(() => {
    if (!user || product?.saleType !== "auction" || product?.auctionStatus !== "live") return;
    axiosInstance
      .get(`/api/auctions/${id}/auto-bid`)
      .then((res) => setProxyMax(res.data.maxAmount))
      .catch(() => {});
  }, [user, id, product?.saleType, product?.auctionStatus]);

  // 비슷한 상품 추천
  useEffect(() => {
    axiosInstance
      .get(`/api/products/${id}/recommendations`)
      .then((res) => setRecommendations(res.data.products || []))
      .catch(() => setRecommendations([]));
  }, [id]);

  const handleToggleWishlist = async () => {
    try {
      const res = await axiosInstance.post(`/api/users/me/wishlist/${id}`);
      setIsWishlisted(res.data.isWishlisted);
    } catch (error) {
      toast.error(error.response?.data?.message || "찜 처리 실패");
    }
  };

  // 경매 소켓 (auction 상품에서만 의미 있음)
  useEffect(() => {
    socket.emit("auction:join", id);

    const handleStarted = (payload) => {
      if (payload.productId !== id) return;
      setProduct((prev) => prev ? { ...prev, ...payload } : prev);
    };
    const handleBid = (payload) => {
      if (payload.productId !== id) return;
      setProduct((prev) => prev ? { ...prev, currentPrice: payload.currentPrice, endTime: payload.endTime } : prev);
      setBids((prev) => [payload.bid, ...prev]);
    };
    const handleEnded = (payload) => {
      if (payload.productId !== id) return;
      setProduct((prev) =>
        prev
          ? {
              ...prev,
              auctionStatus: "ended",
              endTime: payload.endTime,
              saleType: payload.converted ? "fixed" : prev.saleType,
              fixedStatus: payload.converted ? "available" : prev.fixedStatus,
              winner: payload.winner ? { _id: payload.winner.id, name: payload.winner.name } : null,
              currentPrice: payload.winner ? payload.winner.amount : prev.currentPrice,
            }
          : prev
      );
    };

    // 소켓 재연결 시 룸 재구독
    const handleReconnect = () => {
      socket.emit("auction:join", id);
    };

    socket.on("connect", handleReconnect);
    socket.on("auction:started", handleStarted);
    socket.on("auction:bid", handleBid);
    socket.on("auction:ended", handleEnded);

    return () => {
      socket.emit("auction:leave", id);
      socket.off("connect", handleReconnect);
      socket.off("auction:started", handleStarted);
      socket.off("auction:bid", handleBid);
      socket.off("auction:ended", handleEnded);
    };
  }, [id]);

  // 카운트다운 (남은 시간은 경매 진행 중일 때만 표시)
  useEffect(() => {
    if (!product?.endTime || product.auctionStatus !== "live") return;
    const update = () => {
      const diff = new Date(product.endTime).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("00:00"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [product]);

  // 경매 핸들러
  const handleStartAuction = async () => {
    try {
      await axiosInstance.post(`/api/auctions/${id}/start`, { durationMinutes: Number(durationMinutes) });
    } catch (error) {
      toast.error(error.response?.data?.message || "경매 시작 실패");
    }
  };

  const handleBid = async () => {
    try {
      await axiosInstance.post(`/api/auctions/${id}/bid`, { amount: Number(bidAmount) });
      setBidAmount("");
    } catch (error) {
      toast.error(error.response?.data?.message || "입찰 실패");
    }
  };

  const submitProxyBid = async (maxAmount) => {
    try {
      const res = await axiosInstance.post(`/api/auctions/${id}/auto-bid`, { maxAmount: Number(maxAmount) });
      setProxyMax(res.data.maxAmount);
      setProxyInput("");
      toast.success("자동 입찰이 설정되었습니다.");
    } catch (error) {
      toast.error(error.response?.data?.message || "자동 입찰 설정 실패");
    }
  };

  const handleSetProxyBid = () => submitProxyBid(proxyInput);

  const handleMobileProxy = () => {
    const input = window.prompt(
      proxyMax != null
        ? `현재 자동 입찰 최대가: ${proxyMax.toLocaleString()}원\n새 최대 입찰가를 입력하세요`
        : "자동 입찰 최대가를 입력하세요 (이 금액까지 자동으로 대신 입찰)"
    );
    if (input) submitProxyBid(input);
  };

  const handleEndAuction = async () => {
    try {
      await axiosInstance.post(`/api/auctions/${id}/end`);
    } catch (error) {
      toast.error(error.response?.data?.message || "경매 종료 실패");
    }
  };

  // 즉시 판매 핸들러
  const handlePurchase = async () => {
    try {
      const res = await axiosInstance.post(`/api/products/${id}/purchase`);
      navigate(`/chats/${res.data.chat._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "구매 실패");
    }
  };

  const handleConfirmTrade = async () => {
    try {
      await axiosInstance.post(`/api/products/${id}/confirm`);
      fetchProductDetail();
    } catch (error) {
      toast.error(error.response?.data?.message || "거래 완료 처리 실패");
    }
  };

  const handleCancelPurchase = async () => {
    try {
      await axiosInstance.post(`/api/products/${id}/cancel`);
      fetchProductDetail();
    } catch (error) {
      toast.error(error.response?.data?.message || "예약 취소 실패");
    }
  };

  const handleDeleteProduct = async () => {
    if (!window.confirm("상품을 삭제하시겠습니까?")) return;
    try {
      await axiosInstance.delete(`/api/products/${id}`);
      navigate("/");
    } catch (error) {
      toast.error(error.response?.data?.message || "삭제 실패");
    }
  };

  const MAX_EDIT_IMAGES = 5;

  const handleEditStart = () => {
    setEditForm({
      title: product.title,
      description: product.description,
      category: product.category,
      startPrice: product.startPrice ?? "",
      fixedPrice: product.fixedPrice ?? "",
    });
    setEditImages(product.images ?? []);
    setEditImageFiles([]);
    setEditPreviewUrls([]);
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    editPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setEditImageFiles([]);
    setEditPreviewUrls([]);
    setIsEditing(false);
  };

  const handleEditRemoveExisting = (index) => {
    setEditImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditAddFiles = (e) => {
    const selected = Array.from(e.target.files || []);
    const remaining = MAX_EDIT_IMAGES - editImages.length - editImageFiles.length;
    const toAdd = selected.slice(0, remaining);
    if (toAdd.length === 0) return;
    setEditImageFiles((prev) => [...prev, ...toAdd]);
    setEditPreviewUrls((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const handleEditRemoveNew = (index) => {
    URL.revokeObjectURL(editPreviewUrls[index]);
    setEditImageFiles((prev) => prev.filter((_, i) => i !== index));
    setEditPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const uploadedUrls = await Promise.all(
        editImageFiles.map((file) => {
          const formData = new FormData();
          formData.append("image", file);
          return axiosInstance
            .post("/api/uploads/image", formData, { headers: { "Content-Type": "multipart/form-data" } })
            .then((res) => res.data.imageUrl);
        })
      );
      const payload = {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        images: [...editImages, ...uploadedUrls],
      };
      if (product.saleType === "fixed") {
        payload.fixedPrice = Number(editForm.fixedPrice);
      } else {
        payload.startPrice = Number(editForm.startPrice);
      }
      await axiosInstance.patch(`/api/products/${id}`, payload);
      editPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
      setEditImageFiles([]);
      setEditPreviewUrls([]);
      await fetchProductDetail();
      setIsEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.message || "수정 실패");
    }
  };

  const handleScheduleAuction = async () => {
    if (!scheduledStartInput) { toast.error("예약 시간을 선택해주세요."); return; }
    try {
      await axiosInstance.post(`/api/auctions/${id}/schedule`, {
        scheduledStartTime: new Date(scheduledStartInput).toISOString(),
        durationMinutes: Number(scheduledDurationInput),
      });
      toast.success("경매가 예약되었습니다.");
      fetchProductDetail();
    } catch (error) {
      toast.error(error.response?.data?.message || "경매 예약 실패");
    }
  };

  const handleCancelAuctionSchedule = async () => {
    try {
      await axiosInstance.delete(`/api/auctions/${id}/schedule`);
      toast.success("경매 예약이 취소되었습니다.");
      fetchProductDetail();
    } catch (error) {
      toast.error(error.response?.data?.message || "예약 취소 실패");
    }
  };

  const handleConfirmAuctionTrade = async () => {
    try {
      await axiosInstance.post(`/api/products/${id}/confirm-auction`);
      fetchProductDetail();
    } catch (error) {
      toast.error(error.response?.data?.message || "거래 완료 처리 실패");
    }
  };

  // 낙찰자 채팅 시작 (winner용 — POST /api/chats가 기존 채팅방을 반환)
  const handleOpenChat = async () => {
    try {
      const res = await axiosInstance.post("/api/chats", { productId: id });
      navigate(`/chats/${res.data.chat._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "채팅 시작 실패");
    }
  };

  // 판매자용 — 이 상품의 채팅방을 채팅 목록에서 찾아 이동
  const handleSellerGoToChat = async () => {
    try {
      const res = await axiosInstance.get("/api/chats");
      const chat = res.data.chats.find((c) => c.product?._id === id);
      navigate(chat ? `/chats/${chat._id}` : "/chats");
    } catch {
      navigate("/chats");
    }
  };

  if (loading) return (
    <div className="grid lg:grid-cols-3 gap-8 animate-pulse">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="h-80 bg-slate-200 rounded-xl mb-4" />
          <div className="h-8 bg-slate-200 rounded w-2/3 mb-3" />
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
          <div className="h-24 bg-slate-200 rounded mb-4" />
          <div className="h-6 bg-slate-200 rounded w-1/4" />
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow p-6 h-64 bg-slate-200 rounded-xl" />
    </div>
  );
  if (notFound) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <p className="text-5xl mb-4">🗑️</p>
      <h2 className="text-xl font-bold text-slate-800 mb-2">삭제된 상품입니다</h2>
      <p className="text-slate-500 mb-6">이 상품은 판매자가 삭제했거나 존재하지 않습니다.</p>
      <button onClick={() => navigate("/")} className="bg-slate-800 text-white px-6 py-2.5 rounded-lg hover:bg-slate-700">
        홈으로
      </button>
    </div>
  );
  if (!product) return null;

  const isFixed = product.saleType === "fixed";

  return (
    <div className="grid lg:grid-cols-3 gap-8 pb-24 lg:pb-0">
      {/* 상품 정보 */}
      <div className="lg:col-span-2 space-y-6">
      <div className="bg-white rounded-2xl shadow p-6">
        {/* 이미지 슬라이더 */}
        {(() => {
          const images = product.images ?? [];
          const total = images.length;
          const idx = Math.min(slideIndex, Math.max(0, total - 1));
          return (
            <div className="mb-6 space-y-2">
              <div className="h-80 bg-slate-100 rounded-xl overflow-hidden relative">
                {total > 0 ? (
                  <img
                    src={getCloudinaryUrl(images[idx], { width: 800 })}
                    alt={`${product.title} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">이미지 없음</div>
                )}
                <span className={`absolute top-3 left-3 text-sm font-semibold px-3 py-1 rounded-full ${
                  isFixed ? "bg-blue-500 text-white" : "bg-purple-500 text-white"
                }`}>
                  {isFixed ? "즉시구매" : "경매"}
                </span>
                {total > 1 && (
                  <>
                    <button
                      onClick={() => setSlideIndex((i) => (i - 1 + total) % total)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setSlideIndex((i) => (i + 1) % total)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center"
                    >
                      ›
                    </button>
                    <span className="absolute bottom-2 right-3 text-xs text-white bg-black/40 px-2 py-0.5 rounded-full">
                      {idx + 1} / {total}
                    </span>
                  </>
                )}
              </div>
              {total > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setSlideIndex(i)}
                      className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                        i === idx ? "border-slate-800" : "border-transparent"
                      }`}
                    >
                      <img src={getCloudinaryUrl(url, { width: 120, height: 120 })} alt={`썸네일 ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* 판매자 액션 버튼 */}
        {isSeller && (
          <div className="flex gap-2 mb-4">
            {canEdit && !isEditing && (
              <button
                onClick={handleEditStart}
                className="text-sm border border-slate-300 px-4 py-1.5 rounded-lg hover:border-slate-500"
              >
                수정
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleDeleteProduct}
                className="text-sm border border-red-200 text-red-500 px-4 py-1.5 rounded-lg hover:border-red-400"
              >
                삭제
              </button>
            )}
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="space-y-3 mb-6">
            <input
              value={editForm.title}
              onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="상품명"
              required
              className="w-full border rounded-lg px-4 py-2"
            />
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="상품 설명"
              required
              className="w-full border rounded-lg px-4 py-2 h-28"
            />
            <select
              value={editForm.category}
              onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
              required
              className="w-full border rounded-lg px-4 py-2"
            >
              <option value="">카테고리 선택</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {product.saleType === "fixed" ? (
              <input
                type="number"
                value={editForm.fixedPrice}
                onChange={(e) => setEditForm((p) => ({ ...p, fixedPrice: e.target.value }))}
                placeholder="판매가"
                required
                min={0}
                className="w-full border rounded-lg px-4 py-2"
              />
            ) : (
              <input
                type="number"
                value={editForm.startPrice}
                onChange={(e) => setEditForm((p) => ({ ...p, startPrice: e.target.value }))}
                placeholder="시작가"
                required
                min={0}
                className="w-full border rounded-lg px-4 py-2"
              />
            )}

            {/* 이미지 편집 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">이미지 (최대 {MAX_EDIT_IMAGES}장)</p>
                <span className="text-xs text-slate-400">
                  {editImages.length + editImageFiles.length} / {MAX_EDIT_IMAGES}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {editImages.map((url, i) => (
                  <div key={`exist-${i}`} className="relative aspect-square">
                    <img src={url} alt={`이미지 ${i + 1}`} className="w-full h-full object-cover rounded-lg border" />
                    {i === 0 && editImageFiles.length === 0 && (
                      <span className="absolute top-1 left-1 bg-slate-800 text-white text-xs px-1.5 py-0.5 rounded">대표</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEditRemoveExisting(i)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {editPreviewUrls.map((url, i) => (
                  <div key={`new-${i}`} className="relative aspect-square">
                    <img src={url} alt={`새 이미지 ${i + 1}`} className="w-full h-full object-cover rounded-lg border border-blue-300" />
                    {editImages.length === 0 && i === 0 && (
                      <span className="absolute top-1 left-1 bg-slate-800 text-white text-xs px-1.5 py-0.5 rounded">대표</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEditRemoveNew(i)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {editImages.length + editImageFiles.length < MAX_EDIT_IMAGES && (
                <label className="flex items-center justify-center w-full h-16 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition">
                  <span className="text-slate-400 text-sm">+ 이미지 추가</span>
                  <input type="file" accept="image/*" multiple onChange={handleEditAddFiles} className="hidden" />
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-700">
                저장
              </button>
              <button
                type="button"
                onClick={handleEditCancel}
                className="flex-1 border py-2 rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <h1 className="text-xl sm:text-3xl font-bold">{product.title}</h1>
              {user && !isSeller && (
                <button
                  onClick={handleToggleWishlist}
                  className="ml-3 mt-1 text-2xl shrink-0"
                  aria-label={isWishlisted ? "찜 해제" : "찜하기"}
                >
                  {isWishlisted ? "❤️" : "🤍"}
                </button>
              )}
            </div>
            <p className="text-slate-500 mb-1">카테고리: {product.category}</p>
            <p className="text-xs text-slate-400 mb-4">조회 {product.views?.toLocaleString() ?? 0}회</p>
            <p className="text-slate-700 mb-6 whitespace-pre-wrap">{product.description}</p>
          </>
        )}

        <div className="space-y-2 text-lg">
          <div className="flex items-center gap-3 flex-wrap">
            <p>
              판매자:{" "}
              <Link to={`/users/${product.seller?._id}`} className="text-blue-600 hover:underline">
                {product.seller?.name}
              </Link>
            </p>
            {product.seller?.brookScore != null && (
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                브룩 {product.seller.brookScore.toFixed(1)}점
              </span>
            )}
            {user && !isSeller && (
              <button
                onClick={() => setShowReportModal(true)}
                className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-0.5 rounded-lg"
              >
                신고
              </button>
            )}
          </div>
          {showReportModal && (
            <ReportModal
              reportedUserId={product.seller?._id}
              reportedUserName={product.seller?.name}
              productId={product._id}
              onClose={() => setShowReportModal(false)}
            />
          )}

          {isFixed ? (
            <>
              <p className="font-semibold">
                판매가: {product.fixedPrice?.toLocaleString()}원
              </p>
              <p>
                상태:{" "}
                <span className={`font-medium ${FIXED_STATUS_COLORS[product.fixedStatus]}`}>
                  {FIXED_STATUS_LABELS[product.fixedStatus]}
                </span>
              </p>
              {product.fixedStatus === "reserved" && product.buyer && (
                <p className="text-sm text-slate-500">
                  예약자: {product.buyer.name ?? "확인 중"}
                </p>
              )}
            </>
          ) : (
            <>
              <p>시작가: {product.startPrice?.toLocaleString()}원</p>
              <p className="font-semibold text-xl">
                현재가: {product.currentPrice?.toLocaleString()}원
              </p>
              {product.auctionStatus === "live" && minBidAmount != null && (
                <p className="text-sm text-slate-500">
                  최소 입찰가: {minBidAmount.toLocaleString()}원
                  <span className="ml-2 text-xs">(단위: {bidUnit?.toLocaleString()}원)</span>
                </p>
              )}
              <p>
                상태:{" "}
                {product.auctionStatus === "pending" && "대기중"}
                {product.auctionStatus === "live" && "진행중"}
                {product.auctionStatus === "ended" && "종료됨"}
              </p>
              {product.auctionStatus === "pending" && product.scheduledStartTime && !isSeller && (
                <p className="text-sm text-purple-600">
                  경매 시작 예정: {new Date(product.scheduledStartTime).toLocaleString("ko-KR")}
                </p>
              )}
              {product.auctionStatus === "live" && (
                <p className="text-red-600 font-bold">남은 시간: {timeLeft}</p>
              )}
              {product.auctionStatus === "ended" && (
                <p>낙찰자: {product.winner ? product.winner.name : "없음 (유찰)"}</p>
              )}
              {product.auctionStatus === "ended" && product.auctionTradeConfirmed && (
                <p className="text-green-600 font-medium text-sm">거래 완료</p>
              )}
            </>
          )}
        </div>
      </div>

      <ReviewSection productId={id} product={product} user={user} />
      </div>

      {/* 액션 패널 (데스크탑) */}
      <div className="hidden lg:block space-y-6">
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">
            {isFixed ? "구매하기" : "경매 참여"}
          </h2>

          {!user ? (
            <p className="text-slate-500">로그인 후 참여할 수 있습니다.</p>
          ) : isFixed ? (
            /* 즉시 판매 액션 */
            <div className="space-y-3">
              {!isSeller && product.fixedStatus === "available" && (
                <button
                  onClick={handlePurchase}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
                >
                  구매하기
                </button>
              )}
              {(isSeller || isBuyer) && product.fixedStatus === "reserved" && (
                <button
                  onClick={handleConfirmTrade}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700"
                >
                  {isSeller ? "거래 완료" : "거래 완료(수령 확인)"}
                </button>
              )}
              {(isSeller || isBuyer) && product.fixedStatus === "reserved" && (
                <button
                  onClick={handleCancelPurchase}
                  className="w-full border border-red-400 text-red-500 py-3 rounded-lg hover:bg-red-50"
                >
                  예약 취소
                </button>
              )}
              {isBuyer && product.fixedStatus === "reserved" && (
                <button
                  onClick={() => navigate("/chats")}
                  className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-700"
                >
                  채팅방으로 이동
                </button>
              )}
              {product.fixedStatus === "sold" && (
                <p className="text-slate-400 text-center">판매 완료된 상품입니다.</p>
              )}
              {!isSeller && product.fixedStatus === "reserved" && !isBuyer && (
                <p className="text-slate-500 text-sm">이미 예약된 상품입니다.</p>
              )}
            </div>
          ) : (
            /* 경매 액션 */
            <div className="space-y-3">
              {isSeller && product.auctionStatus === "pending" && (
                <div className="space-y-3">
                  {product.scheduledStartTime ? (
                    <div className="border rounded-xl p-4 bg-slate-50 space-y-2">
                      <p className="text-sm font-medium text-slate-700">예약된 경매 시작</p>
                      <p className="text-slate-600 text-sm">
                        {new Date(product.scheduledStartTime).toLocaleString("ko-KR")}
                      </p>
                      <p className="text-xs text-slate-500">경매 시간: {product.scheduledDurationMinutes}분</p>
                      <button
                        onClick={handleCancelAuctionSchedule}
                        className="text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg px-3 py-1.5"
                      >
                        예약 취소
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setScheduleMode(false)}
                          className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                            !scheduleMode ? "bg-slate-800 text-white border-slate-800" : "text-slate-500 hover:border-slate-400"
                          }`}
                        >
                          즉시 시작
                        </button>
                        <button
                          type="button"
                          onClick={enableScheduleMode}
                          className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                            scheduleMode ? "bg-slate-800 text-white border-slate-800" : "text-slate-500 hover:border-slate-400"
                          }`}
                        >
                          예약 시작
                        </button>
                      </div>
                      <input
                        type="number"
                        value={scheduleMode ? scheduledDurationInput : durationMinutes}
                        onChange={(e) =>
                          scheduleMode
                            ? setScheduledDurationInput(e.target.value)
                            : setDurationMinutes(e.target.value)
                        }
                        className="w-full border rounded-lg px-4 py-3"
                        placeholder="경매 시간(분)"
                        min={1}
                      />
                      {scheduleMode && (
                        <input
                          type="datetime-local"
                          value={scheduledStartInput}
                          onChange={(e) => setScheduledStartInput(e.target.value)}
                          min={scheduleMinTime}
                          className="w-full border rounded-lg px-4 py-3"
                        />
                      )}
                      <button
                        onClick={scheduleMode ? handleScheduleAuction : handleStartAuction}
                        className={`w-full py-3 rounded-lg text-white ${
                          scheduleMode
                            ? "bg-purple-600 hover:bg-purple-700"
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                      >
                        {scheduleMode ? "예약 설정" : "경매 시작"}
                      </button>
                    </>
                  )}
                </div>
              )}
              {!isSeller && product.auctionStatus === "live" && (
                <>
                  {bidUnit != null && (
                    <div className="flex gap-2">
                      {[1, 2, 5].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setBidAmount(String(product.currentPrice + bidUnit * m))}
                          className="flex-1 text-sm border rounded-lg px-2 py-2 hover:border-purple-400 hover:text-purple-600 transition"
                        >
                          +{(bidUnit * m).toLocaleString()}원
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="w-full border rounded-lg px-4 py-3"
                    placeholder={
                      minBidAmount != null
                        ? `최소 ${minBidAmount.toLocaleString()}원 이상`
                        : "입찰 금액"
                    }
                    min={minBidAmount ?? 0}
                  />
                  <button
                    onClick={handleBid}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700"
                  >
                    입찰하기
                  </button>

                  {/* 자동 입찰 (proxy bidding) */}
                  <div className="border-t pt-3 mt-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">🤖 자동 입찰</p>
                      {proxyMax != null && (
                        <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                          최대 {proxyMax.toLocaleString()}원 설정됨
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      최대 금액만 정하면, 다른 입찰이 들어올 때 한 단위씩만 자동으로 대신 입찰합니다.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={proxyInput}
                        onChange={(e) => setProxyInput(e.target.value)}
                        className="flex-1 border rounded-lg px-4 py-2.5 text-sm"
                        placeholder="최대 입찰가"
                        min={minBidAmount ?? 0}
                      />
                      <button
                        onClick={handleSetProxyBid}
                        disabled={!proxyInput}
                        className="bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-40 shrink-0"
                      >
                        {proxyMax != null ? "수정" : "설정"}
                      </button>
                    </div>
                  </div>
                </>
              )}
              {isSeller && product.auctionStatus === "live" && (
                <button
                  onClick={handleEndAuction}
                  className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700"
                >
                  경매 종료
                </button>
              )}
              {isWinner && product.auctionStatus === "ended" && (
                <>
                  <button
                    onClick={handleOpenChat}
                    className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-700"
                  >
                    채팅방으로 이동
                  </button>
                  {product.auctionTradeConfirmed ? (
                    <p className="text-center text-green-600 font-medium text-sm">거래가 완료되었습니다.</p>
                  ) : (
                    <button
                      onClick={handleConfirmAuctionTrade}
                      className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700"
                    >
                      거래 완료(수령 확인)
                    </button>
                  )}
                </>
              )}
              {isSeller && product.auctionStatus === "ended" && product.winner && (
                product.auctionTradeConfirmed ? (
                  <p className="text-center text-green-600 font-medium">거래 완료됨</p>
                ) : (
                  <>
                    <button
                      onClick={handleSellerGoToChat}
                      className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-700"
                    >
                      낙찰자와 채팅하기
                    </button>
                    <button
                      onClick={handleConfirmAuctionTrade}
                      className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700"
                    >
                      거래 완료
                    </button>
                  </>
                )
              )}
              {!isSeller && product.auctionStatus === "pending" && (
                product.scheduledStartTime ? (
                  <div className="border rounded-xl p-4 bg-purple-50 space-y-1">
                    <p className="text-sm font-medium text-purple-700">경매 시작 예정</p>
                    <p className="text-sm text-purple-600">
                      {new Date(product.scheduledStartTime).toLocaleString("ko-KR")}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">판매자가 아직 경매를 시작하지 않았습니다.</p>
                )
              )}
            </div>
          )}
        </div>

        {/* 입찰 내역 (경매 전용) */}
        {!isFixed && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">입찰 내역</h2>
            {bids.length === 0 ? (
              <p className="text-slate-500">아직 입찰이 없습니다.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {bids.map((bid) => (
                  <div key={bid._id} className="border rounded-xl p-3 bg-slate-50">
                    <p className="font-medium">{bid.bidder?.name}</p>
                    <p>{bid.amount.toLocaleString()}원</p>
                    <p className="text-xs text-slate-500">{new Date(bid.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 비슷한 상품 추천 */}
      {recommendations.length > 0 && (
        <section className="lg:col-span-3">
          <h2 className="text-xl font-bold mb-4">비슷한 상품</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {recommendations.map((p) => (
              <Link
                key={p._id}
                to={`/products/${p._id}`}
                className="bg-white rounded-2xl shadow hover:shadow-lg transition overflow-hidden"
              >
                <div className="aspect-square bg-slate-100 overflow-hidden">
                  {p.images?.[0] ? (
                    <img src={getCloudinaryUrl(p.images[0], { width: 300, height: 300 })} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm">이미지 없음</div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.saleType === "fixed" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {p.saleType === "fixed" ? "즉시구매" : "경매"}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-sm text-slate-700 mt-0.5">
                    {(p.saleType === "fixed" ? p.fixedPrice : p.currentPrice ?? p.startPrice)?.toLocaleString()}원
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 모바일 하단 고정 액션 바 */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40 px-4 py-3">
        {!user ? (
          <Link to="/login" className="block w-full text-center bg-slate-800 text-white py-3 rounded-xl font-medium">
            로그인하고 참여하기
          </Link>
        ) : isFixed ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400">판매가</p>
              <p className="font-bold text-slate-800">{product.fixedPrice?.toLocaleString()}원</p>
            </div>
            {!isSeller && product.fixedStatus === "available" && (
              <button onClick={handlePurchase} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700">
                구매하기
              </button>
            )}
            {isBuyer && product.fixedStatus === "reserved" && (
              <button onClick={() => navigate("/chats")} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-medium">
                채팅방으로 이동
              </button>
            )}
            {(isSeller || isBuyer) && product.fixedStatus === "reserved" && (
              <button onClick={handleConfirmTrade} className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium">
                {isSeller ? "거래 완료" : "거래 완료(수령 확인)"}
              </button>
            )}
            {product.fixedStatus === "sold" && (
              <p className="text-slate-400 font-medium">판매 완료</p>
            )}
          </div>
        ) : (
          <div>
            {!isSeller && product.auctionStatus === "live" && (
              <div className="space-y-1.5">
                <div className="flex gap-2 items-center">
                  <div className="shrink-0">
                    <p className="text-xs text-slate-400">현재가</p>
                    <p className="font-bold text-slate-800 text-sm">{product.currentPrice?.toLocaleString()}원</p>
                  </div>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder={minBidAmount != null ? `최소 ${minBidAmount.toLocaleString()}원` : "입찰 금액"}
                    className="flex-1 border rounded-xl px-3 py-2.5 text-sm min-w-0"
                  />
                  <button onClick={handleBid} className="bg-purple-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm shrink-0 hover:bg-purple-700">
                    입찰
                  </button>
                </div>
                <button onClick={handleMobileProxy} className="text-xs text-slate-500 hover:text-purple-600">
                  🤖 자동 입찰 {proxyMax != null ? `(최대 ${proxyMax.toLocaleString()}원)` : "설정"}
                </button>
              </div>
            )}
            {isSeller && product.auctionStatus === "live" && (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs text-slate-400">현재가</p>
                  <p className="font-bold text-slate-800">{product.currentPrice?.toLocaleString()}원</p>
                </div>
                <button onClick={handleEndAuction} className="bg-red-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-red-700">
                  경매 종료
                </button>
              </div>
            )}
            {isSeller && product.auctionStatus === "pending" && (
              <button onClick={handleStartAuction} className="w-full bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700">
                경매 시작 ({durationMinutes}분) — 위에서 시간 변경 가능
              </button>
            )}
            {isWinner && product.auctionStatus === "ended" && (
              <div className="flex gap-2">
                <button onClick={handleOpenChat} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-medium text-sm hover:bg-slate-700">
                  채팅방으로 이동
                </button>
                {!product.auctionTradeConfirmed && (
                  <button onClick={handleConfirmAuctionTrade} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-green-700">
                    거래 완료(수령 확인)
                  </button>
                )}
              </div>
            )}
            {isSeller && product.auctionStatus === "ended" && product.winner && !product.auctionTradeConfirmed && (
              <div className="flex gap-2">
                <button onClick={handleSellerGoToChat} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-medium text-sm">
                  낙찰자와 채팅
                </button>
                <button onClick={handleConfirmAuctionTrade} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-medium text-sm">
                  거래 완료
                </button>
              </div>
            )}
            {product.auctionStatus === "ended" && !isWinner && !isSeller && (
              <p className="text-center text-slate-400 text-sm py-2">종료된 경매입니다.</p>
            )}
            {product.auctionStatus === "pending" && !isSeller && (
              <p className="text-center text-slate-400 text-sm py-2">
                {product.scheduledStartTime
                  ? `경매 시작 예정: ${new Date(product.scheduledStartTime).toLocaleString("ko-KR")}`
                  : "판매자가 아직 경매를 시작하지 않았습니다."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductDetailPage;
