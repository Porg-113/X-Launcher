@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "REPO=Porg-113/X-Launcher"
set "DIST_DIR=%~dp0dist"

echo.
echo ========================================
echo X Client - neuesten Installer uploaden
echo ========================================
echo.

where gh >nul 2>nul
if errorlevel 1 (
  echo FEHLER: GitHub CLI wurde nicht gefunden.
  echo.
  echo Installiere GitHub CLI:
  echo https://cli.github.com/
  echo.
  echo Danach einmal anmelden:
  echo gh auth login
  echo.
  pause
  exit /b 1
)

gh auth status >nul 2>nul
if errorlevel 1 (
  echo Du bist noch nicht bei GitHub CLI angemeldet.
  echo Starte jetzt: gh auth login
  echo.
  gh auth login
  if errorlevel 1 (
    echo.
    echo FEHLER: GitHub Login wurde abgebrochen oder ist fehlgeschlagen.
    pause
    exit /b 1
  )
)

if not exist "%DIST_DIR%\" (
  echo FEHLER: dist Ordner nicht gefunden:
  echo "%DIST_DIR%"
  echo.
  echo Erstelle zuerst den Installer mit:
  echo npm run build:installer
  echo.
  pause
  exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-ChildItem -LiteralPath '%DIST_DIR%' -Filter 'X-Client-*-x64.exe' -File | Where-Object { $_.Name -notlike '*Portable*' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName"`) do set "INSTALLER=%%I"

if not defined INSTALLER (
  echo FEHLER: Kein Installer im dist Ordner gefunden.
  echo Erwartet wird z.B.:
  echo dist\X-Client-1.2.3-x64.exe
  echo.
  echo Erstelle zuerst den Installer mit:
  echo npm run build:installer
  echo.
  pause
  exit /b 1
)

for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "$pkg = Get-Content -Raw -LiteralPath '%~dp0package.json' | ConvertFrom-Json; $pkg.version"`) do set "VERSION=%%V"

if not defined VERSION (
  echo FEHLER: Version konnte nicht aus package.json gelesen werden.
  pause
  exit /b 1
)

set "TAG=v%VERSION%"
set "LATEST_YML=%DIST_DIR%\latest.yml"
set "BLOCKMAP=%INSTALLER%.blockmap"

if not exist "%LATEST_YML%" (
  echo FEHLER: latest.yml fehlt.
  echo Auto-Updates brauchen diese Datei.
  echo.
  echo Erstelle zuerst den Installer mit:
  echo npm run build:installer
  echo.
  pause
  exit /b 1
)

if not exist "%BLOCKMAP%" (
  echo FEHLER: Blockmap fehlt:
  echo "%BLOCKMAP%"
  echo.
  echo Erstelle zuerst den Installer mit:
  echo npm run build:installer
  echo.
  pause
  exit /b 1
)

echo Repository: %REPO%
echo Release Tag: %TAG%
echo Installer:   "%INSTALLER%"
echo Metadata:    "%LATEST_YML%"
echo Blockmap:    "%BLOCKMAP%"
echo.

gh release view "%TAG%" --repo "%REPO%" >nul 2>nul
if errorlevel 1 (
  echo Release %TAG% existiert noch nicht. Erstelle Release...
  gh release create "%TAG%" --repo "%REPO%" --title "X Client %VERSION%" --notes "X Client %VERSION%"
  if errorlevel 1 (
    echo.
    echo FEHLER: Release konnte nicht erstellt werden.
    pause
    exit /b 1
  )
) else (
  echo Release %TAG% existiert bereits. Dateien werden ersetzt...
)

echo.
echo Upload startet...
gh release upload "%TAG%" "%INSTALLER%" "%BLOCKMAP%" "%LATEST_YML%" --repo "%REPO%" --clobber
if errorlevel 1 (
  echo.
  echo FEHLER: Upload fehlgeschlagen.
  pause
  exit /b 1
)

echo.
echo Fertig. Release:
echo https://github.com/%REPO%/releases/tag/%TAG%
echo.
pause
