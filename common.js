/* 릴레이 웹툰 이어쓰기 — 공유: Supabase 연결 + 패널 데이터
 *
 * 이 앱은 기존 office-webtoon 앱과 Supabase 프로젝트/테이블을 공유하지만, 아래 관례로 완전히 분리된다.
 *   webtoon_config id=3 행의 team_count: 이 앱의 팀 수 (id=1은 기존 앱 전용이라 건드리지 않음).
 *   webtoon_config id=4 행의 team_count: 이 앱의 사용 컷 수 (1컷부터 이 숫자까지 사용, 없으면 그림 총수).
 *   webtoon_config id=5 행의 team_count: 초기화 횟수 카운터 (초기화할 때마다 +1; 열어둔 참가자 화면이 초기화를 알아채고 로컬 초안을 버리는 신호).
 *   webtoon_bubbles team_no=0: 릴레이 공용 캔버스 (팀 번호는 1부터라 기존 앱 데이터와 충돌 없음).
 *   webtoon_teams team_no=900+panel_idx, submitted=true면 해당 컷 잠금 (팀 수는 최대 60이라 충돌 없음).
 * 구간 나누기: 컷 수 P를 팀 수 N으로 최대한 균등하게 연속 구간으로 나눈다 (앞 팀부터 한 컷씩 더 받음).
 *   예: 15컷·8팀이면 1~7팀은 2컷씩, 8팀은 1컷. 한 팀의 차례 = 자기 구간 전체를 쓰고 넘기기.
 * 스키마 변경(DDL) 없이 기존 테이블만으로 동작한다.
 */
const SB_URL = 'https://rbvhohhuqaryzuahskfe.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJidmhvaGh1cWFyeXp1YWhza2ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNTIxNDYsImV4cCI6MjEwNzkyODE0Nn0.oIMmJjotxIGYBWcOkuLe56xae4ATnHTvvb87Jq03Yzc';
const H = { 'apikey': SB_ANON, 'Authorization': 'Bearer ' + SB_ANON, 'Content-Type': 'application/json' };

async function api(path, init) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, Object.assign({ headers: H }, init || {}));
  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error('요청 실패 (' + r.status + ') ' + t); }
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

const PANELS = [
  { img: 'img/panel-01.png', title: '1컷 · 아침 9시', cap: '햇살 가득한 사무실로 출근하는 두 사람' },
  { img: 'img/panel-02.png', title: '2컷 · 팀 회의', cap: '화이트보드 앞에서 발표하는 팀장' },
  { img: 'img/panel-03.png', title: '3컷 · 바쁜 오전', cap: '커피 한 잔의 여유와 서류 더미' },
  { img: 'img/panel-04.png', title: '4컷 · 점심시간', cap: '함께 먹는 점심, 웃음 가득' },
  { img: 'img/panel-05.png', title: '5컷 · 나른한 오후', cap: '책상에 엎드린 동료와 깨우는 손길' },
  { img: 'img/panel-06.png', title: '6컷 · 긴급 상황!', cap: '모니터 속 빨간 오류 화면' },
  { img: 'img/panel-07.png', title: '7컷 · 힘을 합쳐', cap: '머리를 맞댄 여섯 사람' },
  { img: 'img/panel-08.png', title: '8컷 · 야근하는 밤', cap: '창밖 도시 불빛과 따뜻한 조명' },
  { img: 'img/panel-09.png', title: '9컷 · 성공!', cap: '하이파이브와 흩날리는 색종이' },
  { img: 'img/panel-10.png', title: '10컷 · 퇴근길', cap: '함께 나서는 밤거리' },
  { img: 'img/panel-11.png', title: '11컷 · 퇴근 후 회식', cap: '치킨집에서 건배하는 동료들' },
  { img: 'img/panel-12.png', title: '12컷 · 웃음꽃', cap: '이야기꽃이 핀 회식 자리' },
  { img: 'img/panel-13.png', title: '13컷 · 집으로 가는 길', cap: '가로등 아래 함께 걷는 밤거리' },
  { img: 'img/panel-14.png', title: '14컷 · 하루 마무리', cap: '집에서 조용히 하루를 돌아보는 시간' },
  { img: 'img/panel-15.png', title: '15컷 · 다음날 아침', cap: '햇살과 함께 다시 시작하는 출근길' },
];
const BUBBLES_PER_PANEL = 2;
const BUBBLE_LABEL = ['말풍선 ①', '말풍선 ②'];
const RELAY_TEAM = 0;
const MARKER_BASE = 900;
const CONFIG_ID = 3;
const PANEL_CONFIG_ID = 4;
const RESET_CONFIG_ID = 5;

async function getTeamCount() {
  try {
    const rows = await api('webtoon_config?select=team_count&id=eq.' + CONFIG_ID);
    const n = rows && rows[0] && rows[0].team_count;
    return (n && n > 0) ? n : 8;
  } catch (e) { return 8; }
}

async function getPanelCount() {
  try {
    const rows = await api('webtoon_config?select=team_count&id=eq.' + PANEL_CONFIG_ID);
    const n = rows && rows[0] && rows[0].team_count;
    if (n && n > 0) return Math.min(n, PANELS.length);
  } catch (e) { /* 없으면 그림 총수 */ }
  return PANELS.length;
}

async function getResetEpoch() {
  try {
    const rows = await api('webtoon_config?select=team_count&id=eq.' + RESET_CONFIG_ID);
    const n = rows && rows[0] && rows[0].team_count;
    return n || 0;
  } catch (e) { return null; } // 읽기에 실패하면 이번 폴링에서는 초기화 판단을 건너뜀
}

/* 구간 나누기: P컷을 N팀이 연속 구간으로 최대한 균등하게 (앞 팀부터 한 컷씩 더 받음) */
function chunkOwner(p, n, pc) {
  const P = pc || PANELS.length;
  const base = Math.floor(P / n), rem = P % n;
  const boundary = rem * (base + 1);
  if (p < boundary) return Math.floor(p / (base + 1)) + 1;
  return rem + Math.floor((p - boundary) / base) + 1;
}

function teamChunk(team, n, pc) {
  const P = pc || PANELS.length;
  const base = Math.floor(P / n), rem = P % n;
  let start, size;
  if (team <= rem) { start = (team - 1) * (base + 1); size = base + 1; }
  else { start = rem * (base + 1) + (team - 1 - rem) * base; size = base; }
  if (size <= 0) return null;
  return { start: start, end: start + size - 1, size: size };
}

function chunkLabel(team, n, pc) {
  const c = teamChunk(team, n, pc);
  if (!c) return '맡은 구간 없음';
  return c.size === 1 ? ((c.start + 1) + '컷') : ((c.start + 1) + '~' + (c.end + 1) + '컷');
}

function relayAuthor(p, n, pc) { return chunkOwner(p, n, pc); }

async function getRelayState(n, pc) {
  const P = pc || PANELS.length;
  const done = new Array(P).fill(false);
  try {
    const markers = await api('webtoon_teams?select=team_no,submitted&team_no=gte.' + MARKER_BASE);
    markers.forEach(m => {
      const p = m.team_no - MARKER_BASE;
      if (p >= 0 && p < P && m.submitted) done[p] = true;
    });
  } catch (e) { /* 마커를 못 읽으면 전부 미완료로 취급 */ }
  let current = -1;
  for (let i = 0; i < P; i++) { if (!done[i]) { current = i; break; } }
  const currentTeam = current === -1 ? null : chunkOwner(current, n, P);
  return {
    done: done,
    currentPanel: current,
    complete: current === -1,
    currentTeam: currentTeam,
    currentChunk: currentTeam ? teamChunk(currentTeam, n, P) : null,
    doneCount: done.filter(Boolean).length,
    panelCount: P
  };
}

async function getRelayBubbles() {
  const map = {};
  try {
    const rows = await api('webtoon_bubbles?select=panel_idx,bubble_idx,text&team_no=eq.' + RELAY_TEAM);
    rows.forEach(r => { map[r.panel_idx + '_' + r.bubble_idx] = r.text || ''; });
  } catch (e) { /* 첫 작성 */ }
  return map;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function bubbleHTML(text, editable, p, b, lockedLabel) {
  const side = b === 0 ? 'left' : 'right';
  if (editable) {
    return '<div class="bubble edit ' + side + '" data-p="' + p + '" data-b="' + b + '">'
      + '<textarea rows="2" maxlength="120" placeholder="대사를 입력하세요" data-p="' + p + '" data-b="' + b + '">' + esc(text) + '</textarea></div>';
  }
  if (lockedLabel) {
    return '<div class="bubble locked ' + side + '">' + esc(lockedLabel) + '</div>';
  }
  const cls = 'bubble' + (text ? '' : ' empty');
  const inner = text ? esc(text).replace(/\n/g, '<br>') : '<span class="ph">…</span>';
  return '<div class="' + cls + ' ' + side + '">' + inner + '</div>';
}

function panelFigure(p, bubbleFn, badgeHTML) {
  const meta = PANELS[p];
  return '<figure class="panel" id="panel-' + p + '">'
    + '<div class="art"><img src="' + meta.img + '" alt="' + esc(meta.title) + '" loading="lazy">'
    + bubbleFn(0) + bubbleFn(1)
    + '</div>'
    + '<figcaption><strong>' + esc(meta.title) + '</strong>'
    + (badgeHTML ? '<span class="figbadge">' + badgeHTML + '</span>' : '')
    + '</figcaption>'
    + '</figure>';
}
