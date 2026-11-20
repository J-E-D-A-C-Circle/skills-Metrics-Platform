@echo off
echo Stopping DVLA Skills Metrics Platform...
docker compose -f skills-metrics/docker-compose.yml down
echo.
echo Skills Metrics stopped.
pause
