function BrookScore({ score, completedDeals, totalDeals, size = "md" }) {
  if (score == null) return null;

  const getColor = (s) => {
    if (s >= 70) return { bar: "bg-red-400", text: "text-red-500", label: "매우 신뢰" };
    if (s >= 50) return { bar: "bg-orange-400", text: "text-orange-500", label: "신뢰" };
    if (s >= 30) return { bar: "bg-green-400", text: "text-green-600", label: "보통" };
    return { bar: "bg-blue-400", text: "text-blue-500", label: "낮음" };
  };

  const { bar, text, label } = getColor(score);
  const pct = (score / 99) * 100;

  const isLg = size === "lg";

  return (
    <div className={isLg ? "space-y-2" : "space-y-1"}>
      <div className="flex items-center gap-2">
        <span className={`font-bold ${text} ${isLg ? "text-2xl" : "text-base"}`}>
          {score.toFixed(1)}
        </span>
        <span className="text-xs text-slate-500 font-medium">브룩 지수</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${text} bg-slate-100`}>
          {label}
        </span>
      </div>
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${isLg ? "h-3" : "h-2"}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {(completedDeals != null || totalDeals != null) && (
        <p className="text-xs text-slate-400">
          거래 완료 {completedDeals ?? 0}회
          {totalDeals > 0 && (
            <span className="ml-1">
              (완료율 {Math.round((completedDeals / totalDeals) * 100)}%)
            </span>
          )}
        </p>
      )}
    </div>
  );
}

export default BrookScore;
