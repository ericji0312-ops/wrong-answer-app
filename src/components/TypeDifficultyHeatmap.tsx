import type { HeatmapCell } from "@/app/actions/wrongAnswers";
import { DIFFICULTIES } from "@/types/domain";

// 오답률(연속 크기값)이므로 단일 색조 sequential 램프를 쓴다 — 앱 전반에서 이미
// 쓰고 있는 블루 계열(BarList의 막대 색과 동일 hue)의 밝→진 단계.
const SEQUENTIAL_RAMP = [
  "#cde2fb",
  "#b7d3f6",
  "#9ec5f4",
  "#86b6ef",
  "#6da7ec",
  "#5598e7",
  "#3987e5",
  "#2a78d6",
  "#256abf",
  "#1c5cab",
  "#184f95",
  "#104281",
  "#0d366b",
];

function rampColor(rate: number) {
  const index = Math.round((rate / 100) * (SEQUENTIAL_RAMP.length - 1));
  return SEQUENTIAL_RAMP[Math.min(SEQUENTIAL_RAMP.length - 1, Math.max(0, index))];
}

export default function TypeDifficultyHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const wrongByType = new Map<string, number>();
  for (const c of cells) {
    wrongByType.set(c.problem_type, (wrongByType.get(c.problem_type) ?? 0) + c.wrong);
  }

  const types = [...wrongByType.entries()]
    .filter(([, wrong]) => wrong > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  const cellByKey = new Map(cells.map((c) => [`${c.problem_type}||${c.difficulty}`, c]));

  if (types.length === 0) {
    return <p className="text-gray-500 text-sm">데이터가 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-1 text-left font-medium text-gray-500"></th>
            {DIFFICULTIES.map((d) => (
              <th key={d} className="p-1 font-medium text-gray-500 text-center w-16">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {types.map((type) => (
            <tr key={type}>
              <th className="p-1 pr-3 text-left font-medium whitespace-nowrap">{type}</th>
              {DIFFICULTIES.map((d) => {
                const cell = cellByKey.get(`${type}||${d}`);
                if (!cell || cell.total === 0) {
                  return (
                    <td key={d} className="p-1">
                      <div className="w-16 h-10 rounded flex items-center justify-center bg-gray-50 text-gray-300 border">
                        -
                      </div>
                    </td>
                  );
                }
                const rate = Math.round((cell.wrong / cell.total) * 100);
                const textDark = rate < 50;
                return (
                  <td key={d} className="p-1">
                    <div
                      className="w-16 h-10 rounded flex items-center justify-center"
                      style={{
                        backgroundColor: rampColor(rate),
                        color: textDark ? "#1a1a1a" : "#ffffff",
                      }}
                      title={`${type} · ${d} — ${cell.wrong}/${cell.total}`}
                    >
                      <span className="font-semibold">{rate}%</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
