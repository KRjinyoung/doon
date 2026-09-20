// 지금 확정된 결정만 반영한 최소 실행체.
//   001 · Electron
//   002 · F11 완전 몰입 — 브라우저 크롬(주소창·탭바·버튼) 없음
//   003 · "OS에 들어온 느낌" — OS 창틀(제목표시줄·최소화/최대화/닫기·리사이즈 테두리)도 없음
//
// 아직 확정되지 않은 것(소환 방법, 탭 전환, 홈 화면, 부팅 시퀀스 등)은
// 일부러 아무것도 넣지 않았다. 그래서 이 창은 "들어가면 콘텐츠가 화면 전체를
// 채운다"는 느낌 하나만 체험할 수 있고, 나가는 방법도 임시로만 있다.

const { app, BrowserWindow, Menu, globalShortcut, screen } = require('electron');

// OS가 그려주는 메뉴바도 003의 "창틀 없음"에 포함된다.
// null을 주지 않으면 리눅스/윈도우에서 위쪽에 메뉴 줄이 남는다.
Menu.setApplicationMenu(null);

function createWindow() {
  // fullscreen:true 는 창 관리자(WM)가 EWMH 힌트를 처리해줘야 실제로 화면을
  // 채운다. WM이 없거나 다르게 구현된 리눅스 환경에서도 "화면 자체가 된다"는
  // 003을 보장하려고, 창 생성 시점에 주 디스플레이 크기로 bounds를 직접 맞춘다.
  const { width, height } = screen.getPrimaryDisplay().size;

  const win = new BrowserWindow({
    x: 0,
    y: 0,
    width,
    height,
    frame: false,        // 003 · 제목표시줄과 최소화/최대화/닫기 버튼, 리사이즈 테두리 제거
    fullscreen: true,     // 003 · 창이 아니라 화면 자체가 된다
    autoHideMenuBar: true,
    backgroundColor: '#000000',
  });

  // 콘텐츠: 아직 "홈 화면"이 뭔지(003-3) 정해지지 않았다.
  // 이 사용자가 대화를 시작할 때 직접 예로 든 화면(구글 검색창 + F11)을
  // 그대로 채워서, "이게 내 소프트웨어의 평소 상태다"를 체감할 수 있게 했다.
  // 실제 제품에서 무엇을 채울지는 003-3에서 따로 정한다.
  win.loadURL('https://www.google.com');

  // 임시 탈출구. 소환 방법(002-1)이 정해지기 전까지는
  // 이것 말고는 이 창을 벗어날 방법이 없다 — 디자인이 아니라 테스트 편의다.
  globalShortcut.register('Escape', () => app.quit());
  globalShortcut.register('CommandOrControl+Q', () => app.quit());

  return win;
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  app.quit();
});
