@echo off
echo Starting DVLA Vehicle Layoff System...
docker compose -f layoff/docker-compose.yml up -d --build
echo.
echo Vehicle Layoff launched at http://localhost:3005
echo phpMyAdmin available at http://localhost:8086
pause
