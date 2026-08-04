"use server";

import { redirect } from "next/navigation";
import { createSession, deleteSession } from "@/lib/session";

export interface LoginState {
  error?: string;
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");

  if (typeof password !== "string" || password.length === 0) {
    return { error: "비밀번호를 입력해주세요." };
  }

  if (password !== process.env.SHARED_PASSWORD) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }

  await createSession();
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
