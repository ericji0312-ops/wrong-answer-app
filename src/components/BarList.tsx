export interface BarListItem {
  label: string;
  count: number;
}

// 단원/유형별 오답 개수 — 단일 시리즈 랭킹 막대 (dataviz 팔레트 slot-1 blue 사용).
export default function BarList({ items }: { items: BarListItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));

  return (
    <div
      className="space-y-2"
      style={
        {
          "--bar-color": "#2a78d6",
        } as React.CSSProperties
      }
    >
      <style>{`
        @media (prefers-color-scheme: dark) {
          .bar-list-fill { background: #3987e5 !important; }
        }
      `}</style>
      {items.length === 0 && <p className="text-gray-500 text-sm">데이터가 없습니다.</p>}
      <div className="overflow-x-auto space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 w-max min-w-full">
            <div className="shrink-0 whitespace-nowrap text-sm">{item.label}</div>
            <div className="flex-1 flex items-center gap-2 min-w-40">
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div
                  className="bar-list-fill h-4 rounded-full transition-all"
                  style={{
                    width: `${(item.count / max) * 100}%`,
                    background: "var(--bar-color)",
                  }}
                />
              </div>
              <span className="w-6 text-right text-sm font-medium tabular-nums">
                {item.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
