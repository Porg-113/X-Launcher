# X Client - Setup

## Schnellstart

### 1. Node.js installieren

Der Launcher benötigt Node.js. Lade die aktuelle LTS-Version herunter:

https://nodejs.org/

Danach prüfen:

```bash
node --version
npm --version
```

### 2. Abhängigkeiten installieren

```bash
cd %USERPROFILE%\Desktop\GameLauncher
npm install
```

### 3. Launcher starten

```bash
npm start
```

## Projektstruktur

```text
GameLauncher/
├── src/
│   ├── main.js
│   └── preload.js
├── index.html
├── styles.css
├── app.js
├── package.json
├── README.md
└── SETUP.md
```

## Build

Installer erstellen:

```bash
npm run build:installer
```

Portable Version erstellen:

```bash
npm run build:portable
```

Alles erstellen:

```bash
npm run build
```

## Hinweise

- Das App-Icon liegt in `icons/icon.ico`.
- Der Windows-Installer wird in `dist` erstellt.
- Wenn Windows noch ein altes Icon zeigt, lösche alte Verknüpfungen oder starte den Explorer neu.

## Windows-Signatur und SmartScreen

Der Eintrag `author` in `package.json` macht Windows nicht zu einem verifizierten Herausgeber. Dafür muss die erzeugte `.exe` mit einem echten Authenticode-Zertifikat signiert werden. Die GitHub-Action bricht Releases ohne gültige Signatur absichtlich ab.

### Variante A: vorhandenes `.pfx` lokal verwenden

1. Besorge ein für Windows-Code-Signing ausgestelltes Zertifikat von einer anerkannten Zertifizierungsstelle. Ein selbst signiertes Zertifikat entfernt die SmartScreen-Warnung bei anderen PCs nicht.
2. Lege die `.pfx`-Datei außerhalb des Repositorys ab.
3. Öffne PowerShell im Projektordner und setze die Variablen nur für dieses Terminal:

```powershell
$env:CSC_LINK = 'C:\Pfad\zu\deinem\zertifikat.pfx'
$env:CSC_KEY_PASSWORD = 'DEIN_PFX_PASSWORT'
npm run build:installer
```

Das Passwort nicht in `package.json`, eine `.bat`-Datei oder Git eintragen. Die erzeugte Datei lässt sich mit folgendem Befehl prüfen:

```powershell
Get-AuthenticodeSignature .\dist\X-Client-*-x64.exe | Format-List Status,SignerCertificate
```

### Variante B: GitHub Actions für Releases

Für automatische Releases müssen im GitHub-Repository unter **Settings > Secrets and variables > Actions** diese beiden Repository-Secrets angelegt werden:

- `WINDOWS_CSC_LINK`: Inhalt der `.pfx`-Datei als Base64-Text oder eine geschützte URL zur Datei
- `WINDOWS_CSC_KEY_PASSWORD`: Passwort des privaten Schlüssels

Die Werte werden von der bestehenden Workflow-Datei nur beim Build verwendet und nicht in den Release-Dateien veröffentlicht. Die `.pfx`-Datei selbst niemals committen oder öffentlich hochladen.

Ein Zertifikat kann SmartScreen trotzdem anfangs anzeigen, bis Microsoft genügend Reputation für das Zertifikat und die Datei gesammelt hat. Eine sofortige Garantie ohne Warnbildschirm gibt es bei frei verteilten `.exe`-Dateien nicht. Für maximale Vertrauenswürdigkeit ist eine MSIX-Verteilung über den Microsoft Store der alternative Weg.
