@echo off
setlocal

if "%~1"=="" (
  echo Usage: %~nx0 ^<seconds^>
  echo Example: %~nx0 30
  exit /b 1
)

cd /d "%~dp0.."
node "src\obs_replay_clip.js" %~1
