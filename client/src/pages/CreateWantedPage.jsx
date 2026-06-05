import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axiosInstance from "../api/axios";
import { CATEGORIES } from "../utils/categories";

function CreateWantedPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", category: "", targetPrice: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        targetPrice: form.targetPrice ? Number(form.targetPrice) : null,
      };
      const res = await axiosInstance.post("/api/wanted", payload);
      toast.success("게시글이 등록되었습니다.");
      navigate(`/wanted/${res.data.post._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "등록 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-4 sm:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">삽니다 글쓰기</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="title"
          placeholder="제목 (예: 아이폰 14 구합니다)"
          value={form.title}
          onChange={handleChange}
          required
          maxLength={100}
          className="w-full border rounded-lg px-4 py-3"
        />

        <textarea
          name="description"
          placeholder="원하는 상품의 상태, 조건 등을 자세히 적어주세요."
          value={form.description}
          onChange={handleChange}
          required
          maxLength={2000}
          className="w-full border rounded-lg px-4 py-3 h-36 resize-none"
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

        <div>
          <label className="text-sm text-slate-600 mb-1 block">희망 가격 (선택)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="targetPrice"
              placeholder="최대 예산"
              value={form.targetPrice}
              onChange={handleChange}
              min={0}
              className="flex-1 border rounded-lg px-4 py-3"
            />
            <span className="text-slate-500 shrink-0">원 이하</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-700 disabled:opacity-60"
        >
          {loading ? "등록 중..." : "게시글 등록"}
        </button>
      </form>
    </div>
  );
}

export default CreateWantedPage;
