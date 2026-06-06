import { useState } from "react";
import toast from "react-hot-toast";
import axiosInstance from "../api/axios";

const REASONS = ["사기 의심", "허위 상품", "욕설·비방", "기타"];

function ReportModal({ reportedUserId, reportedUserName, productId, onClose }) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) { toast.error("신고 사유를 선택해주세요."); return; }
    if (reason === "기타" && !description.trim()) {
      toast.error("'기타' 선택 시 상세 내용을 입력해주세요.");
      return;
    }
    try {
      setSubmitting(true);
      await axiosInstance.post("/api/reports", {
        reportedUserId,
        reason,
        description,
        productId: productId || undefined,
      });
      toast.success("신고가 접수되었습니다.");
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || "신고 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">신고하기</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <p className="text-sm text-slate-500">
          <span className="font-medium text-slate-700">{reportedUserName}</span> 님을 신고합니다.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">신고 사유</p>
            {REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">{r}</span>
              </label>
            ))}
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={reason === "기타" ? "상세 내용을 입력해주세요 (필수)" : "상세 내용 (선택)"}
            maxLength={500}
            className={`w-full border rounded-lg px-4 py-2.5 text-sm h-24 resize-none ${
              reason === "기타" && !description.trim() ? "border-red-300" : ""
            }`}
          />

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border py-2.5 rounded-lg text-sm hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm hover:bg-red-600 disabled:opacity-60"
            >
              {submitting ? "접수 중..." : "신고 접수"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportModal;
