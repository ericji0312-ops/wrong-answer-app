"use client";

import { useEffect, useMemo, useState } from "react";
import { getWrongAnswers } from "@/app/actions/wrongAnswers";
import BarList from "@/components/BarList";
import type { Student, WrongAnswer } from "@/types/domain";

type Period = "all" | "1m";

function countBy(items: WrongAnswer[], key: "unit" | "problem_type") {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = item[key];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export default function Dashboard({ students }: { students: Student[] }) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [period, setPeriod] = useState<Period>("all");
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) {
      setWrongAnswers([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getWrongAnswers(studentId)
      .then((data) => {
        if (!cancelled) setWrongAnswers(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const filtered = useMemo(() => {
    if (period === "all") return wrongAnswers;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return wrongAnswers.filter((w) => new Date(w.recorded_at).getTime() >= cutoff);
  }, [wrongAnswers, period]);

  const unitCounts = useMemo(() => countBy(filtered, "unit"), [filtered]);
  const typeCounts = useMemo(() => countBy(filtered, "problem_type"), [filtered]);

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

      {loading && <p className="text-gray-500">불러오는 중...</p>}

      {!loading && (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold">단원별 오답 개수</h2>
            <BarList items={unitCounts} />
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">유형별 오답 순위</h2>
            <BarList items={typeCounts} />
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">오답 목록 ({filtered.length}건)</h2>
            <ul className="divide-y">
              {filtered.map((w) => (
                <li key={w.id} className="flex items-center gap-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={w.image_url}
                    alt={`${w.unit} - ${w.problem_type}`}
                    className="w-14 h-14 object-cover rounded border cursor-pointer"
                    onClick={() => setPreviewUrl(w.image_url)}
                  />
                  <div className="flex-1">
                    <p className="font-medium">
                      {w.unit} · {w.problem_type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(w.recorded_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="py-2 text-gray-500">오답 기록이 없습니다.</li>
              )}
            </ul>
          </section>
        </>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50"
          onClick={() => setPreviewUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="오답 원본"
            className="max-h-full max-w-full rounded shadow-lg"
          />
        </div>
      )}
    </div>
  );
}
