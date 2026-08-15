import { Fragment } from "react";

export interface BarListItem {
  label: string;
  count: number;
}

export interface BarListGroup {
  heading: string;
  items: BarListItem[];
}

type BarListProps = {
  valueSuffix?: string;
  /** 고정 스케일. 생략하면 전체 항목 중 최댓값을 기준으로 막대 길이를 계산한다. */
  max?: number;
} & ({ items: BarListItem[]; groups?: undefined } | { groups: BarListGroup[]; items?: undefined });

// 단원/유형별 오답 개수 — 단일 시리즈 랭킹 막대 (dataviz 팔레트 slot-1 blue 사용).
// 그리드 레이아웃이라 라벨 열 너비가 가장 긴 라벨 기준으로 모든 행에서 동일하게
// 맞춰지고, 그 결과 막대의 시작점이 행마다 정렬된다 (flex 행별 독립 폭과 차이점).
// groups를 넘기면 여러 소제목 구간을 하나의 그리드로 묶어서, 구간이 달라져도
// 라벨 열 너비(=막대 시작점)가 전체 기준으로 동일하게 맞춰진다.
export default function BarList({ items, groups, valueSuffix = "", max: fixedMax }: BarListProps) {
  const resolvedGroups: BarListGroup[] = groups ?? [{ heading: "", items: items ?? [] }];
  const allItems = resolvedGroups.flatMap((g) => g.items);
  const max = fixedMax ?? Math.max(1, ...allItems.map((i) => i.count));

  return (
    <div
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
      {allItems.length === 0 && <p className="text-gray-500 text-sm">데이터가 없습니다.</p>}
      <div className="overflow-x-auto">
        <div
          className="grid gap-x-3 gap-y-2 items-center w-max min-w-full"
          style={{ gridTemplateColumns: "max-content minmax(10rem, 1fr) max-content" }}
        >
          {resolvedGroups.map((group) => (
            <Fragment key={group.heading || "_"}>
              {group.heading && (
                <div className="col-span-3 text-sm font-bold pt-3 first:pt-0">
                  {group.heading}
                </div>
              )}
              {group.items.map((item) => (
                <Fragment key={item.label}>
                  <div className="whitespace-nowrap text-sm">{item.label}</div>
                  <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="bar-list-fill h-4 rounded-full transition-all"
                      style={{
                        width: `${(item.count / max) * 100}%`,
                        background: "var(--bar-color)",
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium tabular-nums justify-self-end">
                    {item.count}
                    {valueSuffix}
                  </span>
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
