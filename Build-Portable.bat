@echo off
setlocal
cd /d "%~dp0"
echo Installing build dependencies...
call npm install --include=dev
if errorlevel 1 goto :error
call npm run check
if errorlevel 1 goto :error
echo Building portable edition...
call npm run dist:portable
if errorlevel 1 goto :error
start "" "%~dp0dist"
pause
exit /b 0
:error
echo Build failed. Review the error above.
pause
exit /b 1
