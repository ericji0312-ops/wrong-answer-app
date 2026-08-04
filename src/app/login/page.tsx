"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="mx-auto max-w-sm p-6 mt-24 space-y-4 text-sm">
      <h1 className="text-xl font-bold text-center">오답노트 자동분류</h1>
      <form action={formAction} className="space-y-3">
        <input
          type="password"
          name="password"
          placeholder="비밀번호"
          className="border rounded px-2 py-1 w-full"
          autoFocus
          required
        />
        {state.error && <p className="text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white rounded px-4 py-2 w-full transition-colors duration-150 hover:bg-blue-700 hover:shadow-md disabled:opacity-40 disabled:hover:bg-blue-600 disabled:hover:shadow-none"
        >
          {pending ? "확인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
