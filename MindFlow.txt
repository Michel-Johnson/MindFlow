@echo off
cd /d "D:\MindFlow\MindFlow"
echo 正在启动开发服务器...
start "" powershell -NoExit -ExecutionPolicy Bypass -Command "npm run dev"
timeout /t 3 >nul
start http://localhost:5000
echo 服务器已启动，浏览器已打开！
pause