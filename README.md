# X Client mit Fabric-Unterstützung

Ein moderner Minecraft-Launcher mit Fabric Mod Loader, Microsoft/Xbox-Login, Profilen, Skins und Modrinth-Integration.

## Features

**Minecraft**
- Microsoft/Xbox-Weblogin
- Offline-Modus
- Direkter Spielstart
- Fabric-Versionen verwalten

**Mods**
- Modrinth-Suche
- Mods, Shader und Ressourcenpakete herunterladen
- Automatische Synchronisierung verwalteter Mods
- Größen-Tracking
- Ein-Klick-Installation und Entfernung

**Profile und Skins**
- Eigene Profile mit separaten Mods-Ordnern
- Skin-Import
- Skin-Vorschau

**Design**
- Dunkles Theme
- Anpassbare Design-Farbe
- Moderne Oberfläche

## Installation

```bash
npm install
npm start
```

## Kommandos

```bash
npm start               # Launcher starten
npm run dev             # Mit DevTools starten
npm run build           # Installer und portable Version erstellen
npm run build:installer # Nur Installer erstellen
npm run build:portable  # Nur portable Version erstellen
npm run pack            # Ungepackte Version erstellen
```

## Auto-Updates

Der installierte Windows-Installer nutzt `electron-updater` und GitHub Releases. Portable Builds werden nicht automatisch aktualisiert.

Du brauchst keine eigene Website. Die Updates koennen kostenlos ueber GitHub Releases verteilt werden.

Wichtige Links:

- Repository: `https://github.com/Porg-113/X-Launcher`
- Releases: `https://github.com/Porg-113/X-Launcher/releases`
- Neuen Release erstellen: `https://github.com/Porg-113/X-Launcher/releases/new`
- GitHub Actions: `https://github.com/Porg-113/X-Launcher/actions`

Einmalige Vorbereitung:

1. Lade den Projektordner in das GitHub-Repository `https://github.com/Porg-113/X-Launcher` hoch.
2. Stelle sicher, dass das Repository oeffentlich ist, damit andere PCs die Updates ohne Login laden koennen.
3. Installiere den Client auf Nutzer-PCs immer mit der Installer-Datei `X-Client-<version>-x64.exe`, nicht mit der Portable-Datei. Der bestehende technische App-Identifier bleibt absichtlich erhalten, damit ein Update die alte X-Launcher-Installation ersetzt und deren alte Verknüpfungen entfernt.

Empfohlener Release-Ablauf mit GitHub Actions:

```bash
npm version patch
git push
git push --tags
```

Wenn der Tag z. B. `v1.2.4` heisst, baut GitHub Actions automatisch den Installer und laedt diese Dateien in den Release:

- `latest.yml`
- `X-Client-<version>-x64.exe`
- `X-Client-<version>-x64.exe.blockmap`

Manueller Release-Ablauf ohne GitHub Actions:

```bash
npm version patch
npm run build:installer
```

Dann auf GitHub einen Release mit Tag `v<version>` erstellen und die drei Dateien aus `dist` hochladen.

Auf einem anderen PC muss einmal der Installer installiert werden. Danach prueft der Launcher beim Start automatisch GitHub Releases, laedt neue Versionen herunter und installiert sie nach einem Neustart. In den Einstellungen gibt es ausserdem unter Automatik den Button `Jetzt pruefen`.

## Fehlersuche

**Minecraft wird nicht gefunden?**
- Prüfe den Windows-Benutzernamen in den Einstellungen.
- Standardpfad: `%APPDATA%\.minecraft`

**Mods werden nicht geladen?**
- Mods müssen `.jar`-Dateien sein.
- Der aktive Profilordner muss zur ausgewählten Fabric-Version passen.

## Lizenz

MIT
