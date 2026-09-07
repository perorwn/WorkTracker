@echo off
cd /d "%~dp0"

echo.
echo ==========================
echo      WorkTracker Push
echo ==========================
echo.

git add .

git commit -m "Update WorkTracker"

git push

echo.
echo ==========================
echo          완료
echo ==========================
echo.

pause
