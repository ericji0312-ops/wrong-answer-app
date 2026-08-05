import type { Difficulty, WrongAnswer } from "@/types/domain";
import { DIFFICULTIES } from "@/types/domain";

// 난이도(열) x 세부 유형(행) 교차표 — 어떤 난이도에서 어떤 유형이 취약한지 한눈에 보여준다.
// 셀 색상은 단일 색상(blue) 순차 램프이며 값이 클수록 진하다 (dataviz sequential 규칙).
function buildMatrix(items: WrongAnswer[]) {
  const rowTotals = new Map<string, number>();
  const cellCounts = new Map<string, number>();

  for (const item of items) {
    if (!item.difficulty) continue;
    rowTotals.set(item.problem_type, (rowTotals.get(item.problem_type) ?? 0) + 1);
    const key = `${item.problem_type}__${item.difficulty}`;
    cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
  }

  const rows = [...rowTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([problemType]) => problemType);

  const max = Math.max(0, ...cellCounts.values());

  return { rows, cellCounts, max };
}

function bucketOf(count: number, max: number) {
  if (count === 0 || max === 0) return 0;
  return Math.min(5, Math.ceil((count / max) * 5));
}

function cellKey(problemType: string, difficulty: Difficulty) {
  return `${problemType}__${difficulty}`;
}

export default function DifficultyTypeHeatmap({ items }: { items: WrongAnswer[] }) {
  const { rows, cellCounts, max } = buildMatrix(items);

  return (
    <div className="heatmap-root space-y-2">
      <style>{`
        .heatmap-root {
          /* sequential blue, light→dark (steps 250/350/500/600/700); light-end clears 2:1 on the light surface */
          --heat-1: #86b6ef; --heat-1-text: #0b0b0b;
          --heat-2: #5598e7; --heat-2-text: #0b0b0b;
          --heat-3: #256abf; --heat-3-text: #ffffff;
          --heat-4: #184f95; --heat-4-text: #ffffff;
          --heat-5: #0d366b; --heat-5-text: #ffffff;
          --heat-empty: transparent;
          --heat-border: #e1e0d9;
        }
        @media (prefers-color-scheme: dark) {
          .heatmap-root {
            /* anchor flips: low value sits near the dark surface (steps capped at 600), high value is brightest */
            --heat-1: #184f95; --heat-1-text: #ffffff;
            --heat-2: #256abf; --heat-2-text: #ffffff;
            --heat-3: #3987e5; --heat-3-text: #0b0b0b;
            --heat-4: #6da7ec; --heat-4-text: #0b0b0b;
            --heat-5: #9ec5f4; --heat-5-text: #0b0b0b;
            --heat-empty: transparent;
            --heat-border: #2c2c2a;
          }
        }
      `}</style>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">데이터가 없습니다.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table style={{ borderSpacing: "2px", borderCollapse: "separate" }}>
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 pr-2 pb-1 align-bottom">
                    세부 유형
                  </th>
                  {DIFFICULTIES.map((d) => (
                    <th
                      key={d}
                      className="text-xs font-medium text-gray-500 px-1 pb-1 align-bottom min-w-12"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((problemType) => (
                  <tr key={problemType}>
                    <th
                      scope="row"
                      className="text-left text-xs font-normal pr-2 whitespace-nowrap align-middle"
                    >
                      {problemType}
                    </th>
                    {DIFFICULTIES.map((d) => {
                      const count = cellCounts.get(cellKey(problemType, d)) ?? 0;
                      const bucket = bucketOf(count, max);
                      return (
                        <td key={d} className="p-0 align-middle">
                          <div
                            title={`${problemType} · 난이도 ${d}: ${count}건`}
                            className="w-12 h-9 rounded text-xs font-medium tabular-nums flex items-center justify-center"
                            style={
                              bucket === 0
                                ? {
                                    background: "var(--heat-empty)",
                                    border: "1px solid var(--heat-border)",
                                  }
                                : {
                                    background: `var(--heat-${bucket})`,
                                    color: `var(--heat-${bucket}-text)`,
                                  }
                            }
                          >
                            {bucket > 0 && count}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>적음</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((b) => (
                <span
                  key={b}
                  className="w-4 h-3 rounded-sm inline-block"
                  style={{ background: `var(--heat-${b})` }}
                />
              ))}
            </div>
            <span>많음</span>
          </div>
        </>
      )}
    </div>
  );
}
