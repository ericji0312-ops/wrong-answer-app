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

-- ============================================================
-- 마이그레이션: 과목(subjects) + 학생-과목 수강 연결 + 분류항목 과목 소속
-- Supabase 대시보드 > SQL Editor 에서 이 블록만 실행하면 됨.
-- ============================================================

create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table subjects disable row level security;

create table student_subjects (
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, subject_id)
);

alter table student_subjects disable row level security;

-- 기존 unit_tags는 과목 개념 없이 만들어졌으므로, 기본 과목 "수학"을 만들고
-- 기존 데이터를 모두 이 과목 소속으로 이관한다. 필요하면 /subjects 화면에서
-- 이후에 과목을 더 추가하거나 이름을 바꾸면 된다.
insert into subjects (name) values ('수학')
on conflict (name) do nothing;

alter table unit_tags add column if not exists subject_id uuid references subjects(id);

update unit_tags
set subject_id = (select id from subjects where name = '수학')
where subject_id is null;

alter table unit_tags alter column subject_id set not null;

alter table unit_tags drop constraint if exists unit_tags_unit_problem_type_key;
alter table unit_tags add constraint unit_tags_subject_unit_problem_type_key
  unique (subject_id, unit, problem_type);

create index on unit_tags (subject_id);

-- ============================================================
-- 마이그레이션: 문제집(workbooks) 기반 오답률 시스템
-- Supabase 대시보드 > SQL Editor 에서 이 블록만 실행하면 됨.
-- ============================================================

create table workbooks (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

alter table workbooks disable row level security;
create index on workbooks (subject_id);

create table workbook_problems (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  problem_number integer not null,
  unit text not null,
  problem_type text not null,
  difficulty text not null,
  created_at timestamptz not null default now(),
  unique (workbook_id, problem_number)
);

alter table workbook_problems disable row level security;
create index on workbook_problems (workbook_id);

create table attempt_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  workbook_id uuid not null references workbooks(id) on delete cascade,
  range_start integer not null,
  range_end integer not null,
  recorded_at timestamptz not null default now()
);

alter table attempt_sessions disable row level security;
create index on attempt_sessions (student_id);
create index on attempt_sessions (workbook_id);

-- wrong_answers: 문제집 기반 등록을 지원하도록 확장. 새 방식은 사진이 없으므로
-- image_url을 nullable로 바꾸고, 문제집 문제/풀이 세션을 참조하는 컬럼을 추가한다.
-- 기존 사진 기반 오답 기록은 그대로 남아있고 대시보드에서 계속 조회/수정할 수 있다.
alter table wrong_answers alter column image_url drop not null;
alter table wrong_answers add column if not exists workbook_problem_id uuid references workbook_problems(id);
alter table wrong_answers add column if not exists attempt_session_id uuid references attempt_sessions(id);

create index on wrong_answers (workbook_problem_id);
create index on wrong_answers (attempt_session_id);

-- ============================================================
-- 마이그레이션: 삭제 시 외래키 동작 수정
-- Supabase 대시보드 > SQL Editor 에서 이 블록만 실행하면 됨.
--
-- unit_tags.subject_id에 on delete cascade가 빠져 있어서, 이미 분류 항목이
-- 연결된 과목을 삭제하면 외래키 제약 위반으로 실패했다 (화면에는 에러가
-- 표시되지 않아 마치 아무 반응이 없는 것처럼 보임). workbooks처럼 과목
-- 삭제 시 그 과목의 분류 항목도 함께 삭제되도록 cascade로 바꾼다.
--
-- wrong_answers.workbook_problem_id / attempt_session_id는 반대로, 문제집
-- 문제나 풀이 세션이 나중에 삭제되더라도 이미 기록된 오답(단원/유형/난이도는
-- 저장 시점에 복사해뒀음)은 사라지지 않고 남아있어야 하므로 on delete set
-- null로 바꾼다.
-- ============================================================

alter table unit_tags drop constraint if exists unit_tags_subject_id_fkey;
alter table unit_tags add constraint unit_tags_subject_id_fkey
  foreign key (subject_id) references subjects(id) on delete cascade;

alter table wrong_answers drop constraint if exists wrong_answers_workbook_problem_id_fkey;
alter table wrong_answers add constraint wrong_answers_workbook_problem_id_fkey
  foreign key (workbook_problem_id) references workbook_problems(id) on delete set null;

alter table wrong_answers drop constraint if exists wrong_answers_attempt_session_id_fkey;
alter table wrong_answers add constraint wrong_answers_attempt_session_id_fkey
  foreign key (attempt_session_id) references attempt_sessions(id) on delete set null;

-- ============================================================
-- 마이그레이션: wrong-answers 스토리지 버킷에 삭제 정책 추가
-- Supabase 대시보드 > SQL Editor 에서 이 블록만 실행하면 됨.
--
-- 처음 버킷을 만들 때 읽기/업로드 정책만 열어두고 삭제 정책을 빠뜨려서,
-- 오답 기록을 지워도 연결된 사진 파일은 스토리지에 그대로 남아있었다.
-- ============================================================

create policy "wrong-answers anon delete"
  on storage.objects for delete
  using (bucket_id = 'wrong-answers');

-- ============================================================
-- 마이그레이션: 문제집 PDF 업로드용 스토리지 버킷
-- Supabase 대시보드 > SQL Editor 에서 이 블록만 실행하면 됨.
--
-- Vercel 서버리스 함수는 요청 본문이 약 4.5MB를 넘으면 플랫폼 자체에서
-- 413으로 막아버려서(Next.js의 bodySizeLimit 설정과는 별개), 스캔본처럼
-- 큰 PDF는 서버 액션으로 직접 보낼 수 없다. 그래서 브라우저에서 이 버킷으로
-- 바로 업로드한 뒤, 서버는 경로만 받아 다운로드해서 Gemini에 넘긴다.
-- 분석이 끝나면(성공/실패 무관) 서버가 바로 지운다 — 상시 보관용이 아니다.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('workbook-pdfs', 'workbook-pdfs', true)
on conflict (id) do nothing;

create policy "workbook-pdfs public read"
  on storage.objects for select
  using (bucket_id = 'workbook-pdfs');

create policy "workbook-pdfs anon insert"
  on storage.objects for insert
  with check (bucket_id = 'workbook-pdfs');

create policy "workbook-pdfs anon delete"
  on storage.objects for delete
  using (bucket_id = 'workbook-pdfs');

-- ============================================================
-- 마이그레이션: 문제집 파트(섹션) 지원
-- Supabase 대시보드 > SQL Editor 에서 이 블록만 실행하면 됨.
--
-- "일품" 같은 문제집은 개념&핵심기출/고난도 문제/최고수준 문제처럼 여러
-- 파트로 나뉘고, 파트마다 문제 번호가 다시 1번부터 시작한다. 기존
-- (workbook_id, problem_number) 유니크 제약으로는 이런 문제집을 인쇄된
-- 번호 그대로 저장할 수 없어서, 파트가 없는 척 PDF 등장 순서로 전체를
-- 강제 재넘버링했었다(이전 마이그레이션 참고). 그 결과 채점할 때 책에
-- 보이는 번호와 DB에 저장된 번호가 달라져 오답 등록이 어려워졌다.
--
-- 파트 컬럼을 추가하고 유니크 제약을 (workbook_id, part, problem_number)로
-- 넓혀서, 파트별로 번호가 리셋되는 걸 정상적으로 허용한다. 파트 구분이
-- 없는 문제집은 part=''로 두면 기존과 동일하게 동작한다. part_order는
-- PDF에 파트가 처음 등장한 순서를 저장해서, 목록을 번호가 아니라 책
-- 순서(파트 → 번호)대로 보여줄 수 있게 한다.
-- ============================================================

alter table workbook_problems add column if not exists part text not null default '';
alter table workbook_problems add column if not exists part_order integer not null default 0;

alter table workbook_problems drop constraint if exists workbook_problems_workbook_id_problem_number_key;
alter table workbook_problems add constraint workbook_problems_workbook_id_part_problem_number_key
  unique (workbook_id, part, problem_number);

alter table attempt_sessions add column if not exists part text not null default '';

-- ============================================================
-- 마이그레이션: 문제 이미지(페이지) 영구 보관
-- Supabase 대시보드 > SQL Editor 에서 이 블록만 실행하면 됨.
--
-- 취약유형 대시보드에서 틀린 문제를 클릭했을 때 실제 문제 이미지를 함께
-- 보여주기 위한 것. workbook-pdfs 버킷은 파싱 후 바로 삭제되는 임시
-- 저장소라 재사용할 수 없다 — 대신 파싱 시점에 문제가 있는 페이지만
-- JPEG로 한 번 렌더링해서 이 버킷에 영구 저장한다(무료 플랜 용량을
-- 아끼기 위해 원본 PDF 전체가 아니라 페이지 이미지만 남긴다).
-- 경로 규칙: workbook-pages/{workbook_id}/{page_number}.jpg
-- ============================================================

alter table workbook_problems add column if not exists page_number integer;

insert into storage.buckets (id, name, public)
values ('workbook-pages', 'workbook-pages', true)
on conflict (id) do nothing;

create policy "workbook-pages public read"
  on storage.objects for select
  using (bucket_id = 'workbook-pages');

create policy "workbook-pages anon insert"
  on storage.objects for insert
  with check (bucket_id = 'workbook-pages');

create policy "workbook-pages anon delete"
  on storage.objects for delete
  using (bucket_id = 'workbook-pages');
