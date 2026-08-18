import type { RepeatWrongProblem } from "@/app/actions/wrongAnswers";

export default function RepeatWrongList({ problems }: { problems: RepeatWrongProblem[] }) {
  if (problems.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">반복오답 ({problems.length})</h2>
      <p className="text-xs text-gray-400">
        같은 문제를 두 번 이상 틀린 경우입니다. 다시 짚어줘야 할 우선순위 목록으로 보세요.
      </p>
      <ul className="divide-y rounded-xl border bg-white">
        {problems.map((p) => (
          <li key={p.problemId} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="font-medium">
                {p.workbookTitle}
                {p.part && ` · ${p.part}`} · {p.problemNumber}번
              </p>
              <p className="text-xs text-gray-500">
                {p.unit} · {p.problemType} · {p.difficulty}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
              {p.wrongRounds.join(", ")}회독 연속 오답
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
