# 오답노트 자동분류 & 취약유형 대시보드

사진/PDF로 받은 틀린 문제를 업로드하면 Gemini가 단원/유형을 자동 분류해 저장하고,
학생별로 취약 유형을 대시보드에서 확인할 수 있는 내부용 웹앱입니다.

## 스택

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Supabase (DB + Storage) ·
Gemini API (`gemini-2.5-flash`) · 공유 비밀번호 로그인

## 최초 설정

1. **Supabase 프로젝트 생성**
   - https://supabase.com 에서 새 프로젝트 생성
   - 프로젝트 대시보드 > SQL Editor 에서 `supabase/schema.sql` 내용을 그대로 실행
     (테이블 2개 + `wrong-answers` Storage 버킷/정책까지 한 번에 생성됨)
   - Project Settings > API 에서 `Project URL`과 `anon public` 키 확인

2. **Gemini API 키 발급**
   - https://aistudio.google.com/apikey 에서 무료 API 키 발급

3. **환경변수 설정**
   - `.env.local.example`을 참고해 `.env.local`에 아래 값을 채웁니다.

     | 변수 | 설명 |
     |---|---|
     | `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
     | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public 키 |
     | `GEMINI_API_KEY` | Google AI Studio에서 발급한 Gemini API 키 |
     | `SHARED_PASSWORD` | 선생님들이 로그인할 때 쓸 공유 비밀번호 (원하는 값으로 설정) |
     | `AUTH_SECRET` | 세션 쿠키 서명용 임의의 긴 문자열 (`openssl rand -hex 32` 등으로 생성) |

4. **설치 및 실행**

   ```bash
   npm install
   npm run dev
   ```

   http://localhost:3000 접속 → 로그인 → 학생 관리에서 학생 등록 → 오답 등록 화면에서
   사진 업로드/분류/저장 → 대시보드에서 확인.

## 배포 (Vercel)

1. GitHub 저장소에 push
2. Vercel에서 이 저장소를 import
3. 위 5개 환경변수를 Vercel 프로젝트 설정 > Environment Variables 에 동일하게 등록
4. Deploy

## 화면 구성

- `/register` — 오답 등록 (학생 선택 → 사진/PDF 업로드 → AI 분류 결과 확인/수정 → 저장)
- `/dashboard` — 학생별 취약유형 대시보드 (단원별/유형별 오답 개수, 기간 필터, 오답 목록)
- `/students` — 학생 등록/관리

## 참고

- `unit`/`problem_type`은 현재 자유 텍스트입니다. 단원/유형 태그 목록이 확정되면
  `unit_tags` 마스터 테이블을 추가하고 분류 프롬프트에 허용 목록을 넣어 일관성을
  높이는 것을 권장합니다 (설계 명세서 3번 항목 참고).
- 이 앱은 RLS 없이 anon key로 직접 DB/Storage에 접근합니다 (공유 비밀번호 모델).
  Supabase 프로젝트를 다른 용도로 공유하지 마세요.
