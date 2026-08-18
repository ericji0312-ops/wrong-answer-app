import type { RoundComparison } from "@/app/actions/wrongAnswers";

const RESULT_STYLE: Record<string, { icon: string; className: string }> = {
  wrong: { icon: "✗", className: "bg-red-50 text-red-600" },
  correct: { icon: "✓", className: "bg-green-50 text-green-600" },
  not_attempted: { icon: "–", className: "text-gray-300" },
};

export default function RoundComparisonTable({ comparison }: { comparison: RoundComparison }) {
  const { rounds, rows } = comparison;

  if (rounds.length === 0 || rows.length === 0) {
    return <p className="text-sm text-gray-500">이 문제집·파트에 등록된 이력이 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-xs text-gray-500">
            <th className="px-3 py-2 text-left font-medium">문제</th>
            <th className="px-3 py-2 text-left font-medium">단원 · 유형</th>
            {rounds.map((r) => (
              <th key={r} className="px-3 py-2 text-center font-medium">
                {r}회독
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const wrongCount = rounds.filter((r) => row.resultsByRound[r] === "wrong").length;
            return (
              <tr key={row.problemId} className={wrongCount >= 2 ? "bg-red-50/40" : ""}>
                <td className="px-3 py-2 font-medium">{row.problemNumber}번</td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {row.unit} · {row.problemType} · {row.difficulty}
                </td>
                {rounds.map((r) => {
                  const result = row.resultsByRound[r] ?? "not_attempted";
                  const style = RESULT_STYLE[result];
                  return (
                    <td key={r} className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${style.className}`}
                      >
                        {style.icon}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
