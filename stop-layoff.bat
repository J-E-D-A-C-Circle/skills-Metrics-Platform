@echo off
echo Stopping DVLA Vehicle Layoff System...
docker compose -f layoff/docker-compose.yml down
echo.
echo Vehicle Layoff stopped.
pause
