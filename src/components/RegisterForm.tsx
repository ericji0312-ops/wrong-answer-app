"use client";

import { useActionState, useEffect, useState } from "react";
import {
  analyzeWrongAnswerDeep,
  classifyUpload,
  saveWrongAnswer,
  type ClassifyState,
  type SaveWrongAnswerState,
} from "@/app/actions/wrongAnswers";
import type { Difficulty, Student, UnitTag } from "@/types/domain";
import { DIFFICULTIES } from "@/types/domain";

const initialClassifyState: ClassifyState = {};
const initialSaveState: SaveWrongAnswerState = {};

export default function RegisterForm({
  students,
  unitTags,
}: {
  students: Student[];
  unitTags: UnitTag[];
}) {
  const units = [...new Set(unitTags.map((t) => t.unit))];
  const problemTypes = [...new Set(unitTags.map((t) => t.problem_type))];
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [unit, setUnit] = useState("");
  const [problemType, setProblemType] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("중");
  const [fileKey, setFileKey] = useState(0);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const [analysisPoints, setAnalysisPoints] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [classifyState, classifyAction, classifying] = useActionState(
    classifyUpload,
    initialClassifyState
  );
  const [saveState, saveAction, saving] = useActionState(
    saveWrongAnswer,
    initialSaveState
  );

  useEffect(() => {
    if (classifyState.result) {
      setUnit(classifyState.result.unit);
      setProblemType(classifyState.result.problem_type);
      setDifficulty(classifyState.result.difficulty);
      setAnalysisPoints([]);
      setAnalysisError(null);
    }
  }, [classifyState.result]);

  useEffect(() => {
    if (saveState.success && classifyState.imageUrl) {
      setSavedImageUrl(classifyState.imageUrl);
      setUnit("");
      setProblemType("");
      setAnalysisPoints([]);
      setFileKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState.success]);

  const showResult = Boolean(classifyState.imageUrl) && classifyState.imageUrl !== savedImageUrl;

  async function requestDeepAnalysis() {
    if (!classifyState.imageUrl) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const { points } = await analyzeWrongAnswerDeep(classifyState.imageUrl);
      setAnalysisPoints(points);
    } catch {
      setAnalysisError("심층분석 중 오류가 발생했습니다.");
    } finally {
      setAnalyzing(false);
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

      <form action={classifyAction} className="space-y-2" key={fileKey}>
        <label className="block font-medium">틀린 문제 사진 / PDF</label>
        <input
          type="file"
          name="file"
          accept="image/*,application/pdf"
          required
          className="border rounded px-2 py-1 w-full"
        />
        <button
          type="submit"
          disabled={classifying || !studentId}
          className="bg-gray-800 text-white rounded px-4 py-2 w-full transition-colors duration-150 hover:bg-gray-900 disabled:opacity-40"
        >
          {classifying ? "AI 분류 중..." : "업로드 및 AI 분류"}
        </button>
        {classifyState.error && <p className="text-red-600">{classifyState.error}</p>}
      </form>

      {showResult && (
        <form action={saveAction} className="space-y-3 border-t pt-4">
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="imageUrl" value={classifyState.imageUrl} />
          <input type="hidden" name="rawResponse" value={classifyState.rawResponse ?? ""} />
          <input type="hidden" name="analysisPoints" value={JSON.stringify(analysisPoints)} />

          <p className="font-medium">AI 분류 결과 (확인/수정 후 저장)</p>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={classifyState.imageUrl}
            alt="업로드한 오답 사진"
            className="max-h-64 rounded border object-contain"
          />

          <div className="space-y-1">
            <label className="block font-medium">단원</label>
            <input
              type="text"
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              list="unit-options"
              className="border rounded px-2 py-1 w-full"
              required
            />
            <datalist id="unit-options">
              {units.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1">
            <label className="block font-medium">세부 유형</label>
            <input
              type="text"
              name="problemType"
              value={problemType}
              onChange={(e) => setProblemType(e.target.value)}
              list="problem-type-options"
              className="border rounded px-2 py-1 w-full"
              required
            />
            <datalist id="problem-type-options">
              {problemTypes.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1">
            <label className="block font-medium">난이도</label>
            <input type="hidden" name="difficulty" value={difficulty} />
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={
                    "flex-1 rounded border px-3 py-1 " +
                    (difficulty === d
                      ? "bg-blue-600 text-white border-blue-600"
                      : "hover:bg-gray-50")
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <button
              type="button"
              onClick={requestDeepAnalysis}
              disabled={analyzing}
              className="w-full border rounded px-4 py-2 hover:bg-gray-50 disabled:opacity-40"
            >
              {analyzing ? "심층분석 중..." : "심층분석 (Gemini 3.6 Flash)"}
            </button>
            {analysisError && <p className="text-red-600">{analysisError}</p>}
            {analysisPoints.length > 0 && (
              <ul className="list-disc list-inside space-y-1 bg-gray-50 rounded p-2">
                {analysisPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white rounded px-4 py-2 w-full transition-colors duration-150 hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          {saveState.error && <p className="text-red-600">{saveState.error}</p>}
          {saveState.success && <p className="text-green-600">저장되었습니다.</p>}
        </form>
      )}
    </div>
  );
}
