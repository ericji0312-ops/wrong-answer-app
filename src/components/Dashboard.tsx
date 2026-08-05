"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getWrongAnswers,
  reclassifyWrongAnswer,
  updateWrongAnswerClassification,
} from "@/app/actions/wrongAnswers";
import BarList from "@/components/BarList";
import DifficultyTypeHeatmap from "@/components/DifficultyTypeHeatmap";
import type { Difficulty, Student, UnitTag, WrongAnswer } from "@/types/domain";
import { DIFFICULTIES } from "@/types/domain";

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

function countByDifficulty(items: WrongAnswer[]) {
  const counts = new Map<Difficulty, number>();
  for (const item of items) {
    if (!item.difficulty) continue;
    counts.set(item.difficulty, (counts.get(item.difficulty) ?? 0) + 1);
  }
  // 개수 순이 아니라 하→중→상→최상 고정 순서로 보여준다 (난이도는 랭킹이 아니라 척도이므로).
  return DIFFICULTIES.map((d) => ({ label: d, count: counts.get(d) ?? 0 }));
}

interface FolderGroup {
  key: string;
  unit: string;
  problemType: string;
  items: WrongAnswer[];
}

function groupByCategory(items: WrongAnswer[]): FolderGroup[] {
  const map = new Map<string, FolderGroup>();
  for (const item of items) {
    const key = `${item.unit} ${item.problem_type}`;
    const group = map.get(key);
    if (group) {
      group.items.push(item);
    } else {
      map.set(key, {
        key,
        unit: item.unit,
        problemType: item.problem_type,
        items: [item],
      });
    }
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length);
}

export default function Dashboard({
  students,
  unitTags,
}: {
  students: Student[];
  unitTags: UnitTag[];
}) {
  const units = [...new Set(unitTags.map((t) => t.unit))];
  const problemTypes = [...new Set(unitTags.map((t) => t.problem_type))];

  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [period, setPeriod] = useState<Period>("all");
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<WrongAnswer | null>(null);
  const [editing, setEditing] = useState(false);
  const [editUnit, setEditUnit] = useState("");
  const [editProblemType, setEditProblemType] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<Difficulty>("중");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyError, setReclassifyError] = useState<string | null>(null);

  function openPreview(item: WrongAnswer) {
    setPreviewItem(item);
    setEditing(false);
    setEditUnit(item.unit);
    setEditProblemType(item.problem_type);
    setEditDifficulty(item.difficulty ?? "중");
    setEditError(null);
    setReclassifyError(null);
  }

  async function requestReclassify() {
    if (!previewItem) return;
    setReclassifying(true);
    setReclassifyError(null);
    try {
      const { result } = await reclassifyWrongAnswer(previewItem.image_url);
      setEditUnit(result.unit);
      setEditProblemType(result.problem_type);
      setEditDifficulty(result.difficulty);
      setEditing(true);
    } catch {
      setReclassifyError("AI 재분류 중 오류가 발생했습니다.");
    } finally {
      setReclassifying(false);
    }
  }

  async function saveClassification() {
    if (!previewItem) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await updateWrongAnswerClassification(
        previewItem.id,
        editUnit,
        editProblemType,
        editDifficulty
      );
      setWrongAnswers((prev) =>
        prev.map((w) =>
          w.id === previewItem.id
            ? {
                ...w,
                unit: editUnit.trim(),
                problem_type: editProblemType.trim(),
                difficulty: editDifficulty,
              }
            : w
        )
      );
      setPreviewItem(null);
      setOpenFolder(null);
    } catch {
      setEditError("저장 중 오류가 발생했습니다.");
    } finally {
      setEditSaving(false);
    }
  }

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
  const difficultyCounts = useMemo(() => countByDifficulty(filtered), [filtered]);
  const folders = useMemo(() => groupByCategory(filtered), [filtered]);
  const activeFolder = folders.find((f) => f.key === openFolder) ?? null;

  useEffect(() => {
    setOpenFolder(null);
  }, [studentId, period]);

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
            <h2 className="font-semibold">난이도별 오답 개수</h2>
            <BarList items={difficultyCounts} />
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">난이도별 취약 유형</h2>
            <DifficultyTypeHeatmap items={filtered} />
          </section>

          <section className="space-y-2">
            {activeFolder ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOpenFolder(null)}
                    className="text-blue-600 hover:underline"
                  >
                    ← 분류 항목 목록
                  </button>
                </div>
                <h2 className="font-semibold">
                  {activeFolder.unit} · {activeFolder.problemType} (
                  {activeFolder.items.length}건)
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {activeFolder.items.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => openPreview(w)}
                      className="space-y-1 text-left"
                    >
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={w.image_url}
                          alt={`${w.unit} - ${w.problem_type}`}
                          className="w-full aspect-square object-cover rounded border cursor-pointer"
                        />
                        {w.difficulty && (
                          <span className="absolute top-1 right-1 rounded-full bg-black/60 text-white px-1.5 py-0.5 text-[10px]">
                            {w.difficulty}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(w.recorded_at).toLocaleDateString("ko-KR")}
                      </p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="font-semibold">분류 항목별 오답 ({filtered.length}건)</h2>
                <ul className="divide-y">
                  {folders.map((folder) => (
                    <li key={folder.key}>
                      <button
                        onClick={() => setOpenFolder(folder.key)}
                        className="w-full flex items-center gap-3 py-2 text-left hover:bg-gray-50 rounded px-1"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={folder.items[0].image_url}
                          alt={folder.problemType}
                          className="w-14 h-14 object-cover rounded border"
                        />
                        <div className="flex-1">
                          <p className="font-medium">
                            {folder.unit} · {folder.problemType}
                          </p>
                          <p className="text-xs text-gray-500">{folder.items.length}건</p>
                        </div>
                        <span className="text-gray-400">›</span>
                      </button>
                    </li>
                  ))}
                  {folders.length === 0 && (
                    <li className="py-2 text-gray-500">오답 기록이 없습니다.</li>
                  )}
                </ul>
              </>
            )}
          </section>
        </>
      )}

      {previewItem && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-lg w-full max-h-full overflow-y-auto p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewItem.image_url}
              alt="오답 원본"
              className="max-h-96 w-full object-contain rounded border"
            />

            {!editing ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">
                    {previewItem.unit} · {previewItem.problem_type}
                    {previewItem.difficulty && (
                      <span className="ml-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs align-middle">
                        난이도 {previewItem.difficulty}
                      </span>
                    )}
                  </p>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-blue-600 hover:underline shrink-0"
                  >
                    분류 수정
                  </button>
                </div>
                <button
                  onClick={requestReclassify}
                  disabled={reclassifying}
                  className="w-full border rounded px-4 py-2 hover:bg-gray-50 disabled:opacity-40"
                >
                  {reclassifying ? "AI 재분류 중..." : "AI 재분류 요청"}
                </button>
                {reclassifyError && <p className="text-red-600">{reclassifyError}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="block font-medium">단원</label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    list="dashboard-unit-options"
                    className="border rounded px-2 py-1 w-full"
                  />
                  <datalist id="dashboard-unit-options">
                    {units.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label className="block font-medium">세부 유형</label>
                  <input
                    type="text"
                    value={editProblemType}
                    onChange={(e) => setEditProblemType(e.target.value)}
                    list="dashboard-problem-type-options"
                    className="border rounded px-2 py-1 w-full"
                  />
                  <datalist id="dashboard-problem-type-options">
                    {problemTypes.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label className="block font-medium">난이도</label>
                  <div className="flex gap-2">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setEditDifficulty(d)}
                        className={
                          "flex-1 rounded border px-3 py-1 " +
                          (editDifficulty === d
                            ? "bg-blue-600 text-white border-blue-600"
                            : "hover:bg-gray-50")
                        }
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                {editError && <p className="text-red-600">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={saveClassification}
                    disabled={editSaving}
                    className="flex-1 bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-40"
                  >
                    {editSaving ? "저장 중..." : "저장"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 border rounded px-4 py-2 hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
