@echo off
cd /d "D:\MindFlow\MindFlow"
echo 正在启动开发服务器...
start "" powershell -NoExit -ExecutionPolicy Bypass -Command "npm run dev"
echo Waiting for http://localhost:5000 ...
call npx --yes wait-on http://localhost:5000 -t 60000
start http://localhost:5000
echo 服务器已启动，浏览器已打开！
pause
