# 릴레이 웹툰 이어쓰기

하나의 웹툰을 팀이 순서대로 이어쓰는 교육용 앱. 15컷을 팀 수대로 구간을 나눠, 각 팀이 맡은 구간(컷당 말풍선 2개)을 쓰고 다음 팀에게 넘긴다.

- 라이브: https://relay-webtoon.vercel.app/
- 관리자: https://relay-webtoon.vercel.app/admin.html

## 구조

- `index.html` — 팀 선택(홈)
- `write.html` — 팀별 이어쓰기 화면 (자기 구간으로 자동 스크롤, 3초마다 차례 확인)
- `result.html` — 완성 웹툰 보기
- `admin.html` — 관리자 (팀 수·컷 수 설정, 릴레이 현황 3초 자동 갱신, 전체 보기 미리보기, CSV 다운로드, 초기화)
- `common.js` — Supabase 연결 + 패널 데이터 + 구간 나누기
- `img/` — 웹툰 컷 이미지 15장
- `supabase/schema.sql` — 사용하는 테이블·관례 정리
- `check.js` — 문법 + 구간 나누기 검사 (`node check.js`)

## 데이터 (Supabase `stack-test-landing`, DDL 없이 관례로 분리)

- `webtoon_config` id=3 팀 수, id=4 컷 수, id=5 초기화 횟수 카운터
- `webtoon_bubbles` team_no=0 릴레이 공용 캔버스
- `webtoon_teams` team_no=900+panel_idx 완료 마커

## 배포

바꾼 파일을 `dist/`에 똑같이 복사한 뒤 `dist/`에서 배포한다.

```sh
cd dist
vc deploy --prod --yes --scope suyeon15 --project relay-webtoon
```

`dist/`는 배포용 복사본이라 저장소에 포함하지 않는다.
