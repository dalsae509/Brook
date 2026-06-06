import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import axiosInstance from "../api/axios";

const PIE_COLORS = ["#60a5fa", "#fbbf24", "#34d399", "#a78bfa", "#f87171", "#94a3b8"];

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ?? "text-slate-800"}`}>{value}</p>
    </div>
  );
}

function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance
      .get("/api/users/me/dashboard")
      .then((res) => setData(res.data))
      .catch((error) => toast.error(error.response?.data?.message || "대시보드 불러오기 실패"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-20 text-slate-400">불러오는 중...</div>;
  }
  if (!data) return null;

  const { summary, statusBreakdown, salesByMonth, topViewed } = data;
  const won = (n) => `${(n ?? 0).toLocaleString()}원`;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold">판매자 대시보드</h1>
        <Link to="/mypage" className="text-sm text-slate-500 hover:text-slate-800">← 마이페이지</Link>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="총 매출" value={won(summary.totalRevenue)} accent="text-green-600" />
        <StatCard label="판매 완료" value={`${summary.soldCount}건`} />
        <StatCard label="총 조회수" value={(summary.totalViews ?? 0).toLocaleString()} />
        <StatCard label="진행 중 상품" value={`${summary.activeListings}개`} accent="text-blue-600" />
      </div>

      {/* 월별 매출 */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="font-semibold mb-4">월별 매출</h2>
        {salesByMonth.length === 0 ? (
          <p className="text-slate-400 text-sm py-10 text-center">아직 판매 완료된 거래가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={salesByMonth} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" fontSize={12} stroke="#94a3b8" />
              <YAxis fontSize={12} stroke="#94a3b8" tickFormatter={(v) => `${(v / 10000).toLocaleString()}만`} />
              <Tooltip formatter={(v, name) => name === "revenue" ? [won(v), "매출"] : [`${v}건`, "판매수"]} />
              <Bar dataKey="revenue" fill="#34d399" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 상품 상태 분포 */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-semibold mb-4">상품 상태 분포</h2>
          {statusBreakdown.length === 0 ? (
            <p className="text-slate-400 text-sm py-10 text-center">등록한 상품이 없습니다.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {statusBreakdown.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}개`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 인기 상품 (조회수) */}
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="font-semibold mb-4">인기 상품 (조회수)</h2>
          {topViewed.length === 0 ? (
            <p className="text-slate-400 text-sm py-10 text-center">등록한 상품이 없습니다.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topViewed} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" fontSize={12} stroke="#94a3b8" />
                <YAxis type="category" dataKey="title" width={90} fontSize={12} stroke="#94a3b8"
                  tickFormatter={(t) => (t.length > 8 ? `${t.slice(0, 8)}…` : t)} />
                <Tooltip formatter={(v) => [`${v}회`, "조회수"]} />
                <Bar dataKey="views" fill="#60a5fa" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
