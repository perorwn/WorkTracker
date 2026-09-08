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

웹 데이터 로직 테스트는 통과했으며, 전체 빌드 및 실제 서비스 연결 검증은 아직 완료되지 않았습니다.
