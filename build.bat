@echo off
setlocal EnableExtensions
chcp 65001 >nul

cd /d "%~dp0"

echo.
echo  ===========================================
echo  X Client - Windows Installer Build
echo  ===========================================
echo.

echo [CLEANUP] Leere den dist-Ordner...
if exist "%~dp0dist\" (
    rmdir /s /q "%~dp0dist"
    if exist "%~dp0dist\" (
        echo [ERROR] Der dist-Ordner konnte nicht vollständig geleert werden.
        echo Bitte schließe Programme, die Dateien aus diesem Ordner verwenden.
        echo.
        pause
        exit /b 1
    )
)
mkdir "%~dp0dist"
if errorlevel 1 (
    echo [ERROR] Der leere dist-Ordner konnte nicht erstellt werden.
    echo.
    pause
    exit /b 1
)
echo [OK] dist wurde vollständig geleert.
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js wurde nicht gefunden.
    echo Bitte installiere Node.js von https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm wurde nicht gefunden.
    echo.
    pause
    exit /b 1
)

echo [OK] Node:
node --version
if errorlevel 1 (
    echo [ERROR] node --version ist fehlgeschlagen.
    echo.
    pause
    exit /b 1
)

echo [OK] npm:
call npm --version
if errorlevel 1 (
    echo [ERROR] npm --version ist fehlgeschlagen.
    echo.
    pause
    exit /b 1
)

echo.
if exist "node_modules" (
    echo [1/2] Abhängigkeiten bereits vorhanden.
) else (
    echo [1/2] Installiere Abhängigkeiten...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install ist fehlgeschlagen.
        echo.
        pause
        exit /b 1
    )
)

echo.
echo [2/2] Baue Installer-.exe...
call npm run build:installer
if errorlevel 1 (
    echo.
    echo [ERROR] Der Build ist fehlgeschlagen.
    echo.
    echo Häufige Ursachen:
    echo - app-builder.exe wird von Defender/Antivirus blockiert ^(EPERM^)
    echo - icons\icon.ico fehlt oder ist ungültig
    echo - node_modules sind defekt
    echo.
    echo Schnell-Fix:
    echo 1^) Schließe Launcher/Node-Prozesse
    echo 2^) Lösche node_modules und package-lock.json
    echo 3^) Führe npm install aus
    echo 4^) Starte build.bat erneut
    echo.
    pause
    exit /b 1
)

echo.
echo [CLEANUP] Entferne unnötige Build-Artefakte...
if exist "dist\win-unpacked" rmdir /s /q "dist\win-unpacked"
if exist "dist\.icon-ico" rmdir /s /q "dist\.icon-ico"
del /q "dist\builder-debug.yml" >nul 2>nul
del /q "dist\builder-effective-config.yaml" >nul 2>nul

echo.
echo [SUCCESS] Fertig.
echo Installer-Datei:
for %%F in ("dist\*.exe") do echo   %%~fF
echo.
pause
exit /b 0



