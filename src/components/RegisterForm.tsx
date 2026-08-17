"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getWorkbookProblems } from "@/app/actions/workbooks";
import {
  deleteAttemptSession,
  getAttemptSessionHistory,
  saveWorkbookWrongAnswers,
  type AttemptSessionHistoryItem,
} from "@/app/actions/wrongAnswers";
import type { Student, Subject, Workbook, WorkbookProblem } from "@/types/domain";

export default function RegisterForm({
  students,
  subjects,
  studentSubjectMap,
  workbooks,
}: {
  students: Student[];
  subjects: Subject[];
  studentSubjectMap: Record<string, string[]>;
  workbooks: Workbook[];
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState("");
  const [workbookId, setWorkbookId] = useState("");
  const [part, setPart] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [problems, setProblems] = useState<WorkbookProblem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [wrongNumbers, setWrongNumbers] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [history, setHistory] = useState<AttemptSessionHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const workbookTitle = useCallback(
    (workbookId: string) => workbooks.find((w) => w.id === workbookId)?.title ?? "(삭제된 문제집)",
    [workbooks]
  );

  const refreshHistory = useCallback(() => {
    if (!studentId) {
      setHistory([]);
      return;
    }
    setLoadingHistory(true);
    getAttemptSessionHistory(studentId)
      .then(setHistory)
      .finally(() => setLoadingHistory(false));
  }, [studentId]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  async function handleDelete(sessionId: string) {
    if (!window.confirm("이 등록 이력을 삭제할까요? 관련된 오답 기록도 함께 삭제되며 되돌릴 수 없습니다.")) {
      return;
    }
    setDeletingId(sessionId);
    try {
      await deleteAttemptSession(sessionId);
      refreshHistory();
    } catch {
      window.alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  const availableSubjects = useMemo(
    () => subjects.filter((s) => (studentSubjectMap[studentId] ?? []).includes(s.id)),
    [subjects, studentSubjectMap, studentId]
  );

  const workbooksForSubject = useMemo(
    () => workbooks.filter((w) => w.subject_id === subjectId),
    [workbooks, subjectId]
  );

  useEffect(() => {
    setSubjectId(availableSubjects[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    setWorkbookId(workbooksForSubject[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  useEffect(() => {
    setProblems([]);
    setPart("");
    setWrongNumbers(new Set());
    setSaveSuccess(false);
    if (!workbookId) return;
    let cancelled = false;
    setLoadingProblems(true);
    getWorkbookProblems(workbookId)
      .then((data) => {
        if (!cancelled) {
          setProblems(data);
          setPart(data[0]?.part ?? "");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProblems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workbookId]);

  const parts = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const p of problems) {
      if (!seen.has(p.part)) {
        seen.add(p.part);
        list.push(p.part);
      }
    }
    return list;
  }, [problems]);

  const start = Number(rangeStart);
  const end = Number(rangeEnd);
  const rangeValid =
    rangeStart !== "" && rangeEnd !== "" && Number.isInteger(start) && Number.isInteger(end) && start <= end;

  const problemsInRange = useMemo(() => {
    if (!rangeValid) return [];
    return problems.filter(
      (p) => p.part === part && p.problem_number >= start && p.problem_number <= end
    );
  }, [problems, rangeValid, start, end, part]);

  function toggleWrong(problemNumber: number) {
    setWrongNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(problemNumber)) next.delete(problemNumber);
      else next.add(problemNumber);
      return next;
    });
  }

  async function handleSave() {
    if (!studentId || !workbookId || !rangeValid) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveWorkbookWrongAnswers({
        studentId,
        workbookId,
        part,
        rangeStart: start,
        rangeEnd: end,
        wrongProblemNumbers: [...wrongNumbers],
      });
      setSaveSuccess(true);
      setRangeStart("");
      setRangeEnd("");
      setWrongNumbers(new Set());
      setProblems([]);
      refreshHistory();
    } catch {
      setSaveError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6 space-y-6 text-sm">
      <h1 className="text-xl font-bold">오답 등록</h1>

      <div className="space-y-1">
        <label className="block font-medium">학생</label>
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        >
          {students.length === 0 && <option value="">등록된 학생이 없습니다</option>}
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.grade ? ` (${s.grade})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block font-medium">과목</label>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="border rounded px-2 py-1 w-full"
          disabled={availableSubjects.length === 0}
        >
          {availableSubjects.length === 0 && (
            <option value="">이 학생이 수강 중인 과목이 없습니다</option>
          )}
          {availableSubjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {availableSubjects.length === 0 && studentId && (
          <p className="text-xs text-gray-500">
            학생 관리 화면에서 이 학생의 수강 과목을 먼저 등록해주세요.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block font-medium">문제집</label>
        <select
          value={workbookId}
          onChange={(e) => setWorkbookId(e.target.value)}
          className="border rounded px-2 py-1 w-full"
          disabled={workbooksForSubject.length === 0}
        >
          {workbooksForSubject.length === 0 && (
            <option value="">등록된 문제집이 없습니다</option>
          )}
          {workbooksForSubject.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>
        {workbooksForSubject.length === 0 && subjectId && (
          <p className="text-xs text-gray-500">
            문제집 관리 화면에서 이 과목의 문제집을 먼저 등록해주세요.
          </p>
        )}
      </div>

      {parts.length > 1 && (
        <div className="space-y-1">
          <label className="block font-medium">파트</label>
          <select
            value={part}
            onChange={(e) => {
              setPart(e.target.value);
              setWrongNumbers(new Set());
            }}
            className="border rounded px-2 py-1 w-full"
          >
            {parts.map((p) => (
              <option key={p} value={p}>
                {p || "(파트 구분 없음)"}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label className="block font-medium">이번에 푼 범위</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            placeholder="시작 번호"
            className="border rounded px-2 py-1 w-full"
          />
          <span>~</span>
          <input
            type="number"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            placeholder="끝 번호"
            className="border rounded px-2 py-1 w-full"
          />
        </div>
      </div>

      {loadingProblems && <p className="text-gray-500">문제 목록을 불러오는 중...</p>}

      {!loadingProblems && rangeValid && workbookId && (
        <div className="space-y-2 border-t pt-4">
          <p className="font-medium">
            틀린 문제를 선택해주세요 ({problemsInRange.length}문항 중{" "}
            {wrongNumbers.size}개 선택)
          </p>
          {problemsInRange.length === 0 ? (
            <p className="text-gray-500">
              이 범위에 등록된 문제가 없습니다. 문제집 관리 화면에서 문제 데이터를
              확인해주세요.
            </p>
          ) : (
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
              {problemsInRange.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleWrong(p.problem_number)}
                  className={
                    "rounded border py-1 text-xs " +
                    (wrongNumbers.has(p.problem_number)
                      ? "bg-red-600 text-white border-red-600"
                      : "hover:bg-gray-50")
                  }
                >
                  {p.problem_number}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !studentId || !workbookId || !rangeValid}
        className="bg-blue-600 text-white rounded px-4 py-2 w-full transition-colors duration-150 hover:bg-blue-700 disabled:opacity-40"
      >
        {saving ? "저장 중..." : "오답 등록 저장"}
      </button>
      {saveError && <p className="text-red-600">{saveError}</p>}
      {saveSuccess && <p className="text-green-600">저장되었습니다.</p>}

      <div className="space-y-2 border-t pt-4">
        <h2 className="font-medium">등록 이력</h2>
        {loadingHistory ? (
          <p className="text-gray-500">불러오는 중...</p>
        ) : history.length === 0 ? (
          <p className="text-gray-500">등록된 이력이 없습니다.</p>
        ) : (
          <ul className="divide-y rounded border">
            {history.map((h) => (
              <li key={h.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId((prev) => (prev === h.id ? null : h.id))}
                    className="flex-1 text-left"
                  >
                    <p className="font-medium">
                      {workbookTitle(h.workbookId)}
                      {h.part && ` · ${h.part}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {h.rangeStart}~{h.rangeEnd}번 · 오답 {h.wrongCount}개 ·{" "}
                      {new Date(h.recordedAt).toLocaleDateString("ko-KR")}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(h.id)}
                    disabled={deletingId === h.id}
                    className="shrink-0 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    {deletingId === h.id ? "삭제 중..." : "삭제"}
                  </button>
                </div>
                {expandedId === h.id && (
                  <p className="mt-2 text-xs text-gray-600">
                    {h.wrongProblemNumbers.length === 0
                      ? "틀린 문제가 없습니다."
                      : `틀린 번호: ${h.wrongProblemNumbers.join(", ")}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
