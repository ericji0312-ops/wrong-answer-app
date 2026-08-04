"use client";

import { useActionState, useMemo } from "react";
import {
  uploadUnitTags,
  deleteUnitTag,
  type UploadUnitTagsState,
} from "@/app/actions/unitTags";
import type { UnitTag } from "@/types/domain";

const initialState: UploadUnitTagsState = {};

const PLACEHOLDER = `이차함수
- 이차함수의 최댓값·최솟값 활용
- 이차함수와 직선의 위치관계
- 이차함수의 그래프 해석

수열의 극한
- 수열의 극한값 계산
- 급수의 합`;

export default function TagManager({ tags }: { tags: UnitTag[] }) {
  const [state, formAction, pending] = useActionState(uploadUnitTags, initialState);

  const grouped = useMemo(() => {
    const map = new Map<string, UnitTag[]>();
    for (const tag of tags) {
      const list = map.get(tag.unit) ?? [];
      list.push(tag);
      map.set(tag.unit, list);
    }
    return [...map.entries()];
  }, [tags]);

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6 text-sm">
      <div>
        <h1 className="text-xl font-bold">분류 항목 관리</h1>
        <p className="text-gray-500 mt-1">
          커리큘럼 단원/세부유형을 텍스트로 붙여넣으면, AI가 오답을 분류할 때 이
          목록에서 가장 가까운 항목을 우선적으로 고릅니다. 단원명 줄 아래에{" "}
          <code className="bg-gray-100 px-1 rounded">- 세부유형</code> 형태로
          적어주세요.
        </p>
      </div>

      <form action={formAction} className="space-y-2 border-b pb-4">
        <textarea
          name="text"
          rows={10}
          placeholder={PLACEHOLDER}
          className="border rounded px-2 py-1 w-full font-mono text-xs"
          required
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white rounded px-4 py-2 w-full transition-colors duration-150 hover:bg-blue-700 disabled:opacity-40"
        >
          {pending ? "업로드 중..." : "업로드"}
        </button>
        {state.error && <p className="text-red-600">{state.error}</p>}
        {state.addedCount !== undefined && (
          <p className="text-green-600">{state.addedCount}개 항목을 반영했습니다.</p>
        )}
      </form>

      <div className="space-y-4">
        {grouped.map(([unit, items]) => (
          <div key={unit}>
            <p className="font-semibold">{unit}</p>
            <ul className="divide-y">
              {items.map((tag) => (
                <li
                  key={tag.id}
                  className="flex items-center justify-between py-1 pl-3 text-gray-700"
                >
                  <span>{tag.problem_type}</span>
                  <button
                    onClick={() => deleteUnitTag(tag.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {grouped.length === 0 && (
          <p className="text-gray-500">등록된 분류 항목이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
