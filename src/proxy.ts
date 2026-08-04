import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

// 공유 비밀번호 로그인 게이트. 세션 쿠키만 확인하는 optimistic check —
// 실제 데이터 접근 권한은 anon key 자체가 통제한다 (RLS 미적용, 별도 사용자 계정이 없기 때문).
const PUBLIC_PATHS = ["/login"];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.includes(path);

  const session = await decrypt(req.cookies.get("session")?.value);
  const authenticated = Boolean(session?.authenticated);

  if (!isPublic && !authenticated) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isPublic && authenticated) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
