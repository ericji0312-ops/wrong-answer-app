"use client";

import { logout } from "@/app/actions/auth";

export default function LogoutButton() {
  return (
    <button
      onClick={() => logout()}
      className="text-xs text-gray-500 hover:text-gray-800 underline"
    >
      로그아웃
    </button>
  );
}
