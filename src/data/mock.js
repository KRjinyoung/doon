// 프로토타입용 가짜 브라우저 상태.
// "탭 37개 열어둔 채로 일하는 사람"을 가정한다. 그게 실제 사용 조건이다.

const MINUTE = 1000 * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

export function createState(now = Date.now()) {
  return {
    now,
    tabs: [
      { id: 't1', title: 'doon/doon: 주소창부터 다시 만든 브라우저', url: 'https://github.com/doon/doon', lastActive: now - 2 * MINUTE },
      { id: 't2', title: 'Docker Compose 파일 레퍼런스', url: 'https://docs.docker.com/compose/compose-file/', lastActive: now - 14 * MINUTE },
      { id: 't3', title: '결제 연동 가이드 — 토스페이먼츠', url: 'https://docs.tosspayments.com/guides/payment', lastActive: now - 40 * MINUTE },
      { id: 't4', title: 'Slack | 프로덕트팀', url: 'https://app.slack.com/client/T01/C02', lastActive: now - 3 * MINUTE, audible: true },
      { id: 't5', title: 'Figma — 명령 바 와이어프레임', url: 'https://www.figma.com/file/abc/command-bar', lastActive: now - 55 * MINUTE },
      { id: 't6', title: 'Docker Compose 파일 레퍼런스', url: 'https://docs.docker.com/compose/compose-file/?utm_source=newsletter', lastActive: now - 2 * HOUR },
      { id: 't7', title: '릴리스 노트 초안 - Google Docs', url: 'https://docs.google.com/document/d/xyz/edit', lastActive: now - 5 * HOUR },
      { id: 't8', title: 'YouTube — 키보드 중심 UI 데모', url: 'https://www.youtube.com/watch?v=abcd1234', lastActive: now - 6 * HOUR, audible: true },
    ],
    history: [
      { title: 'Docker Compose 로 로컬 개발환경 만들기', url: 'https://docs.docker.com/compose/gettingstarted/', visits: 9, lastVisit: now - 3 * HOUR },
      { title: '토스페이먼츠 결제위젯 연동', url: 'https://docs.tosspayments.com/guides/payment-widget', visits: 4, lastVisit: now - 20 * HOUR },
      { title: 'Chromium 소스 빌드 가이드', url: 'https://chromium.googlesource.com/chromium/src/+/main/docs/linux/build_instructions.md', visits: 2, lastVisit: now - 2 * DAY },
      { title: 'Electron WebContentsView 문서', url: 'https://www.electronjs.org/docs/latest/api/web-contents-view', visits: 6, lastVisit: now - 26 * HOUR },
      { title: '브라우저 시장 점유율 2026', url: 'https://gs.statcounter.com/browser-market-share', visits: 1, lastVisit: now - 5 * DAY },
      { title: '사업자등록 신청 - 홈택스', url: 'https://hometax.go.kr/registration', visits: 3, lastVisit: now - 9 * DAY },
      { title: 'Arc 브라우저는 왜 접었나', url: 'https://news.example.com/arc-postmortem', visits: 2, lastVisit: now - 12 * DAY },
    ],
    bookmarks: [
      { title: '주간 회고 노션', url: 'https://www.notion.so/weekly-retro', folder: '일' },
      { title: 'Docker Hub', url: 'https://hub.docker.com/', folder: '개발' },
      { title: '네이버 메일', url: 'https://mail.naver.com/', folder: null },
      { title: 'Chromium 디자인 문서 모음', url: 'https://www.chromium.org/developers/design-documents/', folder: '리서치' },
    ],
    currentTabId: 't1',
  };
}
