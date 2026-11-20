@echo off
echo ========================================================
echo Stopping DVLA Skills Metrics ^& Vehicle Layoff Suite...
echo ========================================================
docker compose down
echo.
echo All services and containers stopped.
pause
