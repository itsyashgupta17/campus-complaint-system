@echo off
title Campus Management Backend Server
echo ====================================================
echo Starting Parul Campus Management Backend Server...
echo Connecting to MongoDB Atlas Database...
echo Frontend and API will be available at: http://localhost:5000
echo ====================================================
cd /d "%~dp0backend"
node server.js
pause
