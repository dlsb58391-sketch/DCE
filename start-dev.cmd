@echo off
title BDIC Server (dev) - keep this window open
cd /d C:\Dental\dental-site
set NODE_ENV=development
set PORT=3000
set HOSTNAME=0.0.0.0
echo ============================================
echo   BDIC site (dev) at http://localhost:3000
echo   Login: doctor@bdic.clinic / bdic12345
echo   Keep this window open during the demo.
echo ============================================
:loop
echo [%date% %time%] starting next dev... >> bdic-run.log
node node_modules\next\dist\bin\next dev -p 3000 -H 0.0.0.0 >> bdic-run.log 2>&1
echo [%date% %time%] next dev exited with code %errorlevel% - restarting in 3s >> bdic-run.log
timeout /t 3 /nobreak >nul
goto loop
