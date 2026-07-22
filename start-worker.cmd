@echo off
title BDIC WhatsApp Worker - keep this window open
cd /d C:\Dental\dental-site
echo ============================================
echo   BDIC WhatsApp booking worker
echo   Links the clinic WhatsApp number to the bot.
echo   Scan the QR from the dashboard WhatsApp tab.
echo   Keep this window open.
echo ============================================
:loop
node worker\whatsapp-web.mjs >> wa-worker.log 2>&1
echo [%date% %time%] worker exited - restarting in 5s >> wa-worker.log
timeout /t 5 /nobreak >nul
goto loop
