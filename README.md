# WorkTracker

Clip Studio Paint 작업 시간을 측정하고 Supabase를 통해 웹에 표시하는 프로젝트입니다.

- 루트 Python 파일: 기존 Windows 작업 시간 측정·SQLite 저장·Supabase 동기화 프로그램
- `web/`: 기존 디자인을 유지하면서 실제 기록 조회를 연결한 Next.js 웹사이트

웹 실행 방법과 검증 상태는 [web/README.md](web/README.md)를 확인하세요.

```powershell
cd web
pnpm install --frozen-lockfile
pnpm dev
```

## GitHub Pages (PC에 Node.js 설치 불필요)

GitHub 저장소의 Settings → Pages → Build and deployment → Source에서 **GitHub Actions**를 선택합니다.
이후 main에 웹 코드가 푸시되면 자동으로 테스트·빌드·배포됩니다. 처음 설정 후에는 Actions → Deploy web to GitHub Pages → Run workflow로 실행할 수 있습니다.

배포 성공 후 주소: https://perorwn.github.io/WorkTracker/

Actions에서 build와 deploy가 모두 초록색인지 확인하세요. Python 측정 프로그램은 기존처럼 PC에서 실행합니다.
웹 데이터 로직 테스트는 통과했으며, 전체 빌드 결과는 Actions에서 확인할 수 있습니다.

## Windows 창모드

창모드 화면은 측정 프로그램과 같은 `http://127.0.0.1:8765`에서 제공됩니다. 설치할 때 `web`에서 `pnpm build`를 실행한 후 `web/out` 내용 전체를 측정 프로그램 옆 `web_static` 폴더에 복사하세요. 웹 디자인을 수정한 경우 이 사본도 갱신해야 합니다. 실행 PC에서는 빌드된 파일만 있으면 되므로 Node.js가 필요하지 않습니다.

측정 프로그램이 실행 중일 때 웹의 `창모드` 버튼, 트레이 메뉴의 `창모드 열기`, 또는 `Ctrl+Shift+F1`~`F3`를 누르면 Microsoft Edge 앱 창으로 열립니다. 주소 표시줄 없이 항상 위 Windows 창으로 동작하며, 마지막 창 크기와 위치는 다음 실행에도 유지됩니다. 창이 열린 상태에서는 `Ctrl+Shift+-`로 현재 기능의 왼쪽 버튼을, `Ctrl+Shift++`로 오른쪽 버튼을 실행할 수 있습니다.

창모드는 오늘 기록, 항상 표시되는 작업 시간 측정, 세로 전환 버튼 3개, 선택한 타이머 순서입니다. Ctrl+Shift+F1은 뽀모도로, F2는 타이머, F3는 스톱워치입니다.
