"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  addStudent,
  deleteStudent,
  type AddStudentState,
} from "@/app/actions/students";
import { setStudentSubjects } from "@/app/actions/studentSubjects";
import type { Student, Subject } from "@/types/domain";

const initialState: AddStudentState = {};

const GRADES = ["중1", "중2", "중3", "고1", "고2", "고3"];
const LEVELS = ["비기너", "베이직", "어드밴스드"];

function SubjectEditor({
  studentId,
  subjects,
  selectedIds,
}: {
  studentId: string;
  subjects: Subject[];
  selectedIds: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string[]>(selectedIds);
  const [saving, setSaving] = useState(false);

  if (!editing) {
    const names = subjects.filter((s) => selectedIds.includes(s.id)).map((s) => s.name);
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>{names.length > 0 ? names.join(", ") : "수강 과목 없음"}</span>
        <button
          onClick={() => {
            setPicked(selectedIds);
            setEditing(true);
          }}
          className="text-blue-600 hover:underline"
        >
          수정
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {subjects.map((s) => (
        <label key={s.id} className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={picked.includes(s.id)}
            onChange={(e) =>
              setPicked((prev) =>
                e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
              )
            }
          />
          {s.name}
        </label>
      ))}
      <button
        onClick={async () => {
          setSaving(true);
          try {
            await setStudentSubjects(studentId, picked);
            setEditing(false);
          } finally {
            setSaving(false);
          }
        }}
        disabled={saving}
        className="text-blue-600 hover:underline disabled:opacity-40"
      >
        {saving ? "저장 중..." : "저장"}
      </button>
      <button onClick={() => setEditing(false)} className="text-gray-500 hover:underline">
        취소
      </button>
    </div>
  );
}

export default function StudentManager({
  students,
  subjects,
  studentSubjectMap,
}: {
  students: Student[];
  subjects: Subject[];
  studentSubjectMap: Record<string, string[]>;
}) {
  const [state, formAction, pending] = useActionState(addStudent, initialState);

  return (
    <div className="mx-auto max-w-lg p-6 space-y-6 text-sm">
      <h1 className="text-xl font-bold">학생 관리</h1>

      <form action={formAction} className="space-y-2 border-b pb-4">
        <label className="block font-medium">이름</label>
        <input
          type="text"
          name="name"
          required
          className="border rounded px-2 py-1 w-full"
        />

        <label className="block font-medium">학년</label>
        <select name="grade" className="border rounded px-2 py-1 w-full">
          <option value="">선택 안 함</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <label className="block font-medium">레벨</label>
        <select name="level" className="border rounded px-2 py-1 w-full">
          <option value="">선택 안 함</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white rounded px-4 py-2 w-full transition-colors duration-150 hover:bg-blue-700 disabled:opacity-40"
        >
          {pending ? "등록 중..." : "학생 등록"}
        </button>
        {state.error && <p className="text-red-600">{state.error}</p>}
      </form>

      <ul className="divide-y">
        {students.map((s) => (
          <li key={s.id} className="py-2 space-y-1">
            <div className="flex items-center justify-between">
              <span>
                {s.name}
                {s.grade ? ` · ${s.grade}` : ""}
                {s.level ? ` · ${s.level}` : ""}
              </span>
              <button
                onClick={() => deleteStudent(s.id)}
                className="text-xs text-red-600 hover:underline"
              >
                삭제
              </button>
            </div>
            <SubjectEditor
              studentId={s.id}
              subjects={subjects}
              selectedIds={studentSubjectMap[s.id] ?? []}
            />
          </li>
        ))}
        {students.length === 0 && (
          <li className="py-2 text-gray-500">등록된 학생이 없습니다.</li>
        )}
      </ul>
    </div>
  );
}
