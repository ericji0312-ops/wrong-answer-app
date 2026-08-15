"use client";

import { useActionState, useState } from "react";
import { addSubject, deleteSubject, type AddSubjectState } from "@/app/actions/subjects";
import type { Subject } from "@/types/domain";

const initialState: AddSubjectState = {};

export default function SubjectManager({ subjects }: { subjects: Subject[] }) {
  const [state, formAction, pending] = useActionState(addSubject, initialState);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await deleteSubject(id);
    } catch {
      setDeleteError("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6 space-y-6 text-sm">
      <div>
        <h1 className="text-xl font-bold">과목 관리</h1>
        <p className="text-gray-500 mt-1">
          분류 항목과 문제집은 과목별로 묶여 관리됩니다. 여기서 과목을 먼저
          등록해주세요.
        </p>
      </div>

      <form action={formAction} className="space-y-2 border-b pb-4">
        <label className="block font-medium">과목명</label>
        <input
          type="text"
          name="name"
          placeholder="예: 수학, 영어"
          required
          className="border rounded px-2 py-1 w-full"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white rounded px-4 py-2 w-full transition-colors duration-150 hover:bg-blue-700 disabled:opacity-40"
        >
          {pending ? "등록 중..." : "과목 등록"}
        </button>
        {state.error && <p className="text-red-600">{state.error}</p>}
      </form>

      <ul className="divide-y">
        {subjects.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-2">
            <span>{s.name}</span>
            <button
              onClick={() => handleDelete(s.id)}
              disabled={deletingId === s.id}
              className="text-xs text-red-600 hover:underline disabled:opacity-40"
            >
              {deletingId === s.id ? "삭제 중..." : "삭제"}
            </button>
          </li>
        ))}
        {subjects.length === 0 && (
          <li className="py-2 text-gray-500">등록된 과목이 없습니다.</li>
        )}
      </ul>
      {deleteError && <p className="text-red-600">{deleteError}</p>}
    </div>
  );
}
