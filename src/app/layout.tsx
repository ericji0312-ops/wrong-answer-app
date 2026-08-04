import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSession } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";
import NavLinks from "@/components/NavLinks";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "오답노트 자동분류",
  description: "오답노트 자동분류 & 취약유형 대시보드",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authenticated = await getSession();

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {authenticated && (
          <nav className="flex items-center justify-between gap-4 border-b px-6 py-3 text-sm font-medium">
            <NavLinks />
            <LogoutButton />
          </nav>
        )}
        {children}
      </body>
    </html>
  );
}
