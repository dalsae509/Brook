import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axiosInstance from "../api/axios";
import useAuthStore from "../store/authStore";
import { CATEGORIES } from "../utils/categories";

function CreateProductPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [saleType, setSaleType] = useState("auction");
  const [onFailedAuction, setOnFailedAuction] = useState("close");
  const [useCustomTiers, setUseCustomTiers] = useState(false);
  const [bidTiers, setBidTiers] = useState([
    { upTo: 100000, unit: 5000 },
    { upTo: null, unit: 10000 },
  ]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    startPrice: "",
    fixedPrice: "",
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => { previewUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [previewUrls]);

  if (!user) return <div>로그인 후 이용해주세요.</div>;

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const MAX_IMAGES = 5;

  const handleImageChange = (e) => {
    const selected = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - imageFiles.length;
    const toAdd = selected.slice(0, remaining);
    if (toAdd.length === 0) return;
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    const newFiles = [...imageFiles, ...toAdd];
    setImageFiles(newFiles);
    setPreviewUrls(newFiles.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  };

  const handleRemoveImage = (index) => {
    URL.revokeObjectURL(previewUrls[index]);
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    if (imageFiles.length === 0) return [];
    const results = await Promise.all(
      imageFiles.map((file) => {
        const formData = new FormData();
        formData.append("image", file);
        return axiosInstance
          .post("/api/uploads/image", formData, { headers: { "Content-Type": "multipart/form-data" } })
          .then((res) => res.data.imageUrl);
      })
    );
    return results;
  };

  const addTierRow = () => {
    setBidTiers((prev) => {
      const last = prev[prev.length - 1];
      const prevUpTo = prev.length >= 2 ? prev[prev.length - 2].upTo : 0;
      const newUpTo = prevUpTo ? prevUpTo * 10 : 100000;
      return [
        ...prev.slice(0, -1),
        { upTo: newUpTo, unit: last.unit },
        { upTo: null, unit: last.unit * 2 },
      ];
    });
  };

  const removeTierRow = (index) => {
    setBidTiers((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTierRow = (index, field, value) => {
    setBidTiers((prev) =>
      prev.map((tier, i) => (i === index ? { ...tier, [field]: value === "" ? "" : Number(value) } : tier))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const images = await uploadImages();

      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        images,
        saleType,
      };

      if (saleType === "fixed") {
        payload.fixedPrice = Number(form.fixedPrice);
      } else {
        payload.startPrice = Number(form.startPrice);
        payload.onFailedAuction = onFailedAuction;
        if (onFailedAuction === "convert") {
          payload.fixedPrice = Number(form.fixedPrice);
        }
        if (useCustomTiers) {
          payload.bidTiers = bidTiers;
        }
      }

      const res = await axiosInstance.post("/api/products", payload);
      navigate(`/products/${res.data.product._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "상품 등록 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-4 sm:p-8">
      <h1 className="text-3xl font-bold mb-6">상품 등록</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 판매 방식 선택 */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">판매 방식</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSaleType("fixed")}
              className={`py-4 rounded-xl border-2 font-semibold transition ${
                saleType === "fixed"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              즉시 판매
              <p className="text-xs font-normal mt-1">정가에 바로 판매</p>
            </button>
            <button
              type="button"
              onClick={() => setSaleType("auction")}
              className={`py-4 rounded-xl border-2 font-semibold transition ${
                saleType === "auction"
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              경매
              <p className="text-xs font-normal mt-1">입찰 경쟁으로 판매</p>
            </button>
          </div>
        </div>

        <input
          type="text"
          name="title"
          placeholder="상품명"
          value={form.title}
          onChange={handleChange}
          required
          className="w-full border rounded-lg px-4 py-3"
        />

        <textarea
          name="description"
          placeholder="상품 설명"
          value={form.description}
          onChange={handleChange}
          required
          className="w-full border rounded-lg px-4 py-3 h-32"
        />

        <select
          name="category"
          value={form.category}
          onChange={handleChange}
          required
          className="w-full border rounded-lg px-4 py-3"
        >
          <option value="">카테고리 선택</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* 판매 방식별 가격 필드 */}
        {saleType === "fixed" ? (
          <input
            type="number"
            name="fixedPrice"
            placeholder="판매가"
            value={form.fixedPrice}
            onChange={handleChange}
            required
            min={0}
            className="w-full border rounded-lg px-4 py-3"
          />
        ) : (
          <>
            <input
              type="number"
              name="startPrice"
              placeholder="시작가"
              value={form.startPrice}
              onChange={handleChange}
              required
              min={0}
              className="w-full border rounded-lg px-4 py-3"
            />

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">유찰 시 처리</p>
              <select
                value={onFailedAuction}
                onChange={(e) => setOnFailedAuction(e.target.value)}
                className="w-full border rounded-lg px-4 py-3"
              >
                <option value="close">그냥 종료</option>
                <option value="convert">즉시 판매로 전환</option>
              </select>
            </div>

            {onFailedAuction === "convert" && (
              <input
                type="number"
                name="fixedPrice"
                placeholder="전환 후 판매가"
                value={form.fixedPrice}
                onChange={handleChange}
                required
                min={0}
                className="w-full border rounded-lg px-4 py-3"
              />
            )}

            {/* 입찰 단위 설정 */}
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">입찰 단위 직접 설정</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomTiers}
                    onChange={(e) => setUseCustomTiers(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-600">직접 설정</span>
                </label>
              </div>

              {!useCustomTiers && (
                <p className="text-xs text-slate-400">
                  기본값: 10만 미만 5,000원 / 100만 미만 10,000원 / 이상 50,000원
                </p>
              )}

              {useCustomTiers && (
                <div className="space-y-2">
                  {bidTiers.map((tier, i) => {
                    const isLast = i === bidTiers.length - 1;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500 w-6 text-right">{i + 1}.</span>
                        {isLast ? (
                          <span className="flex-1 px-3 py-2 bg-slate-50 rounded-lg text-slate-400">이상 (나머지)</span>
                        ) : (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="number"
                              value={tier.upTo ?? ""}
                              onChange={(e) => updateTierRow(i, "upTo", e.target.value)}
                              placeholder="상한 금액"
                              min={1}
                              className="flex-1 border rounded-lg px-3 py-2"
                            />
                            <span className="text-slate-400">원 미만</span>
                          </div>
                        )}
                        <span className="text-slate-400">→</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={tier.unit ?? ""}
                            onChange={(e) => updateTierRow(i, "unit", e.target.value)}
                            placeholder="단위"
                            min={1}
                            className="w-28 border rounded-lg px-3 py-2"
                          />
                          <span className="text-slate-400">원</span>
                        </div>
                        {!isLast && bidTiers.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeTierRow(i)}
                            className="text-red-400 hover:text-red-600 px-1"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={addTierRow}
                    className="text-sm text-slate-600 border border-dashed rounded-lg px-4 py-2 w-full hover:border-slate-400"
                  >
                    + 구간 추가
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* 이미지 업로드 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">상품 이미지 (최대 {MAX_IMAGES}장)</p>
            <span className="text-xs text-slate-400">{imageFiles.length} / {MAX_IMAGES}</span>
          </div>

          {imageFiles.length < MAX_IMAGES && (
            <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-slate-400 transition">
              <span className="text-slate-400 text-sm">+ 이미지 추가</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          )}

          {previewUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {previewUrls.map((url, i) => (
                <div key={i} className="relative aspect-square">
                  <img src={url} alt={`미리보기 ${i + 1}`} className="w-full h-full object-cover rounded-xl border" />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 bg-slate-800 text-white text-xs px-1.5 py-0.5 rounded">
                      대표
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(i)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-700"
        >
          {loading ? "등록 중..." : "상품 등록"}
        </button>
      </form>
    </div>
  );
}

export default CreateProductPage;
