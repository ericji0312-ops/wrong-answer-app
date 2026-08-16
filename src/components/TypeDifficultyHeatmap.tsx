import type { HeatmapCell } from "@/app/actions/wrongAnswers";
import { DIFFICULTIES } from "@/types/domain";

// 오답률(빨간색이 위험을 뜻하는 단일 계열 magnitude)이므로 레드 계열의
// 밝→진 단계로 표현한다. red-50~300 사이는 육안으로 거의 구분이 안 돼서
// 표 전체가 비슷한 연분홍으로 보이는 문제가 있었다 — 고위험 구간은 진한
// 배경 + 흰 글자까지 벌려서 실제로 "뜨거운" 셀이 한눈에 띄게 한다.
function rateClasses(rate: number): string {
  if (rate === 0) return "bg-gray-50 text-gray-400";
  if (rate < 15) return "bg-red-50 text-red-600";
  if (rate < 30) return "bg-red-200 text-red-700";
  if (rate < 50) return "bg-red-400 text-white";
  if (rate < 70) return "bg-red-600 text-white";
  return "bg-red-800 text-white";
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
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-3 text-left font-medium text-gray-500">유형</th>
            {DIFFICULTIES.map((d) => (
              <th key={d} className="p-3 text-center font-medium text-gray-500">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {types.map((type) => (
            <tr key={type} className="border-b last:border-b-0">
              <th className="p-3 text-left font-medium whitespace-nowrap">{type}</th>
              {DIFFICULTIES.map((d) => {
                const cell = cellByKey.get(`${type}||${d}`);
                if (!cell || cell.total === 0) {
                  return (
                    <td key={d} className="p-3 text-center text-gray-300">
                      -
                    </td>
                  );
                }
                const rate = Math.round((cell.wrong / cell.total) * 100);
                return (
                  <td key={d} className="p-3 text-center">
                    <span
                      className={`inline-block min-w-14 rounded-md px-2 py-1 font-semibold ${rateClasses(rate)}`}
                      title={`${type} · ${d} — ${cell.wrong}/${cell.total}`}
                    >
                      {rate}%
                    </span>
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
