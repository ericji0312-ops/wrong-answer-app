-- 오답노트 자동분류 & 취약유형 대시보드 앱 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 그대로 실행하면 됨.

create extension if not exists "pgcrypto";

create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade text,
  level text,
  created_at timestamptz not null default now()
);

create table wrong_answers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  image_url text not null,
  unit text not null,
  problem_type text not null,
  ai_raw_response text,
  is_verified boolean not null default false,
  recorded_at timestamptz not null default now()
);

create index on wrong_answers (student_id);
create index on wrong_answers (recorded_at);

-- 이 앱은 Supabase Auth를 쓰지 않고 앱 레벨의 공유 비밀번호로만 접근을 제어한다
-- (스펙 참고). 따라서 이 두 테이블은 RLS를 비활성 상태로 두고 anon key로 직접
-- 읽기/쓰기 한다. 만약 나중에 실제 사용자별 인증을 도입하면 RLS를 켜고 정책을
-- 추가해야 한다.

-- ============================================================
-- Storage: 오답 사진/PDF 원본 저장용 버킷
-- Supabase 대시보드 > SQL Editor 에서 이 블록도 함께 실행하면 버킷과
-- 업로드/조회 정책까지 한 번에 준비된다 (대시보드에서 수동으로 버킷을
-- 만들어도 무방하나, public으로 설정해야 image_url을 그대로 <img>에 쓸 수 있다).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('wrong-answers', 'wrong-answers', true)
on conflict (id) do nothing;

-- storage.objects는 Supabase가 기본적으로 RLS를 켜두므로, 이 앱의 공유
-- 비밀번호 모델에 맞춰 anon key로 자유롭게 업로드/조회할 수 있도록 정책을 연다.
create policy "wrong-answers public read"
  on storage.objects for select
  using (bucket_id = 'wrong-answers');

create policy "wrong-answers anon insert"
  on storage.objects for insert
  with check (bucket_id = 'wrong-answers');

-- ============================================================
-- 마이그레이션: 분류 항목(단원/세부유형) 목록 — AI 분류 프롬프트에 참고 목록으로 사용
-- Supabase 대시보드 > SQL Editor 에서 이 블록만 실행하면 됨.
-- ============================================================

create table unit_tags (
  id uuid primary key default gen_random_uuid(),
  unit text not null,
  problem_type text not null,
  created_at timestamptz not null default now(),
  unique (unit, problem_type)
);

create index on unit_tags (unit);

-- unit_tags는 이 Supabase 프로젝트 기본값으로 RLS가 켜진 채 생성됐다. 나머지 테이블과
-- 동일하게 anon key로 자유롭게 읽기/쓰기 하도록 꺼준다.
alter table unit_tags disable row level security;

-- ============================================================
-- 마이그레이션: 오답 난이도 (하/중/상) — AI가 계산 복잡도·개념 응용 정도를 보고 분류
-- Supabase 대시보드 > SQL Editor 에서 이 블록만 실행하면 됨.
-- ============================================================

alter table wrong_answers
  add column if not exists difficulty text;
