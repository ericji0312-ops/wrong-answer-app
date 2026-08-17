"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  getWrongProblemsByTypeDifficulty,
  getWrongRateBreakdown,
  type WrongProblemDetail,
  type WrongRateBreakdown,
} from "@/app/actions/wrongAnswers";
import TypeDifficultyHeatmap from "@/components/TypeDifficultyHeatmap";
import type { Student, Subject } from "@/types/domain";

type Period = "all" | "1m";

function severity(rate: number) {
  if (rate >= 30) return { label: "심각", badge: "bg-red-100 text-red-700", bar: "bg-red-500" };
  if (rate >= 15) return { label: "주의", badge: "bg-amber-100 text-amber-700", bar: "bg-amber-500" };
  return { label: "양호", badge: "bg-green-100 text-green-700", bar: "bg-green-500" };
}

export default function Dashboard({
  students,
  subjects,
  studentSubjectMap,
}: {
  students: Student[];
  subjects: Subject[];
  studentSubjectMap: Record<string, string[]>;
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [query, setQuery] = useState("");
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [wrongRates, setWrongRates] = useState<WrongRateBreakdown>({
    unitTypeRates: [],
    typeDifficultyRates: [],
  });
  const [loadingRates, setLoadingRates] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ problemType: string; difficulty: string } | null>(
    null
  );
  const [wrongProblems, setWrongProblems] = useState<WrongProblemDetail[]>([]);
  const [loadingWrongProblems, setLoadingWrongProblems] = useState(false);

  const availableSubjects = useMemo(
    () => subjects.filter((s) => (studentSubjectMap[studentId] ?? []).includes(s.id)),
    [subjects, studentSubjectMap, studentId]
  );

  useEffect(() => {
    setSubjectId(availableSubjects[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    if (!studentId || !subjectId) {
      setWrongRates({ unitTypeRates: [], typeDifficultyRates: [] });
      return;
    }
    let cancelled = false;
    setLoadingRates(true);
    const sinceIso =
      period === "1m"
        ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
    getWrongRateBreakdown(studentId, subjectId, sinceIso)
      .then((data) => {
        if (!cancelled) setWrongRates(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingRates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, subjectId, period]);

  useEffect(() => {
    setSelectedCell(null);
  }, [studentId, subjectId, period]);

  useEffect(() => {
    if (!selectedCell || !studentId) {
      setWrongProblems([]);
      return;
    }
    let cancelled = false;
    setLoadingWrongProblems(true);
    const sinceIso =
      period === "1m"
        ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
    getWrongProblemsByTypeDifficulty(
      studentId,
      selectedCell.problemType,
      selectedCell.difficulty,
      subjectId,
      sinceIso
    )
      .then((data) => {
        if (!cancelled) setWrongProblems(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingWrongProblems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCell, studentId, subjectId, period]);

  const unitGroups = useMemo(() => {
    const groups = new Map<string, { unit: string; items: { label: string; rate: number }[] }>();
    for (const r of wrongRates.unitTypeRates) {
      if (r.total === 0 || r.wrong === 0) continue;
      const group = groups.get(r.unit) ?? { unit: r.unit, items: [] };
      group.items.push({ label: r.problem_type, rate: Math.round((r.wrong / r.total) * 100) });
      groups.set(r.unit, group);
    }
    return [...groups.values()]
      .map((g) => {
        const items = [...g.items].sort((a, b) => b.rate - a.rate);
        const avgRate = Math.round(items.reduce((sum, i) => sum + i.rate, 0) / items.length);
        return { unit: g.unit, items, avgRate };
      })
      .sort((a, b) => b.avgRate - a.avgRate);
  }, [wrongRates.unitTypeRates]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return unitGroups;
    return unitGroups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) => g.unit.toLowerCase().includes(q) || i.label.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [unitGroups, query]);

  const stats = useMemo(() => {
    const withTotal = wrongRates.unitTypeRates.filter((r) => r.total > 0);
    const analyzedTypes = withTotal.length;
    const unitCount = new Set(withTotal.map((r) => r.unit)).size;
    const avgRate =
      withTotal.length > 0
        ? Math.round(
            (withTotal.reduce((sum, r) => sum + r.wrong / r.total, 0) / withTotal.length) * 100
          )
        : 0;
    const severeCount = withTotal.filter((r) => r.wrong / r.total >= 0.3).length;

    const unitSums = new Map<string, { sum: number; count: number }>();
    for (const r of withTotal) {
      const g = unitSums.get(r.unit) ?? { sum: 0, count: 0 };
      g.sum += r.wrong / r.total;
      g.count += 1;
      unitSums.set(r.unit, g);
    }
    let topUnit: { unit: string; rate: number } | null = null;
    for (const [unit, { sum, count }] of unitSums) {
      const rate = Math.round((sum / count) * 100);
      if (!topUnit || rate > topUnit.rate) topUnit = { unit, rate };
    }

    return { analyzedTypes, unitCount, avgRate, severeCount, topUnit };
  }, [wrongRates.unitTypeRates]);

  function toggleExpand(unit: string) {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unit)) next.delete(unit);
      else next.add(unit);
      return next;
    });
  }

  return (
    <div className="max-w-5xl p-8 space-y-8 text-sm">
      <div>
        <h1 className="text-xl font-bold">학생별 취약유형 대시보드</h1>
        <p className="mt-1 text-gray-500">
          오답 데이터를 단원·유형·난이도별로 분석해 취약점을 한눈에 보여줍니다
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <label className="block font-medium">학생</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="border rounded-lg px-3 py-1.5"
          >
            {students.length === 0 && <option value="">등록된 학생이 없습니다</option>}
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block font-medium">과목</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="border rounded-lg px-3 py-1.5"
            disabled={availableSubjects.length === 0}
          >
            {availableSubjects.length === 0 && (
              <option value="">수강 중인 과목이 없습니다</option>
            )}
            {availableSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block font-medium">기간</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="border rounded-lg px-3 py-1.5"
          >
            <option value="all">전체</option>
            <option value="1m">최근 1개월</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-gray-500">분석된 오답 유형</p>
          <p className="mt-1 text-2xl font-bold">{stats.analyzedTypes}개</p>
          <p className="mt-1 text-xs text-gray-400">단원 {stats.unitCount}개 기준</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-gray-500">평균 오답률</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{stats.avgRate}%</p>
          <p className="mt-1 text-xs text-gray-400">전체 유형 평균</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-gray-500">심각 유형 수</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{stats.severeCount}개</p>
          <p className="mt-1 text-xs text-gray-400">오답률 30% 이상</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-gray-500">최다 오답 단원</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {stats.topUnit ? stats.topUnit.unit : "-"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {stats.topUnit ? `평균 ${stats.topUnit.rate}%` : "데이터 없음"}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">단원별 · 유형별 오답률</h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="유형 검색 (예: 삼각비)"
          className="w-full border rounded-lg px-3 py-1.5"
        />

        {loadingRates ? (
          <p className="text-gray-500">불러오는 중...</p>
        ) : filteredGroups.length === 0 ? (
          <p className="text-gray-500">데이터가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((g) => {
              const expanded = query.trim() !== "" || expandedUnits.has(g.unit);
              const shown = expanded ? g.items : g.items.slice(0, 6);
              const remaining = g.items.length - shown.length;
              return (
                <div key={g.unit} className="rounded-xl border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">{g.unit}</h3>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      평균 오답률 {g.avgRate}%
                    </span>
                  </div>

                  <div
                    className="mt-3 grid gap-x-3 gap-y-2"
                    style={{
                      gridTemplateColumns: "1.25rem 1fr 8rem 2.5rem 3.5rem",
                    }}
                  >
                    {shown.map((item, i) => {
                      const sev = severity(item.rate);
                      return (
                        <Fragment key={item.label}>
                          <span className="self-center text-gray-400">{i + 1}</span>
                          <span className="self-center">{item.label}</span>
                          <div className="h-2 self-center overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={`h-2 rounded-full ${sev.bar}`}
                              style={{ width: `${item.rate}%` }}
                            />
                          </div>
                          <span className="self-center text-right font-medium tabular-nums">
                            {item.rate}%
                          </span>
                          <span
                            className={`self-center rounded-full px-2 py-0.5 text-center text-xs font-medium ${sev.badge}`}
                          >
                            {sev.label}
                          </span>
                        </Fragment>
                      );
                    })}
                  </div>

                  {!query.trim() && g.items.length > 6 && (
                    <button
                      onClick={() => toggleExpand(g.unit)}
                      className="mt-3 text-xs text-blue-600 hover:underline"
                    >
                      {expandedUnits.has(g.unit) ? "접기" : `더보기 (${remaining}개 더)`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">유형별 · 난이도별 오답률</h2>
        <p className="text-xs text-gray-400">셀을 클릭하면 해당 유형·난이도의 틀린 문제를 볼 수 있습니다</p>
        {loadingRates ? (
          <p className="text-gray-500">불러오는 중...</p>
        ) : (
          <TypeDifficultyHeatmap
            cells={wrongRates.typeDifficultyRates}
            selected={selectedCell}
            onCellClick={(problemType, difficulty) =>
              setSelectedCell((prev) =>
                prev?.problemType === problemType && prev?.difficulty === difficulty
                  ? null
                  : { problemType, difficulty }
              )
            }
          />
        )}

        {selectedCell && (
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">
                {selectedCell.problemType} · {selectedCell.difficulty} 틀린 문제
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                닫기
              </button>
            </div>
            {loadingWrongProblems ? (
              <p className="mt-3 text-gray-500">불러오는 중...</p>
            ) : wrongProblems.length === 0 ? (
              <p className="mt-3 text-gray-500">해당하는 틀린 문제가 없습니다.</p>
            ) : (
              <ul className="mt-3 divide-y">
                {wrongProblems.map((p, i) => (
                  <li key={`${p.workbookId}-${p.part}-${p.problemNumber}-${i}`} className="flex items-center justify-between py-2">
                    <span>
                      {p.workbookTitle}
                      {p.part && ` · ${p.part}`} · {p.problemNumber}번
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(p.recordedAt).toLocaleDateString("ko-KR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
