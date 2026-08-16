"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

const LINKS = [
  { href: "/register", label: "오답 등록" },
  { href: "/dashboard", label: "취약유형 대시보드" },
  { href: "/students", label: "학생 관리" },
  { href: "/subjects", label: "과목 관리" },
  { href: "/tags", label: "분류 항목" },
  { href: "/workbooks", label: "문제집 관리" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r bg-white sticky top-0">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="h-7 w-7 shrink-0 rounded-md bg-blue-600" />
        <span className="font-bold">오답앱</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 text-sm">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                "block rounded-lg px-3 py-2 " +
                (active
                  ? "bg-blue-50 font-semibold text-blue-600"
                  : "text-gray-600 hover:bg-gray-50")
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-4 py-4">
        <LogoutButton />
      </div>
    </aside>
  );
}
