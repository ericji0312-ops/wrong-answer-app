"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/register", label: "오답 등록" },
  { href: "/dashboard", label: "취약유형 대시보드" },
  { href: "/students", label: "학생 관리" },
  { href: "/subjects", label: "과목 관리" },
  { href: "/tags", label: "분류 항목" },
  { href: "/workbooks", label: "문제집 관리" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-4">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={
            pathname === link.href
              ? "text-blue-600 font-semibold"
              : "text-gray-600 hover:text-blue-600"
          }
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
