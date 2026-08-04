"use client";

import { useActionState } from "react";
import {
  addStudent,
  deleteStudent,
  type AddStudentState,
} from "@/app/actions/students";
import type { Student } from "@/types/domain";

const initialState: AddStudentState = {};

const GRADES = ["중1", "중2", "중3", "고1", "고2", "고3"];
const LEVELS = ["비기너", "베이직", "어드밴스드"];

export default function StudentManager({ students }: { students: Student[] }) {
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
          <li key={s.id} className="flex items-center justify-between py-2">
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
          </li>
        ))}
        {students.length === 0 && (
          <li className="py-2 text-gray-500">등록된 학생이 없습니다.</li>
        )}
      </ul>
    </div>
  );
}
