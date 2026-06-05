import { useNavigate } from "react-router-dom";

function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="text-7xl font-bold text-slate-200 mb-4">404</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">페이지를 찾을 수 없습니다</h1>
      <p className="text-slate-500 mb-8">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="border border-slate-300 px-5 py-2.5 rounded-lg hover:border-slate-500 text-slate-700"
        >
          이전 페이지
        </button>
        <button
          onClick={() => navigate("/")}
          className="bg-slate-800 text-white px-5 py-2.5 rounded-lg hover:bg-slate-700"
        >
          홈으로
        </button>
      </div>
    </div>
  );
}

export default NotFoundPage;
