@echo off
REM Launches OBS with the replay buffer already running, minimized to tray.
REM Edit OBS_PATH below if your install location differs.

set OBS_PATH="C:\Program Files\obs-studio\bin\64bit\obs64.exe"
set OBS_DIR="C:\Program Files\obs-studio\bin\64bit"

start "" /D %OBS_DIR% %OBS_PATH% --startreplaybuffer --minimize-to-tray