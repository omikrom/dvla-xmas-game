@echo off
REM compress-audio.bat - Batch convert public\*.mp3 to public\optimized\*.webm using ffmpeg
REM Usage: run this script from the repository root (double-clicking also works).
REM Requires: ffmpeg available on PATH.



















exit /b 0ENDLOCALecho All done.)  ffmpeg -y -i "!IN!" -c:a libopus -b:a 96k -vbr on -ac 2 -ar 48000 "%OPT_DIR%\!NAME!.webm"  echo Converting "!NAME!"...  set "NAME=%%~nF"  set "IN=%%~fF"for %%F in ("%PUBLIC_DIR%\*.mp3") do (
necho Scanning "%PUBLIC_DIR%" for .mp3 files...)  mkdir "%OPT_DIR%"
nIF NOT EXIST "%OPT_DIR%" (SET "OPT_DIR=%PUBLIC_DIR%\optimized"SET "PUBLIC_DIR=%SCRIPTDIR%..\public"SET "SCRIPTDIR=%~dp0"
nREM Resolve paths relative to this script: scripts\ -> project rootnSETLOCAL ENABLEDELAYEDEXPANSION