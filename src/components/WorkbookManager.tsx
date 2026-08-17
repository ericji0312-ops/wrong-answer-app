"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createWorkbook,
  deleteWorkbook,
  deleteWorkbookProblem,
  getWorkbookProblems,
  parseWorkbookPdfFromStorage,
  saveWorkbookProblems,
  updateWorkbookProblem,
} from "@/app/actions/workbooks";
import { supabase, WORKBOOK_PDF_BUCKET } from "@/lib/supabaseClient";
import type { Difficulty, Subject, Workbook, WorkbookProblem } from "@/types/domain";
import { DIFFICULTIES } from "@/types/domain";
import type { ParsedWorkbookProblem } from "@/lib/gemini";

export default function WorkbookManager({
  subjects,
  workbooks,
}: {
  subjects: Subject[];
  workbooks: Workbook[];
}) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [localWorkbooks, setLocalWorkbooks] = useState(workbooks);
  const [selectedWorkbookId, setSelectedWorkbookId] = useState<string | null>(null);

  const [problems, setProblems] = useState<WorkbookProblem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(false);

  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editPart, setEditPart] = useState("");
  const [editProblemNumber, setEditProblemNumber] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editProblemType, setEditProblemType] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<Difficulty>("중");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ParsedWorkbookProblem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveDraftError, setSaveDraftError] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const workbooksForSubject = useMemo(
    () => localWorkbooks.filter((w) => w.subject_id === subjectId),
    [localWorkbooks, subjectId]
  );

  useEffect(() => {
    setSelectedWorkbookId(null);
    setDraft(null);
  }, [subjectId]);

  useEffect(() => {
    if (!selectedWorkbookId) {
      setProblems([]);
      return;
    }
    let cancelled = false;
    setLoadingProblems(true);
    getWorkbookProblems(selectedWorkbookId)
      .then((data) => {
        if (!cancelled) setProblems(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingProblems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedWorkbookId]);

  async function handleCreateWorkbook() {
    if (!subjectId || !newTitle.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const workbook = await createWorkbook(subjectId, newTitle.trim());
      setLocalWorkbooks((prev) => [...prev, workbook]);
      setNewTitle("");
      setSelectedWorkbookId(workbook.id);
    } catch {
      setCreateError("문제집 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteWorkbook(id: string) {
    await deleteWorkbook(id);
    setLocalWorkbooks((prev) => prev.filter((w) => w.id !== id));
    if (selectedWorkbookId === id) setSelectedWorkbookId(null);
  }

  async function handleParse() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !selectedWorkbookId) return;

    setParseError(null);
    setDraft(null);

    // Vercel 서버리스 함수는 요청 본문이 약 4.5MB를 넘으면 플랫폼 레벨에서
    // 413으로 막아버려서, 큰 PDF는 서버 액션으로 직접 보낼 수 없다. 브라우저에서
    // 스토리지로 바로 업로드하고, 서버에는 경로만 넘긴다.
    setUploading(true);
    const storagePath = `${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(WORKBOOK_PDF_BUCKET)
      .upload(storagePath, file, { contentType: "application/pdf" });
    setUploading(false);

    if (uploadError) {
      setParseError("PDF 업로드 중 오류가 발생했습니다.");
      return;
    }

    setParsing(true);
    try {
      const { problems: parsed } = await parseWorkbookPdfFromStorage(
        subjectId,
        selectedWorkbookId,
        storagePath
      );
      if (parsed.length === 0) {
        setParseError("PDF에서 문제를 인식하지 못했습니다.");
      } else {
        setDraft(parsed);
      }
    } catch {
      setParseError("PDF 분석 중 오류가 발생했습니다.");
    } finally {
      setParsing(false);
      setFileKey((k) => k + 1);
    }
  }

  function updateDraftRow(index: number, patch: Partial<ParsedWorkbookProblem>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function removeDraftRow(index: number) {
    setDraft((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSaveDraft() {
    if (!selectedWorkbookId || !draft || draft.length === 0) return;
    setSaving(true);
    setSaveDraftError(null);
    try {
      const result = await saveWorkbookProblems(selectedWorkbookId, draft);
      if (result.error) {
        setSaveDraftError(result.error);
        return;
      }
      const refreshed = await getWorkbookProblems(selectedWorkbookId);
      setProblems(refreshed);
      setDraft(null);
    } catch (error) {
      setSaveDraftError(error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProblem(id: string) {
    await deleteWorkbookProblem(id);
    setProblems((prev) => prev.filter((p) => p.id !== id));
    if (editingProblemId === id) setEditingProblemId(null);
  }

  function startEditProblem(p: WorkbookProblem) {
    setEditingProblemId(p.id);
    setEditPart(p.part);
    setEditProblemNumber(String(p.problem_number));
    setEditUnit(p.unit);
    setEditProblemType(p.problem_type);
    setEditDifficulty(p.difficulty);
    setEditError(null);
  }

  async function saveEditProblem(id: string) {
    const problemNumber = Number(editProblemNumber);
    if (!Number.isInteger(problemNumber)) {
      setEditError("문제 번호를 올바르게 입력해주세요.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await updateWorkbookProblem(id, {
        part: editPart,
        problem_number: problemNumber,
        unit: editUnit,
        problem_type: editProblemType,
        difficulty: editDifficulty,
      });
      setProblems((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                part: editPart.trim(),
                problem_number: problemNumber,
                unit: editUnit.trim(),
                problem_type: editProblemType.trim(),
                difficulty: editDifficulty,
              }
            : p
        )
      );
      setEditingProblemId(null);
    } catch {
      setEditError("저장 중 오류가 발생했습니다.");
    } finally {
      setEditSaving(false);
    }
  }

  const selectedWorkbook = localWorkbooks.find((w) => w.id === selectedWorkbookId) ?? null;

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6 text-sm">
      <div>
        <h1 className="text-xl font-bold">문제집 관리</h1>
        <p className="text-gray-500 mt-1">
          문제집 PDF를 업로드하면 AI가 문제마다 번호/단원/유형/난이도를
          분석합니다. 결과를 검수·수정한 뒤 저장하면, 오답등록 화면에서 사진
          없이 문제번호만 선택해 오답을 기록할 수 있습니다.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block font-medium">과목</label>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="border rounded px-2 py-1 w-full"
        >
          {subjects.length === 0 && <option value="">등록된 과목이 없습니다</option>}
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 border-b pb-4">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="새 문제집 제목 (예: 쎈 수학 상)"
          className="border rounded px-2 py-1 flex-1"
        />
        <button
          onClick={handleCreateWorkbook}
          disabled={creating || !subjectId || !newTitle.trim()}
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-40"
        >
          {creating ? "생성 중..." : "문제집 생성"}
        </button>
      </div>
      {createError && <p className="text-red-600">{createError}</p>}

      <div className="flex flex-wrap gap-2">
        {workbooksForSubject.map((w) => (
          <button
            key={w.id}
            onClick={() => setSelectedWorkbookId(w.id)}
            className={
              "rounded border px-3 py-1 " +
              (selectedWorkbookId === w.id
                ? "bg-blue-600 text-white border-blue-600"
                : "hover:bg-gray-50")
            }
          >
            {w.title}
          </button>
        ))}
        {workbooksForSubject.length === 0 && (
          <p className="text-gray-500">이 과목에 등록된 문제집이 없습니다.</p>
        )}
      </div>

      {selectedWorkbook && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{selectedWorkbook.title}</h2>
            <button
              onClick={() => handleDeleteWorkbook(selectedWorkbook.id)}
              className="text-xs text-red-600 hover:underline"
            >
              문제집 삭제
            </button>
          </div>

          <div key={fileKey} className="space-y-2 bg-gray-50 rounded p-3">
            <label className="block font-medium">문제집 PDF 업로드 및 AI 분석</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              required
              className="border rounded px-2 py-1 w-full bg-white"
            />
            <button
              type="button"
              onClick={handleParse}
              disabled={uploading || parsing}
              className="bg-gray-800 text-white rounded px-4 py-2 w-full hover:bg-gray-900 disabled:opacity-40"
            >
              {uploading ? "업로드 중..." : parsing ? "AI 분석 중..." : "업로드 및 분석"}
            </button>
            {parseError && <p className="text-red-600">{parseError}</p>}
          </div>

          {draft && (
            <div className="space-y-2">
              <p className="font-medium">
                분석 결과 초안 ({draft.length}문항) — 확인/수정 후 저장하세요
              </p>
              <div className="max-h-96 overflow-y-auto border rounded divide-y">
                {draft.map((p, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 p-2 text-xs">
                    <input
                      type="text"
                      value={p.part}
                      onChange={(e) => updateDraftRow(i, { part: e.target.value })}
                      placeholder="파트(없으면 비워둠)"
                      className="border rounded px-1 py-0.5 w-24 shrink-0"
                    />
                    <input
                      type="number"
                      value={p.problem_number}
                      onChange={(e) =>
                        updateDraftRow(i, { problem_number: Number(e.target.value) })
                      }
                      className="border rounded px-1 py-0.5 w-14 shrink-0 text-center"
                    />
                    <input
                      type="text"
                      value={p.unit}
                      onChange={(e) => updateDraftRow(i, { unit: e.target.value })}
                      className="border rounded px-1 py-0.5 flex-1 min-w-24"
                    />
                    <input
                      type="text"
                      value={p.problem_type}
                      onChange={(e) => updateDraftRow(i, { problem_type: e.target.value })}
                      className="border rounded px-1 py-0.5 flex-1 min-w-24"
                    />
                    <select
                      value={p.difficulty}
                      onChange={(e) =>
                        updateDraftRow(i, { difficulty: e.target.value as Difficulty })
                      }
                      className="border rounded px-1 py-0.5"
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeDraftRow(i)}
                      className="text-red-600 hover:underline"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-40"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setDraft(null)}
                  className="flex-1 border rounded px-4 py-2 hover:bg-gray-50"
                >
                  취소
                </button>
              </div>
              {saveDraftError && <p className="text-red-600">{saveDraftError}</p>}
            </div>
          )}

          <div className="space-y-2">
            <p className="font-medium">저장된 문제 ({problems.length}문항)</p>
            {loadingProblems && <p className="text-gray-500">불러오는 중...</p>}
            {!loadingProblems && problems.length === 0 && (
              <p className="text-gray-500">아직 저장된 문제가 없습니다.</p>
            )}
            {!loadingProblems && problems.length > 0 && (
              <div className="max-h-96 overflow-y-auto border rounded divide-y">
                {problems.map((p, i) => {
                  const showPartHeader = i === 0 || problems[i - 1].part !== p.part;
                  return (
                  <div key={p.id}>
                    {showPartHeader && p.part && (
                      <div className="bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                        {p.part}
                      </div>
                    )}
                    {editingProblemId === p.id ? (
                    <div className="flex flex-wrap items-center gap-2 p-2 text-xs">
                      <input
                        type="text"
                        value={editPart}
                        onChange={(e) => setEditPart(e.target.value)}
                        placeholder="파트(없으면 비워둠)"
                        className="border rounded px-1 py-0.5 w-24 shrink-0"
                      />
                      <input
                        type="number"
                        value={editProblemNumber}
                        onChange={(e) => setEditProblemNumber(e.target.value)}
                        className="border rounded px-1 py-0.5 w-14 shrink-0 text-center"
                      />
                      <input
                        type="text"
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                        className="border rounded px-1 py-0.5 flex-1 min-w-24"
                      />
                      <input
                        type="text"
                        value={editProblemType}
                        onChange={(e) => setEditProblemType(e.target.value)}
                        className="border rounded px-1 py-0.5 flex-1 min-w-24"
                      />
                      <select
                        value={editDifficulty}
                        onChange={(e) => setEditDifficulty(e.target.value as Difficulty)}
                        className="border rounded px-1 py-0.5"
                      >
                        {DIFFICULTIES.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => saveEditProblem(p.id)}
                        disabled={editSaving}
                        className="text-blue-600 hover:underline disabled:opacity-40"
                      >
                        {editSaving ? "저장 중..." : "저장"}
                      </button>
                      <button
                        onClick={() => setEditingProblemId(null)}
                        className="text-gray-500 hover:underline"
                      >
                        취소
                      </button>
                      {editError && <p className="text-red-600 w-full">{editError}</p>}
                    </div>
                    ) : (
                    <div
                      className="flex items-center justify-between gap-2 p-2 text-xs"
                    >
                      <span>
                        {p.problem_number}번 · {p.unit} · {p.problem_type} · {p.difficulty}
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => startEditProblem(p)}
                          className="text-blue-600 hover:underline"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteProblem(p.id)}
                          className="text-red-600 hover:underline"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
