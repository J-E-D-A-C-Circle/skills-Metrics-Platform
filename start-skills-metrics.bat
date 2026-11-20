@echo off
echo Starting DVLA Skills Metrics Platform...
docker compose -f skills-metrics/docker-compose.yml up -d --build
echo.
echo Skills Metrics launched at http://localhost:3004
echo phpMyAdmin available at http://localhost:8085
pause
