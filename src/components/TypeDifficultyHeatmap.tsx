import { Fragment } from "react";
import type { HeatmapCell } from "@/app/actions/wrongAnswers";
import { DIFFICULTIES } from "@/types/domain";

// 표가 아니라 진짜 히트맵처럼 보이도록, 셀을 테두리 있는 표 대신 색이 꽉 찬
// 블록으로 그린다. 오답률(연속된 magnitude)이므로 레드 계열 단일 색조를
// 밝→진 9단계로 보간해서 칠한다 — 이전의 pill 배지는 배경색이 텍스트
// 주변에만 살짝 칠해져서 "히트맵"이라는 느낌이 약했다.
const SEQUENTIAL_RAMP = [
  "#fef2f2",
  "#fecaca",
  "#fca5a5",
  "#f87171",
  "#ef4444",
  "#dc2626",
  "#b91c1c",
  "#991b1b",
  "#7f1d1d",
];

function rampColor(rate: number) {
  const index = Math.round((rate / 100) * (SEQUENTIAL_RAMP.length - 1));
  return SEQUENTIAL_RAMP[Math.min(SEQUENTIAL_RAMP.length - 1, Math.max(0, index))];
}

export default function TypeDifficultyHeatmap({
  cells,
  onCellClick,
  selected,
}: {
  cells: HeatmapCell[];
  onCellClick?: (problemType: string, difficulty: string) => void;
  selected?: { problemType: string; difficulty: string } | null;
}) {
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
    <div className="overflow-x-auto rounded-xl border bg-white p-4">
      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `10rem repeat(${DIFFICULTIES.length}, minmax(4rem, 1fr))`,
        }}
      >
        <div />
        {DIFFICULTIES.map((d) => (
          <div key={d} className="pb-2 text-center text-xs font-medium text-gray-500">
            {d}
          </div>
        ))}

        {types.map((type) => (
          <Fragment key={type}>
            <div className="flex items-center pr-3 text-sm font-medium">{type}</div>
            {DIFFICULTIES.map((d) => {
              const cell = cellByKey.get(`${type}||${d}`);
              if (!cell || cell.total === 0) {
                return (
                  <div
                    key={d}
                    className="flex h-12 items-center justify-center rounded-sm bg-gray-50 text-xs text-gray-300"
                  >
                    -
                  </div>
                );
              }
              const rate = Math.round((cell.wrong / cell.total) * 100);
              const textLight = rate >= 55;
              const isSelected = selected?.problemType === type && selected?.difficulty === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onCellClick?.(type, d)}
                  disabled={!onCellClick || cell.wrong === 0}
                  className={
                    "flex h-12 items-center justify-center rounded-sm text-sm font-bold transition-shadow " +
                    (onCellClick && cell.wrong > 0 ? "cursor-pointer hover:ring-2 hover:ring-blue-400" : "") +
                    (isSelected ? " ring-2 ring-blue-600" : "")
                  }
                  style={{
                    backgroundColor: rampColor(rate),
                    color: textLight ? "#ffffff" : "#7f1d1d",
                  }}
                  title={`${type} · ${d} — ${cell.wrong}/${cell.total}`}
                >
                  {rate}%
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
