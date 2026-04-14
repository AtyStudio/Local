@echo off
cd /d C:\Users\telmo\Documents\SakanMatchF-main

set "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sakanmatch"

call pnpm.cmd install

set "CONTAINER_EXISTS="
for /f "delims=" %%i in ('docker ps -a --format "{{.Names}}" ^| findstr /r /c:"^sakanmatch-postgres$"') do set "CONTAINER_EXISTS=1"

if not defined CONTAINER_EXISTS (
  docker run --name sakanmatch-postgres ^
    -e POSTGRES_USER=postgres ^
    -e POSTGRES_PASSWORD=postgres ^
    -e POSTGRES_DB=sakanmatch ^
    -p 5432:5432 ^
    -d postgres:16-alpine
) else (
  docker start sakanmatch-postgres >nul
)

timeout /t 4 /nobreak >nul

call pnpm.cmd --filter @workspace/db run push
call pnpm.cmd --filter @workspace/db run seed
call pnpm.cmd --filter @workspace/api-spec run codegen
call pnpm.cmd --filter @workspace/api-server run build

start "SakanMatch API" cmd /k "cd /d C:\Users\telmo\Documents\SakanMatchF-main && set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sakanmatch && pnpm.cmd --filter @workspace/api-server run start"
start "SakanMatch Web" cmd /k "cd /d C:\Users\telmo\Documents\SakanMatchF-main && pnpm.cmd --filter @workspace/sakanmatch run dev"

echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8080
echo Health:   http://localhost:8080/api/healthz
echo.
echo Demo seeker: youssef.benali@demo.sakanmatch.com / Demo@1234!
echo Demo owner:  rachid.moussaoui@demo.sakanmatch.com / Demo@1234!
