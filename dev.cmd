@echo off
setlocal
where npm.cmd >nul 2>&1
if %ERRORLEVEL% equ 0 (
  npm.cmd run dev
  exit /b %ERRORLEVEL%
)
if exist "%ProgramFiles%\nodejs\npm.cmd" (
  "%ProgramFiles%\nodejs\npm.cmd" run dev
  exit /b %ERRORLEVEL%
)
echo npm not found. Install Node.js from https://nodejs.org or add it to your PATH.
exit /b 1
