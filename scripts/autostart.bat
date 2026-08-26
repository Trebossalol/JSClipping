@echo off
REM Launches OBS with the replay buffer already running, minimized to tray.
REM Edit OBS_PATH below if your install location differs.

set OBS_PATH="C:\Program Files\obs-studio\bin\64bit\obs64.exe"
set OBS_DIR="C:\Program Files\obs-studio\bin\64bit"

if exist "%APPDATA%\obs-studio\.sentinel" rd /s /q "%APPDATA%\obs-studio\.sentinel"
start "" /D %OBS_DIR% %OBS_PATH% --startreplaybuffer --minimize-to-tray --disable-shutdown-check