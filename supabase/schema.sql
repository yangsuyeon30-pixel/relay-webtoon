-- 팀 웹툰 말풍선 채우기 — Supabase 스키마 (stack-test-landing)
-- supabase db query --project-ref rbvhohhuqaryzuahskfe -f schema.sql 로 적용

create table if not exists public.webtoon_config (
  id int primary key,
  team_count int not null default 8,
  updated_at timestamptz not null default now()
);
insert into public.webtoon_config (id, team_count) values (1, 8)
on conflict (id) do nothing;

create table if not exists public.webtoon_teams (
  team_no int primary key,
  submitted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.webtoon_bubbles (
  team_no int not null,
  panel_idx int not null,
  bubble_idx int not null,
  text text not null default '',
  updated_at timestamptz not null default now(),
  primary key (team_no, panel_idx, bubble_idx)
);
create index if not exists webtoon_bubbles_team_idx on public.webtoon_bubbles (team_no);

alter table public.webtoon_config enable row level security;
alter table public.webtoon_teams enable row level security;
alter table public.webtoon_bubbles enable row level security;

-- 교육용 일회성 앱: 익명(anon) 키로 읽기/쓰기 모두 허용
drop policy if exists webtoon_open on public.webtoon_config;
create policy webtoon_open on public.webtoon_config for all to anon using (true) with check (true);
drop policy if exists webtoon_open on public.webtoon_teams;
create policy webtoon_open on public.webtoon_teams for all to anon using (true) with check (true);
drop policy if exists webtoon_open on public.webtoon_bubbles;
create policy webtoon_open on public.webtoon_bubbles for all to anon using (true) with check (true);

-- 릴레이 웹툰 이어쓰기 (2026-11-17, 별도 앱 relay-webtoon): 스키마 변경 없이 기존 테이블의 관례로 동작한다.
--   webtoon_config id=3 행의 team_count: 이 앱의 팀 수 (id=1은 기존 office-webtoon 앱 전용이라 건드리지 않음).
--   webtoon_bubbles team_no=0: 릴레이 공용 캔버스 (팀 번호는 1부터라 기존 앱 데이터와 충돌 없음).
--   webtoon_teams team_no=900+panel_idx, submitted=true: 해당 컷 완료/잠금 표시 (팀 수는 최대 60).
--   webtoon_config id=4 행의 team_count: 이 앱의 사용 컷 수 (1컷부터 이 숫자까지, 기본값=그림 총수).
--   구간 나누기: 컷 수 P를 팀 수 N으로 최대한 균등하게 연속 구간으로 나눈다 (앞 팀부터 한 컷씩 더 받음).
--   예: 15컷·8팀이면 1~7팀은 2컷씩, 8팀은 1컷. 한 팀의 차례 = 자기 구간 전체를 쓰고 넘기기.
--   REST upsert 시 Prefer: resolution=merge-duplicates,return=representation 사용.
--   참고: 기존 office-webtoon 앱의 관리자 CSV는 webtoon_bubbles 전체를 내려받으므로, 릴레이 데이터가 있는 동안에는
--   '0팀' 행이 함께 보일 수 있다. 릴레이 초기화(관리자)를 하면 사라진다. 기존 앱 화면·데이터에는 영향이 없다.
