@echo off
echo ========================================================
echo Starting DVLA Skills Metrics ^& Vehicle Layoff Suite...
echo ========================================================
docker compose up -d --build
echo.
echo ========================================================
echo All Services Launched Successfully!
echo.
echo [Skills Metrics App]:         http://localhost:3004
echo [Vehicle Layoff App]:         http://localhost:3005
echo [Skills Metrics phpMyAdmin]:  http://localhost:8085
echo [Vehicle Layoff phpMyAdmin]:  http://localhost:8086
echo ========================================================
pause
