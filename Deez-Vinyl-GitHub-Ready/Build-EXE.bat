@echo off
setlocal
cd /d "%~dp0"

echo Installing build dependencies...
call npm install --include=dev
if errorlevel 1 goto :error

echo Checking source files...
call npm run check
if errorlevel 1 goto :error

echo Building the Windows Setup installer...
call npm run dist
if errorlevel 1 goto :error

echo.
echo Build completed successfully.
echo The installer is in the dist folder and its name ends with -Setup.exe
start "" "%~dp0dist"
pause
exit /b 0

:error
echo.
echo Build failed. Review the error above.
pause
exit /b 1
