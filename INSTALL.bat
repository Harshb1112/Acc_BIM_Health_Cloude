@echo off
echo ========================================
echo BIM Health Report - Installation
echo ========================================
echo.

echo Installing dependencies...
call npm install

echo.
echo ========================================
echo Generating Prisma Client...
echo ========================================
call npm run prisma:generate

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Copy .env.example to .env
echo 2. Fill in your environment variables
echo 3. Run: npm run prisma:migrate
echo 4. Run: npm run dev
echo.
pause
