"use client";

import { useEffect, useMemo, useState } from "react";
import { getWrongRateBreakdown, type WrongRateBreakdown } from "@/app/actions/wrongAnswers";
import BarList from "@/components/BarList";
import TypeDifficultyHeatmap from "@/components/TypeDifficultyHeatmap";
import type { Student } from "@/types/domain";

type Period = "all" | "1m";

export default function Dashboard({ students }: { students: Student[] }) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [period, setPeriod] = useState<Period>("all");
  const [wrongRates, setWrongRates] = useState<WrongRateBreakdown>({
    unitTypeRates: [],
    typeDifficultyRates: [],
  });
  const [loadingRates, setLoadingRates] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setWrongRates({ unitTypeRates: [], typeDifficultyRates: [] });
      return;
    }
    let cancelled = false;
    setLoadingRates(true);
    const sinceIso =
      period === "1m"
        ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
    getWrongRateBreakdown(studentId, sinceIso)
      .then((data) => {
        if (!cancelled) setWrongRates(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingRates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, period]);

  const typeRatesByUnit = useMemo(() => {
    const groups = new Map<string, { unit: string; wrongSum: number; items: { label: string; count: number }[] }>();
    for (const r of wrongRates.unitTypeRates) {
      if (r.wrong === 0) continue;
      const group = groups.get(r.unit) ?? { unit: r.unit, wrongSum: 0, items: [] };
      group.wrongSum += r.wrong;
      group.items.push({ label: r.problem_type, count: Math.round((r.wrong / r.total) * 100) });
      groups.set(r.unit, group);
    }
    for (const group of groups.values()) {
      group.items.sort((a, b) => b.count - a.count);
    }
    return [...groups.values()].sort((a, b) => b.wrongSum - a.wrongSum);
  }, [wrongRates.unitTypeRates]);

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-8 text-sm">
      <h1 className="text-xl font-bold">학생별 취약유형 대시보드</h1>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <label className="block font-medium">학생</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="border rounded px-2 py-1"
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
          <label className="block font-medium">기간</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="border rounded px-2 py-1"
          >
            <option value="all">전체</option>
            <option value="1m">최근 1개월</option>
          </select>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="font-semibold">단원별 · 유형별 오답률</h2>
        {loadingRates ? (
          <p className="text-gray-500">불러오는 중...</p>
        ) : (
          <BarList
            groups={typeRatesByUnit.map((g) => ({ heading: g.unit, items: g.items }))}
            valueSuffix="%"
            max={100}
          />
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">유형별 · 난이도별 오답률</h2>
        {loadingRates ? (
          <p className="text-gray-500">불러오는 중...</p>
        ) : (
          <TypeDifficultyHeatmap cells={wrongRates.typeDifficultyRates} />
        )}
      </section>
    </div>
  );
}
