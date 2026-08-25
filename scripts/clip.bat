@echo off
setlocal

REM Dev launcher (tsx). Packaged Action Ring should call:
REM   "C:\Program Files\EasyClip\EasyClip.exe" --clip 30

if "%~1"=="" (
  echo Usage: %~nx0 ^<seconds^>
  echo Example: %~nx0 30
  exit /b 1
)

cd /d "%~dp0.."
if not exist "node_modules\.bin\tsx.cmd" (
  echo Missing local tsx. Run: npm install
  exit /b 1
)
call "node_modules\.bin\tsx.cmd" "src\cli\obs_replay_clip.ts" %~1
