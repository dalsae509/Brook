// recharts 없이 순수 HTML/CSS로 그리는 경량 차트 (React 19 호환 문제 회피)

// 세로 막대 차트
export function VBarChart({ data, valueKey, labelKey, format, labelFormat, color = "#34d399", height = 230 }) {
  const max = Math.max(...data.map((d) => d[valueKey] ?? 0), 1);
  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d) => {
          const v = d[valueKey] ?? 0;
          return (
            <div key={d[labelKey]} className="flex-1 flex flex-col justify-end items-center h-full">
              <span className="text-[10px] text-slate-500 mb-1">{format ? format(v) : v}</span>
              <div
                className="w-full rounded-t transition-all"
                style={{ height: `${(v / max) * 100}%`, backgroundColor: color, minHeight: v > 0 ? 4 : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-1.5">
        {data.map((d) => (
          <span key={d[labelKey]} className="flex-1 text-center text-[10px] text-slate-400 truncate">
            {labelFormat ? labelFormat(d[labelKey]) : d[labelKey]}
          </span>
        ))}
      </div>
    </div>
  );
}

// 가로 막대 리스트
export function HBarList({ data, valueKey, labelKey, format, colors, labelWidth = "6rem" }) {
  const max = Math.max(...data.map((d) => d[valueKey] ?? 0), 1);
  return (
    <div className="space-y-2.5 py-2">
      {data.map((d, i) => {
        const v = d[valueKey] ?? 0;
        return (
          <div key={d[labelKey] ?? i} className="flex items-center gap-3 text-sm">
            <span className="shrink-0 truncate text-slate-600" style={{ width: labelWidth }}>{d[labelKey]}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(v / max) * 100}%`, backgroundColor: colors ? colors[i % colors.length] : "#60a5fa" }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-slate-500">{format ? format(v) : v}</span>
          </div>
        );
      })}
    </div>
  );
}
