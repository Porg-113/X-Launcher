// Minecraft Launcher with Fabric Support
const X_LAUNCHER_LANGUAGE_STORAGE_KEY = 'xLauncherLanguagePreference';
const X_LAUNCHER_SUPPORTED_LANGUAGES = ['de', 'en'];
const X_LAUNCHER_LANGUAGE_NAMES = {
  de: 'Deutsch',
  en: 'English'
};
const X_LAUNCHER_SERVICE_HEALTH_INTERVAL_MS = 45000;
const X_LAUNCHER_SERVICE_RECOVERY_VISIBLE_MS = 2600;
const X_LAUNCHER_LANGUAGE_COPY = {
  de: {
    autoStatus: 'Auto: Systemsprache ({language}).',
    manualStatus: 'Sprache manuell gesetzt: {language}.',
    saved: 'Sprache gespeichert: {language}.'
  },
  en: {
    autoStatus: 'Auto: system language ({language}).',
    manualStatus: 'Language set manually: {language}.',
    saved: 'Language saved: {language}.'
  }
};
let currentUser = null;

function setCurrentUser(user) {
  currentUser = user && typeof user === 'object' ? Object.freeze({ ...user }) : null;
  return currentUser;
}

// UI visibility helper only. Privileged operations must additionally be
// authorized by the main process/backend using the account UUID.
function hasAdminPermission() {
  return currentUser?.isAdmin === true;
}

const X_LAUNCHER_DE_TO_EN_TEXT = new Map([
  ['Minimieren', 'Minimize'],
  ['Maximieren', 'Maximize'],
  ['Wiederherstellen', 'Restore'],
  ['Schließen', 'Close'],
  ['Keine Internetverbindung.', 'No internet connection.'],
  ['Modrinth ist momentan nicht erreichbar.', 'Modrinth is currently unreachable.'],
  ['Microsoft-Anmeldung momentan nicht verfügbar.', 'Microsoft sign-in is currently unavailable.'],
  ['Launcher-Server antwortet nicht.', 'Launcher server is not responding.'],
  ['Downloads sind derzeit deaktiviert.', 'Downloads are currently disabled.'],
  ['Verbindung wiederhergestellt', 'Connection restored'],
  ['Accounts öffnen', 'Open accounts'],
  ['Xbox/Microsoft-Weblogin wird vorbereitet...', 'Preparing Xbox/Microsoft web login...'],
  ['Xbox/Microsoft-Weblogin wird vorbereitet', 'Preparing Xbox/Microsoft web login'],
  ['MIT XBOX ANMELDEN', 'SIGN IN WITH XBOX'],
  ['Login über die offizielle Xbox/Microsoft-Webseite', 'Sign in through the official Xbox/Microsoft website'],
  ['Der Browser wird automatisch geöffnet', 'The browser opens automatically'],
  ['Nach erfolgreicher Anmeldung wirst du direkt übernommen', 'After a successful sign-in, the launcher uses your account automatically'],
  ['Offline-Modus verfügbar', 'Offline mode available'],
  ['OFFLINE SPIELEN', 'PLAY OFFLINE'],
  ['Abmelden', 'Log out'],
  ['Start', 'Home'],
  ['Schnell starten, Mods verwalten und direkt mit deinen Freunden spielen.', 'Launch quickly, manage mods, and play with your friends right away.'],
  ['Optimiert', 'Optimized'],
  ['Integriert', 'Integrated'],
  ['Bereit', 'Ready'],
  ['Server', 'Servers'],
  ['Einstellungen', 'Settings'],
  ['Kein aktiver Skin', 'No active skin'],
  ['Status wird geladen...', 'Loading status...'],
  ['Profil auswählen', 'Select profile'],
  ['Server-Favoriten', 'Server favorites'],
  ['Mods verwalten', 'Manage mods'],
  ['Mods-Ordner öffnen', 'Open mods folder'],
  ['Alle prüfen', 'Check all'],
  ['Mods für diese Version', 'Mods for this version'],
  ['Ausgeblendet', 'Hidden'],
  ['Ausgeblendete Pflichtmods', 'Hidden required mods'],
  ['Keine ausgeblendeten Mods installiert.', 'No hidden mods installed.'],
  ['Ausgeblendete Mods', 'Hidden mods'],
  ['Pflicht- und Performance-Mods', 'Required and performance mods'],
  ['Pflichtmod', 'Required mod'],
  ['Launcher-Standard ist aktiv.', 'Launcher default is active.'],
  ['Mod-Status wird geprüft...', 'Checking mod status...'],
  ['Mods hier ablegen', 'Drop mods here'],
  ['JAR-Dateien', 'JAR files'],
  ['Mods herunterladen', 'Download mods'],
  ['Installiert in den Launcher-Standard.', 'Installs into the launcher default.'],
  ['Modrinth Typen', 'Modrinth types'],
  ['Ressourcenpakete', 'Resource packs'],
  ['Auf Modrinth nach Fabric-Mods suchen...', 'Search Modrinth for Fabric mods...'],
  ['Auf Modrinth nach Modpacks suchen...', 'Search Modrinth for modpacks...'],
  ['Auf Modrinth nach Shadern suchen...', 'Search Modrinth for shaders...'],
  ['Auf Modrinth nach Ressourcenpaketen suchen...', 'Search Modrinth for resource packs...'],
  ['Suchen', 'Search'],
  ['Suche Mods passend zu deiner ausgewählten Fabric-Version.', 'Searches mods matching your selected Fabric version.'],
  ['Profile', 'Profiles'],
  ['Neues Profil', 'New profile'],
  ['Jedes Profil hat genau eine Fabric-Version und einen eigenen Mods-Ordner.', 'Each profile has exactly one Fabric version and its own mods folder.'],
  ['Profil-Name eingeben...', 'Enter profile name...'],
  ['Profil erstellen', 'Create profile'],
  ['Deine Profile', 'Your profiles'],
  ['Einstellungen kopieren', 'Copy settings'],
  ['Einstellungen einfügen', 'Paste settings'],
  ['Profil-Aktionen', 'Profile actions'],
  ['Einstellungen kopiert.', 'Settings copied.'],
  ['Kopiere zuerst die Einstellungen eines Profils.', 'Copy a profile’s settings first.'],
  ['Dieses Profil hat noch keine Minecraft-Einstellungen.', 'This profile does not have Minecraft settings yet.'],
  ['Server speichern', 'Save server'],
  ['Adresse oder IP', 'Address or IP'],
  ['Speichern', 'Save'],
  ['Favoriten', 'Favorites'],
  ['Noch keine Server geladen.', 'No servers loaded yet.'],
  ['Accounts', 'Accounts'],
  ['Microsoft hinzufügen', 'Add Microsoft'],
  ['Offline-Account', 'Offline account'],
  ['Spielername', 'Player name'],
  ['Offline hinzufügen', 'Add offline'],
  ['Gespeicherte Accounts', 'Saved accounts'],
  ['Noch keine Accounts geladen.', 'No accounts loaded yet.'],
  ['Skin Auswahl', 'Skin selection'],
  ['Skin importieren', 'Import skin'],
  ['Noch kein Skin ausgewählt.', 'No skin selected yet.'],
  ['Aktiven Skin entfernen', 'Remove active skin'],
  ['Gespeicherte Skins', 'Saved skins'],
  ['Skin-Bibliothek', 'Skin library'],
  ['Suche nach einem Namen, um passende Skins zu laden.', 'Search for a name to load matching skins.'],
  ['Name oder Skin-Typ...', 'Name or skin type...'],
  ['Design, Verhalten, Wartung und Speicherorte auf einen Blick.', 'Theme, behavior, maintenance, and folders at a glance.'],
  ['Darstellung', 'Appearance'],
  ['Optik, Sprache und Sound des Launchers.', 'Launcher visuals, language, and sound.'],
  ['Design-Farbe', 'Theme color'],
  ['Primärfarbe für Akzente, Buttons und Markierungen.', 'Primary color for accents, buttons, and highlights.'],
  ['Hell/Dunkel', 'Light/Dark'],
  ['Dunkles Design wie bisher oder heller Launcher-Modus.', 'Dark design as before or a brighter launcher mode.'],
  ['Hellmodus', 'Light mode'],
  ['Synchronisiert den hellen Modus automatisch mit dem Launcher.', 'Automatically syncs light mode with the launcher.'],
  ['RGB-Modus', 'RGB mode'],
  ['Farben wechseln automatisch durch das Spektrum.', 'Colors cycle automatically through the spectrum.'],
  ['Rot:', 'Red:'],
  ['Grün:', 'Green:'],
  ['Blau:', 'Blue:'],
  ['Farbe vom aktiven Skin übernehmen', 'Use color from active skin'],
  ['Der Launcher nutzt automatisch eine passende Skin-Farbe.', 'The launcher automatically uses a matching skin color.'],
  ['Sprache', 'Language'],
  ['Automatisch an Systemsprache anpassen.', 'Automatically match the system language.'],
  ['Automatisch (System)', 'Automatic (system)'],
  ['Deutsch', 'German'],
  ['Sound', 'Sound'],
  ['Feedback beim Klicken und Bedienen.', 'Click and interaction feedback.'],
  ['Automatik', 'Automation'],
  ['Regeln für Mods.', 'Rules for mods.'],
  ['Mods automatisch updaten', 'Update mods automatically'],
  ['Verwaltete Mods werden beim Prüfen aktuell gehalten.', 'Managed mods stay current when checked.'],
  ['Eigene Mods einzeln akzeptieren', 'Approve custom mods one by one'],
  ['Unbekannte Drag-and-drop-JARs landen zuerst ausgeschaltet in der Modliste.', 'Unknown drag-and-drop JARs are added disabled first.'],
  ['Modrinth Anzeige', 'Modrinth display'],
  ['40 Mods pro Suche.', '40 mods per search.'],
  ['Anzahl:', 'Amount:'],
  ['Launcher automatisch updaten', 'Update launcher automatically'],
  ['Der installierte Launcher prüft beim Start automatisch nach Updates.', 'The installed launcher checks for updates automatically on startup.'],
  ['Jetzt prüfen', 'Check now'],
  ['Update installieren', 'Install update'],
  ['Launcher-Update bereit', 'Launcher update ready'],
  ['Später', 'Later'],
  ['Launcher-Update', 'Launcher update'],
  ['Launcher-Update wird geladen', 'Launcher update is downloading'],
  ['Bitte den Launcher geöffnet lassen. Die neue Version wird automatisch heruntergeladen.', 'Please keep the launcher open. The new version is downloading automatically.'],
  ['Download läuft. Danach installiert der Launcher die neue Version automatisch.', 'Download in progress. After that, the launcher installs the new version automatically.'],
  ['Update wird installiert', 'Installing update'],
  ['Download fertig. Der Launcher startet gleich automatisch neu.', 'Download complete. The launcher will restart automatically shortly.'],
  ['Bitte einen Moment warten. Die neue Version wird ohne weitere Klicks installiert.', 'Please wait a moment. The new version is being installed without more clicks.'],
  ['Lautstärke:', 'Volume:'],
  ['Klick Sound', 'Click sound'],
  ['Anhören', 'Preview'],
  ['Wartung', 'Maintenance'],
  ['Diagnose, Logs und Tutorial.', 'Diagnostics, logs, and tutorial.'],
  ['Diagnose', 'Diagnostics'],
  ['Logs und Integritätsprüfung bereit.', 'Logs and integrity check ready.'],
  ['Debug-Modus', 'Debug mode'],
  ['Schreibt ausführlichere Logs.', 'Writes more detailed logs.'],
  ['Diagnose ausführen', 'Run diagnostics'],
  ['Logs öffnen', 'Open logs'],
  ['Tutorial', 'Tutorial'],
  ['Starte die geführte Erklärung des Launchers erneut.', 'Start the guided launcher explanation again.'],
  ['Tutorial nochmal spielen', 'Replay tutorial'],
  ['Speicherorte', 'Folders'],
  ['Minecraft-Profil und isolierter Standard-Mods-Ordner.', 'Minecraft profile and isolated default mods folder.'],
  ['Windows Name', 'Windows name'],
  ['Wird geladen...', 'Loading...'],
  ['Windows Benutzername', 'Windows user name'],
  ['Namen speichern', 'Save name'],
  ['Standard Mods-Ordner', 'Default mods folder'],
  ['Ordner wählen', 'Choose folder'],
  ['Zurücksetzen', 'Reset'],
  ['Neon-Rahmen', 'Neon frames'],
  ['Neon-Rahmen sind ausgeschaltet.', 'Neon frames are off.'],
  ['Neon-Rahmen sind eingeschaltet.', 'Neon frames are on.'],
  ['Neon-Rahmen anzeigen', 'Show neon frames'],
  ['Aktiviert die leuchtenden Rahmen-Striche in Mausnähe.', 'Enables the glowing frame strokes near the cursor.'],
  ['Launcher wird geladen', 'Launcher is loading'],
  ['Es ist noch kein Launcher-Update heruntergeladen.', 'No launcher update has been downloaded yet.'],
  ['Aktion bestätigen', 'Confirm action'],
  ['Bist du sicher?', 'Are you sure?'],
  ['Abbrechen', 'Cancel'],
  ['Bestätigen', 'Confirm'],
  ['Skin-Modell wählen', 'Choose skin model'],
  ['Wähle zuerst, ob dein Skin Slim oder Wide verwenden soll.', 'Choose whether your skin should use Slim or Wide first.'],
  ['Tutorial überspringen', 'Skip tutorial'],
  ['Schritt 1', 'Step 1'],
  ['Bewege mindestens einen Regler, dann geht es weiter.', 'Move at least one slider, then you can continue.'],
  ['Zurück', 'Back'],
  ['Weiter', 'Next'],
  ['Startet...', 'Starting...'],
  ['Bereit.', 'Ready.'],
  ['Warnung.', 'Warning.'],
  ['Design...', 'Theme...'],
  ['Verbindung...', 'Connection...'],
  ['Login...', 'Login...'],
  ['Profil...', 'Profile...'],
  ['Lädt...', 'Loading...'],
  ['Minecraft...', 'Minecraft...'],
  ['Versionen...', 'Versions...'],
  ['Nicht gefunden', 'Not found'],
  ['Vom aktiven Skin übernommen', 'Taken from the active skin'],
  ['Manuelle Design-Farbe', 'Manual theme color'],
  ['Hellmodus aktiv', 'Light mode active'],
  ['Dunkelmodus aktiv', 'Dark mode active'],
  ['Automatisch: Hellmodus aktiv', 'Automatic: light mode active'],
  ['Automatisch: Dunkelmodus aktiv', 'Automatic: dark mode active'],
  ['Hellmodus aktiviert.', 'Light mode enabled.'],
  ['Dunkelmodus aktiviert.', 'Dark mode enabled.'],
  ['Systemdesign aktiviert.', 'System theme enabled.'],
  ['RGB-Modus aktiv', 'RGB mode active'],
  ['RGB-Modus wechselt die Launcher-Farbe automatisch.', 'RGB mode cycles the launcher color automatically.'],
  ['RGB-Modus aktiviert.', 'RGB mode enabled.'],
  ['RGB-Modus deaktiviert.', 'RGB mode disabled.'],
  ['Aktiver Skin bestimmt die Launcher-Farbe.', 'The active skin controls the launcher color.'],
  ['Wird angewendet, sobald ein Skin aktiv ist.', 'Applies as soon as a skin is active.'],
  ['Design-Farbe wählen', 'Choose theme color'],
  ['Farbe speichern', 'Save color'],
  ['Xbox anmelden', 'Sign in with Xbox'],
  ['Offline spielen', 'Play offline'],
  ['Spiel starten', 'Start game'],
  ['Direkt auf Server', 'Direct server launch'],
  ['Aktives Profil', 'Active profile'],
  ['Navigation', 'Navigation'],
  ['Modrinth Suche', 'Modrinth search'],
  ['Favoriten verwalten', 'Manage favorites'],
  ['Account wechseln', 'Switch account'],
  ['Mehrere Accounts', 'Multiple accounts'],
  ['Offline-Accounts', 'Offline accounts'],
  ['Accountliste', 'Account list'],
  ['Skins', 'Skins'],
  ['Fertig', 'Done'],
  ['Stelle zuerst die Farbe des Launchers ein. Diese Farbe wird direkt übernommen und später in den Einstellungen gespeichert.', 'First choose the launcher color. This color is applied immediately and saved later in Settings.'],
  ['Hier startest du den offiziellen Microsoft/Xbox-Login. Nach der Anmeldung übernimmt der Launcher deinen Account automatisch.', 'This starts the official Microsoft/Xbox sign-in. After signing in, the launcher uses your account automatically.'],
  ['Wenn du nur lokal testen willst, kannst du den Offline-Modus nutzen. Multiplayer funktioniert damit nur auf Offline-Mode-Servern.', 'If you only want to test locally, you can use offline mode. Multiplayer only works on offline-mode servers.'],
  ['Auf der Startseite wählst du ein Profil und startest Minecraft. Der Status darüber zeigt, ob der Launcher bereit ist.', 'On the Home page you choose a profile and start Minecraft. The status above shows whether the launcher is ready.'],
  ['Gespeicherte Server-Favoriten erscheinen hier als Kacheln. Ein Klick startet das aktive Profil und verbindet direkt mit dem Server.', 'Saved server favorites appear here as tiles. One click starts the active profile and connects directly to the server.'],
  ['Dieses Feld bestimmt, mit welchem Profil gestartet wird. Profile haben eigene Fabric-Versionen und eigene Mods-Ordner.', 'This field decides which profile is launched. Profiles have their own Fabric versions and mods folders.'],
  ['Links wechselst du zwischen Start, Mods, Modrinth, Profilen, Servern, Skins und Einstellungen. Accounts öffnest du oben rechts über deinen Namen.', 'Use the left side to switch between Home, Mods, Modrinth, Profiles, Servers, Skins, and Settings. Open accounts from your name in the top right.'],
  ['Im Mods-Bereich legst du JAR-Dateien ab, öffnest den Mods-Ordner und prüfst installierte Mods passend zur ausgewählten Version.', 'In the Mods section you drop JAR files, open the mods folder, and check installed mods for the selected version.'],
  ['Hier suchst du direkt nach Mods, Shadern und Ressourcenpaketen. Die Treffer werden passend zum aktiven Profil gefiltert.', 'Search directly for mods, shaders, and resource packs here. Results are filtered for the active profile.'],
  ['Profile trennen Versionen und Modlisten voneinander. So kannst du mehrere Setups behalten, ohne die Mods jedes Mal umzubauen.', 'Profiles keep versions and mod lists separate, so you can keep multiple setups without rebuilding your mods each time.'],
  ['Im Server-Bereich speicherst du Name und Adresse deiner Lieblingsserver. Danach kannst du sie aus der Favoritenliste oder direkt von der Startseite starten.', 'In the Servers section you save the name and address of your favorite servers. Then you can launch them from the favorites list or directly from Home.'],
  ['Gespeicherte Server lassen sich hier beitreten oder wieder löschen. Der Launcher nutzt beim Beitreten immer das aktuell ausgewählte Profil.', 'Saved servers can be joined or deleted here. The launcher always uses the currently selected profile when joining.'],
  ['Der Spielername oben rechts öffnet die Accountverwaltung. So wechselst du schnell zwischen gespeicherten Microsoft- und Offline-Accounts.', 'The player name in the top right opens account management, where you can quickly switch between saved Microsoft and offline accounts.'],
  ['Hier fügst du weitere Microsoft-Accounts hinzu. Neue Accounts werden gespeichert und direkt als aktiver Spieler übernommen.', 'Add more Microsoft accounts here. New accounts are saved and immediately used as the active player.'],
  ['Zusätzliche Offline-Accounts sind praktisch zum lokalen Testen. Online-Multiplayer funktioniert damit nur auf Offline-Mode-Servern.', 'Additional offline accounts are useful for local testing. Online multiplayer only works with them on offline-mode servers.'],
  ['In der Accountliste siehst du, welcher Account aktiv ist. Andere gespeicherte Accounts kannst du nutzen oder aus der Liste entfernen.', 'The account list shows which account is active. You can use other saved accounts or remove them from the list.'],
  ['Im Skin-Bereich importierst du Skins, setzt gespeicherte Skins aktiv und wählst bei Bedarf Slim oder Wide.', 'In the Skins section you import skins, activate saved skins, and choose Slim or Wide when needed.'],
  ['In den Einstellungen änderst du Farbe, Sprache, Sound, Diagnose, Windows-Namen und den Standard-Mods-Ordner. Über diesen Button startest du das Tutorial erneut.', 'In Settings you change color, language, sound, diagnostics, Windows name, and the default mods folder. Use this button to replay the tutorial.'],
  ['Das Tutorial ist abgeschlossen. Du kannst es jederzeit in den Einstellungen wiederholen.', 'The tutorial is complete. You can replay it from Settings at any time.'],
  ['Farbe übernommen. Du kannst jetzt fortfahren.', 'Color applied. You can continue now.'],
  ['Bitte zuerst eine Farbe einstellen.', 'Please set a color first.'],
  ['Tutorial übersprungen. Du kannst es in den Einstellungen erneut starten.', 'Tutorial skipped. You can restart it in Settings.'],
  ['Tutorial abgeschlossen. Du kannst es in den Einstellungen erneut starten.', 'Tutorial completed. You can restart it in Settings.'],
  ['Dein X Launcher', 'Your X Launcher'],
  ['Wähle zuerst deine Design-Farbe. Du kannst sie später jederzeit in den Einstellungen ändern.', 'First choose your theme color. You can change it later in Settings at any time.'],
  ['Farbe speichern', 'Save color'],
  ['Sicher anmelden', 'Sign in securely'],
  ['Melde dich über Microsoft an. X Launcher ist ein unabhängiger, inoffizieller Launcher und steht in keiner Verbindung zu Mojang oder Microsoft.', 'Sign in through Microsoft. X Launcher is an independent, unofficial launcher and is not affiliated with Mojang or Microsoft.'],
  ['Offline spielen', 'Play offline'],
  ['Wenn du nur lokal testen willst, kannst du den Offline-Modus nutzen. Multiplayer funktioniert damit nur auf Offline-Mode-Servern.', 'For local testing, you can use offline mode. Multiplayer only works on offline-mode servers.'],
  ['Minecraft direkt starten', 'Launch Minecraft directly'],
  ['Ein Klick startet Minecraft direkt mit dem ausgewählten Profil über X Launcher.', 'One click launches Minecraft directly with the selected profile through X Launcher.'],
  ['Direkt auf Server', 'Join a server directly'],
  ['Gespeicherte Server-Favoriten erscheinen hier als Kacheln. Ein Klick startet das aktive Profil und verbindet direkt mit dem Server.', 'Saved favorite servers appear here as tiles. One click launches the active profile and connects directly to the server.'],
  ['Aktives Profil', 'Active profile'],
  ['Das Standardprofil nutzt immer den normalen .minecraft/mods-Ordner. Zusätzliche Profile können weiterhin eigene Versionen und Mod-Sammlungen besitzen.', 'The default profile always uses the regular .minecraft/mods folder. Additional profiles can have their own versions and mod collections.'],
  ['Links wechselst du zwischen Start, Mods, Modrinth, Profilen, Servern, Skins und Einstellungen. Accounts öffnest du oben rechts über deinen Namen.', 'Use the navigation on the left to switch between Home, Mods, Modrinth, Profiles, Servers, Skins, and Settings. Open Accounts using your name in the top right.'],
  ['Ziehe Mod-JARs hier hinein oder verwalte installierte Mods. X Launcher achtet automatisch auf die Version des aktiven Profils.', 'Drop mod JARs here or manage installed mods. X Launcher automatically uses the version of the active profile.'],
  ['Modrinth Suche', 'Modrinth search'],
  ['Hier suchst du direkt nach Mods, Shadern und Ressourcenpaketen. Die Treffer werden passend zum aktiven Profil gefiltert.', 'Search directly for mods, shaders, and resource packs here. Results are filtered for the active profile.'],
  ['Profile trennen Versionen und Modlisten voneinander. So kannst du mehrere Setups behalten, ohne die Mods jedes Mal umzubauen.', 'Profiles keep versions and mod lists separate, so you can maintain multiple setups without rearranging mods each time.'],
  ['Server-Favoriten', 'Server favorites'],
  ['Im Server-Bereich speicherst du Name und Adresse deiner Lieblingsserver. Danach kannst du sie aus der Favoritenliste oder direkt von der Startseite starten.', 'Save the names and addresses of your favorite servers here. You can then join them from the favorites list or directly from Home.'],
  ['Favoriten verwalten', 'Manage favorites'],
  ['Gespeicherte Server lassen sich hier beitreten oder wieder löschen. Der Launcher nutzt beim Beitreten immer das aktuell ausgewählte Profil.', 'Join or remove saved servers here. The launcher always uses the currently selected profile when joining.'],
  ['Account wechseln', 'Switch account'],
  ['Der Spielername oben rechts öffnet die Accountverwaltung. So wechselst du schnell zwischen gespeicherten Microsoft- und Offline-Accounts.', 'The player name in the top right opens account management, where you can quickly switch between saved Microsoft and offline accounts.'],
  ['Mehrere Accounts', 'Multiple accounts'],
  ['Hier fügst du weitere Microsoft-Accounts hinzu. Neue Accounts werden gespeichert und direkt als aktiver Spieler übernommen.', 'Add more Microsoft accounts here. New accounts are saved and selected as the active player.'],
  ['Offline-Accounts', 'Offline accounts'],
  ['Zusätzliche Offline-Accounts sind praktisch zum lokalen Testen. Online-Multiplayer funktioniert damit nur auf Offline-Mode-Servern.', 'Additional offline accounts are useful for local testing. Online multiplayer only works with them on offline-mode servers.'],
  ['Accountliste', 'Account list'],
  ['In der Accountliste siehst du, welcher Account aktiv ist. Andere gespeicherte Accounts kannst du nutzen oder aus der Liste entfernen.', 'The account list shows which account is active. You can use other saved accounts or remove them from the list.'],
  ['Im Skin-Bereich importierst du Skins, setzt gespeicherte Skins aktiv und wählst bei Bedarf Slim oder Wide.', 'In the Skins section, you can import skins, activate saved skins, and choose Slim or Wide when needed.'],
  ['Hier änderst du Design, Sprache, Sound und Diagnose. Über diesen Button kannst du die Einführung jederzeit erneut starten.', 'Change the theme, language, sound, and diagnostics here. You can replay this introduction at any time using this button.'],
  ['Alles bereit. Wähle dein Profil und starte Minecraft direkt mit X Launcher.', 'Everything is ready. Select your profile and launch Minecraft directly with X Launcher.'],
  ['Fertig', 'Done'],
  ['Diese Farbe wird als Startfarbe verwendet. Du kannst sie behalten oder mit den Reglern ändern.', 'This color will be used as the initial color. You can keep it or change it with the sliders.'],
  ['Wähle eine Farbe oder behalte die bereits eingestellte Startfarbe.', 'Choose a color or keep the current initial color.'],
  ['Bitte zuerst eine Farbe einstellen.', 'Please choose a color first.'],
  ['Keine gültige JAR-Datei erkannt.', 'No valid JAR file detected.'],
  ['Fehler: Drag-and-drop Import ist nicht verfügbar.', 'Error: drag-and-drop import is not available.'],
  ['Mod hinzufügen', 'Add mod'],
  ['Soll der Launcher diese Mod so behalten oder auf Modrinth nach einer passenden Version suchen und sie ersetzen?', 'Should the launcher keep this mod as-is or search Modrinth for a matching version and replace it?'],
  ['Modrinth prüfen', 'Check Modrinth'],
  ['Behalten', 'Keep'],
  ['Erkenne und installiere Mods...', 'Detecting and installing mods...'],
  ['Bereite eigene Mods vor...', 'Preparing custom mods...'],
  ['Füge eigene Mods hinzu...', 'Adding custom mods...'],
  ['Erkenne Mods und bereite eigene Mods vor...', 'Detecting mods and preparing custom mods...'],
  ['Mod konnte nicht installiert werden.', 'Mod could not be installed.'],
  ['Mod installiert.', 'Mod installed.'],
  ['Pfad konnte nicht gespeichert werden.', 'Path could not be saved.'],
  ['Name konnte nicht gespeichert werden.', 'Name could not be saved.'],
  ['Standard Mods-Ordner kann nicht geändert werden.', 'Default mods folder cannot be changed.'],
  ['Mods-Ordner konnte nicht gespeichert werden.', 'Mods folder could not be saved.'],
  ['Mods-Ordner konnte nicht zurückgesetzt werden.', 'Mods folder could not be reset.'],
  ['Offline-Login wird vorbereitet...', 'Preparing offline login...'],
  ['Xbox/Microsoft-Login wird im Browser geöffnet...', 'Opening Xbox/Microsoft login in the browser...'],
  ['Microsoft-Login wird im Browser geöffnet...', 'Opening Microsoft login in the browser...'],
  ['Dauer-Offline-Modus aktiv. Multiplayer geht nur auf Offline-Mode-Servern.', 'Permanent offline mode active. Multiplayer only works on offline-mode servers.'],
  ['Xbox/Microsoft-Weblogin aktiv | Kein Azure-Setup nötig | Browser wird automatisch geöffnet', 'Xbox/Microsoft web login active | No Azure setup needed | Browser opens automatically'],
  ['Client-ID gespeichert.', 'Client ID saved.'],
  ['Client-ID entfernt.', 'Client ID removed.'],
  ['Offline-Account wird vorbereitet...', 'Preparing offline account...'],
  ['Offline-Account wird gespeichert...', 'Saving offline account...'],
  ['Abgemeldet!', 'Logged out.'],
  ['Fehler beim Abmelden!', 'Logout failed.'],
  ['Bitte anmelden!', 'Please sign in.'],
  ['Bitte wähle zuerst einen Server-Favoriten aus.', 'Please select a server favorite first.'],
  ['Aktiviere lokales Fabric...', 'Activating local Fabric...'],
  ['Mod-Status konnte nicht geladen werden.', 'Mod status could not be loaded.'],
  ['Keine Server-Favoriten', 'No server favorites'],
  ['Noch keine Server-Favoriten gespeichert.', 'No server favorites saved yet.'],
  ['Speichere einen Server, um ihn direkt starten zu können.', 'Save a server to start it directly.'],
  ['Standard-Port', 'Default port'],
  ['Beitreten', 'Join'],
  ['Löschen', 'Delete'],
  ['Mod löschen', 'Delete mod'],
  ['Ressourcenpaket löschen', 'Delete resource pack'],
  ['Shader löschen', 'Delete shader'],
  ['Bitte gib eine Server-Adresse ein.', 'Please enter a server address.'],
  ['Server gespeichert.', 'Server saved.'],
  ['Server löschen', 'Delete server'],
  ['Server entfernt.', 'Server removed.'],
  ['Noch keine Accounts gespeichert.', 'No accounts saved yet.'],
  ['Füge einen Microsoft- oder Offline-Account hinzu.', 'Add a Microsoft or offline account.'],
  ['Aktiv', 'Active'],
  ['Nutzen', 'Use'],
  ['Bitte gib einen Offline-Spielernamen ein.', 'Please enter an offline player name.'],
  ['Account wird gewechselt...', 'Switching account...'],
  ['Account entfernen', 'Remove account'],
  ['Account entfernt.', 'Account removed.'],
  ['Launcher-Standard', 'Launcher Default'],
  ['keine Fabric-Version', 'no Fabric version'],
  ['Neue Mods werden in den Launcher-Standard installiert.', 'New mods are installed into the launcher default.'],
  ['Modpacks werden in ein vorhandenes oder neues Profil importiert.', 'Modpacks are imported into an existing or new profile.'],
  ['Jede Version', 'Any version'],
  ['Wähle eine Modpack-Version aus.', 'Choose a modpack version.'],
  ['Neue Shader werden im shaderpacks-Ordner des aktiven Profils gespeichert.', 'New shaders are saved in the active profile shaderpacks folder.'],
  ['Ressourcenpakete jeder Minecraft-Version werden im resourcepacks-Ordner des aktiven Profils gespeichert.', 'Resource packs for every Minecraft version are saved in the active profile resourcepacks folder.'],
  ['Keine Fabric-Version verfügbar', 'No Fabric version available'],
  ['Keine unterstützte Version verfügbar', 'No supported version available'],
  ['Nutze den isolierten Standard-Mods-Ordner ohne eigenes Profil.', 'Use the isolated default mods folder without a custom profile.'],
  ['Standard-Mods-Ordner', 'Default mods folder'],
  ['Eigener Mods-Ordner und genau eine Fabric-Version pro Profil.', 'Own mods folder and exactly one Fabric version per profile.'],
  ['eigener Mods-Ordner', 'own mods folder'],
  ['Bitte gib einen Profil-Namen ein.', 'Please enter a profile name.'],
  ['Bitte wähle eine Fabric-Version für das Profil aus.', 'Please choose a Fabric version for the profile.'],
  ['Aktiviere Launcher-Standard...', 'Activating launcher default...'],
  ['Profil löschen', 'Delete profile'],
  ['Online-Skin-Bibliothek ist in diesem Build nicht verfügbar.', 'The online skin library is not available in this build.'],
  ['Sucht...', 'Searching...'],
  ['Lade beliebte Skin-Vorschläge...', 'Loading popular skin suggestions...'],
  ['Keine Online-Skins gefunden.', 'No online skins found.'],
  ['Online-Skins werden geladen...', 'Loading online skins...'],
  ['Noch keine Online-Skins geladen.', 'No online skins loaded yet.'],
  ['Importiere Skin...', 'Importing skin...'],
  ['Skin gespeichert.', 'Skin saved.'],
  ['Skin löschen', 'Delete skin'],
  ['Es ist kein Skin gespeichert.', 'No skin is saved.'],
  ['Skin entfernen', 'Remove skin'],
  ['Entferne aktiven Skin...', 'Removing active skin...'],
  ['Skin entfernt.', 'Skin removed.'],
  ['Versionsliste aktualisiert.', 'Version list updated.'],
  ['Keine Versionen gefunden', 'No versions found'],
  ['Keine Version ausgewählt', 'No version selected'],
  ['bereits installiert', 'already installed'],
  ['wird beim Download geladen', 'will be downloaded when needed'],
  ['Lade Fabric-Versionen...', 'Loading Fabric versions...'],
  ['Bitte zuerst eine Version auswählen.', 'Please select a version first.'],
  ['Diese Mod ist nicht für die ausgewählte Minecraft-Version verfügbar.', 'This mod is not available for the selected Minecraft version.'],
  ['Wähle zuerst eine Fabric-Version aus.', 'Choose a Fabric version first.'],
  ['In Profil installieren', 'Install into profile'],
  ['Herunterladen', 'Download'],
  ['Installieren', 'Install'],
  ['Top Modpacks auf Modrinth.', 'Top modpacks on Modrinth.'],
  ['Keine beliebten Modpacks gefunden.', 'No popular modpacks found.'],
  ['Keine Modpack-Treffer auf Modrinth.', 'No modpack results on Modrinth.'],
  ['Zielprofil', 'Target profile'],
  ['Keine passenden Profile', 'No matching profiles'],
  ['Neuer Profilname', 'New profile name'],
  ['Jetzt installieren', 'Install now'],
  ['Keine Beschreibung verfügbar.', 'No description available.'],
  ['Schon installiert', 'Already installed'],
  ['Falsche Version', 'Wrong version'],
  ['Mehr anzeigen', 'Show more'],
  ['Lade...', 'Loading...'],
  ['Mods-Ordner konnte nicht geöffnet werden.', 'Mods folder could not be opened.'],
  ['Alle Mods werden bereits geprüft.', 'All mods are already being checked.'],
  ['Fehler: Mod-Prüfung ist im Launcher nicht verfügbar.', 'Error: mod checking is not available in the launcher.'],
  ['Prüft...', 'Checking...'],
  ['Prüfe und korrigiere alle Mods...', 'Checking and fixing all mods...'],
  ['Verwaltet', 'Managed'],
  ['Manuell', 'Manual'],
  ['Ausgeschaltet.', 'Disabled.'],
  ['Ausgeschaltet: keine passende Version gefunden.', 'Disabled: no matching version found.'],
  ['Pflichtmod: Kann ausgeschaltet, aber nicht entfernt werden.', 'Required mod: can be disabled, but not removed.'],
  ['Pflichtmod: Bleibt immer eingeschaltet.', 'Required mod: always stays enabled.'],
  ['Direkt über Modrinth verwaltet.', 'Managed directly through Modrinth.'],
  ['Lokale JAR-Datei im Mods-Ordner.', 'Local JAR file in the mods folder.'],
  ['Immer an', 'Always on'],
  ['Ausschalten', 'Disable'],
  ['Einschalten', 'Enable'],
  ['Nicht entfernbar', 'Cannot remove'],
  ['Diese Pflichtmod ist erforderlich und kann nicht entfernt werden.', 'This required mod is needed and cannot be removed.'],
  ['Mod entfernen', 'Remove mod'],
  ['Minecraft-Ordner wird erstellt', 'Creating Minecraft folder'],
  ['Unbekannt', 'Unknown'],
  ['Java nicht gefunden', 'Java not found'],
  ['Java-Status nicht verfügbar', 'Java status unavailable'],
  ['keine Auswahl', 'no selection'],
  ['die ausgewählte Version', 'the selected version'],
  ['Noch keine Skins gespeichert.', 'No skins saved yet.'],
  ['Slim-Modell verwenden? OK = Slim, Abbrechen = Wide', 'Use Slim model? OK = Slim, Cancel = Wide'],
  ['Diagnose ist nicht verfügbar.', 'Diagnostics are not available.'],
  ['Diagnose läuft...', 'Diagnostics running...'],
  ['Debug-Modus gespeichert.', 'Debug mode saved.'],
  ['Minecraft läuft', 'Minecraft is running'],
  ['Adresse kopieren', 'Copy address'],
  ['Aktualisieren', 'Refresh'],
  ['Alle -2-Mods löschen', 'Delete all -2 mods'],
  ['Backup erstellen', 'Create backup'],
  ['Bitte den Launcher geöffnet lassen. Die neue Version wird automatisch installiert.', 'Please keep the launcher open. The new version will be installed automatically.'],
  ['Blendet den Hosting-Tab in der Seitenleiste ein oder aus.', 'Shows or hides the Hosting tab in the sidebar.'],
  ['Dateien und Backups', 'Files and backups'],
  ['Deine Server', 'Your servers'],
  ['Du kannst die eingestellte Startfarbe behalten oder mit den Reglern ändern.', 'You can keep the initial color or change it with the sliders.'],
  ['End aktiviert', 'End enabled'],
  ['Gib das Admin-Passwort deiner Internet-Box ein. Es wird nicht gespeichert.', 'Enter the administrator password for your router. It will not be saved.'],
  ['Kopieren', 'Copy'],
  ['Live-Spieler', 'Live players'],
  ['Lokaler Minecraft Java Server · direkte Verbindung', 'Local Minecraft Java server · direct connection'],
  ['Löscht jede Mod-JAR mit „-2.jar“ am Dateiende aus allen Launcher-Modordnern – auch Pflichtmods.', 'Deletes every mod JAR ending in “-2.jar” from all launcher mod folders, including required mods.'],
  ['Max. Spieler', 'Max. players'],
  ['Nether aktiviert', 'Nether enabled'],
  ['Noch keine Konsolen-Ausgabe.', 'No console output yet.'],
  ['Optionale Bereiche und visuelle Effekte.', 'Optional sections and visual effects.'],
  ['Ordner und Pfade, die der Launcher verwendet.', 'Folders and paths used by the launcher.'],
  ['Ordner öffnen', 'Open folder'],
  ['PVP aktiviert', 'PVP enabled'],
  ['Paper wird automatisch heruntergeladen, EULA wird akzeptiert.', 'Paper is downloaded automatically and the EULA is accepted.'],
  ['Plugins, Welten und Sicherungen im Serverordner.', 'Plugins, worlds, and backups in the server folder.'],
  ['Profil-Version ändern', 'Change profile version'],
  ['Server erstellen', 'Create server'],
  ['Server erstellen und konfigurieren', 'Create and configure server'],
  ['Server-Einstellungen', 'Server settings'],
  ['Serverstatus wird geladen...', 'Loading server status...'],
  ['Spieler sortieren', 'Sort players'],
  ['Spieler suchen', 'Search players'],
  ['Spieler werden über die Konsole erkannt.', 'Players are detected through the console.'],
  ['Starten & Online', 'Start and go online'],
  ['Unpassende Mods löschen', 'Delete incompatible mods'],
  ['Update wird vorbereitet', 'Preparing update'],
  ['Wähle einen lokalen Server oder erstelle einen neuen.', 'Select a local server or create a new one.'],
  ['systemd-Logs, Paper-Konsole und RCON-Befehle.', 'systemd logs, Paper console, and RCON commands.'],
  ['Nutze den offiziellen .minecraft-Mods-Ordner ohne eigenes Profil.', 'Use the official .minecraft mods folder without a custom profile.'],
  ['Keine Bans geladen.', 'No bans loaded.'],
  ['Keine Spieler online.', 'No players online.'],
  ['Noch keine Dateien geladen.', 'No files loaded yet.'],
  ['Du hast noch keine Server erstellt.', 'You have not created any servers yet.'],
  ['Keine bestehenden X-Launcher-VMs erkannt.', 'No existing X Launcher VMs detected.'],
  ['Noch keine Server-Mods. Füge Fabric-kompatible JAR-Dateien hinzu.', 'No server mods yet. Add Fabric-compatible JAR files.'],
  ['Noch keine lokalen Server.', 'No local servers yet.'],
  ['Suche läuft...', 'Searching...'],
  ['Alle Mod-Dateien mit -2.jar am Ende werden gelöscht...', 'Deleting all mod files ending in -2.jar...'],
  ['Alles bereit. Wähle dein Profil und starte Minecraft direkt mit X Launcher.', 'Everything is ready. Select your profile and launch Minecraft directly with X Launcher.'],
  ['Aurora-Hintergrund aktiv.', 'Aurora background enabled.'],
  ['Auto-Updates sind in dieser Launcher-Version nicht verfügbar.', 'Automatic updates are not available in this launcher version.'],
  ['Automatische Mod-Prüfung ist aktiv.', 'Automatic mod checking is enabled.'],
  ['Automatische Mod-Prüfung ist deaktiviert.', 'Automatic mod checking is disabled.'],
  ['Beim Start werden UPnP, Windows-Firewall und öffentliche IPv4 automatisch geprüft.', 'UPnP, Windows Firewall, and the public IPv4 address are checked automatically on startup.'],
  ['Bitte Backup-Dateiname eingeben.', 'Enter a backup file name.'],
  ['Bitte akzeptiere die Minecraft EULA.', 'Please accept the Minecraft EULA.'],
  ['Bitte akzeptiere zuerst die Minecraft Server EULA.', 'Please accept the Minecraft Server EULA first.'],
  ['Bitte erstelle oder wähle zuerst einen Hosting-Server aus.', 'Create or select a hosted server first.'],
  ['Bitte erstelle oder öffne zuerst einen Server.', 'Create or open a server first.'],
  ['Bitte gib einen Befehl ein.', 'Enter a command.'],
  ['Bitte gib einen Servernamen ein, z. B. pizza.', 'Enter a server name, for example pizza.'],
  ['Bitte gib einen Servernamen ein.', 'Enter a server name.'],
  ['Bitte gib einen gültigen Spielernamen ein.', 'Enter a valid player name.'],
  ['Bitte gib mindestens 2 Zeichen ein.', 'Enter at least 2 characters.'],
  ['Bitte wähle zuerst einen Server aus.', 'Select a server first.'],
  ['Bitte öffne zuerst einen Server.', 'Open a server first.'],
  ['Cloud-Server löschen', 'Delete cloud server'],
  ['Das Standardprofil nutzt immer den normalen .minecraft/mods-Ordner. Zusätzliche Profile können weiterhin eigene Versionen und Mod-Sammlungen besitzen.', 'The default profile always uses the normal .minecraft/mods folder. Additional profiles can still use their own versions and mod collections.'],
  ['Das ausgewählte Profil wurde nicht gefunden.', 'The selected profile was not found.'],
  ['Dein X Launcher', 'Your X Launcher'],
  ['Dein aktueller Account-Skin wurde automatisch importiert.', 'Your current account skin was imported automatically.'],
  ['Diese Farbe wird als Startfarbe verwendet. Du kannst sie behalten oder mit den Reglern ändern.', 'This color is used as the initial color. You can keep it or change it with the sliders.'],
  ['Du hast bereits die aktuelle Launcher-Version.', 'You already have the latest launcher version.'],
  ['Eigene Drag-and-drop-Mods müssen einzeln eingeschaltet werden.', 'Custom drag-and-drop mods must be enabled individually.'],
  ['Eigene Drag-and-drop-Mods werden sofort aktiviert.', 'Custom drag-and-drop mods are enabled immediately.'],
  ['Eigene Mods müssen nach dem Ablegen einzeln eingeschaltet werden.', 'Custom mods must be enabled individually after being dropped.'],
  ['Eigene Mods werden nach dem Ablegen direkt aktiviert.', 'Custom mods are enabled immediately after being dropped.'],
  ['Ein Klick startet Minecraft direkt mit dem ausgewählten Profil. Der offizielle Minecraft Launcher wird dabei weder geöffnet noch verändert.', 'One click launches Minecraft directly with the selected profile. The official Minecraft Launcher is neither opened nor modified.'],
  ['Ein Launcher-Update wurde heruntergeladen. Jetzt neu starten und installieren?', 'A launcher update was downloaded. Restart and install it now?'],
  ['Ein anderer Server läuft gerade. Stoppe ihn zuerst.', 'Another server is running. Stop it first.'],
  ['Entferne unpassende Mods...', 'Removing incompatible mods...'],
  ['Fehler: Mod-Bereinigung ist im Launcher nicht verfügbar.', 'Error: mod cleanup is not available in the launcher.'],
  ['Fehler: Sammellöschen ist im Launcher nicht verfügbar.', 'Error: bulk deletion is not available in the launcher.'],
  ['Fehler: Standard Mods-Ordner kann nicht geändert werden.', 'Error: the default mods folder cannot be changed.'],
  ['Für externe Spieler muss der Port im Router und in der Firewall erlaubt sein.', 'For external players, the port must be allowed in the router and firewall.'],
  ['Galaxy-Hintergrund aktiv.', 'Galaxy background enabled.'],
  ['Grid Motion aktiv.', 'Grid Motion enabled.'],
  ['Hintergrund Animation gespeichert.', 'Background animation saved.'],
  ['Hosting ist ausgeschaltet.', 'Hosting is disabled.'],
  ['Hosting ist ausgeschaltet. Aktiviere den Schalter in den Einstellungen.', 'Hosting is disabled. Enable it in Settings.'],
  ['Hosting ist eingeschaltet.', 'Hosting is enabled.'],
  ['Hyperspeed-Hintergrund aktiv.', 'Hyperspeed background enabled.'],
  ['Jede Mod-Datei mit „-2.jar“ am Ende wird sofort und dauerhaft aus allen Launcher-Modordnern gelöscht. Pflichtmods werden nicht ausgenommen und nicht neu installiert.', 'Every mod file ending in “-2.jar” is permanently deleted from all launcher mod folders. Required mods are included and are not reinstalled.'],
  ['Keine Ressourcenpakete installiert.', 'No resource packs installed.'],
  ['Keine Server-Adresse zum Kopieren.', 'No server address to copy.'],
  ['Keine Shader installiert.', 'No shaders installed.'],
  ['Keine entfernbaren unpassenden Mods gefunden.', 'No removable incompatible mods found.'],
  ['Keine unpassenden Mods vorhanden', 'No incompatible mods found'],
  ['Konsolenbefehle sind in dieser Launcher-Version nicht verfügbar.', 'Console commands are not available in this launcher version.'],
  ['Launcher-Standard wurde aktualisiert.', 'Launcher default was updated.'],
  ['Launcher-Update kann in dieser Version nicht installiert werden.', 'The launcher update cannot be installed in this version.'],
  ['Launcher-Updates sind in dieser Version nicht verfügbar.', 'Launcher updates are not available in this version.'],
  ['Link konnte nicht geöffnet werden.', 'The link could not be opened.'],
  ['Lokaler Server wurde als Favorit gespeichert.', 'Local server saved as a favorite.'],
  ['Lösche alle -2-Mods...', 'Deleting all -2 mods...'],
  ['Melde dich mit Microsoft an. X Launcher startet Minecraft danach selbstständig und öffnet den offiziellen Minecraft Launcher nicht.', 'Sign in with Microsoft. X Launcher will then launch Minecraft directly without opening the official Minecraft Launcher.'],
  ['Minecraft direkt starten', 'Launch Minecraft directly'],
  ['Minecraft starten', 'Launch Minecraft'],
  ['Minecraft startet bereits.', 'Minecraft is already starting.'],
  ['Minecraft-Server starten und online stellen', 'Start the Minecraft server and bring it online'],
  ['Minecraft-Server stoppen', 'Stop the Minecraft server'],
  ['Mod entfernt.', 'Mod removed.'],
  ['Mods hinzugefügt.', 'Mods added.'],
  ['Neueste Paper-Version', 'Latest Paper version'],
  ['Neustart ist in dieser Launcher-Version nicht verfügbar.', 'Restart is not available in this launcher version.'],
  ['Nicht gestartet', 'Not started'],
  ['Gefährliche Aufräumaktionen für Mod-Dateien.', 'Dangerous cleanup actions for mod files.'],
  ['Java-Version', 'Java version'],
  ['Minecraft-Version dieses Profils ändern', 'Change this profile’s Minecraft version'],
  ['Modpack-Version filtern', 'Filter modpack version'],
  ['Mods', 'Mods'],
  ['Version', 'Version'],
  ['Ban-Liste wurde in der Konsole aktualisiert.', 'Ban list updated in the console.'],
  ['Kein gültiger Spielername für diese Aktion.', 'No valid player name for this action.'],
  ['Oracle-Anmeldung ist nicht verfügbar.', 'Oracle sign-in is not available.'],
  ['Ressourcenpakete und Shader bitte über den Modrinth-Tab installieren.', 'Install resource packs and shaders through the Modrinth tab.'],
  ['Server-Hosting ist in dieser Launcher-Version nicht verfügbar.', 'Server hosting is not available in this launcher version.'],
  ['Speichern ist in dieser Launcher-Version nicht verfügbar.', 'Saving is not available in this launcher version.'],
  ['Vanilla-Server unterstützt keine Mods.', 'Vanilla servers do not support mods.'],
  ['Änderungen verworfen.', 'Changes discarded.']
]);

const X_LAUNCHER_TRANSLATION_PATTERNS = [
  [/^Einstellungen von (.+) kopiert\.$/u, 'Settings copied from $1.'],
  [/^Einstellungen in (.+) eingefügt\.$/u, 'Settings pasted into $1.'],
  [/^Keine Konsolenzeile gefunden für "(.+)"\.$/u, 'No console line found for "$1".'],
  [/^Schritt (\d+) von (\d+)$/u, 'Step $1 of $2'],
  [/^Startwarnung: (.+)$/u, 'Startup warning: $1'],
  [/^Fehler: (.+)$/u, 'Error: $1'],
  [/^Warnung: (.+)$/u, 'Warning: $1'],
  [/^Hinweis: (.+)$/u, 'Note: $1'],
  [/^Logdatei: (.+)$/u, 'Log file: $1'],
  [/^Config geöffnet: (.+)$/u, 'Config opened: $1'],
  [/^Logs geöffnet: (.+)$/u, 'Logs opened: $1'],
  [/^Minecraft-Pfad gespeichert: (.+)$/u, 'Minecraft path saved: $1'],
  [/^Windows-Name gespeichert: (.+)$/u, 'Windows name saved: $1'],
  [/^Standard Mods-Ordner gespeichert: (.+)$/u, 'Default mods folder saved: $1'],
  [/^Standard Mods-Ordner zurückgesetzt: (.+)$/u, 'Default mods folder reset: $1'],
  [/^Launcher-Update(.*) wird heruntergeladen\.\.\.$/u, 'Launcher update$1 is downloading...'],
  [/^Launcher-Update: (\d+)% heruntergeladen$/u, 'Launcher update: $1% downloaded'],
  [/^Launcher-Update(.*) ist bereit\.$/u, 'Launcher update$1 is ready.'],
  [/^Launcher wird für das Update neu gestartet\.\.\.$/u, 'Launcher is restarting for the update...'],
  [/^Willkommen, (.+)!$/u, 'Welcome, $1!'],
  [/^Offline Login aktiv\. Willkommen (.+)\.$/u, 'Offline login active. Welcome $1.'],
  [/^Anmeldung fehlgeschlagen: (.+)$/u, 'Login failed: $1'],
  [/^Fehler beim Starten: (.+)$/u, 'Launch failed: $1'],
  [/^Starte (.+) und trete Server bei\.\.\.$/u, 'Starting $1 and joining server...'],
  [/^Starte (.+) als (.+)\.\.\.$/u, 'Starting $1 as $2...'],
  [/^(\d+) Favorit(?:en)? gespeichert\.$/u, '$1 favorite(s) saved.'],
  [/^(\d+) Account(?:s)? gespeichert\.$/u, '$1 account(s) saved.'],
  [/^"(.+)" wirklich aus den Favoriten entfernen\?$/u, 'Remove "$1" from favorites?'],
  [/^"(.+)" aus der Accountliste entfernen\?$/u, 'Remove "$1" from the account list?'],
  [/^Ressourcenpaket "(.+)" wirklich löschen\?$/u, 'Really delete resource pack "$1"?'],
  [/^Shader "(.+)" wirklich löschen\?$/u, 'Really delete shader "$1"?'],
  [/^Mod "(.+)" wirklich löschen\?$/u, 'Really delete mod "$1"?'],
  [/^(.+) wurde hinzugefügt und aktiviert\.$/u, '$1 was added and activated.'],
  [/^Profil (.+)$/u, 'Profile $1'],
  [/^Mods in (.+)$/u, 'Mods in $1'],
  [/^(.+) nutzt (.+)\. Alle prüfen korrigiert die verwalteten Mods in diesem Profil\.$/u, '$1 uses $2. Check all fixes managed mods in this profile.'],
  [/^Launcher-Standard nutzt (.+)\. Alle prüfen korrigiert die verwalteten Mods im Standard-Mods-Ordner\.$/u, 'Launcher default uses $1. Check all fixes managed mods in the default mods folder.'],
  [/^Neue Mods werden direkt in (.+) installiert\.$/u, 'New mods are installed directly into $1.'],
  [/^(.+) ist aktiv\.$/u, '$1 is active.'],
  [/^Launcher-Standard \((.+)\)$/u, 'Launcher Default ($1)'],
  [/^Erstelle Profil (.+)\.\.\.$/u, 'Creating profile $1...'],
  [/^Profil (.+) wurde erstellt\.$/u, 'Profile $1 was created.'],
  [/^Aktiviere (.+)\.\.\.$/u, 'Activating $1...'],
  [/^Speichere Launcher-Standard (.+)\.\.\.$/u, 'Saving launcher default $1...'],
  [/^Launcher-Standard nutzt jetzt Fabric (.+)\.(.*)$/u, 'Launcher default now uses Fabric $1.$2'],
  [/^Profil "(.+)" wirklich löschen\? Die zugehörigen Profil-Daten werden entfernt\.$/u, 'Delete profile "$1"? The related profile data will be removed.'],
  [/^Entferne (.+)\.\.\.$/u, 'Removing $1...'],
  [/^(.+) wurde gelöscht\.$/u, '$1 was deleted.'],
  [/^Aktiver Skin: (.+)$/u, 'Active skin: $1'],
  [/^(.+) beliebte Skin-Vorschläge\.$/u, '$1 popular skin suggestions.'],
  [/^(.+) Vorschläge passend zu "(.+)"\.$/u, '$1 suggestions matching "$2".'],
  [/^Keine passenden Online-Skins für "(.+)" gefunden\.$/u, 'No matching online skins found for "$1".'],
  [/^Suche passende Skins für "(.+)"\.\.\.$/u, 'Searching matching skins for "$1"...'],
  [/^Lade (.+) herunter\.\.\.$/u, 'Downloading $1...'],
  [/^Skin (.+) heruntergeladen\.$/u, 'Skin $1 downloaded.'],
  [/^Skin (.+) aktiviert\.$/u, 'Skin $1 activated.'],
  [/^Setze Modell für (.+)\.\.\.$/u, 'Setting model for $1...'],
  [/^Modell für (.+) aktualisiert\.$/u, 'Model for $1 updated.'],
  [/^Skin "(.+)" wirklich löschen\?$/u, 'Delete skin "$1"?'],
  [/^Skin (.+) entfernt\.$/u, 'Skin $1 removed.'],
  [/^Aktiven Skin "(.+)" wirklich entfernen\?$/u, 'Remove active skin "$1"?'],
  [/^Fabric (.+) ist bereits installiert$/u, 'Fabric $1 is already installed'],
  [/^Fabric (.+) ist wird beim Download geladen$/u, 'Fabric $1 will be downloaded when needed'],
  [/^Speichere Fabric (.+)\.\.\.$/u, 'Saving Fabric $1...'],
  [/^Fabric (.+) ausgewählt\.(.*)$/u, 'Fabric $1 selected.$2'],
  [/^Lade Fabric (.+) herunter\.\.\.$/u, 'Downloading Fabric $1...'],
  [/^Suche Modpacks auf Modrinth für jede Version\.$/u, 'Searches modpacks on Modrinth for any version.'],
  [/^Suche Modpacks auf Modrinth für Minecraft (.+)\.$/u, 'Searches modpacks on Modrinth for Minecraft $1.'],
  [/^Suche (.+) für (.+) auf Fabric (.+)\.$/u, 'Searches $1 for $2 on Fabric $3.'],
  [/^Suche (.+) auf Modrinth\.\.\.$/u, 'Searching $1 on Modrinth...'],
  [/^Lade Top (.+) von Modrinth\.\.\.$/u, 'Loading top $1 from Modrinth...'],
  [/^(\d+) Treffer für Modpacks auf Modrinth\.$/u, '$1 results for modpacks on Modrinth.'],
  [/^(\d+) Treffer für Modpacks auf Modrinth für Minecraft (.+)\.$/u, '$1 results for modpacks on Modrinth for Minecraft $2.'],
  [/^Top Modpacks auf Modrinth für Minecraft (.+)\.$/u, 'Top modpacks on Modrinth for Minecraft $1.'],
  [/^Keine beliebten Modpacks für Minecraft (.+) gefunden\.$/u, 'No popular modpacks found for Minecraft $1.'],
  [/^Keine Modpack-Treffer auf Modrinth für Minecraft (.+)\.$/u, 'No modpack results on Modrinth for Minecraft $1.'],
  [/^Top (.+) für (.+) auf Fabric (.+)\.$/u, 'Top $1 for $2 on Fabric $3.'],
  [/^Keine beliebten (.+) für (.+) auf Fabric (.+) gefunden\.$/u, 'No popular $1 found for $2 on Fabric $3.'],
  [/^(\d+) Treffer für (.+) in (.+) auf Fabric (.+)\.$/u, '$1 results for $2 in $3 on Fabric $4.'],
  [/^Keine Modrinth-Treffer für (.+) in (.+) auf Fabric (.+)\.$/u, 'No Modrinth results for $1 in $2 on Fabric $3.'],
  [/^Keine (.+) gefunden\.$/u, 'No $1 found.'],
  [/^Keine Top (.+) gefunden\.$/u, 'No top $1 found.'],
  [/^([\d.,]+) Downloads$/u, '$1 downloads'],
  [/^Importiere (.+)\.\.\.$/u, 'Importing $1...'],
  [/^Installiere (.+)\.\.\.$/u, 'Installing $1...'],
  [/^(.+) installiert\.$/u, '$1 installed.'],
  [/^Mods-Ordner geöffnet: (.+)$/u, 'Mods folder opened: $1'],
  [/^(\d+)\/(\d+) Mods wurden aktualisiert!$/u, '$1/$2 mods updated.'],
  [/^Keine Mods in (.+) aktiv\.$/u, 'No mods active in $1.'],
  [/^Keine Mods für diese Version aktiv\.$/u, 'No mods active for this version.'],
  [/^Schalte ein: (.+)\.\.\.$/u, 'Enabling: $1...'],
  [/^Schalte aus: (.+)\.\.\.$/u, 'Disabling: $1...'],
  [/^Mod "(.+)" wurde eingeschaltet\.$/u, 'Mod "$1" was enabled.'],
  [/^Mod "(.+)" wurde ausgeschaltet\.$/u, 'Mod "$1" was disabled.'],
  [/^Mod "(.+)" wirklich entfernen\?$/u, 'Remove mod "$1"?'],
  [/^Mod "(.+)" wurde entfernt\.$/u, 'Mod "$1" was removed.'],
  [/^Aktualisiere (.+)\.\.\.$/u, 'Updating $1...'],
  [/^Mod "(.+)" aktualisiert\.$/u, 'Mod "$1" updated.'],
  [/^Java (.+) erkannt, Java 21 empfohlen$/u, 'Java $1 detected, Java 21 recommended'],
  [/^Java (.+) erkannt$/u, 'Java $1 detected'],
  [/^Aktiv: (.+) \| (.+)$/u, 'Active: $1 | $2'],
  [/^Aktiv: (.+)$/u, 'Active: $1'],
  [/^Keine Mods für (.+) installiert\.$/u, 'No mods installed for $1.'],
  [/^(\d+) aktive Mod(?:s)? sind manuell und können nicht sicher automatisch korrigiert werden\. Alle prüfen übernimmt erkennbare Modrinth-JARs oder schaltet unpassende Dateien aus\.$/u, '$1 active manual mod(s) cannot be safely fixed automatically. Check all adopts recognizable Modrinth JARs or disables incompatible files.'],
  [/^(\d+) Mod(?:s)? sind ausgeschaltet, weil keine passende Version für (.+) gefunden wurde\.$/u, '$1 mod(s) disabled because no matching version for $2 was found.'],
  [/^(\d+) Mod(?:s)? (?:ist|s sind) ausgeschaltet\. Aktive verwaltete Mods sind passend für (.+)\.$/u, '$1 mod(s) disabled. Active managed mods match $2.'],
  [/^Alles richtig: (\d+) verwaltete Mod(?:s)? sind passend für (.+) aktiv\.(.*)$/u, 'All good: $1 managed mod(s) are active and match $2.$3'],
  [/^Zuletzt geprüft: (.+)$/u, 'Last checked: $1'],
  [/^Diagnose fehlgeschlagen: (.+)$/u, 'Diagnostics failed: $1'],
  [/^Diagnose abgeschlossen: (.+)$/u, 'Diagnostics completed: $1'],
  [/^(\d+) Problem(?:e)?, (\d+) Hinweis(?:e)?, (\d+) Reparaturprüfung(?:en)?\.$/u, '$1 problem(s), $2 note(s), $3 repair check(s).'],
  [/^(\d+) Hinweis(?:e)?, (\d+) Reparaturprüfung(?:en)?\.$/u, '$1 note(s), $2 repair check(s).']
];

class MinecraftLauncher {
  constructor() {
    this.user = null;
    this.mods = [];
    this.skinConfig = null;
    this.minecraftPath = null;
    this.hasCopiedProfileSettings = false;
    this.standardModsPath = null;
    this.launcherStatus = null;
    this.authConfig = null;
    this.availableVersions = [];
    this.selectedVersionId = '';
    this.supportedMinecraftVersions = ['26.1+'];
    this.modrinthLoadedResults = [];
    this.modrinthLoadedStartOffset = 0;
    this.modrinthNextOffset = 0;
    this.modrinthMaxLoadedResults = 500;
    this.modrinthResults = [];
    this.modrinthSearchIndex = [];
    this.modrinthQuery = '';
    this.modrinthDataRevision = 0;
    this.modrinthLastRenderedSignature = '';
    this.modrinthProjectType = 'mod';
    this.modrinthVersionFilterId = '';
    this.modsViewType = 'mod';
    this.installedModProjectIds = new Set();
    this.modrinthHasMore = false;
    this.modrinthTotalHits = 0;
    this.modrinthIsLoadingMore = false;
    this.modrinthIsLoadingPrevious = false;
    this.modrinthSearchCache = new Map();
    this.modrinthSearchDebounceTimer = null;
    this.modrinthSearchRequestId = 0;
    this.modrinthSearchInFlight = false;
    this.pendingModrinthInstalls = new Set();
    this.pendingModRemovals = new Set();
    this.pendingModToggles = new Set();
    this.modOperationState = 'idle';
    this.pendingModOperations = 0;
    this.pendingModOperationIds = new Set();
    this.modOperationQueue = [];
    this.modOperationError = '';
    this.queuedModToggleStates = new Map();
    this.modrinthSearchCacheTtlMs = 5 * 60 * 1000;
    this.modrinthPersistentCacheTtlMs = 7 * 24 * 60 * 60 * 1000;
    this.modrinthPersistentCacheStorageKey = 'xLauncherModrinthSearchCacheV2';
    this.modrinthVirtualOverscanBefore = 2;
    this.modrinthVirtualOverscanAfter = 4;
    this.modrinthPageSize = 100;
    this.modrinthPrefetchDistance = 1200;
    this.modrinthPrefetchItems = 15;
    this.modrinthLastScrollTop = 0;
    this.modrinthLastScrollAt = 0;
    this.modrinthPrefetchTimer = null;
    this.modrinthVirtualRangeKey = '';
    this.modrinthVirtualScrollFrame = null;
    this.modrinthVirtualScrollTimer = null;
    this.modrinthLoadObserver = null;
    this.modrinthImageObserver = null;
    this.onlineSkinResults = [];
    this.onlineSkinQuery = '';
    this.skinLibraryInitialSearchDone = false;
    this.skinLibraryIsLoading = false;
    this.packsConfig = null;
    this.serverFavorites = [];
    this.hostedServerStatus = null;
    this.hostedServers = [];
    this.activeHostedServerId = '';
    this.hostedServerFormMode = 'hidden';
    this.hostedServerAutoSaveTimer = null;
    this.hostedServerDraftDirty = false;
    this.hostedServerStatusTimer = null;
    this.hostedPlayerSearch = '';
    this.hostedPlayerSort = 'name';
    this.hostingConsoleSearch = '';
    this.hostingModerationHistory = [];
    this.hostingBanList = [];
    this.hostedServerListSignature = '';
    this.accountsConfig = null;
    this.selectedDirectServerId = '';
    this.minecraftLaunchState = 'idle';
    this.minecraftLaunchInProgress = false;
    this.minecraftLaunchButtonIdleText = 'Play';
    this.minecraftRuntimeStatusTimer = null;
    this.minecraftLaunchProgress = 0;
    this.minecraftProgressAnimationFrame = null;
    this.minecraftRunningTransitionTimer = null;
    this.loadedSections = new Set();
    this.startupDataReady = false;
    this.startupFolderChangePending = false;
    this.startupFolderRefreshSuppressedUntil = 0;
    this.pendingLauncherReleaseNotes = '';
    this.primaryColor = localStorage.getItem('primaryColor') || '#00d9ff';
    this.rgb = this.hexToRgb(this.primaryColor);
    this.rgb = this.keepAccentVisible(this.rgb.r, this.rgb.g, this.rgb.b);
    this.primaryColor = this.rgbToHex(this.rgb.r, this.rgb.g, this.rgb.b);
    localStorage.setItem('primaryColor', this.primaryColor);
    this.appearanceModeStorageKey = 'xLauncherAppearanceMode';
    this.appearanceMode = this.readAppearanceMode();
    this.themeModeStorageKey = 'xLauncherThemeMode';
    this.rgbModeEnabled = localStorage.getItem(this.themeModeStorageKey) === 'rgb';
    this.rgbModeColor = this.primaryColor;
    this.rgbModeAnimationFrame = null;
    this.rgbModeListenersAttached = false;
    this.themeModeSaveTimer = null;
    this.appearanceModeSaveTimer = null;
    this.appearanceModeListenersAttached = false;
    this.systemAppearanceModeListenersAttached = false;
    this.themeConfigSyncTimer = null;
    this.lastThemeConfigSignature = '';
    this.liveThemeColorInFlight = false;
    this.pendingLiveThemeState = null;
    this.lastLiveThemeSignature = '';
    this.liveThemeColorErrorLogged = false;
    this.backgroundAnimationStorageKey = 'xLauncherBackgroundAnimation';
    this.backgroundAnimation = this.readBackgroundAnimation();
    this.backgroundAnimationSaveTimer = null;
    this.backgroundAnimationListenersAttached = false;
    this.skinColorSyncStorageKey = 'xLauncherSkinColorSync';
    this.skinColorSyncEnabled = this.readSkinColorSyncEnabled();
    this.autoUpdateModsStorageKey = 'xLauncherAutoUpdateMods';
    this.requireDroppedModApprovalStorageKey = 'xLauncherRequireDroppedModApproval';
    this.modrinthResultsLimitStorageKey = 'xLauncherModrinthResultsLimit';
    this.autoUpdateModsEnabled = this.readStoredBoolean(this.autoUpdateModsStorageKey, true);
    this.requireDroppedModApprovalEnabled = this.readStoredBoolean(this.requireDroppedModApprovalStorageKey, true);
    this.modrinthResultsLimit = this.readModrinthResultsLimit();
    this.hostingBetaEnabledStorageKey = 'xLauncherHostingBetaEnabled';
    this.hostingBetaEnabled = localStorage.getItem(this.hostingBetaEnabledStorageKey) === 'true'
      || (localStorage.getItem('xLauncherHostingBetaUnlocked') === 'true'
        && localStorage.getItem(this.hostingBetaEnabledStorageKey) !== 'false');
    this.settingToggleStateListenersAttached = false;
    this.automationSettingsListenersAttached = false;
    this.skinPrimaryColor = null;
    this.skinColorRequestId = 0;
    this.rgbListenersAttached = false;
    this.colorSaveTimer = null;
    this.applyStartupThemeColor();
    this.tutorialStorageKey = 'xLauncherTutorialCompletedV3';
    this.tutorialActive = false;
    this.tutorialStepIndex = 0;
    this.tutorialSteps = [];
    this.tutorialOriginalState = null;
    // The currently configured startup color is already a valid choice. Users
    // can keep it without having to move a slider first.
    this.tutorialColorTouched = true;
    this.isWindowMaximized = false;
    this.dashboardSkinAnimationFrame = null;
    this.dashboardSkinViewer = null;
    this.dashboardSkinIdleAnimation = null;
    this.dashboardSkinWalkAnimation = null;
    this.dashboardSkinViewerSource = '';
    this.dashboardSkinEffectTimers = [];
    this.dashboardSkinCanvasAnimation = null;
    this.dashboardSkinReturnAnimationEndHandler = null;
    this.dashboardSkinLaunchExitActive = false;
    this.dashboardSkinLaunchExitAnimationEndHandler = null;
    this.dashboardSkinHeadTargetYaw = 0;
    this.dashboardSkinHeadCurrentYaw = 0;
    this.dashboardSkinHeadTargetPitch = 0;
    this.dashboardSkinHeadCurrentPitch = 0;
    this.dashboardSkinCursorTrackingTimer = null;
    this.dashboardSkinCursorTrackingInFlight = false;
    this.skinPreviewAnimationFrame = null;
    this.skinTextureCache = new Map();
    this.buttonAudioContext = null;
    this.lastButtonSoundAt = 0;
    this.soundVolumeStorageKey = 'xLauncherSoundVolume';
    this.soundVolumeScaleStorageKey = 'xLauncherSoundVolumeScale';
    this.soundVolumeScaleVersion = 'v2-current-100-is-20';
    this.defaultSoundVolume = 0.04;
    this.clickSoundReferenceVolume = 0.04;
    this.clickSoundStorageKey = 'xLauncherClickSound';
    this.soundVolume = this.readSoundVolume();
    this.clickSound = this.readClickSound();
    this.soundSettingsListenersAttached = false;
    this.isUpdatingAllMods = false;
    this.lastModsCheckResult = null;
    this.lastDiagnostics = null;
    this.pendingConfirm = null;
    this.pendingSkinVariantChoice = null;
    this.scrollFadeFrame = null;
    this.scrollFadeObservers = [];
    this.reactBitsMotionFrame = null;
    this.reactBitsMotionObserver = null;
    this.reactBitsPointerFrame = null;
    this.reactBitsPointer = { x: 0, y: 0 };
    this.neonFrameTrackingFrame = null;
    this.neonFramePointer = null;
    this.neonFrameActiveElements = new Set();
    this.neonFrameMutationObserver = null;
    this.neonFrameGradientCounter = 0;
    this.neonFrameStorageKey = 'xLauncherNeonFramesEnabled';
    this.neonFramesEnabled = this.readStoredBoolean(this.neonFrameStorageKey, false);
    this.neonFrameSettingsListenersAttached = false;
    this.launcherUpdateReady = false;
    this.launcherUpdateChecking = false;
    this.launcherUpdateInstallPromptOpen = false;
    this.lastLauncherUpdateProgressPercent = -1;
    this.loadingProgress = 0;
    this.loadingHideTimer = null;
    this.loadingAutoHideTimer = null;
    this.loadingWelcomeTimer = null;
    this.loadingWelcomeDelayMs = 0;
    this.startupLoadingStartedAt = Date.now();
    this.notificationHideTimer = null;
    this.serviceStatusMap = new Map();
    this.serviceStatusRecoveredTimers = new Map();
    this.serviceStatusCheckTimer = null;
    this.serviceStatusCheckInFlight = false;
    this.serviceStatusListenersAttached = false;
    this.activeSectionId = '';
    this.windowGroupState = {
      count: 1,
      index: 0,
      role: 'standalone',
      grouped: false,
      activeSectionId: 'dashboard',
      sharedAnimationStartedAt: Date.now()
    };
    this.lastLoadingSoundAt = 0;
    this.languagePreference = this.readLanguagePreference();
    this.language = this.resolveLanguagePreference(this.languagePreference);
    this.localizationTextSources = new WeakMap();
    this.localizationAttributeSources = new WeakMap();
    this.localizationObserver = null;
    this.localizationFrame = null;
    this.localizationApplying = false;
    this.applyLocalization({ rerender: false });
    this.setupLocalizationObserver();
    this.init();
  }

  readLanguagePreference() {
    const storedValue = localStorage.getItem(X_LAUNCHER_LANGUAGE_STORAGE_KEY);
    return ['auto', ...X_LAUNCHER_SUPPORTED_LANGUAGES].includes(storedValue) ? storedValue : 'auto';
  }

  resolveLanguagePreference(preference = this.languagePreference) {
    if (X_LAUNCHER_SUPPORTED_LANGUAGES.includes(preference)) {
      return preference;
    }
    return this.getSystemLanguage();
  }

  getSystemLanguage() {
    const languages = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || ''];
    return languages.some((language) => String(language || '').toLowerCase().startsWith('de'))
      ? 'de'
      : 'en';
  }

  getLanguageDisplayName(language = this.language) {
    return X_LAUNCHER_LANGUAGE_NAMES[language] || X_LAUNCHER_LANGUAGE_NAMES.en;
  }

  formatLanguageCopy(key, values = {}) {
    const copy = X_LAUNCHER_LANGUAGE_COPY[this.language]?.[key] || X_LAUNCHER_LANGUAGE_COPY.en[key] || '';
    return copy.replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? ''));
  }

  setLanguagePreference(preference, options = {}) {
    const nextPreference = ['auto', ...X_LAUNCHER_SUPPORTED_LANGUAGES].includes(preference) ? preference : 'auto';
    const previousLanguage = this.language;
    this.languagePreference = nextPreference;
    localStorage.setItem(X_LAUNCHER_LANGUAGE_STORAGE_KEY, nextPreference);
    this.language = this.resolveLanguagePreference(nextPreference);
    this.applyLocalization({ rerender: true });
    this.syncLanguagePreferenceToMain();

    if (options.notify !== false) {
      this.showNotification(this.formatLanguageCopy('saved', {
        language: this.getLanguageDisplayName(this.language)
      }));
    }

    if (previousLanguage !== this.language) {
      this.scheduleRuntimeLocalization();
    }
  }

  async loadLanguageConfig() {
    if (typeof window.electronAPI?.getLanguageConfig !== 'function') {
      return;
    }

    try {
      const hasLocalPreference = localStorage.getItem(X_LAUNCHER_LANGUAGE_STORAGE_KEY) !== null;
      const result = await window.electronAPI.getLanguageConfig();
      if (result?.success && !hasLocalPreference) {
        this.languagePreference = this.readLanguagePreferenceFromValue(result.preference);
        localStorage.setItem(X_LAUNCHER_LANGUAGE_STORAGE_KEY, this.languagePreference);
        this.language = this.resolveLanguagePreference(this.languagePreference);
        this.applyLocalization({ rerender: false });
      }
      await this.syncLanguagePreferenceToMain();
    } catch (error) {
      console.warn('Language config sync error:', error);
    }
  }

  readLanguagePreferenceFromValue(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return ['auto', ...X_LAUNCHER_SUPPORTED_LANGUAGES].includes(normalized) ? normalized : 'auto';
  }

  async syncLanguagePreferenceToMain() {
    if (typeof window.electronAPI?.setLanguagePreference !== 'function') {
      return;
    }

    try {
      await window.electronAPI.setLanguagePreference(this.languagePreference);
    } catch (error) {
      console.warn('Language preference save error:', error);
    }
  }

  setupLanguageSettings() {
    const languageSelect = document.getElementById('language-select');
    languageSelect?.addEventListener('change', (event) => this.setLanguagePreference(event.target.value));
    window.addEventListener('languagechange', () => {
      if (this.languagePreference !== 'auto') {
        return;
      }
      const nextLanguage = this.resolveLanguagePreference('auto');
      if (nextLanguage === this.language) {
        return;
      }
      this.language = nextLanguage;
      this.applyLocalization({ rerender: true });
    });
    this.syncLanguageSettingsUI();
  }

  syncLanguageSettingsUI() {
    const languageSelect = document.getElementById('language-select');
    const languageStatus = document.getElementById('language-status');
    if (languageSelect) {
      languageSelect.value = this.languagePreference;
    }
    if (languageStatus) {
      languageStatus.textContent = this.languagePreference === 'auto'
        ? this.formatLanguageCopy('autoStatus', { language: this.getLanguageDisplayName(this.language) })
        : this.formatLanguageCopy('manualStatus', { language: this.getLanguageDisplayName(this.language) });
    }
  }

  setupHostingBetaGate() {
    this.updateHostingBetaUI();

    const toggle = document.getElementById('hosting-beta-toggle');
    toggle?.addEventListener('change', (event) => {
      this.setHostingBetaEnabled(Boolean(event.target?.checked));
    });
  }

  isHostingBetaEnabled() {
    return hasAdminPermission()
      && (this.hostingBetaEnabled || localStorage.getItem(this.hostingBetaEnabledStorageKey) === 'true');
  }

  setHostingBetaEnabled(enabled) {
    if (!hasAdminPermission()) {
      this.hostingBetaEnabled = false;
      localStorage.removeItem(this.hostingBetaEnabledStorageKey);
      this.updateHostingBetaUI();
      return;
    }
    this.hostingBetaEnabled = Boolean(enabled);
    localStorage.setItem(this.hostingBetaEnabledStorageKey, this.hostingBetaEnabled ? 'true' : 'false');
    this.updateHostingBetaUI();

    if (!this.hostingBetaEnabled && this.activeSectionId === 'hosting') {
      this.activateSection('settings');
    }

    this.showNotification(this.hostingBetaEnabled ? 'Hosting Tab eingeschaltet.' : 'Hosting Tab ausgeschaltet.');
  }

  updateHostingBetaUI() {
    const owner = hasAdminPermission();
    const enabled = this.isHostingBetaEnabled();
    const hostingNavItem = document.querySelector('.nav-item[data-section="hosting"]');
    const hostingSetting = document.getElementById('hosting-beta-setting');
    const statusEl = document.getElementById('hosting-beta-status');
    const toggleRow = document.getElementById('hosting-beta-toggle-row');
    const toggle = document.getElementById('hosting-beta-toggle');

    hostingNavItem?.classList.toggle('hidden', !enabled);
    hostingNavItem?.setAttribute('aria-hidden', enabled ? 'false' : 'true');
    if (statusEl) {
      statusEl.textContent = enabled ? 'Hosting ist eingeschaltet.' : 'Hosting ist ausgeschaltet.';
    }
    hostingSetting?.classList.toggle('hidden', !owner);
    toggleRow?.classList.toggle('hidden', !owner);
    if (toggle) {
      toggle.checked = enabled;
      toggle.disabled = !owner;
    }
  }

  setupLocalizationObserver() {
    if (!document.body || this.localizationObserver || typeof MutationObserver === 'undefined') {
      return;
    }

    this.localizationObserver = new MutationObserver(() => {
      if (!this.localizationApplying) {
        this.scheduleRuntimeLocalization();
      }
    });
    this.localizationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-label', 'placeholder', 'title']
    });
  }

  applyLocalization({ rerender = false } = {}) {
    document.documentElement.lang = this.language;
    this.syncLanguageSettingsUI();
    this.setMaximizeButtonState(this.isWindowMaximized);
    this.scheduleRuntimeLocalization();
    if (rerender) {
      this.refreshLocalizedDynamicUI();
    }
  }

  refreshLocalizedDynamicUI() {
    this.updateMicrosoftConfigUI();
    this.updateSkinColorSettingUI();
    this.updateSoundSettingsUI();
    this.updateAutomationSettingsUI();
    this.updateNeonFrameSettingsUI();
    this.initializeSettingToggleStateSync();
    this.updatePackContextUI();
    this.renderPacks();
    this.renderStartPackSelect();
    this.renderServerFavorites();
    this.renderStartServerList();
    this.renderAccounts();
    this.updateSkinUI();
    this.updateAppearanceModeSettingUI();
    this.updateModrinthTypeUI();
    this.updateModrinthSearchStatus();
    this.renderModrinthResults();
    this.renderMods();
    this.updateLauncherVersionLabels();
    this.updateMinecraftStatus();
    this.updateJavaStatus();
    this.updateModsCheckStatus();
    if (this.tutorialActive) {
      this.renderTutorialStep();
    }
    this.scheduleRuntimeLocalization();
  }

  scheduleRuntimeLocalization() {
    if (this.localizationFrame) {
      return;
    }
    this.localizationFrame = requestAnimationFrame(() => {
      this.localizationFrame = null;
      this.applyRuntimeLocalization();
    });
  }

  applyRuntimeLocalization() {
    if (!document.body) {
      return;
    }

    this.localizationApplying = true;
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => this.shouldLocalizeTextNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT
      });

      let node = walker.nextNode();
      while (node) {
        this.localizeTextNode(node);
        node = walker.nextNode();
      }

      document.body.querySelectorAll('[aria-label], [placeholder], [title]').forEach((element) => {
        ['aria-label', 'placeholder', 'title'].forEach((attributeName) => {
          if (element.hasAttribute(attributeName)) {
            this.localizeElementAttribute(element, attributeName);
          }
        });
      });
    } finally {
      this.localizationApplying = false;
    }
  }

  shouldLocalizeTextNode(node) {
    if (!node?.nodeValue || !node.nodeValue.trim()) {
      return false;
    }

    const parent = node.parentElement;
    if (!parent) {
      return false;
    }

    if (parent.closest('#launch-btn')) {
      return false;
    }

    return !parent.closest('script, style, textarea, canvas');
  }

  localizeTextNode(node) {
    if (this.language !== 'en') {
      const sourceText = this.localizationTextSources.get(node);
      if (sourceText && node.nodeValue !== sourceText) {
        node.nodeValue = sourceText;
      }
      return;
    }

    const storedSource = this.localizationTextSources.get(node);
    const storedTranslation = storedSource ? this.translateGermanText(storedSource) : '';
    const sourceText = storedSource && node.nodeValue === storedTranslation
      ? storedSource
      : node.nodeValue;
    const translatedText = this.translateGermanText(sourceText);

    if (translatedText !== sourceText) {
      this.localizationTextSources.set(node, sourceText);
      if (node.nodeValue !== translatedText) {
        node.nodeValue = translatedText;
      }
    }
  }

  localizeElementAttribute(element, attributeName) {
    if (attributeName === 'title' && element.matches('.start-server-tile')) {
      return;
    }

    const currentValue = element.getAttribute(attributeName);
    if (!currentValue || !currentValue.trim()) {
      return;
    }

    let attributeSources = this.localizationAttributeSources.get(element);
    if (!attributeSources) {
      attributeSources = {};
      this.localizationAttributeSources.set(element, attributeSources);
    }

    if (this.language !== 'en') {
      const sourceValue = attributeSources[attributeName];
      if (sourceValue && element.getAttribute(attributeName) !== sourceValue) {
        element.setAttribute(attributeName, sourceValue);
      }
      return;
    }

    const storedSource = attributeSources[attributeName] || '';
    const storedTranslation = storedSource ? this.translateGermanText(storedSource) : '';
    const sourceValue = storedSource && currentValue === storedTranslation ? storedSource : currentValue;
    const translatedValue = this.translateGermanText(sourceValue);
    if (translatedValue !== sourceValue) {
      attributeSources[attributeName] = sourceValue;
      element.setAttribute(attributeName, translatedValue);
    }
  }

  localizeText(value) {
    const text = String(value ?? '');
    return this.language === 'en' ? this.translateGermanText(text) : text;
  }

  translateGermanText(text) {
    const originalText = String(text ?? '');
    const leadingWhitespace = originalText.match(/^\s*/u)?.[0] || '';
    const trailingWhitespace = originalText.match(/\s*$/u)?.[0] || '';
    const coreText = originalText.trim();
    if (!coreText) {
      return originalText;
    }

    let translatedText = X_LAUNCHER_DE_TO_EN_TEXT.get(coreText) || '';
    if (!translatedText) {
      for (const [pattern, replacement] of X_LAUNCHER_TRANSLATION_PATTERNS) {
        if (pattern.test(coreText)) {
          translatedText = coreText.replace(pattern, replacement);
          break;
        }
      }
    }

    if (!translatedText) {
      translatedText = this.translateCommonGermanTerms(coreText);
    }

    translatedText = this.translateCommonGermanTerms(translatedText || coreText);
    return `${leadingWhitespace}${translatedText}${trailingWhitespace}`;
  }

  translateCommonGermanTerms(text) {
    return String(text || '')
      .replace(/Launcher-Standard/g, 'Launcher Default')
      .replace(/Standard Mods-Ordner/g, 'Default mods folder')
      .replace(/Standard-Mods-Ordner/g, 'Default mods folder')
      .replace(/Ressourcenpakete/g, 'Resource packs')
      .replace(/ressourcenpakete/g, 'resource packs')
      .replace(/Modpacks/g, 'Modpacks')
      .replace(/\bShader\b/g, 'Shaders')
      .replace(/Fehler:/g, 'Error:')
      .replace(/Hinweis:/g, 'Note:')
      .replace(/Warnung:/g, 'Warning:')
      .replace(/Downloads/g, 'downloads')
      .replace(/wurde heruntergeladen/g, 'was downloaded')
      .replace(/heruntergeladen/g, 'downloaded')
      .replace(/wurde aktualisiert/g, 'was updated')
      .replace(/aktualisiert/g, 'updated')
      .replace(/wurde installiert/g, 'was installed')
      .replace(/installiert/g, 'installed')
      .replace(/wurde gespeichert/g, 'was saved')
      .replace(/gespeichert/g, 'saved')
      .replace(/wurde entfernt/g, 'was removed')
      .replace(/entfernt/g, 'removed');
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 217, b: 255 };
  }

  normalizeHexColor(color) {
    const normalized = String(color || '').trim();
    return /^#[0-9a-fA-F]{6}$/u.test(normalized) ? normalized.toLowerCase() : '';
  }

  rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((value) => {
      const hex = value.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  keepAccentVisible(r, g, b) {
    const values = [r, g, b].map((value) => Math.max(0, Math.min(255, Number(value) || 0)));
    const zeroIndexes = values.map((value, index) => value === 0 ? index : -1).filter((index) => index >= 0);
    if (zeroIndexes.length >= 2) {
      const remaining = [0, 1, 2].find((index) => !zeroIndexes.includes(index));
      if (remaining === undefined) {
        values[2] = 30;
      } else {
        values[remaining] = Math.max(30, values[remaining]);
      }
    }
    return { r: values[0], g: values[1], b: values[2] };
  }

  rgbToHsl(r, g, b) {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const delta = max - min;
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (max === red) {
        h = ((green - blue) / delta) + (green < blue ? 6 : 0);
      } else if (max === green) {
        h = ((blue - red) / delta) + 2;
      } else {
        h = ((red - green) / delta) + 4;
      }
      h /= 6;
    }

    return { h, s, l };
  }

  hslToRgb(h, s, l) {
    if (s === 0) {
      const gray = Math.round(l * 255);
      return { r: gray, g: gray, b: gray };
    }

    const hueToRgb = (p, q, t) => {
      let hue = t;
      if (hue < 0) hue += 1;
      if (hue > 1) hue -= 1;
      if (hue < 1 / 6) return p + ((q - p) * 6 * hue);
      if (hue < 1 / 2) return q;
      if (hue < 2 / 3) return p + ((q - p) * (2 / 3 - hue) * 6);
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - (l * s);
    const p = (2 * l) - q;

    return {
      r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
      g: Math.round(hueToRgb(p, q, h) * 255),
      b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255)
    };
  }

  async init() {
    this.startupLoadingStartedAt = Date.now();
    this.showLoading('Launcher wird vorbereitet...', {
      progress: 12,
      playerName: this.user?.username || ''
    });
    this.setupEventListeners();
    this.setupNavigation();
    this.setupWindowStateSync();
    this.setupMinecraftLifecycleSync();
    try {
      await Promise.allSettled([this.loadLanguageConfig(), this.loadThemeConfig()]);
      this.updateLoadingState({ text: 'Theme und Sprache werden geladen...', progress: 34 });
      this.setupSystemAppearanceModeSync();
      this.applyTheme();
      this.startThemeConfigSync();
      this.setupWindowGroupSync();
      this.setupLauncherAppUpdateSync();
      this.setupReactBitsMotion();
      this.updateLoadingState({ text: 'Konfigurationen und Status...', progress: 46 });
      await Promise.allSettled([
        this.loadAuthConfig(),
        this.loadDiagnosticSettings(),
        this.loadStandardModsPath(),
        this.startServiceStatusMonitor()
      ]);
      await this.loadUserInfo();
      this.showLoading('Launcher wird vorbereitet...', {
        progress: 82,
        playerName: this.user?.username || ''
      });
      this.updateLoadingState({ text: 'Launcher ist bereit...', progress: 100 });
      this.finishLoading('Launcher bereit.');
    } catch (error) {
      console.error('Launcher init error:', error);
      this.showLoginScreen();
      this.showNotification('Startwarnung: ' + error.message);
      this.finishLoading('Startwarnung.');
    }
    requestAnimationFrame(() => this.startDeferredInitialization());
  }

  startDeferredInitialization() {
    const run = () => {
      this.startDashboardSkinGlobalCursorTracking();
      this.initializeSoundSettings();
      this.setupScrollFade();
      this.setupNeonFrameTracking();
      this.syncWindowState().catch(() => {});
      this.maybeStartFirstRunTutorial();
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 1200 });
    } else {
      window.setTimeout(run, 0);
    }
  }

  setupWindowStateSync() {
    if (typeof window.electronAPI?.onWindowStateChanged !== 'function') {
      return;
    }

    window.electronAPI.onWindowStateChanged((state) => {
      if (typeof state?.maximized === 'boolean') {
        this.setMaximizeButtonState(state.maximized);
      }
    });
  }

  async syncWindowState() {
    if (typeof window.electronAPI?.getWindowState !== 'function') {
      return;
    }

    try {
      const state = await window.electronAPI.getWindowState();
      if (state?.success && typeof state.maximized === 'boolean') {
        this.setMaximizeButtonState(state.maximized);
      }
    } catch (error) {
      console.error('Window state sync error:', error);
    }
  }

  setupWindowGroupSync() {
    if (typeof window.electronAPI?.onWindowGroupStateChanged !== 'function') {
      return;
    }

    window.electronAPI.onWindowGroupStateChanged((state) => {
      this.applyWindowGroupState(state);
    });

    if (typeof window.electronAPI?.getWindowGroupState === 'function') {
      window.electronAPI.getWindowGroupState().catch((error) => {
        console.error('Window group state sync error:', error);
      });
    }
  }

  applyWindowGroupState(state = {}) {
    const count = Math.max(1, Number(state.count) || 1);
    const index = Math.max(0, Number(state.index) || 0);
    const role = count > 1 && state.role === 'navigation' ? 'navigation' : (count > 1 ? 'content' : 'standalone');
    const activeSectionId = String(state.activeSectionId || this.activeSectionId || 'dashboard').trim() || 'dashboard';
    const startedAt = Number(state.sharedAnimationStartedAt) || Date.now();
    const elapsed = Math.max(0, Date.now() - startedAt);
    this.windowGroupState = {
      count,
      index,
      role,
      grouped: Boolean(state.grouped) && count > 1,
      activeSectionId,
      sharedAnimationStartedAt: startedAt
    };

    document.documentElement.classList.remove(
      'multi-window-active',
      'window-grouped',
      'split-window-navigation',
      'split-window-content'
    );
    document.documentElement.style.setProperty('--window-group-count', String(count));
    document.documentElement.style.setProperty('--window-group-index', String(index));
    document.documentElement.style.setProperty('--window-group-stagger', `${index * 70}ms`);
    document.documentElement.style.setProperty('--shared-window-animation-delay', `-${elapsed}ms`);

    if (activeSectionId && activeSectionId !== this.activeSectionId) {
      this.activateSection(activeSectionId, { broadcast: false });
    }
  }

  setupLauncherAppUpdateSync() {
    if (typeof window.electronAPI?.onLauncherAppUpdateState !== 'function') {
      return;
    }

    window.electronAPI.onLauncherAppUpdateState((state) => {
      this.handleLauncherAppUpdateState(state);
    });
  }

  setupMinecraftLifecycleSync() {
    if (typeof window.electronAPI?.onGameEvent !== 'function') {
      return;
    }

    window.electronAPI.onGameEvent('minecraft-launch-progress', (_event, payload) => {
      this.updateMinecraftLaunchProgress(payload?.progress, payload?.status);
    });
    window.electronAPI.onGameEvent('minecraft-process-created', () => this.setMinecraftLaunchState('launching'));
    window.electronAPI.onGameEvent('minecraft-started', () => this.completeMinecraftLaunch());
    window.electronAPI.onGameEvent('minecraft-closed', () => {
      this.cancelMinecraftProgressAnimation();
      clearTimeout(this.minecraftRunningTransitionTimer);
      this.setMinecraftLaunchState('idle');
      this.playDashboardSkinReturnAnimation();
    });

    if (typeof window.electronAPI.getMinecraftRuntimeStatus === 'function') {
      const refreshRuntimeStatus = () => window.electronAPI.getMinecraftRuntimeStatus().then((status) => {
        if (status?.running && this.minecraftLaunchState !== 'launching') {
          this.setMinecraftLaunchState('running');
        } else if (status?.launching) {
          this.setMinecraftLaunchState('launching');
        } else if (this.minecraftLaunchState === 'running') {
          // This releases externally started Minecraft instances. A launch in
          // preparation is intentionally never released by a negative poll.
          this.setMinecraftLaunchState('idle');
        }
      }).catch((error) => console.warn('Minecraft status check failed:', error));
      refreshRuntimeStatus();
      clearInterval(this.minecraftRuntimeStatusTimer);
      this.minecraftRuntimeStatusTimer = setInterval(refreshRuntimeStatus, 2500);
    }
  }

  setMinecraftLaunchState(nextState) {
    const normalizedState = ['idle', 'launching', 'running'].includes(nextState) ? nextState : 'idle';
    const previousState = this.minecraftLaunchState;
    if (this.minecraftLaunchState === 'launching' && normalizedState === 'idle') {
      // Only an explicit launch failure or minecraft-closed handler may call
      // this transition. Runtime polling never requests it while launching.
    }
    this.minecraftLaunchState = normalizedState;
    this.minecraftLaunchInProgress = normalizedState !== 'idle';
    if (normalizedState === 'idle') {
      this.cancelMinecraftProgressAnimation();
      clearTimeout(this.minecraftRunningTransitionTimer);
    }
    const launchButton = document.getElementById('launch-btn');
    if (launchButton) {
      const busy = normalizedState !== 'idle';
      launchButton.disabled = busy;
      const label = launchButton.querySelector('.launch-progress-label');
      const percent = launchButton.querySelector('.launch-progress-percent');
      if (label) label.textContent = busy
        ? this.localizeText(normalizedState === 'running' ? 'Minecraft läuft' : 'Minecraft wird gestartet')
        : (this.minecraftLaunchButtonIdleText || 'Play');
      if (!busy) {
        this.minecraftLaunchProgress = 0;
        if (percent) percent.textContent = '';
      } else if (normalizedState === 'launching' && previousState === 'idle' && percent) {
        this.minecraftLaunchProgress = 0;
        percent.textContent = '0%';
        percent.setAttribute('aria-hidden', 'false');
      }
      launchButton.classList.toggle('is-minecraft-running', busy);
      launchButton.classList.toggle('is-launching', normalizedState === 'launching');
      launchButton.dataset.minecraftState = normalizedState;
    }
    document.querySelectorAll('#start-server-list .start-server-tile').forEach((serverButton) => {
      serverButton.disabled = normalizedState !== 'idle';
      serverButton.setAttribute('aria-disabled', normalizedState !== 'idle' ? 'true' : 'false');
    });
    this.updateModCompatibilityUI();
  }

  updateMinecraftLaunchProgress(progress, status = '') {
    const launchButton = document.getElementById('launch-btn');
    if (!launchButton) return;
    const normalized = Math.max(this.minecraftLaunchProgress || 0, Math.min(100, Number(progress) || 0));
    this.animateMinecraftProgress(normalized);
    const percent = launchButton.querySelector('.launch-progress-percent');
    if (percent) percent.setAttribute('aria-hidden', 'false');
    const statusEl = document.getElementById('minecraft-status');
    if (statusEl && status) statusEl.textContent = this.localizeText(status);
  }

  animateMinecraftProgress(targetProgress, onComplete = null) {
    this.cancelMinecraftProgressAnimation();
    const start = Number(this.minecraftLaunchProgress) || 0;
    const target = Math.max(start, Math.min(100, Number(targetProgress) || 0));
    const duration = Math.max(180, Math.min(520, (target - start) * 18));
    const startedAt = performance.now();
    const percent = document.querySelector('#launch-btn .launch-progress-percent');
    const tick = (now) => {
      const elapsed = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      this.minecraftLaunchProgress = start + ((target - start) * eased);
      if (percent) percent.textContent = `${Math.round(this.minecraftLaunchProgress)}%`;
      if (elapsed < 1) {
        this.minecraftProgressAnimationFrame = requestAnimationFrame(tick);
      } else {
        this.minecraftProgressAnimationFrame = null;
        this.minecraftLaunchProgress = target;
        if (percent) percent.textContent = `${Math.round(target)}%`;
        onComplete?.();
      }
    };
    this.minecraftProgressAnimationFrame = requestAnimationFrame(tick);
  }

  cancelMinecraftProgressAnimation() {
    if (this.minecraftProgressAnimationFrame) {
      cancelAnimationFrame(this.minecraftProgressAnimationFrame);
      this.minecraftProgressAnimationFrame = null;
    }
  }

  completeMinecraftLaunch() {
    clearTimeout(this.minecraftRunningTransitionTimer);
    this.updateMinecraftStatusText('Minecraft läuft');
    this.animateMinecraftProgress(100, () => {
      this.minecraftRunningTransitionTimer = window.setTimeout(() => {
        if (this.minecraftLaunchState === 'launching') this.setMinecraftLaunchState('running');
      }, 1000);
    });
  }

  updateMinecraftStatusText(text) {
    const statusEl = document.getElementById('minecraft-status');
    if (statusEl) statusEl.textContent = this.localizeText(text);
  }

  handleLauncherAppUpdateState(state) {
    const status = String(state?.status || '');
    const versionText = state?.version ? ` ${state.version}` : '';

    this.updateLauncherUpdateStatusUI(state);

    if (status === 'available') {
      this.lastLauncherUpdateProgressPercent = -1;
      this.showLauncherUpdateOverlay({
        title: 'Launcher-Update wird geladen',
        message: 'Bitte den Launcher geöffnet lassen. Die neue Version wird automatisch heruntergeladen.',
        version: state?.version,
        progress: 4
      });
      this.showNotification(`Launcher-Update${versionText} wird heruntergeladen...`);
      return;
    }

    if (status === 'download-progress') {
      const percent = Math.floor(Number(state?.percent) || 0);
      this.showLauncherUpdateOverlay({
        title: 'Launcher-Update wird geladen',
        message: 'Download läuft. Danach installiert der Launcher die neue Version automatisch.',
        version: state?.version,
        progress: percent
      });
      if (percent >= 100 || percent >= this.lastLauncherUpdateProgressPercent + 25) {
        this.lastLauncherUpdateProgressPercent = percent;
        this.showNotification(`Launcher-Update: ${percent}% heruntergeladen`);
      }
      return;
    }

    if (status === 'downloaded') {
      this.pendingLauncherReleaseNotes = String(state?.releaseNotes || '').trim();
      this.showLauncherUpdateOverlay({
        title: 'Update wird installiert',
        message: 'Download fertig. Der Launcher startet gleich automatisch neu.',
        version: state?.version,
        progress: 100
      });
      this.showNotification(`Launcher-Update${versionText} wird automatisch installiert...`);
      return;
    }

    if (status === 'installing') {
      this.showLauncherUpdateOverlay({
        title: 'Update wird installiert',
        message: 'Bitte einen Moment warten. Die neue Version wird ohne weitere Klicks installiert.',
        version: state?.version,
        progress: 100
      });
      this.showNotification('Launcher wird für das Update neu gestartet...');
      return;
    }

    if (status === 'error' && state?.error) {
      console.warn('Launcher app update failed:', state.error);
    }
  }

  updateLauncherUpdateStatusUI(state = {}) {
    const statusEl = document.getElementById('launcher-update-status');
    const checkButton = document.getElementById('check-launcher-update-btn');
    const installButton = document.getElementById('install-launcher-update-btn');
    if (!statusEl) {
      return;
    }

    const status = String(state?.status || '').trim();
    const versionText = state?.version ? ` ${state.version}` : '';
    statusEl.classList.remove('is-ok', 'is-warning', 'is-error');

    let message = 'Der installierte Launcher prüft beim Start automatisch nach Updates.';
    if (status === 'checking') {
      this.launcherUpdateChecking = true;
      this.launcherUpdateReady = false;
      message = 'Suche nach Launcher-Updates...';
    } else if (status === 'available') {
      this.launcherUpdateChecking = false;
      this.launcherUpdateReady = false;
      message = `Launcher-Update${versionText} gefunden. Download startet...`;
      statusEl.classList.add('is-warning');
    } else if (status === 'download-progress') {
      this.launcherUpdateChecking = false;
      this.launcherUpdateReady = false;
      const percent = Math.floor(Number(state?.percent) || 0);
      message = `Launcher-Update wird heruntergeladen: ${percent}%`;
      statusEl.classList.add('is-warning');
    } else if (status === 'downloaded') {
      this.launcherUpdateChecking = false;
      this.launcherUpdateReady = true;
      message = `Launcher-Update${versionText} wird automatisch installiert...`;
      statusEl.classList.add('is-ok');
    } else if (status === 'not-available') {
      this.launcherUpdateChecking = false;
      this.launcherUpdateReady = false;
      message = 'Du hast bereits die aktuelle Launcher-Version.';
      statusEl.classList.add('is-ok');
    } else if (status === 'skipped') {
      this.launcherUpdateChecking = false;
      this.launcherUpdateReady = false;
      message = state?.reason || 'Auto-Updates sind in dieser Launcher-Version nicht verfügbar.';
      statusEl.classList.add('is-warning');
    } else if (status === 'installing') {
      this.launcherUpdateChecking = false;
      message = 'Launcher wird für das Update neu gestartet...';
      statusEl.classList.add('is-warning');
    } else if (status === 'error') {
      this.launcherUpdateChecking = false;
      this.launcherUpdateReady = false;
      message = `Update-Fehler: ${state?.error || 'Unbekannter Fehler.'}`;
      statusEl.classList.add('is-error');
    }

    statusEl.textContent = this.localizeText(message);
    if (checkButton) {
      checkButton.disabled = this.launcherUpdateChecking;
    }
    if (installButton) {
      installButton.classList.toggle('hidden', !this.launcherUpdateReady);
    }
  }

  showLauncherUpdateOverlay({ title, message, version, progress } = {}) {
    const overlay = document.getElementById('update-overlay');
    const titleEl = document.getElementById('update-title');
    const messageEl = document.getElementById('update-message');
    const versionEl = document.getElementById('update-version-label');
    const progressBar = document.getElementById('update-progress');
    const percentEl = document.getElementById('update-percent');
    if (!overlay) {
      return;
    }

    const normalizedProgress = Math.min(100, Math.max(0, Number(progress) || 0));
    if (titleEl && title) {
      titleEl.textContent = this.localizeText(title);
    }
    if (messageEl && message) {
      messageEl.textContent = this.localizeText(message);
    }
    if (versionEl) {
      const versionText = String(version || '').trim();
      versionEl.textContent = this.localizeText(versionText ? `X Launcher ${versionText}` : 'Launcher-Update');
    }
    if (progressBar) {
      progressBar.style.width = `${Math.round(normalizedProgress)}%`;
    }
    if (percentEl) {
      percentEl.textContent = `${Math.round(normalizedProgress)}%`;
    }

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-busy', normalizedProgress < 100 ? 'true' : 'false');
  }

  async checkLauncherAppUpdateManually() {
    if (typeof window.electronAPI?.checkAppUpdates !== 'function') {
      this.updateLauncherUpdateStatusUI({
        status: 'skipped',
        reason: 'Launcher-Updates sind in dieser Version nicht verfügbar.'
      });
      return;
    }

    this.updateLauncherUpdateStatusUI({ status: 'checking' });
    try {
      const result = await window.electronAPI.checkAppUpdates();
      if (!result?.success) {
        this.updateLauncherUpdateStatusUI({
          status: 'error',
          error: result?.error || 'Update-Prüfung fehlgeschlagen.'
        });
        return;
      }

      if (result.skipped) {
        this.updateLauncherUpdateStatusUI({
          status: 'skipped',
          reason: result.reason
        });
      }
    } catch (error) {
      this.updateLauncherUpdateStatusUI({
        status: 'error',
        error: error.message
      });
    }
  }

  async installLauncherAppUpdateManually() {
    if (typeof window.electronAPI?.installAppUpdate !== 'function') {
      this.showNotification('Launcher-Update kann in dieser Version nicht installiert werden.');
      return;
    }

    try {
      const result = await window.electronAPI.installAppUpdate();
      if (!result?.success) {
        this.showNotification(`Fehler: ${result?.error || 'Update konnte nicht installiert werden.'}`);
      }
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async promptLauncherAppUpdateInstall(state = {}) {
    if (this.launcherUpdateInstallPromptOpen) {
      return;
    }

    this.launcherUpdateInstallPromptOpen = true;
    try {
      const version = String(state?.version || '').trim();
      const confirmed = await this.showConfirm({
        title: 'Launcher-Update bereit',
        message: version
          ? `X Launcher ${version} wurde heruntergeladen. Jetzt neu starten und installieren?`
          : 'Ein Launcher-Update wurde heruntergeladen. Jetzt neu starten und installieren?',
        confirmText: 'Jetzt installieren',
        cancelText: 'Später'
      });

      if (confirmed) {
        await this.installLauncherAppUpdateManually();
      }
    } finally {
      this.launcherUpdateInstallPromptOpen = false;
    }
  }

  setMaximizeButtonState(isMaximized) {
    this.isWindowMaximized = Boolean(isMaximized);
    const maximizeButton = document.getElementById('window-maximize-btn');
    if (!maximizeButton) {
      return;
    }

    maximizeButton.classList.toggle('is-maximized', this.isWindowMaximized);
    const label = this.localizeText(this.isWindowMaximized ? 'Wiederherstellen' : 'Maximieren');
    maximizeButton.setAttribute('aria-label', label);
    maximizeButton.setAttribute('title', label);
  }

  normalizeAppearanceMode(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return ['system', 'light', 'dark'].includes(normalized) ? normalized : 'system';
  }

  getSystemAppearanceMode() {
    return window.matchMedia?.('(prefers-color-scheme: light)')?.matches ? 'light' : 'dark';
  }

  getEffectiveAppearanceMode(value = this.appearanceMode) {
    const normalizedMode = this.normalizeAppearanceMode(value);
    return normalizedMode === 'system' ? this.getSystemAppearanceMode() : normalizedMode;
  }

  readAppearanceMode() {
    const storedValue = localStorage.getItem(this.appearanceModeStorageKey);
    const migrationKey = `${this.appearanceModeStorageKey}SystemDefaultV1`;

    if (localStorage.getItem(migrationKey) !== 'true') {
      localStorage.setItem(migrationKey, 'true');
      localStorage.setItem(this.appearanceModeStorageKey, 'system');
      return 'system';
    }

    const normalizedMode = this.normalizeAppearanceMode(storedValue);
    if (storedValue !== normalizedMode) {
      localStorage.setItem(this.appearanceModeStorageKey, normalizedMode);
    }
    return normalizedMode;
  }

  setupSystemAppearanceModeSync() {
    if (this.systemAppearanceModeListenersAttached || typeof window.matchMedia !== 'function') {
      return;
    }

    const systemAppearanceQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleSystemAppearanceChange = () => {
      if (this.appearanceMode !== 'system') {
        return;
      }

      this.applyTheme();
    };

    if (typeof systemAppearanceQuery.addEventListener === 'function') {
      systemAppearanceQuery.addEventListener('change', handleSystemAppearanceChange);
    } else if (typeof systemAppearanceQuery.addListener === 'function') {
      systemAppearanceQuery.addListener(handleSystemAppearanceChange);
    }

    this.systemAppearanceModeListenersAttached = true;
  }

  applyStartupThemeColor() {
    const root = document.documentElement;
    if (!root) {
      return;
    }
    const color = this.normalizeHexColor(this.primaryColor) || '#00d9ff';
    const rgb = this.hexToRgb(color);
    root.style.setProperty('--primary-color', color);
    root.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    const accentLuminance = ((0.2126 * rgb.r) + (0.7152 * rgb.g) + (0.0722 * rgb.b)) / 255;
    root.style.setProperty('--accent-contrast', accentLuminance > 0.57 ? '#050708' : '#ffffff');
    root.style.setProperty('--loading-glow-color', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.42)`);
  }

  applyTheme() {
    const effectiveColor = this.getEffectivePrimaryColor();
    this.applyAppearanceMode();
    this.applyBackgroundAnimation();
    this.syncRgbModeAnimation();
    this.applyThemeColor(effectiveColor);
    this.updateRgbModeSettingUI();
    this.updateBackgroundAnimationSettingUI();
    this.updateSkinColorSettingUI();
  }

  applyAppearanceMode() {
    const effectiveAppearanceMode = this.getEffectiveAppearanceMode();
    const lightMode = effectiveAppearanceMode === 'light';
    document.documentElement.classList.toggle('theme-light', lightMode);
    document.documentElement.classList.toggle('theme-dark', !lightMode);
    document.documentElement.classList.toggle('theme-system', this.appearanceMode === 'system');
    document.documentElement.style.colorScheme = lightMode ? 'light' : 'dark';
    this.updateAppearanceModeSettingUI();
  }

  applyThemeColor(color) {
    const effectiveColor = this.normalizeHexColor(color) || '#00d9ff';
    const effectiveRgb = this.hexToRgb(effectiveColor);
    document.documentElement.classList.toggle('theme-rgb-mode', this.rgbModeEnabled);
    document.documentElement.style.setProperty('--primary-color', effectiveColor);
    document.documentElement.style.setProperty('--primary-rgb', `${effectiveRgb.r}, ${effectiveRgb.g}, ${effectiveRgb.b}`);
    const accentLuminance = ((0.2126 * effectiveRgb.r) + (0.7152 * effectiveRgb.g) + (0.0722 * effectiveRgb.b)) / 255;
    document.documentElement.style.setProperty('--accent-contrast', accentLuminance > 0.57 ? '#050708' : '#ffffff');
    document.documentElement.style.setProperty('--loading-glow-color', `rgba(${effectiveRgb.r}, ${effectiveRgb.g}, ${effectiveRgb.b}, 0.42)`);
    this.syncThemeStateToMod(effectiveColor);
    const preview = document.getElementById('color-preview');
    if (preview) {
      preview.style.background = effectiveColor;
      preview.title = this.rgbModeEnabled
        ? 'RGB-Modus aktiv'
        : (this.skinColorSyncEnabled && this.skinPrimaryColor
          ? 'Vom aktiven Skin übernommen'
          : 'Manuelle Design-Farbe');
    }
  }

  getBackgroundAnimationOptions() {
    return {
      default: {
        label: 'Standard',
        status: 'Standard-Hintergrund aktiv.',
        notification: 'Standard-Hintergrund aktiviert.'
      },
      aurora: {
        label: 'Aurora',
        status: 'Aurora-Hintergrund aktiv.',
        notification: 'Aurora-Hintergrund aktiviert.'
      },
      grid: {
        label: 'Grid Motion',
        status: 'Grid Motion aktiv.',
        notification: 'Grid Motion aktiviert.'
      },
      galaxy: {
        label: 'Galaxy',
        status: 'Galaxy-Hintergrund aktiv.',
        notification: 'Galaxy-Hintergrund aktiviert.'
      },
      silk: {
        label: 'Silk',
        status: 'Silk-Hintergrund aktiv.',
        notification: 'Silk-Hintergrund aktiviert.'
      },
      hyperspeed: {
        label: 'Hyperspeed',
        status: 'Hyperspeed-Hintergrund aktiv.',
        notification: 'Hyperspeed-Hintergrund aktiviert.'
      }
    };
  }

  normalizeBackgroundAnimation(value) {
    const normalized = String(value || '').trim().toLowerCase();
    const legacyMap = {
      mountains: 'galaxy',
      rain: 'grid',
      stars: 'galaxy',
      waves: 'silk',
      lightning: 'grid'
    };
    const mappedValue = legacyMap[normalized] || normalized;
    return Object.prototype.hasOwnProperty.call(this.getBackgroundAnimationOptions(), mappedValue)
      ? mappedValue
      : 'default';
  }

  getBackgroundAnimationClassNames() {
    return Object.keys(this.getBackgroundAnimationOptions())
      .map((mode) => `background-mode-${mode}`)
      .concat(['background-mode-mountains', 'background-mode-rain', 'background-mode-stars', 'background-mode-waves']);
  }

  readBackgroundAnimation() {
    const normalized = this.normalizeBackgroundAnimation(localStorage.getItem(this.backgroundAnimationStorageKey));
    localStorage.setItem(this.backgroundAnimationStorageKey, normalized);
    return normalized;
  }

  applyBackgroundAnimation() {
    const mode = this.normalizeBackgroundAnimation(this.backgroundAnimation);
    document.documentElement.classList.remove(...this.getBackgroundAnimationClassNames());
    document.documentElement.classList.add(`background-mode-${mode}`);
  }

  initializeBackgroundAnimationSetting() {
    this.applyBackgroundAnimation();
    this.updateBackgroundAnimationSettingUI();

    if (this.backgroundAnimationListenersAttached) {
      return;
    }

    document.querySelectorAll('[data-background-animation]').forEach((button) => {
      button.addEventListener('click', () => this.setBackgroundAnimation(button.dataset.backgroundAnimation, { notify: true }));
    });
    this.backgroundAnimationListenersAttached = true;
  }

  updateBackgroundAnimationSettingUI() {
    const mode = this.normalizeBackgroundAnimation(this.backgroundAnimation);
    const options = this.getBackgroundAnimationOptions();
    const status = document.getElementById('background-animation-status');

    document.querySelectorAll('[data-background-animation]').forEach((button) => {
      const active = button.dataset.backgroundAnimation === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (status) {
      status.textContent = options[mode]?.status || options.default.status;
    }
  }

  setBackgroundAnimation(value, options = {}) {
    const nextAnimation = this.normalizeBackgroundAnimation(value);
    const changed = nextAnimation !== this.backgroundAnimation;
    this.backgroundAnimation = nextAnimation;
    localStorage.setItem(this.backgroundAnimationStorageKey, nextAnimation);
    this.applyBackgroundAnimation();
    this.updateBackgroundAnimationSettingUI();

    if (options.persist !== false && changed) {
      this.scheduleBackgroundAnimationSave();
    }

    if (options.notify && changed) {
      const backgroundOptions = this.getBackgroundAnimationOptions();
      this.showNotification(backgroundOptions[nextAnimation]?.notification || 'Hintergrund Animation gespeichert.');
    }
  }

  scheduleBackgroundAnimationSave() {
    clearTimeout(this.backgroundAnimationSaveTimer);
    this.backgroundAnimationSaveTimer = setTimeout(() => {
      this.backgroundAnimationSaveTimer = null;
      this.saveBackgroundAnimation();
    }, 150);
  }

  async saveBackgroundAnimation() {
    if (typeof window.electronAPI?.setBackgroundAnimation !== 'function') {
      return;
    }

    try {
      await window.electronAPI.setBackgroundAnimation(this.backgroundAnimation);
    } catch (error) {
      console.error('Background animation save error:', error);
    }
  }

  syncThemeStateToMod(color) {
    if (typeof window.electronAPI?.setLiveThemeColor !== 'function') {
      return;
    }
    const normalizedColor = this.normalizeHexColor(color) || '#00d9ff';
    const appearanceMode = this.getEffectiveAppearanceMode();
    const signature = `${normalizedColor}|${appearanceMode}`;
    if (signature === this.lastLiveThemeSignature) {
      return;
    }
    if (this.liveThemeColorInFlight) {
      this.pendingLiveThemeState = { color: normalizedColor, appearanceMode };
      return;
    }
    this.sendLiveThemeState(normalizedColor, appearanceMode);
  }

  async sendLiveThemeState(color, appearanceMode = this.appearanceMode) {
    this.liveThemeColorInFlight = true;
    const normalizedAppearanceMode = this.getEffectiveAppearanceMode(appearanceMode);
    const signature = `${color}|${normalizedAppearanceMode}`;

    try {
      const result = await window.electronAPI.setLiveThemeColor(color, normalizedAppearanceMode);
      if (result?.success) {
        this.lastLiveThemeSignature = signature;
        this.liveThemeColorErrorLogged = false;
      } else if (!this.liveThemeColorErrorLogged) {
        this.liveThemeColorErrorLogged = true;
        console.warn('Live theme sync failed:', result?.error || 'unknown error');
      }
    } catch (error) {
      if (!this.liveThemeColorErrorLogged) {
        this.liveThemeColorErrorLogged = true;
        console.warn('Live theme sync failed:', error);
      }
    } finally {
      this.liveThemeColorInFlight = false;
      const pendingState = this.pendingLiveThemeState;
      this.pendingLiveThemeState = null;
      if (pendingState && `${pendingState.color}|${pendingState.appearanceMode}` !== this.lastLiveThemeSignature) {
        this.sendLiveThemeState(pendingState.color, pendingState.appearanceMode);
      }
    }
  }

  getEffectivePrimaryColor() {
    if (this.rgbModeEnabled) {
      return this.rgbModeColor || this.primaryColor;
    }

    return this.skinColorSyncEnabled && this.skinPrimaryColor
      ? this.skinPrimaryColor
      : this.primaryColor;
  }

  syncRgbModeAnimation() {
    if (this.rgbModeEnabled) {
      this.startRgbModeAnimation();
      return;
    }

    this.stopRgbModeAnimation();
  }

  startRgbModeAnimation() {
    if (this.rgbModeAnimationFrame) {
      return;
    }

    const tick = (timestamp) => {
      if (!this.rgbModeEnabled) {
        this.rgbModeAnimationFrame = null;
        return;
      }

      const hue = (timestamp % 7200) / 7200;
      const nextRgb = this.hslToRgb(hue, 0.92, 0.56);
      this.rgbModeColor = this.rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
      this.applyThemeColor(this.rgbModeColor);
      this.rgbModeAnimationFrame = requestAnimationFrame(tick);
    };

    this.rgbModeAnimationFrame = requestAnimationFrame(tick);
  }

  stopRgbModeAnimation() {
    if (!this.rgbModeAnimationFrame) {
      this.rgbModeColor = this.primaryColor;
      document.documentElement.classList.remove('theme-rgb-mode');
      return;
    }

    cancelAnimationFrame(this.rgbModeAnimationFrame);
    this.rgbModeAnimationFrame = null;
    this.rgbModeColor = this.primaryColor;
    document.documentElement.classList.remove('theme-rgb-mode');
  }

  initializeAppearanceModeSetting() {
    const toggle = document.getElementById('appearance-mode-toggle');
    if (!toggle) {
      return;
    }

    this.setSettingToggleChecked(toggle, this.getEffectiveAppearanceMode() === 'light');
    if (!this.appearanceModeListenersAttached) {
      toggle.addEventListener('change', () => this.handleAppearanceModeChange(toggle.checked));
      this.appearanceModeListenersAttached = true;
    }

    this.updateAppearanceModeSettingUI();
  }

  updateAppearanceModeSettingUI() {
    const toggle = document.getElementById('appearance-mode-toggle');
    const toggleWrap = document.querySelector('.appearance-mode-toggle');
    const status = document.getElementById('appearance-mode-status');
    const automaticMode = this.appearanceMode === 'system';
    const lightMode = this.getEffectiveAppearanceMode() === 'light';
    const activeStatusText = lightMode ? 'Hellmodus aktiv' : 'Dunkelmodus aktiv';
    const statusText = automaticMode
      ? (lightMode ? 'Automatisch: Hellmodus aktiv' : 'Automatisch: Dunkelmodus aktiv')
      : activeStatusText;

    if (toggle) {
      this.setSettingToggleChecked(toggle, lightMode);
      toggle.title = statusText;
    }

    toggleWrap?.classList.toggle('is-active', lightMode);
    if (status) {
      status.textContent = statusText;
    }
  }

  handleAppearanceModeChange(enabled) {
    this.setAppearanceMode(enabled ? 'light' : 'dark', { notify: true });
  }

  setAppearanceMode(appearanceMode, options = {}) {
    const nextMode = this.normalizeAppearanceMode(appearanceMode);
    const changed = this.appearanceMode !== nextMode;
    this.appearanceMode = nextMode;
    localStorage.setItem(this.appearanceModeStorageKey, nextMode);

    if (options.persist !== false && changed) {
      this.scheduleAppearanceModeSave();
    }

    if (options.apply !== false) {
      this.applyTheme();
    } else {
      this.applyAppearanceMode();
      this.syncThemeStateToMod(this.getEffectivePrimaryColor());
    }

    if (options.notify && changed) {
      const message = nextMode === 'system'
        ? 'Systemdesign aktiviert.'
        : (nextMode === 'light' ? 'Hellmodus aktiviert.' : 'Dunkelmodus aktiviert.');
      this.showNotification(message);
    }
  }

  initializeRgbModeSetting() {
    const toggle = document.getElementById('rgb-mode-toggle');
    if (!toggle) {
      return;
    }

    this.setSettingToggleChecked(toggle, this.rgbModeEnabled);
    if (!this.rgbModeListenersAttached) {
      toggle.addEventListener('change', () => this.handleRgbModeChange(toggle.checked));
      this.rgbModeListenersAttached = true;
    }

    this.updateRgbModeSettingUI();
  }

  updateRgbModeSettingUI() {
    const toggle = document.getElementById('rgb-mode-toggle');
    const toggleWrap = document.querySelector('.rgb-mode-toggle');
    if (toggle) {
      this.setSettingToggleChecked(toggle, this.rgbModeEnabled);
      toggle.title = 'RGB-Modus wechselt die Launcher-Farbe automatisch.';
    }

    toggleWrap?.classList.toggle('is-active', this.rgbModeEnabled);
  }

  handleRgbModeChange(enabled) {
    this.setRgbModeEnabled(enabled, { notify: true });
  }

  setRgbModeEnabled(enabled, options = {}) {
    const nextEnabled = Boolean(enabled);
    this.rgbModeEnabled = nextEnabled;
    localStorage.setItem(this.themeModeStorageKey, nextEnabled ? 'rgb' : 'manual');

    if (nextEnabled) {
      this.rgbModeColor = this.rgbModeColor || this.primaryColor;
      if (this.skinColorSyncEnabled) {
        this.skinColorSyncEnabled = false;
        localStorage.setItem(this.skinColorSyncStorageKey, 'false');
      }
    } else {
      this.stopRgbModeAnimation();
    }

    if (options.persist !== false) {
      this.scheduleThemeModeSave();
    }

    if (options.apply !== false) {
      this.applyTheme();
    } else {
      this.updateRgbModeSettingUI();
      this.updateSkinColorSettingUI();
    }

    if (options.notify) {
      this.showNotification(nextEnabled ? 'RGB-Modus aktiviert.' : 'RGB-Modus deaktiviert.');
    }
  }

  initializeRGBSliders() {
    const redSlider = document.getElementById('red-slider');
    const greenSlider = document.getElementById('green-slider');
    const blueSlider = document.getElementById('blue-slider');

    if (!redSlider || !greenSlider || !blueSlider) {
      return;
    }

    redSlider.value = this.rgb.r;
    greenSlider.value = this.rgb.g;
    blueSlider.value = this.rgb.b;
    this.updateRGBDisplay();
    this.updateSkinColorSettingUI();

    if (!this.rgbListenersAttached) {
      const boundRGBChange = () => this.handleRGBChange();
      redSlider.addEventListener('input', boundRGBChange);
      greenSlider.addEventListener('input', boundRGBChange);
      blueSlider.addEventListener('input', boundRGBChange);
      this.rgbListenersAttached = true;
    }
  }

  handleRGBChange() {
    if (this.rgbModeEnabled) {
      this.setRgbModeEnabled(false, { apply: false });
    }

    const requested = this.keepAccentVisible(
      parseInt(document.getElementById('red-slider').value, 10),
      parseInt(document.getElementById('green-slider').value, 10),
      parseInt(document.getElementById('blue-slider').value, 10)
    );
    const { r, g, b } = requested;
    document.getElementById('red-slider').value = r;
    document.getElementById('green-slider').value = g;
    document.getElementById('blue-slider').value = b;

    this.rgb = { r, g, b };
    this.primaryColor = this.rgbToHex(r, g, b);
    localStorage.setItem('primaryColor', this.primaryColor);

    this.applyTheme();
    this.updateRGBDisplay();
    this.schedulePrimaryColorSave();
  }

  updateRGBDisplay() {
    const redValue = document.getElementById('red-value');
    const greenValue = document.getElementById('green-value');
    const blueValue = document.getElementById('blue-value');
    if (redValue) {
      redValue.textContent = this.rgb.r;
    }
    if (greenValue) {
      greenValue.textContent = this.rgb.g;
    }
    if (blueValue) {
      blueValue.textContent = this.rgb.b;
    }
  }

  initializeSkinColorSyncSetting() {
    const toggle = document.getElementById('skin-color-sync-toggle');
    if (!toggle) {
      return;
    }

    this.setSettingToggleChecked(toggle, this.skinColorSyncEnabled);
    toggle.addEventListener('change', () => this.handleSkinColorSyncChange(toggle.checked));
    this.updateSkinColorSettingUI();
  }

  updateSkinColorSettingUI() {
    const toggle = document.getElementById('skin-color-sync-toggle');
    const toggleWrap = document.querySelector('.skin-color-toggle');
    const slidersWrap = document.querySelector('.rgb-sliders');
    const sliderIds = ['red-slider', 'green-slider', 'blue-slider'];
    const skinSyncActive = this.skinColorSyncEnabled && Boolean(this.skinConfig?.activeSkin);
    const controlsDisabled = this.rgbModeEnabled || skinSyncActive;

    if (toggle) {
      this.setSettingToggleChecked(toggle, this.skinColorSyncEnabled);
      toggle.disabled = this.rgbModeEnabled;
      toggle.title = this.rgbModeEnabled
        ? 'RGB-Modus aktiv'
        : (this.skinConfig?.activeSkin
          ? 'Aktiver Skin bestimmt die Launcher-Farbe.'
          : 'Wird angewendet, sobald ein Skin aktiv ist.');
    }

    toggleWrap?.classList.toggle('is-disabled', this.rgbModeEnabled);
    if (toggle) {
      this.syncSettingToggleVisualState(toggle);
    }
    slidersWrap?.classList.toggle('is-rgb-mode', this.rgbModeEnabled);
    slidersWrap?.classList.toggle('is-skin-synced', !this.rgbModeEnabled && skinSyncActive);
    sliderIds.forEach((id) => {
      const slider = document.getElementById(id);
      if (slider) {
        slider.disabled = controlsDisabled;
      }
    });
  }

  handleSkinColorSyncChange(enabled) {
    if (enabled && this.rgbModeEnabled) {
      this.setRgbModeEnabled(false, { apply: false });
    }

    this.skinColorSyncEnabled = Boolean(enabled);
    localStorage.setItem(this.skinColorSyncStorageKey, this.skinColorSyncEnabled ? 'true' : 'false');

    if (!this.skinColorSyncEnabled) {
      this.skinPrimaryColor = null;
      this.applyTheme();
      return;
    }

    this.updateAdaptiveSkinColor(this.skinConfig?.activeSkin || null);
  }

  readSkinColorSyncEnabled() {
    const storedValue = localStorage.getItem(this.skinColorSyncStorageKey);
    if (storedValue === null) {
      localStorage.setItem(this.skinColorSyncStorageKey, 'false');
      return false;
    }

    return storedValue === 'true';
  }

  readStoredBoolean(storageKey, defaultValue = false) {
    const storedValue = localStorage.getItem(storageKey);
    if (storedValue === null) {
      localStorage.setItem(storageKey, defaultValue ? 'true' : 'false');
      return Boolean(defaultValue);
    }

    return storedValue === 'true';
  }

  writeStoredBoolean(storageKey, enabled) {
    localStorage.setItem(storageKey, enabled ? 'true' : 'false');
  }

  setSettingToggleChecked(toggleOrId, checked) {
    const toggle = typeof toggleOrId === 'string'
      ? document.getElementById(toggleOrId)
      : toggleOrId;
    if (!toggle) {
      return;
    }

    toggle.checked = Boolean(checked);
    this.syncSettingToggleVisualState(toggle);
  }

  syncSettingToggleVisualState(toggle) {
    const toggleWrap = toggle?.closest?.('.setting-toggle');
    if (!toggleWrap) {
      return;
    }

    toggleWrap.classList.toggle('is-checked', Boolean(toggle.checked));
    toggleWrap.classList.toggle('is-disabled', Boolean(toggle.disabled));
    toggleWrap.setAttribute('role', 'switch');
    toggleWrap.setAttribute('aria-checked', toggle.checked ? 'true' : 'false');
  }

  initializeSettingToggleStateSync() {
    document.querySelectorAll('.setting-toggle input[type="checkbox"]').forEach((toggle) => {
      this.syncSettingToggleVisualState(toggle);
    });

    if (this.settingToggleStateListenersAttached) {
      return;
    }

    document.addEventListener('change', (event) => {
      const toggle = event.target?.closest?.('.setting-toggle input[type="checkbox"]');
      if (!toggle) {
        return;
      }

      this.syncSettingToggleVisualState(toggle);
    });
    this.settingToggleStateListenersAttached = true;
  }

  initializeAutomationSettings() {
    this.updateAutomationSettingsUI();

    if (this.automationSettingsListenersAttached) {
      return;
    }

    document.getElementById('auto-update-mods')?.addEventListener('change', (event) => {
      this.handleAutoUpdateModsChange(event.target.checked);
    });
    document.getElementById('require-dropped-mod-approval')?.addEventListener('change', (event) => {
      this.handleRequireDroppedModApprovalChange(event.target.checked);
    });
    document.getElementById('modrinth-results-limit-slider')?.addEventListener('input', (event) => {
      this.handleModrinthResultsLimitChange(event.target.value);
    });
    this.automationSettingsListenersAttached = true;
  }

  initializeNeonFrameSettings() {
    this.updateNeonFrameSettingsUI();

    if (this.neonFrameSettingsListenersAttached) {
      return;
    }

    document.getElementById('neon-frame-toggle')?.addEventListener('change', (event) => {
      this.setNeonFramesEnabled(event.target.checked, { notify: true });
    });
    this.neonFrameSettingsListenersAttached = true;
  }

  updateNeonFrameSettingsUI() {
    this.setSettingToggleChecked('neon-frame-toggle', this.neonFramesEnabled);
    const statusEl = document.getElementById('neon-frame-status');
    if (statusEl) {
      statusEl.textContent = this.neonFramesEnabled
        ? 'Neon-Rahmen sind eingeschaltet.'
        : 'Neon-Rahmen sind ausgeschaltet.';
    }
  }

  setNeonFramesEnabled(enabled, options = {}) {
    this.neonFramesEnabled = Boolean(enabled);
    this.writeStoredBoolean(this.neonFrameStorageKey, this.neonFramesEnabled);
    this.updateNeonFrameSettingsUI();

    if (this.neonFramesEnabled) {
      this.refreshNeonFrameTargets();
      this.scheduleNeonFrameUpdate();
    } else {
      this.clearNeonFrameHotspots();
      this.removeNeonFrameTargets();
    }

    if (options.notify) {
      this.showNotification(this.neonFramesEnabled
        ? 'Neon-Rahmen eingeschaltet.'
        : 'Neon-Rahmen ausgeschaltet.');
    }
  }

  removeNeonFrameTargets() {
    document.querySelectorAll('.neon-frame-hotspot').forEach((element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      element.querySelectorAll(':scope > .neon-frame-curve, :scope > .neon-frame-light').forEach((overlay) => overlay.remove());
      element.classList.remove('neon-frame-hotspot');
    });
  }

  updateAutomationSettingsUI() {
    const autoUpdateToggle = document.getElementById('auto-update-mods');
    const requireDroppedModApprovalToggle = document.getElementById('require-dropped-mod-approval');
    const modrinthLimitSlider = document.getElementById('modrinth-results-limit-slider');
    const modrinthLimitValue = document.getElementById('modrinth-results-limit-value');
    const modrinthLimitStatus = document.getElementById('modrinth-results-limit-status');

    if (autoUpdateToggle) {
      this.setSettingToggleChecked(autoUpdateToggle, this.autoUpdateModsEnabled);
      autoUpdateToggle.title = this.autoUpdateModsEnabled
        ? 'Automatische Mod-Prüfung ist aktiv.'
        : 'Automatische Mod-Prüfung ist deaktiviert.';
    }


    if (requireDroppedModApprovalToggle) {
      this.setSettingToggleChecked(requireDroppedModApprovalToggle, this.requireDroppedModApprovalEnabled);
      requireDroppedModApprovalToggle.title = this.requireDroppedModApprovalEnabled
        ? 'Eigene Drag-and-drop-Mods müssen einzeln eingeschaltet werden.'
        : 'Eigene Drag-and-drop-Mods werden sofort aktiviert.';
    }

    if (modrinthLimitSlider) {
      modrinthLimitSlider.value = String(this.modrinthResultsLimit);
    }
    if (modrinthLimitValue) {
      modrinthLimitValue.textContent = String(this.modrinthResultsLimit);
    }
    if (modrinthLimitStatus) {
      modrinthLimitStatus.textContent = `${this.modrinthResultsLimit} Mods pro Suche.`;
    }
  }

  normalizeModrinthResultsLimit(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return 40;
    }
    return Math.min(40, Math.max(4, parsed));
  }

  readModrinthResultsLimit() {
    return this.normalizeModrinthResultsLimit(localStorage.getItem(this.modrinthResultsLimitStorageKey));
  }

  handleModrinthResultsLimitChange(value) {
    this.modrinthResultsLimit = this.normalizeModrinthResultsLimit(value);
    localStorage.setItem(this.modrinthResultsLimitStorageKey, String(this.modrinthResultsLimit));
    this.modrinthSearchCache.clear();
    this.updateAutomationSettingsUI();
    this.searchModrinthMods({ showLoading: false, forceRefresh: true });
  }

  handleAutoUpdateModsChange(enabled) {
    this.autoUpdateModsEnabled = Boolean(enabled);
    this.writeStoredBoolean(this.autoUpdateModsStorageKey, this.autoUpdateModsEnabled);
    this.updateAutomationSettingsUI();
    this.showNotification(this.autoUpdateModsEnabled
      ? 'Automatische Mod-Updates aktiviert.'
      : 'Automatische Mod-Updates deaktiviert.');
  }

  handleRequireDroppedModApprovalChange(enabled) {
    this.requireDroppedModApprovalEnabled = Boolean(enabled);
    this.writeStoredBoolean(this.requireDroppedModApprovalStorageKey, this.requireDroppedModApprovalEnabled);
    this.updateAutomationSettingsUI();
    this.showNotification(this.requireDroppedModApprovalEnabled
      ? 'Eigene Mods müssen nach dem Ablegen einzeln eingeschaltet werden.'
      : 'Eigene Mods werden nach dem Ablegen direkt aktiviert.');
  }

  readSoundVolume() {
    const storedRawValue = localStorage.getItem(this.soundVolumeStorageKey);
    if (storedRawValue === null) {
      return this.defaultSoundVolume;
    }

    const storedValue = Number(storedRawValue);
    if (!Number.isFinite(storedValue)) {
      return this.defaultSoundVolume;
    }

    let volumePercent = storedValue > 1 ? storedValue : storedValue * 100;
    const needsScaleMigration = localStorage.getItem(this.soundVolumeScaleStorageKey) !== this.soundVolumeScaleVersion;
    if (needsScaleMigration) {
      volumePercent /= 5;
    }

    volumePercent = Math.min(100, Math.max(0, volumePercent));
    if (needsScaleMigration) {
      localStorage.setItem(this.soundVolumeStorageKey, String(Math.round(volumePercent)));
      localStorage.setItem(this.soundVolumeScaleStorageKey, this.soundVolumeScaleVersion);
    }

    const normalizedValue = volumePercent / 100;
    return Math.min(1, Math.max(0, normalizedValue));
  }

  readClickSound() {
    const storedSound = localStorage.getItem(this.clickSoundStorageKey);
    return this.getClickSoundProfile(storedSound) ? storedSound : 'soft';
  }

  initializeSoundSettings() {
    const volumeSlider = document.getElementById('sound-volume-slider');
    const soundSelect = document.getElementById('click-sound-select');
    const previewButton = document.getElementById('sound-preview-btn');

    this.updateSoundSettingsUI();

    if (this.soundSettingsListenersAttached) {
      return;
    }

    volumeSlider?.addEventListener('input', () => this.handleSoundVolumeChange(false));
    volumeSlider?.addEventListener('change', () => this.handleSoundVolumeChange(true));
    soundSelect?.addEventListener('change', () => this.handleClickSoundChange());
    previewButton?.addEventListener('click', () => this.playButtonSound({ force: true }));
    this.soundSettingsListenersAttached = true;
  }

  updateSoundSettingsUI() {
    const volumePercent = Math.round((this.soundVolume || 0) * 100);
    const volumeSlider = document.getElementById('sound-volume-slider');
    const volumeValue = document.getElementById('sound-volume-value');
    const soundSelect = document.getElementById('click-sound-select');

    if (volumeSlider) {
      volumeSlider.value = String(volumePercent);
    }
    if (volumeValue) {
      volumeValue.textContent = `${volumePercent}%`;
    }
    if (soundSelect) {
      soundSelect.value = this.getClickSoundProfile(this.clickSound) ? this.clickSound : 'soft';
    }
  }

  handleSoundVolumeChange(playPreview = false) {
    const volumeSlider = document.getElementById('sound-volume-slider');
    const nextPercent = Math.min(100, Math.max(0, Number(volumeSlider?.value || 0)));
    this.soundVolume = nextPercent / 100;
    localStorage.setItem(this.soundVolumeStorageKey, String(nextPercent));
    localStorage.setItem(this.soundVolumeScaleStorageKey, this.soundVolumeScaleVersion);
    this.updateSoundSettingsUI();

    if (playPreview && this.soundVolume > 0) {
      this.playButtonSound({ force: true });
    }
  }

  handleClickSoundChange() {
    const soundSelect = document.getElementById('click-sound-select');
    const nextSound = this.getClickSoundProfile(soundSelect?.value) ? soundSelect.value : 'soft';
    this.clickSound = nextSound;
    localStorage.setItem(this.clickSoundStorageKey, nextSound);
    this.updateSoundSettingsUI();
    this.playButtonSound({ force: true });
  }

  async loadThemeConfig(options = {}) {
    if (typeof window.electronAPI?.getThemeConfig !== 'function') {
      return;
    }

    try {
      const result = await window.electronAPI.getThemeConfig();
      if (!result?.success) {
        return;
      }

      this.applyThemeConfigResult(result, {
        apply: options.apply === true,
        allowLocalColorSave: options.allowLocalColorSave !== false
      });
    } catch (error) {
      console.error('Theme config error:', error);
    }
  }

  applyThemeConfigResult(result, options = {}) {
    const rawConfigColor = this.normalizeHexColor(result.primaryColor) || '#00d9ff';
    const configRgb = this.hexToRgb(rawConfigColor);
    const visibleConfigRgb = this.keepAccentVisible(configRgb.r, configRgb.g, configRgb.b);
    const configColor = this.rgbToHex(visibleConfigRgb.r, visibleConfigRgb.g, visibleConfigRgb.b);
    const configThemeMode = result.themeMode === 'rgb' ? 'rgb' : 'manual';
    const resultAppearanceMode = this.normalizeAppearanceMode(result.appearanceMode);
    const localAppearanceMode = this.normalizeAppearanceMode(localStorage.getItem(this.appearanceModeStorageKey));
    const configAppearanceMode = localAppearanceMode === 'system' ? 'system' : resultAppearanceMode;
    const configBackgroundAnimation = this.normalizeBackgroundAnimation(result.backgroundAnimation);
    const nextSignature = `${configColor}|${configThemeMode}|${configAppearanceMode}|${configBackgroundAnimation}`;
    const signatureChanged = this.lastThemeConfigSignature && this.lastThemeConfigSignature !== nextSignature;
    this.lastThemeConfigSignature = nextSignature;
    let changed = false;

    if (result.configured && configColor && this.primaryColor !== configColor && !this.colorSaveTimer) {
      this.primaryColor = configColor;
      this.rgb = this.hexToRgb(this.primaryColor);
      localStorage.setItem('primaryColor', this.primaryColor);
      changed = true;
    }

    const nextRgbModeEnabled = configThemeMode === 'rgb';
    if (this.rgbModeEnabled !== nextRgbModeEnabled && !this.themeModeSaveTimer) {
      this.rgbModeEnabled = nextRgbModeEnabled;
      localStorage.setItem(this.themeModeStorageKey, this.rgbModeEnabled ? 'rgb' : 'manual');
      changed = true;
    }

    if (this.appearanceMode !== configAppearanceMode && !this.appearanceModeSaveTimer) {
      this.appearanceMode = configAppearanceMode;
      localStorage.setItem(this.appearanceModeStorageKey, this.appearanceMode);
      changed = true;
    }

    if (this.backgroundAnimation !== configBackgroundAnimation && !this.backgroundAnimationSaveTimer) {
      this.backgroundAnimation = configBackgroundAnimation;
      localStorage.setItem(this.backgroundAnimationStorageKey, this.backgroundAnimation);
      changed = true;
    }

    if (localAppearanceMode === 'system' && resultAppearanceMode !== 'system' && !this.appearanceModeSaveTimer) {
      this.scheduleAppearanceModeSave();
    }

    if (this.rgbModeEnabled && this.skinColorSyncEnabled) {
      this.skinColorSyncEnabled = false;
      localStorage.setItem(this.skinColorSyncStorageKey, 'false');
      changed = true;
    }

    if (!result.configured && this.primaryColor && options.allowLocalColorSave) {
      this.schedulePrimaryColorSave();
    }

    if (options.apply && (changed || signatureChanged)) {
      this.applyTheme();
      this.updateRGBDisplay();
    }
  }

  startThemeConfigSync() {
    if (this.themeConfigSyncTimer || typeof window.electronAPI?.getThemeConfig !== 'function') {
      return;
    }

    this.themeConfigSyncTimer = setInterval(() => {
      if (document.hidden) {
        return;
      }
      this.loadThemeConfig({ apply: true, allowLocalColorSave: false });
    }, 1500);
  }

  schedulePrimaryColorSave() {
    clearTimeout(this.colorSaveTimer);
    this.colorSaveTimer = setTimeout(() => {
      this.colorSaveTimer = null;
      this.savePrimaryColor();
    }, 150);
  }

  scheduleThemeModeSave() {
    clearTimeout(this.themeModeSaveTimer);
    this.themeModeSaveTimer = setTimeout(() => {
      this.themeModeSaveTimer = null;
      this.saveThemeMode();
    }, 150);
  }

  scheduleAppearanceModeSave() {
    clearTimeout(this.appearanceModeSaveTimer);
    this.appearanceModeSaveTimer = setTimeout(() => {
      this.appearanceModeSaveTimer = null;
      this.saveAppearanceMode();
    }, 150);
  }

  async savePrimaryColor() {
    try {
      await window.electronAPI.setPrimaryColor(this.primaryColor);
    } catch (error) {
      console.error('Color save error:', error);
    }
  }

  async saveThemeMode() {
    if (typeof window.electronAPI?.setThemeMode !== 'function') {
      return;
    }

    try {
      await window.electronAPI.setThemeMode(this.rgbModeEnabled ? 'rgb' : 'manual');
    } catch (error) {
      console.error('Theme mode save error:', error);
    }
  }

  async saveAppearanceMode() {
    if (typeof window.electronAPI?.setAppearanceMode !== 'function') {
      return;
    }

    try {
      await window.electronAPI.setAppearanceMode(this.appearanceMode);
    } catch (error) {
      console.error('Appearance mode save error:', error);
    }
  }

  setupTutorialEvents() {
    document.getElementById('tutorial-skip-btn')?.addEventListener('click', () => this.finishTutorial({ skipped: true }));
    document.getElementById('tutorial-prev-btn')?.addEventListener('click', () => this.previousTutorialStep());
    document.getElementById('tutorial-next-btn')?.addEventListener('click', () => this.nextTutorialStep());

    ['tutorial-red-slider', 'tutorial-green-slider', 'tutorial-blue-slider'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => this.handleTutorialColorChange());
    });

    document.getElementById('tutorial-overlay')?.addEventListener('pointerdown', (event) => {
      if (!event.target.closest('#tutorial-card')) {
        event.preventDefault();
      }
    });

    document.addEventListener('keydown', (event) => this.handleTutorialKeydown(event), true);
    window.addEventListener('resize', () => this.positionTutorialElements());
  }

  maybeStartFirstRunTutorial() {
    if (localStorage.getItem(this.tutorialStorageKey) === 'done') {
      return;
    }

    setTimeout(() => this.startTutorial(), 450);
  }

  createTutorialSteps() {
    const steps = [
      {
        id: 'color',
        type: 'color',
        title: 'Dein X Launcher',
        message: 'Wähle zuerst deine Design-Farbe. Du kannst sie später jederzeit in den Einstellungen ändern.',
        nextText: 'Farbe speichern'
      }
    ];

    if (!this.user) {
      steps.push(
        {
          id: 'login',
          screen: 'login',
          target: '#login-btn',
          title: 'Sicher anmelden',
          message: 'Melde dich über Microsoft an. X Launcher ist ein unabhängiger, inoffizieller Launcher und steht in keiner Verbindung zu Mojang oder Microsoft.'
        },
        {
          id: 'offline',
          screen: 'login',
          target: '#offline-btn',
          title: 'Offline spielen',
          message: 'Wenn du nur lokal testen willst, kannst du den Offline-Modus nutzen. Multiplayer funktioniert damit nur auf Offline-Mode-Servern.'
        }
      );
    }

    steps.push(
      {
        id: 'start',
        screen: 'main',
        section: 'dashboard',
        target: '#launch-btn',
        title: 'Minecraft direkt starten',
        message: 'Ein Klick startet Minecraft direkt mit dem ausgewählten Profil über X Launcher.'
      },
      {
        id: 'direct-server',
        screen: 'main',
        section: 'dashboard',
        target: '#start-server-list',
        title: 'Direkt auf Server',
        message: 'Gespeicherte Server-Favoriten erscheinen hier als Kacheln. Ein Klick startet das aktive Profil und verbindet direkt mit dem Server.'
      },
      {
        id: 'profile-select',
        screen: 'main',
        section: 'dashboard',
        target: '#start-pack-select',
        title: 'Aktives Profil',
        message: 'Das Standardprofil nutzt immer den normalen .minecraft/mods-Ordner. Zusätzliche Profile können weiterhin eigene Versionen und Mod-Sammlungen besitzen.'
      },
      {
        id: 'navigation',
        screen: 'main',
        section: 'dashboard',
        target: '.nav-menu',
        title: 'Navigation',
        message: 'Links wechselst du zwischen Start, Mods, Modrinth, Profilen, Servern, Skins und Einstellungen. Accounts öffnest du oben rechts über deinen Namen.'
      },
      {
        id: 'mods',
        screen: 'main',
        section: 'mods',
        target: '#mods-drop-zone',
        title: 'Mods verwalten',
        message: 'Ziehe Mod-JARs hier hinein oder verwalte installierte Mods. X Launcher achtet automatisch auf die Version des aktiven Profils.'
      },
      {
        id: 'modrinth',
        screen: 'main',
        section: 'modrinth',
        target: '.modrinth-panel',
        title: 'Modrinth Suche',
        message: 'Hier suchst du direkt nach Mods, Shadern und Ressourcenpaketen. Die Treffer werden passend zum aktiven Profil gefiltert.'
      },
      {
        id: 'packs',
        screen: 'main',
        section: 'packs',
        target: '.packs-layout',
        title: 'Profile',
        message: 'Profile trennen Versionen und Modlisten voneinander. So kannst du mehrere Setups behalten, ohne die Mods jedes Mal umzubauen.'
      },
      {
        id: 'server-favorites',
        screen: 'main',
        section: 'servers',
        target: '#server-host-input',
        title: 'Server-Favoriten',
        message: 'Im Server-Bereich speicherst du Name und Adresse deiner Lieblingsserver. Danach kannst du sie aus der Favoritenliste oder direkt von der Startseite starten.'
      },
      {
        id: 'server-list',
        screen: 'main',
        section: 'servers',
        target: '#servers-list',
        title: 'Favoriten verwalten',
        message: 'Gespeicherte Server lassen sich hier beitreten oder wieder löschen. Der Launcher nutzt beim Beitreten immer das aktuell ausgewählte Profil.'
      },
      {
        id: 'account-entry',
        screen: 'main',
        section: 'dashboard',
        target: '#username-display',
        highlightPadding: { x: 2, y: 2 },
        title: 'Account wechseln',
        message: 'Der Spielername oben rechts öffnet die Accountverwaltung. So wechselst du schnell zwischen gespeicherten Microsoft- und Offline-Accounts.'
      },
      {
        id: 'accounts',
        screen: 'main',
        section: 'accounts',
        target: '#add-microsoft-account-btn',
        title: 'Mehrere Accounts',
        message: 'Hier fügst du weitere Microsoft-Accounts hinzu. Neue Accounts werden gespeichert und direkt als aktiver Spieler übernommen.'
      },
      {
        id: 'offline-accounts',
        screen: 'main',
        section: 'accounts',
        target: '#offline-account-name-input',
        title: 'Offline-Accounts',
        message: 'Zusätzliche Offline-Accounts sind praktisch zum lokalen Testen. Online-Multiplayer funktioniert damit nur auf Offline-Mode-Servern.'
      },
      {
        id: 'saved-accounts',
        screen: 'main',
        section: 'accounts',
        target: '#accounts-list',
        title: 'Accountliste',
        message: 'In der Accountliste siehst du, welcher Account aktiv ist. Andere gespeicherte Accounts kannst du nutzen oder aus der Liste entfernen.'
      },
      {
        id: 'skins',
        screen: 'main',
        section: 'skins',
        target: '#choose-skin-btn',
        title: 'Skins',
        message: 'Im Skin-Bereich importierst du Skins, setzt gespeicherte Skins aktiv und wählst bei Bedarf Slim oder Wide.'
      },
      {
        id: 'settings',
        screen: 'main',
        section: 'settings',
        target: '#replay-tutorial-btn',
        title: 'Einstellungen',
        message: 'Hier änderst du Design, Sprache, Sound und Diagnose. Über diesen Button kannst du die Einführung jederzeit erneut starten.'
      },
      {
        id: 'finish',
        screen: 'main',
        section: 'dashboard',
        target: '#launch-btn',
        title: 'Fertig',
        message: 'Alles bereit. Wähle dein Profil und starte Minecraft direkt mit X Launcher.',
        nextText: 'Fertig'
      }
    );

    return steps;
  }

  startTutorial({ force = false } = {}) {
    if (this.tutorialActive) {
      return;
    }

    if (!force && localStorage.getItem(this.tutorialStorageKey) === 'done') {
      return;
    }

    this.tutorialOriginalState = this.getCurrentTutorialState();
    this.tutorialSteps = this.createTutorialSteps();
    this.tutorialStepIndex = 0;
    this.tutorialColorTouched = true;
    this.tutorialActive = true;

    const overlay = document.getElementById('tutorial-overlay');
    overlay?.classList.remove('hidden');
    overlay?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('tutorial-running');

    this.syncTutorialColorControls();
    this.renderTutorialStep();
  }

  getCurrentTutorialState() {
    return {
      screenId: document.querySelector('.screen.active')?.id || (this.user ? 'main-screen' : 'login-screen'),
      sectionId: document.querySelector('.content-section.active')?.id || 'dashboard'
    };
  }

  renderTutorialStep() {
    const step = this.tutorialSteps[this.tutorialStepIndex];
    if (!step) {
      this.finishTutorial();
      return;
    }

    this.prepareTutorialView(step);

    const titleEl = document.getElementById('tutorial-title');
    const messageEl = document.getElementById('tutorial-message');
    const stepLabelEl = document.getElementById('tutorial-step-label');
    const progressBar = document.getElementById('tutorial-progress-bar');
    const colorControls = document.getElementById('tutorial-color-controls');
    const prevButton = document.getElementById('tutorial-prev-btn');
    const nextButton = document.getElementById('tutorial-next-btn');

    if (titleEl) {
      titleEl.textContent = this.localizeText(step.title);
    }
    if (messageEl) {
      messageEl.textContent = this.localizeText(step.message);
    }
    if (stepLabelEl) {
      stepLabelEl.textContent = this.language === 'en'
        ? `Step ${this.tutorialStepIndex + 1} of ${this.tutorialSteps.length}`
        : `Schritt ${this.tutorialStepIndex + 1} von ${this.tutorialSteps.length}`;
    }
    if (progressBar) {
      progressBar.style.width = `${((this.tutorialStepIndex + 1) / this.tutorialSteps.length) * 100}%`;
    }
    colorControls?.classList.toggle('hidden', step.type !== 'color');
    if (prevButton) {
      prevButton.disabled = this.tutorialStepIndex === 0;
    }
    if (nextButton) {
      nextButton.textContent = this.localizeText(step.nextText || 'Weiter');
      nextButton.disabled = step.type === 'color' && !this.tutorialColorTouched;
    }

    this.syncTutorialColorControls();
    this.focusTutorialStep(step);
    this.scrollTutorialTargetIntoView(step);

    requestAnimationFrame(() => {
      this.positionTutorialElements();
      setTimeout(() => this.positionTutorialElements(), 90);
      setTimeout(() => this.positionTutorialElements(), 240);
      setTimeout(() => this.positionTutorialElements(), 430);
    });
  }

  scrollTutorialTargetIntoView(step) {
    if (!step.target) {
      return;
    }

    if (step.section === 'modrinth') {
      document.getElementById('modrinth')?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return;
    }

    const target = document.querySelector(step.target);
    if (!target || typeof target.scrollIntoView !== 'function') {
      return;
    }

    if (step.section === 'dashboard' || target.closest('#dashboard')) {
      return;
    }

    target.scrollIntoView({ block: 'center', inline: 'nearest' });
  }

  prepareTutorialView(step) {
    if (step.screen === 'login') {
      this.showLoginScreen();
      return;
    }

    if (step.screen === 'main') {
      this.showMainScreen();
    }

    if (step.section) {
      this.activateSection(step.section);
    }
  }

  activateSection(sectionId, options = {}) {
    if (sectionId === 'hosting' && !this.isHostingBetaEnabled()) {
      this.updateHostingBetaUI();
      sectionId = 'settings';
      this.showNotification('Hosting ist ausgeschaltet. Aktiviere den Schalter in den Einstellungen.');
    }

    if (sectionId === this.activeSectionId
      && document.getElementById(sectionId)?.classList.contains('active')) {
      return;
    }

    const broadcast = options.broadcast !== false;
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    const previousSectionId = this.activeSectionId || document.querySelector('.content-section.active')?.id || '';
    const navOrder = Array.from(navItems).map((navItem) => navItem.getAttribute('data-section'));
    const previousIndex = navOrder.indexOf(previousSectionId);
    const nextIndex = navOrder.indexOf(sectionId);
    const hasDirection = previousSectionId && previousSectionId !== sectionId && previousIndex !== -1 && nextIndex !== -1;
    const enterX = hasDirection && nextIndex < previousIndex ? '-10px' : (hasDirection ? '10px' : '0px');

    navItems.forEach((navItem) => {
      const isActive = navItem.getAttribute('data-section') === sectionId;
      navItem.classList.toggle('active', isActive);
      navItem.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        navItem.setAttribute('aria-current', 'page');
      } else {
        navItem.removeAttribute('aria-current');
      }
    });

    sections.forEach((section) => {
      const isActive = section.id === sectionId;
      section.classList.toggle('active', isActive);
      section.classList.remove('section-enter-forward', 'section-enter-back');

      if (isActive) {
        section.style.setProperty('--section-enter-x', enterX);
        section.classList.add(enterX === '-10px' ? 'section-enter-back' : 'section-enter-forward');
        this.prepareSectionMotion(section);
      }

      if (section.id === 'dashboard' && isActive) {
        section.scrollTop = 0;
      }
    });

    this.activeSectionId = sectionId;
    this.windowGroupState.activeSectionId = sectionId;
    this.refreshSectionFromPreloadedState(sectionId);
    if (sectionId === 'hosting') {
      this.closeHostedServerEditor();
    }
    if (broadcast && typeof window.electronAPI?.setWindowActiveSection === 'function') {
      window.electronAPI.setWindowActiveSection(sectionId).catch((error) => {
        console.error('Window section broadcast error:', error);
      });
    }
    this.scheduleScrollFadeUpdate();
  }

  refreshSectionFromPreloadedState(sectionId) {
    // A section change may require a layout pass because hidden sections have
    // no usable viewport dimensions. This method only renders cached startup
    // state; it never reads files or starts a network request.
    switch (sectionId) {
      case 'dashboard':
        this.renderStartPackSelect();
        this.renderStartServerList();
        this.updateMinecraftStatus();
        break;
      case 'mods':
        this.renderMods();
        this.updateModsCheckStatus();
        break;
      case 'modrinth':
        this.renderModrinthResults({ force: true });
        this.updateModrinthSearchStatus();
        break;
      case 'packs':
        this.renderPacks();
        break;
      case 'servers':
        this.renderServerFavorites();
        break;
      case 'hosting':
        this.updateHostedServerStatus(this.hostedServerStatus || {});
        break;
      case 'skins':
        this.updateSkinUI();
        this.renderAccounts();
        break;
      case 'settings':
        this.syncLanguageSettingsUI();
        this.updateMicrosoftConfigUI();
        break;
      default:
        break;
    }
  }

  focusTutorialStep(step) {
    const nextButton = document.getElementById('tutorial-next-btn');
    const redSlider = document.getElementById('tutorial-red-slider');

    setTimeout(() => {
      if (!this.tutorialActive) {
        return;
      }

      if (step.type === 'color' && redSlider) {
        redSlider.focus();
        return;
      }

      nextButton?.focus();
    }, 80);
  }

  positionTutorialElements() {
    if (!this.tutorialActive) {
      return;
    }

    const step = this.tutorialSteps[this.tutorialStepIndex];
    const card = document.getElementById('tutorial-card');
    const highlight = document.getElementById('tutorial-highlight');
    const arrow = document.getElementById('tutorial-arrow');
    if (!step || !card || !highlight || !arrow) {
      return;
    }

    const target = step.target ? document.querySelector(step.target) : null;
    const targetRect = target?.getBoundingClientRect();
    const hasTarget = Boolean(targetRect && targetRect.width > 0 && targetRect.height > 0);

    if (!hasTarget) {
      highlight.classList.remove('visible');
      arrow.classList.remove('visible');
      this.positionTutorialBlurPanes();
      this.centerTutorialCard(card);
      return;
    }

    const targetPadding = this.getTutorialTargetPadding(step);
    const rect = this.getTutorialTargetRect(targetRect, targetPadding);
    const targetStyle = window.getComputedStyle(target);

    highlight.style.left = `${rect.left}px`;
    highlight.style.top = `${rect.top}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    const highlightRadius = this.getTutorialHighlightRadius(targetStyle, rect, targetPadding);
    highlight.style.borderRadius = `${highlightRadius}px`;
    highlight.classList.add('visible');

    this.positionTutorialBlurPanes(rect, highlightRadius);
    this.placeTutorialCard(card, rect);
    this.placeTutorialArrow(arrow, rect, card.getBoundingClientRect());
  }

  toDevicePixel(value) {
    const ratio = window.devicePixelRatio || 1;
    return Math.round(value * ratio) / ratio;
  }

  getPixelPerfectRect(domRect) {
    const left = this.toDevicePixel(Math.max(0, domRect.left));
    const top = this.toDevicePixel(Math.max(0, domRect.top));
    const right = this.toDevicePixel(Math.min(window.innerWidth, domRect.right));
    const bottom = this.toDevicePixel(Math.min(window.innerHeight, domRect.bottom));

    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top)
    };
  }

  getTutorialTargetPadding(step) {
    const minimumPadding = 10;
    const padding = step?.highlightPadding ?? 0;
    if (typeof padding === 'number') {
      return {
        top: minimumPadding + padding,
        right: minimumPadding + padding,
        bottom: minimumPadding + padding,
        left: minimumPadding + padding
      };
    }

    const x = Number(padding.x ?? 0);
    const y = Number(padding.y ?? 0);
    return {
      top: minimumPadding + (Number(padding.top ?? y) || 0),
      right: minimumPadding + (Number(padding.right ?? x) || 0),
      bottom: minimumPadding + (Number(padding.bottom ?? y) || 0),
      left: minimumPadding + (Number(padding.left ?? x) || 0)
    };
  }

  getTutorialTargetRect(domRect, padding = this.getTutorialTargetPadding()) {
    return this.getPixelPerfectRect({
      left: domRect.left - padding.left,
      top: domRect.top - padding.top,
      right: domRect.right + padding.right,
      bottom: domRect.bottom + padding.bottom
    });
  }

  getTutorialHighlightRadius(targetStyle, targetRect, padding = this.getTutorialTargetPadding()) {
    const rawRadius = targetStyle?.borderTopLeftRadius || targetStyle?.borderRadius || '';
    const parsedRadius = Number.parseFloat(rawRadius);
    const targetRadius = Number.isFinite(parsedRadius) ? parsedRadius : 0;
    const radiusOffset = Math.max(padding.top, padding.right, padding.bottom, padding.left);
    const maxRadius = Math.max(0, Math.min(targetRect.width, targetRect.height) / 2);
    const radius = Math.min(24, maxRadius, targetRadius > 0 ? targetRadius + radiusOffset : 12);
    return this.toDevicePixel(radius);
  }

  positionTutorialBlurPanes(targetRect = null, targetRadius = 0) {
    const panes = {
      top: document.querySelector('.tutorial-blur-top'),
      right: document.querySelector('.tutorial-blur-right'),
      bottom: document.querySelector('.tutorial-blur-bottom'),
      left: document.querySelector('.tutorial-blur-left')
    };
    const corners = {
      topLeft: document.querySelector('.tutorial-blur-corner-top-left'),
      topRight: document.querySelector('.tutorial-blur-corner-top-right'),
      bottomLeft: document.querySelector('.tutorial-blur-corner-bottom-left'),
      bottomRight: document.querySelector('.tutorial-blur-corner-bottom-right')
    };
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const setPane = (pane, left, top, width, height) => {
      if (!pane) {
        return;
      }

      pane.style.left = `${this.toDevicePixel(Math.max(0, left))}px`;
      pane.style.top = `${this.toDevicePixel(Math.max(0, top))}px`;
      pane.style.width = `${this.toDevicePixel(Math.max(0, width))}px`;
      pane.style.height = `${this.toDevicePixel(Math.max(0, height))}px`;
    };

    const setCorner = (corner, left, top, radius) => {
      if (!corner) {
        return;
      }

      const size = this.toDevicePixel(Math.max(0, radius));
      corner.style.left = `${this.toDevicePixel(Math.max(0, left))}px`;
      corner.style.top = `${this.toDevicePixel(Math.max(0, top))}px`;
      corner.style.width = `${size}px`;
      corner.style.height = `${size}px`;
      corner.style.setProperty('--tutorial-corner-radius', `${size}px`);
    };

    if (!targetRect) {
      setPane(panes.top, 0, 0, viewportWidth, viewportHeight);
      setPane(panes.right, 0, 0, 0, 0);
      setPane(panes.bottom, 0, 0, 0, 0);
      setPane(panes.left, 0, 0, 0, 0);
      Object.values(corners).forEach((corner) => setCorner(corner, 0, 0, 0));
      return;
    }

    setPane(panes.top, 0, 0, viewportWidth, targetRect.top);
    setPane(panes.bottom, 0, targetRect.bottom, viewportWidth, viewportHeight - targetRect.bottom);
    setPane(panes.left, 0, targetRect.top, targetRect.left, targetRect.height);
    setPane(panes.right, targetRect.right, targetRect.top, viewportWidth - targetRect.right, targetRect.height);

    const radius = Math.min(targetRadius, targetRect.width / 2, targetRect.height / 2);
    setCorner(corners.topLeft, targetRect.left, targetRect.top, radius);
    setCorner(corners.topRight, targetRect.right - radius, targetRect.top, radius);
    setCorner(corners.bottomLeft, targetRect.left, targetRect.bottom - radius, radius);
    setCorner(corners.bottomRight, targetRect.right - radius, targetRect.bottom - radius, radius);
  }

  centerTutorialCard(card) {
    const cardRect = card.getBoundingClientRect();
    const left = Math.max(16, (window.innerWidth - cardRect.width) / 2);
    const top = Math.max(16, (window.innerHeight - cardRect.height) / 2);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  placeTutorialCard(card, targetRect) {
    const margin = 16;
    const gap = 28;
    const cardRect = card.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left;
    let top;

    if (targetRect.right + gap + cardRect.width <= viewportWidth - margin) {
      left = targetRect.right + gap;
      top = targetRect.top + (targetRect.height / 2) - (cardRect.height / 2);
    } else if (targetRect.left - gap - cardRect.width >= margin) {
      left = targetRect.left - gap - cardRect.width;
      top = targetRect.top + (targetRect.height / 2) - (cardRect.height / 2);
    } else if (targetRect.bottom + gap + cardRect.height <= viewportHeight - margin) {
      left = targetRect.left + (targetRect.width / 2) - (cardRect.width / 2);
      top = targetRect.bottom + gap;
    } else {
      left = targetRect.left + (targetRect.width / 2) - (cardRect.width / 2);
      top = targetRect.top - gap - cardRect.height;
    }

    left = Math.min(Math.max(margin, left), viewportWidth - cardRect.width - margin);
    top = Math.min(Math.max(margin, top), viewportHeight - cardRect.height - margin);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  placeTutorialArrow(arrow, targetRect, cardRect) {
    const start = {
      x: targetRect.left + (targetRect.width / 2),
      y: targetRect.top + (targetRect.height / 2)
    };
    const end = {
      x: cardRect.left + (cardRect.width / 2),
      y: cardRect.top + (cardRect.height / 2)
    };
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distance = Math.max(36, Math.sqrt((deltaX * deltaX) + (deltaY * deltaY)) - 28);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    arrow.style.left = `${start.x}px`;
    arrow.style.top = `${start.y}px`;
    arrow.style.width = `${distance}px`;
    arrow.style.transform = `rotate(${angle}deg)`;
    arrow.classList.add('visible');
  }

  syncTutorialColorControls() {
    const controls = [
      { slider: 'tutorial-red-slider', label: 'tutorial-red-value', value: this.rgb.r },
      { slider: 'tutorial-green-slider', label: 'tutorial-green-value', value: this.rgb.g },
      { slider: 'tutorial-blue-slider', label: 'tutorial-blue-value', value: this.rgb.b }
    ];

    controls.forEach((control) => {
      const slider = document.getElementById(control.slider);
      const label = document.getElementById(control.label);
      if (slider && document.activeElement !== slider) {
        slider.value = control.value;
      }
      if (label) {
        label.textContent = control.value;
      }
    });

    const preview = document.getElementById('tutorial-color-preview');
    if (preview) {
      preview.style.background = this.primaryColor;
    }

    const requiredText = document.getElementById('tutorial-color-required');
    if (requiredText) {
      requiredText.textContent = this.localizeText(this.tutorialColorTouched
        ? 'Diese Farbe wird als Startfarbe verwendet. Du kannst sie behalten oder mit den Reglern ändern.'
        : 'Wähle eine Farbe oder behalte die bereits eingestellte Startfarbe.');
    }
  }

  handleTutorialColorChange() {
    const redSlider = document.getElementById('tutorial-red-slider');
    const greenSlider = document.getElementById('tutorial-green-slider');
    const blueSlider = document.getElementById('tutorial-blue-slider');
    if (!redSlider || !greenSlider || !blueSlider) {
      return;
    }

    this.rgb = this.keepAccentVisible(
      parseInt(redSlider.value, 10),
      parseInt(greenSlider.value, 10),
      parseInt(blueSlider.value, 10)
    );
    redSlider.value = this.rgb.r;
    greenSlider.value = this.rgb.g;
    blueSlider.value = this.rgb.b;
    this.primaryColor = this.rgbToHex(this.rgb.r, this.rgb.g, this.rgb.b);
    this.tutorialColorTouched = true;
    if (this.rgbModeEnabled) {
      this.setRgbModeEnabled(false, { apply: false });
    }

    localStorage.setItem('primaryColor', this.primaryColor);
    this.applyTheme();
    this.updateRGBDisplay();
    this.syncTutorialColorControls();
    this.schedulePrimaryColorSave();

    const nextButton = document.getElementById('tutorial-next-btn');
    if (nextButton) {
      nextButton.disabled = false;
    }
  }

  nextTutorialStep() {
    const step = this.tutorialSteps[this.tutorialStepIndex];
    if (step?.type === 'color' && !this.tutorialColorTouched) {
      this.showNotification('Bitte zuerst eine Farbe einstellen.');
      return;
    }

    if (this.tutorialStepIndex >= this.tutorialSteps.length - 1) {
      this.finishTutorial();
      return;
    }

    this.tutorialStepIndex += 1;
    this.renderTutorialStep();
  }

  previousTutorialStep() {
    if (this.tutorialStepIndex <= 0) {
      return;
    }

    this.tutorialStepIndex -= 1;
    this.renderTutorialStep();
  }

  finishTutorial({ skipped = false } = {}) {
    if (!this.tutorialActive) {
      return;
    }

    localStorage.setItem(this.tutorialStorageKey, 'done');
    this.tutorialActive = false;
    document.body.classList.remove('tutorial-running');

    const overlay = document.getElementById('tutorial-overlay');
    overlay?.classList.add('hidden');
    overlay?.setAttribute('aria-hidden', 'true');
    document.getElementById('tutorial-highlight')?.classList.remove('visible');
    document.getElementById('tutorial-arrow')?.classList.remove('visible');

    this.restoreTutorialState();
    this.showNotification(skipped ? 'Tutorial übersprungen. Du kannst es in den Einstellungen erneut starten.' : 'Tutorial abgeschlossen. Du kannst es in den Einstellungen erneut starten.');
  }

  restoreTutorialState() {
    const state = this.tutorialOriginalState;
    this.tutorialOriginalState = null;
    if (!state) {
      return;
    }

    if (state.screenId === 'login-screen' || !this.user) {
      this.showLoginScreen();
    } else {
      this.showMainScreen();
    }

    this.activateSection(state.sectionId || 'dashboard');
  }

  handleTutorialKeydown(event) {
    if (!this.tutorialActive) {
      return;
    }

    const overlay = document.getElementById('tutorial-overlay');
    if (!overlay) {
      return;
    }

    if (!overlay.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      document.getElementById('tutorial-next-btn')?.focus();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = Array.from(overlay.querySelectorAll('button:not(:disabled), input:not(:disabled)'));
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async loadUserInfo() {
    try {
      this.updateLoadingState({
        text: 'Profil...',
        progress: 54
      });
      this.user = setCurrentUser(await window.electronAPI.getUserInfo());
      if (this.user) {
        this.updateLoadingPlayerName(this.user.username);
        this.showMainScreen();
        try {
          await this.loadGameData();
        } catch (error) {
          console.error('Background game data initialization failed:', error);
          this.showNotification('Minecraft-Daten konnten nicht vollständig geladen werden: ' + error.message);
        } finally {
          if (!this.startupDataReady) {
            this.startupDataReady = true;
            this.startupFolderRefreshSuppressedUntil = Date.now() + 2500;
          }
        }
      } else {
        this.startupDataReady = true;
        this.updateLoadingState({
          text: 'Login.',
          progress: 92
        });
        this.showLoginScreen();
      }
    } catch (error) {
      console.error('Error loading user info:', error);
      this.updateLoadingState({
        text: 'Login.',
        progress: 92
      });
      this.showLoginScreen();
    }
  }

  async loadGameData() {
    this.startupDataReady = false;
    this.startupFolderChangePending = false;
    this.updateLoadingState({
      text: 'Minecraft...',
      progress: 68
    });
    this.minecraftPath = await window.electronAPI.getMinecraftPath();
    this.updateLoadingState({
      text: 'Versionen...',
      progress: 74
    });
    const launcherUpdatePromise = this.checkLauncherUpdates();
    this.updateLoadingState({
      text: 'Profile...',
      progress: 82
    });
    await this.refreshPackContext({ reloadSearch: false });
    const minecraftPathEl = document.getElementById('minecraft-path');
    if (minecraftPathEl) {
      minecraftPathEl.textContent = this.minecraftPath || 'Nicht gefunden';
    }
    const minecraftWindowsUserInput = document.getElementById('minecraft-windows-user-input');
    if (minecraftWindowsUserInput) {
      minecraftWindowsUserInput.value = this.getWindowsUserNameFromMinecraftPath(this.minecraftPath);
    }
    const changePathBtn = document.getElementById('change-path-btn');
    if (changePathBtn) {
      changePathBtn.disabled = false;
    }
    this.updateLoadingState({ text: 'Server-Favoriten...', progress: 82 });
    await this.loadServerFavorites();
    this.updateLoadingState({ text: 'Launcher-Daten...', progress: 86 });
    this.updateModrinthTypeUI();
    this.initializeRGBSliders();
    await Promise.allSettled([
      this.searchModrinthMods({ showLoading: false }),
      this.loadSkinConfig(),
      this.loadAccounts(),
      this.loadHostedServerStatus(),
      this.loadStandardModsPath(),
      this.loadDiagnosticSettings(),
      this.loadAuthConfig(),
      launcherUpdatePromise
    ]);
    this.updateLoadingState({ text: 'Symbole...', progress: 94 });
    await this.preloadStartupContentIcons();
    this.loadedSections = new Set(['dashboard', 'mods', 'modrinth', 'packs', 'servers', 'hosting', 'skins', 'settings']);
    this.startupFolderChangePending = false;
    this.startupDataReady = true;
    this.startupFolderRefreshSuppressedUntil = Date.now() + 2500;
    this.updateLoadingState({
      text: 'Bereit.',
      progress: 98
    });

    this.scheduleScrollFadeUpdate();
    this.scheduleReactBitsMotionUpdate();
  }

  async checkLauncherUpdates() {
    if (typeof window.electronAPI?.checkLauncherUpdates !== 'function') {
      return;
    }

    try {
      const result = await window.electronAPI.checkLauncherUpdates();
      if (!result?.success) {
        if (result?.error) {
          console.warn('Launcher update check failed:', result.error);
        }
        return;
      }

      if (result.changed) {
        this.showNotification(result.message || 'Launcher-Standard wurde aktualisiert.');
      }
    } catch (error) {
      console.warn('Launcher update check failed:', error);
    }
  }

  setupEventListeners() {
    this.setupButtonFeedback();
    this.initializeAppearanceModeSetting();
    this.initializeRgbModeSetting();
    this.initializeBackgroundAnimationSetting();
    this.initializeSkinColorSyncSetting();
    this.initializeAutomationSettings();
    this.initializeNeonFrameSettings();
    this.initializeSettingToggleStateSync();
    this.setupLanguageSettings();
    this.setupHostingBetaGate();

    document.getElementById('login-btn')?.addEventListener('click', () => this.handleLogin());
    document.getElementById('window-minimize-btn')?.addEventListener('click', () => this.minimizeWindow());
    document.getElementById('window-maximize-btn')?.addEventListener('click', () => this.toggleMaximizeWindow());
    document.getElementById('window-close-btn')?.addEventListener('click', () => this.closeWindow());
    document.getElementById('confirm-cancel-btn')?.addEventListener('click', () => this.resolveConfirm(false));
    document.getElementById('confirm-ok-btn')?.addEventListener('click', () => this.resolveConfirm(true));
    document.getElementById('confirm-modal')?.addEventListener('click', (event) => {
      if (event.target?.id === 'confirm-modal') {
        this.resolveConfirm(false);
      }
    });
    document.getElementById('skin-variant-slim-btn')?.addEventListener('click', () => this.resolveSkinVariantChoice('slim'));
    document.getElementById('skin-variant-wide-btn')?.addEventListener('click', () => this.resolveSkinVariantChoice('classic'));
    document.getElementById('skin-variant-cancel-btn')?.addEventListener('click', () => this.resolveSkinVariantChoice(null));
    document.getElementById('skin-variant-modal')?.addEventListener('click', (event) => {
      if (event.target?.id === 'skin-variant-modal') {
        this.resolveSkinVariantChoice(null);
      }
    });
    document.addEventListener('keydown', (event) => this.handleConfirmKeydown(event));
    document.addEventListener('mousemove', (event) => this.updateDashboardSkinHeadTarget(event));

    document.getElementById('launch-btn')?.addEventListener('click', () => this.launchMinecraft());
    document.getElementById('open-mods-btn')?.addEventListener('click', () => this.switchSection('mods'));
    document.getElementById('install-fabric-btn')?.addEventListener('click', () => this.installFabric());
    document.getElementById('load-mods-folder-btn')?.addEventListener('click', () => this.loadModsFolder());
    document.getElementById('mods-profile-version-select')?.addEventListener('change', (event) => {
      this.changeActiveProfileVersion(event.target?.value || '');
    });
    this.setupModsDragAndDrop();
    document.addEventListener('click', (event) => this.handleGlobalActionClick(event));
    if (typeof window.electronAPI?.onModFolderChanged === 'function') {
      window.electronAPI.onModFolderChanged(() => {
        if (!this.startupDataReady) {
          this.startupFolderChangePending = true;
          return;
        }
        if (Date.now() < this.startupFolderRefreshSuppressedUntil) {
          return;
        }
        if (this.pendingModrinthInstalls.size
          || this.pendingModRemovals.size
          || Date.now() < Number(this.suppressOwnModFolderRefreshUntil || 0)) {
          return;
        }
        this.loadMods({
          skipManagedSync: Date.now() < Number(this.suppressModSyncUntil || 0)
        }).catch((error) => console.error('Background mod folder refresh failed:', error));
      });
    }
    document.getElementById('modrinth-search-btn')?.addEventListener('click', () => this.submitModrinthSearch());
    document.getElementById('modrinth-search-input')?.addEventListener('input', () => {
      this.hideModrinthSuggestions();
      this.scheduleModrinthInstantSearch();
    });
    document.getElementById('modrinth-search-input')?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.submitModrinthSearch();
      }
    });
    document.getElementById('modrinth-version-filter')?.addEventListener('change', () => this.handleModrinthVersionFilterChange());
    document.getElementById('modrinth-type-tabs')?.addEventListener('click', (event) => this.handleModrinthTypeChange(event));
    document.getElementById('modrinth-results')?.addEventListener('click', (event) => this.handleModrinthResultsClick(event));
    document.getElementById('modrinth-results')?.addEventListener('change', (event) => this.handleModrinthResultsChange(event));
    document.getElementById('modrinth')?.addEventListener('scroll', () => {
      const scrollHost = document.getElementById('modrinth');
      const now = performance.now();
      const elapsed = Math.max(1, now - Number(this.modrinthLastScrollAt || now));
      const distance = Math.abs(Number(scrollHost?.scrollTop || 0) - Number(this.modrinthLastScrollTop || 0));
      const velocity = distance / elapsed;
      this.modrinthPrefetchItems = velocity > 2.2 ? 12 : (velocity > 0.8 ? 8 : 4);
      this.modrinthLastScrollTop = Number(scrollHost?.scrollTop || 0);
      this.modrinthLastScrollAt = now;
      // Loading must not depend on requestAnimationFrame: Chromium throttles
      // animation frames for occluded windows, while scroll events still fire.
      this.scheduleModrinthPrefetch();
      if (this.modrinthVirtualScrollFrame) {
        return;
      }
      const renderVirtualWindow = () => {
        if (!this.modrinthVirtualScrollFrame) return;
        window.cancelAnimationFrame(this.modrinthVirtualScrollFrame);
        this.modrinthVirtualScrollFrame = null;
        if (this.modrinthVirtualScrollTimer) {
          window.clearTimeout(this.modrinthVirtualScrollTimer);
          this.modrinthVirtualScrollTimer = null;
        }
        this.renderModrinthResults({ virtualScroll: true });
      };
      this.modrinthVirtualScrollFrame = window.requestAnimationFrame(renderVirtualWindow);
      // Fallback for minimized/occluded Electron windows where rAF is throttled.
      this.modrinthVirtualScrollTimer = window.setTimeout(renderVirtualWindow, 50);
    }, { passive: true });
    document.getElementById('mods-view-tabs')?.addEventListener('click', (event) => this.handleModsViewChange(event));
    document.getElementById('mods-list')?.addEventListener('click', (event) => this.handleModsListClick(event));
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.installed-mod-menu-wrap')) {
        this.closeInstalledModMenus();
      }
    });
    document.getElementById('packs-list')?.addEventListener('change', (event) => this.handlePacksListChange(event));
    document.getElementById('create-pack-btn')?.addEventListener('click', () => this.createPack());
    document.getElementById('pack-name-input')?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.createPack();
      }
    });
    document.getElementById('packs-list')?.addEventListener('click', (event) => this.handlePacksListClick(event));
    document.getElementById('start-pack-select')?.addEventListener('change', (event) => this.handleStartPackChange(event));
    document.getElementById('start-server-list')?.addEventListener('click', (event) => this.handleStartServerClick(event));
    document.getElementById('username-display')?.addEventListener('click', () => this.openAccountSwitcher());
    document.getElementById('add-server-btn')?.addEventListener('click', () => this.addServerFavorite());
    document.getElementById('server-host-input')?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.addServerFavorite();
      }
    });
    document.getElementById('servers-list')?.addEventListener('click', (event) => this.handleServerListClick(event));
    document.getElementById('hosted-server-create-btn')?.addEventListener('click', () => this.openHostedServerCreateForm());
    document.getElementById('oracle-hosting-refresh-btn')?.addEventListener('click', () => this.loadHostedServerStatus());
    document.getElementById('oracle-browser-login-btn')?.addEventListener('click', () => this.loginOracleCloud());
    document.getElementById('oracle-logout-btn')?.addEventListener('click', () => this.logoutOracleCloud());
    document.getElementById('hosted-server-final-create-btn')?.addEventListener('click', () => this.createHostedServer());
    document.getElementById('hosted-server-cancel-create-btn')?.addEventListener('click', () => this.closeHostedServerEditor());
    document.getElementById('hosted-server-save-btn')?.addEventListener('click', () => this.saveHostedServer());
    document.getElementById('hosted-server-list')?.addEventListener('click', (event) => this.handleHostedServerListClick(event));
    document.getElementById('hosted-server-start-btn')?.addEventListener('click', () => {
      if (this.hostedServerStatus?.running || this.hostedServerStatus?.stopping) {
        this.stopHostedServer();
      } else {
        this.startHostedServer();
      }
    });
    document.getElementById('hosted-server-restart-btn')?.addEventListener('click', () => this.restartHostedServer());
    document.getElementById('oracle-vm-stop-btn')?.addEventListener('click', () => this.runHostedVmAction('STOP'));
    document.getElementById('oracle-vm-reboot-btn')?.addEventListener('click', () => this.runHostedVmAction('RESET'));
    document.getElementById('hosted-server-delete-btn')?.addEventListener('click', () => this.deleteActiveHostedServer());
    document.getElementById('hosted-server-copy-address-btn')?.addEventListener('click', () => this.copyHostedServerAddress());
    document.getElementById('hosted-server-router-btn')?.addEventListener('click', async () => {
      if (typeof window.electronAPI?.configureSwisscomPortForwarding !== 'function') return;
      let password = await this.showRouterPasswordPrompt();
      if (!password) return;
      this.showLoading('Router-Portfreigabe wird eingerichtet...', { progress: 35 });
      try {
        const activeServer = this.hostedServerStatus?.activeServer || {};
        const result = await window.electronAPI.configureSwisscomPortForwarding({
          password,
          localIp: this.hostedServerStatus?.upnp?.localIp || '192.168.0.12',
          internalPort: activeServer.port || 25565
        });
        if (!result?.success) {
          this.showNotification(result?.error || 'Router-Portfreigabe fehlgeschlagen.');
          if (/CGNAT|Shared Address Space/iu.test(result?.error || '')) {
            const routerButton = document.getElementById('hosted-server-router-btn');
            if (routerButton) {
              routerButton.textContent = 'Öffentliche IPv4 erforderlich';
              routerButton.disabled = true;
            }
            const fallbackAddress = document.getElementById('hosted-server-fallback-address');
            if (fallbackAddress) fallbackAddress.textContent = result.error;
          }
          return;
        }
        this.showNotification(result.message || 'Router-Portfreigabe wurde erstellt.');
        const refreshed = await window.electronAPI.configureDirectHosting(this.activeHostedServerId);
        this.updateHostedServerStatus(refreshed);
      } catch (error) {
        this.showNotification('Router-Konfiguration fehlgeschlagen: ' + error.message);
      } finally {
        password = '';
        this.hideLoading();
      }
    });
    document.getElementById('router-password-cancel-btn')?.addEventListener('click', () => this.resolveRouterPasswordPrompt(''));
    document.getElementById('router-password-ok-btn')?.addEventListener('click', () => {
      this.resolveRouterPasswordPrompt(document.getElementById('router-password-input')?.value || '');
    });
    document.getElementById('router-password-input')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') this.resolveRouterPasswordPrompt(event.currentTarget.value || '');
      if (event.key === 'Escape') this.resolveRouterPasswordPrompt('');
    });
    document.getElementById('hosted-server-command-send-btn')?.addEventListener('click', () => this.sendHostedServerCommand());
    document.getElementById('hosted-server-command-input')?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.sendHostedServerCommand();
      }
    });
    document.getElementById('hosting-player-search')?.addEventListener('input', (event) => {
      this.hostedPlayerSearch = event.target?.value || '';
      this.renderHostingPlayers(this.hostedServerStatus);
    });
    document.getElementById('hosting-player-sort')?.addEventListener('change', (event) => {
      this.hostedPlayerSort = event.target?.value || 'name';
      this.renderHostingPlayers(this.hostedServerStatus);
    });
    document.getElementById('hosting-player-list')?.addEventListener('click', (event) => this.handleHostingPlayerAction(event));
    document.getElementById('hosting-ban-list')?.addEventListener('click', (event) => this.handleHostingPlayerAction(event));
    document.getElementById('hosting-console-search')?.addEventListener('input', (event) => {
      this.hostingConsoleSearch = event.target?.value || '';
      this.renderHostingConsole(this.hostedServerStatus);
    });
    document.getElementById('hosting-refresh-bans-btn')?.addEventListener('click', () => this.requestHostingBanList());
    document.getElementById('hosting-unban-btn')?.addEventListener('click', () => this.unbanHostingPlayer());
    document.getElementById('hosting-plugin-upload-input')?.addEventListener('change', (event) => this.importHostedServerMods(event));
    document.getElementById('hosting-file-list')?.addEventListener('click', (event) => this.handleHostedServerModsClick(event));
    document.getElementById('hosting-open-folder-btn')?.addEventListener('click', () => this.openHostedServerFolder());
    document.getElementById('hosting-create-backup-btn')?.addEventListener('click', () => this.createHostedServerBackup());
    document.getElementById('hosting-restore-backup-btn')?.addEventListener('click', () => this.restoreHostedServerBackup());
    document.getElementById('hosting-unban-input')?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.unbanHostingPlayer();
      }
    });
    [
      'hosted-server-name-input',
      'hosted-server-edition-select',
      'hosted-server-software-select',
      'hosted-server-version-input',
      'hosted-server-ram-input',
      'hosted-server-port-input',
      'hosted-server-max-players-input',
      'hosted-server-difficulty-select',
      'hosted-server-gamemode-select',
      'hosted-server-motd-input',
      'hosted-server-view-distance-input',
      'hosted-server-simulation-distance-input',
      'hosted-server-spawn-protection-input',
      'hosted-server-pvp-checkbox',
      'hosted-server-whitelist-checkbox',
      'hosted-server-online-mode-checkbox',
      'hosted-server-command-block-checkbox',
      'hosted-server-eula-checkbox'
    ].forEach((id) => {
      const element = document.getElementById(id);
      const eventName = element?.type === 'checkbox' || element?.tagName === 'SELECT' ? 'change' : 'input';
      element?.addEventListener(eventName, () => this.markHostedServerDirty());
    });
    document.getElementById('hosted-server-edition-select')?.addEventListener('change', () => this.updateHostedServerSoftwareOptions());
    document.getElementById('hosted-server-software-select')?.addEventListener('change', () => this.updateHostedServerSoftwareOptions());
    document.getElementById('add-microsoft-account-btn')?.addEventListener('click', () => this.addMicrosoftAccount());
    document.getElementById('add-offline-account-btn')?.addEventListener('click', () => this.addOfflineAccount());
    document.getElementById('offline-account-name-input')?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.addOfflineAccount();
      }
    });
    document.getElementById('accounts-list')?.addEventListener('click', (event) => this.handleAccountsListClick(event));
    document.getElementById('choose-skin-btn')?.addEventListener('click', () => this.chooseSkin());
    document.getElementById('clear-skin-btn')?.addEventListener('click', () => this.clearSkin());
    document.getElementById('skins-list')?.addEventListener('click', (event) => this.handleSkinListClick(event));
    document.getElementById('refresh-versions-btn')?.addEventListener('click', () => this.refreshVersions());
    document.getElementById('download-version-btn')?.addEventListener('click', () => this.downloadSelectedVersion());
    document.getElementById('version-select')?.addEventListener('change', () => this.handleVersionChange());
    document.getElementById('change-path-btn')?.addEventListener('click', () => this.saveMinecraftWindowsUserName());
    document.getElementById('minecraft-windows-user-input')?.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        this.saveMinecraftWindowsUserName();
      }
    });
    document.getElementById('choose-standard-mods-path-btn')?.addEventListener('click', () => this.chooseStandardModsPath());
    document.getElementById('reset-standard-mods-path-btn')?.addEventListener('click', () => this.resetStandardModsPath());
    document.getElementById('debug-mode-toggle')?.addEventListener('change', (event) => this.setDebugMode(event.target.checked));
    document.getElementById('run-diagnostics-btn')?.addEventListener('click', () => this.runDiagnostics());
    document.getElementById('cleanup-numbered-mods-btn')?.addEventListener('click', () => this.cleanupNumberedAndDuplicateMods());
    document.getElementById('open-diagnostics-folder-btn')?.addEventListener('click', () => this.openDiagnosticsFolder());
    document.getElementById('replay-tutorial-btn')?.addEventListener('click', () => this.startTutorial({ force: true }));
    document.getElementById('check-launcher-update-btn')?.addEventListener('click', () => this.checkLauncherAppUpdateManually());
    document.getElementById('install-launcher-update-btn')?.addEventListener('click', () => this.installLauncherAppUpdateManually());
    document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
    document.getElementById('offline-btn')?.addEventListener('click', () => this.handleOfflineLogin());
    this.setupTutorialEvents();
  }

  setupModsDragAndDrop() {
    const dropZone = document.getElementById('mods-drop-zone');
    if (!dropZone) {
      return;
    }

    const hasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');
    const preventFileOpen = (event) => {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
    };

    document.addEventListener('dragover', preventFileOpen);
    document.addEventListener('drop', preventFileOpen);

    dropZone.addEventListener('dragenter', (event) => {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      dropZone.classList.add('is-drag-over');
    });

    dropZone.addEventListener('dragover', (event) => {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      dropZone.classList.add('is-drag-over');
    });

    dropZone.addEventListener('dragleave', (event) => {
      if (!dropZone.contains(event.relatedTarget)) {
        dropZone.classList.remove('is-drag-over');
      }
    });

    dropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropZone.classList.remove('is-drag-over');
      if (this.modsViewType !== 'mod') {
        this.showNotification('Ressourcenpakete und Shader bitte über den Modrinth-Tab installieren.');
        return;
      }
      this.importDroppedMods(this.getDroppedFilePaths(event.dataTransfer));
    });
  }

  getDroppedFilePaths(dataTransfer) {
    return Array.from(dataTransfer?.files || [])
      .map((file) => {
        if (typeof window.electronAPI?.getPathForFile === 'function') {
          try {
            return window.electronAPI.getPathForFile(file);
          } catch (_error) {
            return file?.path || '';
          }
        }
        return file?.path || '';
      })
      .filter(Boolean);
  }

  async importDroppedMods(filePaths) {
    if (!filePaths.length) {
      this.showNotification('Keine gültige JAR-Datei erkannt.');
      return;
    }

    if (typeof window.electronAPI?.importDroppedMods !== 'function') {
      this.showNotification('Fehler: Drag-and-drop Import ist nicht verfügbar.');
      return;
    }

    const shouldCheckModrinth = await this.showConfirm({
      title: 'Mod hinzufügen',
      message: 'Soll der Launcher diese Mod so behalten oder auf Modrinth nach einer passenden Version suchen und sie ersetzen?',
      confirmText: 'Modrinth prüfen',
      cancelText: 'Behalten'
    });
    const importMode = shouldCheckModrinth ? 'modrinth' : 'keep';

    this.showLoading(importMode === 'keep'
      ? (this.requireDroppedModApprovalEnabled ? 'Bereite eigene Mods vor...' : 'Füge eigene Mods hinzu...')
      : (this.requireDroppedModApprovalEnabled ? 'Erkenne Mods und bereite eigene Mods vor...' : 'Erkenne und installiere Mods...'));

    try {
      const result = await window.electronAPI.importDroppedMods(filePaths, {
        mode: importMode,
        requireManualApproval: this.requireDroppedModApprovalEnabled
      });
      if (!result.success) {
        const rejectedText = result.rejected?.length ? ` Hinweis: ${result.rejected.slice(0, 2).join(' | ')}` : '';
        this.showNotification(`Fehler: ${result.error || 'Mod konnte nicht installiert werden.'}${rejectedText}`);
        return;
      }

      this.selectedVersionId = result.selectedVersionId || this.selectedVersionId;
      await this.refreshPackContext();
      const warningText = result.warning ? ` Hinweis: ${result.warning}` : '';
      this.showNotification(`${result.message || 'Mod installiert.'}${warningText}`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  setupButtonFeedback() {
    document.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }

      const button = event.target.closest('button, .btn, [role="button"], input[type="checkbox"], input[type="range"], select');
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') {
        return;
      }

      if (button.dataset.skipClickSound !== 'true') {
        this.playButtonSound();
      }
      button.classList.remove('is-clicked');
      window.requestAnimationFrame(() => {
        button.classList.add('is-clicked');
        window.setTimeout(() => button.classList.remove('is-clicked'), 180);
      });
    });
  }

  getButtonAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    if (!this.buttonAudioContext) {
      this.buttonAudioContext = new AudioContextClass();
    }

    if (this.buttonAudioContext.state === 'suspended') {
      this.buttonAudioContext.resume().catch(() => {});
    }

    return this.buttonAudioContext;
  }

  getClickSoundProfile(soundId) {
    const profiles = {
      soft: {
        filter: { type: 'bandpass', frequency: 1350, q: 0.9 },
        tones: [
          { waveform: 'triangle', frequency: 520, endFrequency: 780, offset: 0, duration: 0.08, gain: 0.035 },
          { waveform: 'sine', frequency: 1040, endFrequency: 1320, offset: 0.008, duration: 0.062, gain: 0.018 }
        ]
      },
      crystal: {
        filter: { type: 'bandpass', frequency: 2450, q: 1.25 },
        tones: [
          { waveform: 'sine', frequency: 880, endFrequency: 1320, offset: 0, duration: 0.082, gain: 0.026 },
          { waveform: 'triangle', frequency: 1760, endFrequency: 2093, offset: 0.018, duration: 0.072, gain: 0.014 }
        ]
      },
      wood: {
        filter: { type: 'lowpass', frequency: 1250, q: 0.55 },
        tones: [
          { waveform: 'triangle', frequency: 210, endFrequency: 155, offset: 0, duration: 0.09, gain: 0.042 },
          { waveform: 'sine', frequency: 420, endFrequency: 360, offset: 0.012, duration: 0.068, gain: 0.018 }
        ],
        noise: { duration: 0.026, gain: 0.012, filterType: 'bandpass', filterFrequency: 760, q: 0.7 }
      },
      bubble: {
        filter: { type: 'bandpass', frequency: 1500, q: 0.7 },
        tones: [
          { waveform: 'sine', frequency: 470, endFrequency: 760, offset: 0, duration: 0.105, gain: 0.032 },
          { waveform: 'sine', frequency: 705, endFrequency: 980, offset: 0.032, duration: 0.08, gain: 0.016 }
        ]
      },
      paper: {
        filter: { type: 'highpass', frequency: 900, q: 0.4 },
        tones: [
          { waveform: 'sine', frequency: 720, endFrequency: 650, offset: 0.006, duration: 0.052, gain: 0.013 }
        ],
        noise: { duration: 0.045, gain: 0.022, filterType: 'bandpass', filterFrequency: 1850, q: 0.85 }
      }
    };

    return profiles[soundId] || null;
  }

  getSoundGainMultiplier(boost = 1, cap = 6, referenceVolume = 0.2) {
    const volume = Math.min(1, Math.max(0, Number(this.soundVolume) || 0));
    if (volume <= 0) {
      return 0;
    }

    return Math.min(cap, (volume / referenceVolume) * boost);
  }

  playButtonSound(options = {}) {
    const now = performance.now();
    if (!options.force && now - this.lastButtonSoundAt < 45) {
      return;
    }
    this.lastButtonSoundAt = now;

    const audioContext = this.getButtonAudioContext();
    if (!audioContext) {
      return;
    }

    const volumeMultiplier = this.getSoundGainMultiplier(1, 25, this.clickSoundReferenceVolume);
    if (volumeMultiplier <= 0) {
      return;
    }

    const profile = this.getClickSoundProfile(options.soundId || this.clickSound) || this.getClickSoundProfile('soft');
    const startAt = audioContext.currentTime + 0.004;
    const filter = audioContext.createBiquadFilter();
    const master = audioContext.createGain();
    let lastStopAt = startAt;

    filter.type = profile.filter.type;
    filter.frequency.setValueAtTime(profile.filter.frequency, startAt);
    filter.Q.setValueAtTime(profile.filter.q, startAt);
    master.gain.setValueAtTime(1, startAt);
    filter.connect(master);
    master.connect(audioContext.destination);

    profile.tones.forEach((tone) => {
      const toneStart = startAt + tone.offset;
      const toneEnd = toneStart + tone.duration;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = tone.waveform;
      oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
      oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, toneEnd);

      gain.gain.setValueAtTime(0.0001, toneStart);
      gain.gain.linearRampToValueAtTime(tone.gain * volumeMultiplier, toneStart + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);

      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };

      oscillator.start(toneStart);
      oscillator.stop(toneEnd + 0.012);
      lastStopAt = Math.max(lastStopAt, toneEnd + 0.012);
    });

    if (profile.noise) {
      const noiseStart = startAt;
      const noiseEnd = noiseStart + profile.noise.duration;
      const frameCount = Math.max(1, Math.floor(audioContext.sampleRate * profile.noise.duration));
      const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i += 1) {
        const fade = 1 - (i / frameCount);
        data[i] = (Math.random() * 2 - 1) * fade * fade;
      }

      const source = audioContext.createBufferSource();
      const noiseFilter = audioContext.createBiquadFilter();
      const noiseGain = audioContext.createGain();
      source.buffer = buffer;
      noiseFilter.type = profile.noise.filterType;
      noiseFilter.frequency.setValueAtTime(profile.noise.filterFrequency, noiseStart);
      noiseFilter.Q.setValueAtTime(profile.noise.q, noiseStart);
      noiseGain.gain.setValueAtTime(0.0001, noiseStart);
      noiseGain.gain.linearRampToValueAtTime(profile.noise.gain * volumeMultiplier, noiseStart + 0.004);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, noiseEnd);

      source.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(filter);
      source.onended = () => {
        source.disconnect();
        noiseFilter.disconnect();
        noiseGain.disconnect();
      };
      source.start(noiseStart);
      source.stop(noiseEnd + 0.008);
      lastStopAt = Math.max(lastStopAt, noiseEnd + 0.008);
    }

    window.setTimeout(() => {
      filter.disconnect();
      master.disconnect();
    }, Math.max(120, Math.ceil((lastStopAt - audioContext.currentTime) * 1000) + 30));
  }

  playLoadingSound(type = 'start') {
    const now = performance.now();
    if (now - this.lastLoadingSoundAt < 260) {
      return;
    }
    this.lastLoadingSoundAt = now;

    const audioContext = this.getButtonAudioContext();
    if (!audioContext) {
      return;
    }

    const volumeMultiplier = this.getSoundGainMultiplier(2.2, 6);
    if (volumeMultiplier <= 0) {
      return;
    }

    try {
      const startAt = audioContext.currentTime + 0.01;
      const master = audioContext.createGain();
      const compressor = audioContext.createDynamicsCompressor();
      const tones = type === 'complete'
        ? [
            { frequency: 392, offset: 0, duration: 0.11, gain: 0.032, waveform: 'sine' },
            { frequency: 659.25, offset: 0.055, duration: 0.13, gain: 0.026, waveform: 'triangle' },
            { frequency: 987.77, offset: 0.12, duration: 0.16, gain: 0.018, waveform: 'sine' }
          ]
        : [
            { frequency: 196, offset: 0, duration: 0.12, gain: 0.028, waveform: 'triangle' },
            { frequency: 392, offset: 0.045, duration: 0.13, gain: 0.024, waveform: 'sine' },
            { frequency: 587.33, offset: 0.09, duration: 0.12, gain: 0.016, waveform: 'sine' }
          ];

      compressor.threshold.setValueAtTime(-22, startAt);
      compressor.knee.setValueAtTime(18, startAt);
      compressor.ratio.setValueAtTime(4, startAt);
      master.gain.setValueAtTime(0.9, startAt);
      master.connect(compressor);
      compressor.connect(audioContext.destination);

      let lastStopAt = startAt;
      tones.forEach((tone) => {
        const toneStart = startAt + tone.offset;
        const toneEnd = toneStart + tone.duration;
        const oscillator = audioContext.createOscillator();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();

        oscillator.type = tone.waveform;
        oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
        oscillator.frequency.exponentialRampToValueAtTime(tone.frequency * 1.018, toneEnd);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(type === 'complete' ? 2600 : 2100, toneStart);
        filter.Q.setValueAtTime(0.62, toneStart);

        gain.gain.setValueAtTime(0.0001, toneStart);
        gain.gain.linearRampToValueAtTime(tone.gain * volumeMultiplier, toneStart + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        oscillator.onended = () => {
          oscillator.disconnect();
          filter.disconnect();
          gain.disconnect();
        };

        oscillator.start(toneStart);
        oscillator.stop(toneEnd + 0.015);
        lastStopAt = Math.max(lastStopAt, toneEnd + 0.015);
      });

      window.setTimeout(() => {
        master.disconnect();
        compressor.disconnect();
      }, Math.max(180, Math.ceil((lastStopAt - audioContext.currentTime) * 1000) + 40));
    } catch (error) {
      console.warn('Loading sound error:', error);
    }
  }

  showConfirm({ title = 'Aktion bestätigen', message = 'Bist du sicher?', confirmText = 'Bestätigen', cancelText = 'Abbrechen' } = {}) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const okButton = document.getElementById('confirm-ok-btn');
    const cancelButton = document.getElementById('confirm-cancel-btn');

    if (!modal || !titleEl || !messageEl || !okButton || !cancelButton) {
      return Promise.resolve(window.confirm(this.localizeText(message)));
    }

    if (this.pendingConfirm) {
      this.resolveConfirm(false);
    }

    titleEl.textContent = this.localizeText(title);
    messageEl.textContent = this.localizeText(message);
    okButton.textContent = this.localizeText(confirmText);
    cancelButton.textContent = this.localizeText(cancelText);
    modal.classList.remove('hidden');

    return new Promise((resolve) => {
      this.pendingConfirm = {
        resolve,
        previousFocus: document.activeElement
      };
      window.setTimeout(() => cancelButton.focus(), 0);
    });
  }

  resolveConfirm(confirmed) {
    if (!this.pendingConfirm) {
      return;
    }

    const modal = document.getElementById('confirm-modal');
    const { resolve, previousFocus } = this.pendingConfirm;
    this.pendingConfirm = null;
    modal?.classList.add('hidden');

    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }

    resolve(Boolean(confirmed));
  }

  handleConfirmKeydown(event) {
    if (this.pendingSkinVariantChoice && event.key === 'Escape') {
      event.preventDefault();
      this.resolveSkinVariantChoice(null);
      return;
    }

    if (!this.pendingConfirm) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.resolveConfirm(false);
    }

  }

  showSkinVariantChoice() {
    const modal = document.getElementById('skin-variant-modal');
    const slimButton = document.getElementById('skin-variant-slim-btn');
    const wideButton = document.getElementById('skin-variant-wide-btn');

    if (!modal || !slimButton || !wideButton) {
      const selectedVariant = window.confirm(this.localizeText('Slim-Modell verwenden? OK = Slim, Abbrechen = Wide'))
        ? 'slim'
        : 'classic';
      return Promise.resolve(selectedVariant);
    }

    if (this.pendingSkinVariantChoice) {
      this.resolveSkinVariantChoice(null);
    }

    modal.classList.remove('hidden');

    return new Promise((resolve) => {
      this.pendingSkinVariantChoice = {
        resolve,
        previousFocus: document.activeElement
      };
      window.setTimeout(() => slimButton.focus(), 0);
    });
  }

  resolveSkinVariantChoice(variant) {
    if (!this.pendingSkinVariantChoice) {
      return;
    }

    const modal = document.getElementById('skin-variant-modal');
    const { resolve, previousFocus } = this.pendingSkinVariantChoice;
    this.pendingSkinVariantChoice = null;
    modal?.classList.add('hidden');

    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }

    resolve(variant);
  }

  async minimizeWindow() {
    try {
      await window.electronAPI.windowMinimize();
    } catch (error) {
      console.error('Window minimize error:', error);
    }
  }

  async toggleMaximizeWindow() {
    try {
      const result = await window.electronAPI.windowToggleMaximize();
      if (result?.success && typeof result.maximized === 'boolean') {
        this.setMaximizeButtonState(result.maximized);
      }
    } catch (error) {
      console.error('Window maximize error:', error);
    }
  }

  async closeWindow() {
    try {
      await window.electronAPI.windowClose();
    } catch (error) {
      console.error('Window close error:', error);
    }
  }

  getWindowsUserNameFromMinecraftPath(minecraftPath = '') {
    const parts = String(minecraftPath || '').split(/[\\/]/).filter(Boolean);
    const usersIndex = parts.findIndex((part) => part.toLowerCase() === 'users');
    return usersIndex >= 0 && parts[usersIndex + 1] ? parts[usersIndex + 1] : '';
  }

  async changeMinecraftPath() {
    try {
      const result = await window.electronAPI.chooseMinecraftPath();
      if (!result || result.canceled) {
        return;
      }
      if (!result.success) {
        this.showNotification(`Fehler: ${result.error || 'Pfad konnte nicht gespeichert werden.'}`);
        return;
      }

      this.minecraftPath = result.minecraftPath || this.minecraftPath;
      const minecraftPathEl = document.getElementById('minecraft-path');
      if (minecraftPathEl) {
        minecraftPathEl.textContent = this.minecraftPath || 'Nicht gefunden';
      }
      const minecraftWindowsUserInput = document.getElementById('minecraft-windows-user-input');
      if (minecraftWindowsUserInput) {
        minecraftWindowsUserInput.value = this.getWindowsUserNameFromMinecraftPath(this.minecraftPath);
      }

      this.showNotification(`Minecraft-Pfad gespeichert: ${this.minecraftPath}`);
      await this.loadStandardModsPath();
      await this.refreshPackContext();
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async saveMinecraftWindowsUserName() {
    try {
      const minecraftWindowsUserInput = document.getElementById('minecraft-windows-user-input');
      const windowsUserName = minecraftWindowsUserInput?.value.trim() || this.getWindowsUserNameFromMinecraftPath(this.minecraftPath);
      const result = await window.electronAPI.setMinecraftWindowsUserName(windowsUserName);
      if (!result.success) {
        this.showNotification(`Fehler: ${result.error || 'Name konnte nicht gespeichert werden.'}`);
        return;
      }

      this.minecraftPath = result.minecraftPath || this.minecraftPath;
      const minecraftPathEl = document.getElementById('minecraft-path');
      if (minecraftPathEl) {
        minecraftPathEl.textContent = this.minecraftPath || 'Nicht gefunden';
      }
      if (minecraftWindowsUserInput) {
        minecraftWindowsUserInput.value = result.minecraftWindowsUserName || this.getWindowsUserNameFromMinecraftPath(this.minecraftPath);
      }

      this.showNotification(`Windows-Name gespeichert: ${this.minecraftPath}`);
      await this.loadStandardModsPath();
      await this.refreshPackContext();
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  updateStandardModsPathUI(pathInfo = {}) {
    const standardModsPathEl = document.getElementById('standard-mods-path');
    const resetButton = document.getElementById('reset-standard-mods-path-btn');
    const modsPath = pathInfo.modsPath || this.standardModsPath || '';
    this.standardModsPath = modsPath;

    if (standardModsPathEl) {
      standardModsPathEl.textContent = modsPath || 'Nicht gefunden';
    }
    if (resetButton) {
      resetButton.disabled = !pathInfo.custom;
    }
  }

  async loadStandardModsPath() {
    if (typeof window.electronAPI?.getStandardModsPath !== 'function') {
      return;
    }

    try {
      const result = await window.electronAPI.getStandardModsPath();
      if (result?.success) {
        this.updateStandardModsPathUI(result);
      }
    } catch (error) {
      console.error('Standard mods path error:', error);
    }
  }

  async chooseStandardModsPath() {
    if (typeof window.electronAPI?.chooseStandardModsPath !== 'function') {
      this.showNotification('Fehler: Standard Mods-Ordner kann nicht geändert werden.');
      return;
    }

    try {
      const result = await window.electronAPI.chooseStandardModsPath();
      if (!result || result.canceled) {
        return;
      }
      if (!result.success) {
        this.showNotification(`Fehler: ${result.error || 'Mods-Ordner konnte nicht gespeichert werden.'}`);
        return;
      }

      this.updateStandardModsPathUI(result);
      this.showNotification(`Standard Mods-Ordner gespeichert: ${result.modsPath}`);
      await this.refreshPackContext();
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async resetStandardModsPath() {
    if (typeof window.electronAPI?.resetStandardModsPath !== 'function') {
      return;
    }

    try {
      const result = await window.electronAPI.resetStandardModsPath();
      if (!result.success) {
        this.showNotification(`Fehler: ${result.error || 'Mods-Ordner konnte nicht zurückgesetzt werden.'}`);
        return;
      }

      this.updateStandardModsPathUI(result);
      this.showNotification(`Standard Mods-Ordner zurückgesetzt: ${result.modsPath}`);
      await this.refreshPackContext();
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach((item) => {
      item.addEventListener('click', () => {
        const sectionId = item.getAttribute('data-section');
        this.activateSection(sectionId);
      });
    });

    const initialSectionId = document.querySelector('.nav-item.active')?.getAttribute('data-section')
      || navItems[0]?.getAttribute('data-section');
    if (initialSectionId) {
      this.activateSection(initialSectionId);
    }

    this.scheduleScrollFadeUpdate();
  }

  setupReactBitsMotion() {
    // Global pointer tracking and DOM-wide motion observation caused frame drops
    // on large mod lists. The launcher intentionally uses a static, instant UI.
    document.documentElement.classList.remove('reactbits-motion-ready');
    document.documentElement.classList.add('launcher-static-ui');
  }

  scheduleReactBitsMotionUpdate() {
    if (this.reactBitsMotionFrame) {
      return;
    }

    this.reactBitsMotionFrame = requestAnimationFrame(() => {
      this.reactBitsMotionFrame = null;
      this.prepareReactBitsMotion();
    });
  }

  prepareReactBitsMotion() {
    this.prepareReactBitsText();
    this.prepareReactBitsSurfaces();
    this.prepareReactBitsMotionItems();

    document.querySelectorAll('.content-section.active').forEach((section) => {
      this.prepareSectionMotion(section);
    });
  }

  prepareReactBitsText() {
    const textTargets = [
      '.login-title',
      '.title',
      '.section-header h2',
      '.section-header p',
      '.mods-subtitle',
      '.panel-context-text',
      '.start-status',
      '.modrinth-status',
      '.mods-check-status',
      '.skin-status',
      '.setting-heading h4',
      '.setting-heading p',
      '.hosting-hero h2',
      '.tutorial-card h3',
      '.confirm-content h3'
    ].join(', ');

    document.querySelectorAll(textTargets).forEach((element) => {
      if (!(element instanceof HTMLElement) || element.dataset.reactbitsTextReady === 'true') {
        return;
      }

      element.dataset.reactbitsTextReady = 'true';
      element.classList.add('rb-text-reveal');
      element.style.setProperty('--rb-text-length', String((element.textContent || '').trim().length || 8));
    });
  }

  prepareReactBitsSurfaces() {
    const surfaceTargets = [
      '.login-box',
      '.header',
      '.sidebar',
      '.start-hero-card',
      '.start-direct-server',
      '.installed-mods-panel',
      '.modrinth-panel',
      '.mod-item',
      '.modrinth-project-card',
      '.pack-creator-card',
      '.pack-list-panel',
      '.pack-card',
      '.server-card',
      '.server-list-panel',
      '.server-favorite-card',
      '.hosting-card',
      '.hosted-server-card',
      '.hosting-player-card',
      '.account-card',
      '.account-list-panel',
      '.account-switch-card',
      '.skin-card',
      '.saved-skin-chip',
      '.online-skin-card',
      '.mods-drop-zone',
      '.modrinth-pack-target',
      '.setting-item',
      '.rgb-sliders',
      '.color-preview',
      '.confirm-box',
      '.tutorial-card',
      '[class$="-panel"]',
      '[class$="-card"]',
      '[class$="-chip"]'
    ].join(', ');

    document.querySelectorAll(surfaceTargets).forEach((element, index) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      if (!element.classList.contains('rb-surface')) {
        element.classList.add('rb-surface');
      }

      const surfaceIndex = String(index % 18);
      if (element.style.getPropertyValue('--rb-surface-index') !== surfaceIndex) {
        element.style.setProperty('--rb-surface-index', surfaceIndex);
      }
    });
  }

  prepareReactBitsMotionItems() {
    const itemTargets = [
      'button',
      '.btn',
      '.nav-item',
      '.modrinth-type-tab',
      '.input-field',
      '.rgb-slider',
      '.setting-toggle',
      '.checkbox-row',
      '.section-actions > *',
      '.settings-actions > *',
      '.skin-actions > *',
      '.server-actions > *',
      '.mod-actions > *',
      '.pack-actions > *',
      '.saved-skin-actions > *',
      '.online-skin-actions > *',
      '.login-form > *',
      '.login-info > *',
      '.pack-form > *',
      '.server-form > *',
      '.account-form > *',
      '.skin-library-search-row > *',
      '.modrinth-search-row > *',
      '.sound-controls > *',
      '.slider-group',
      '.sound-select-row',
      '.server-command-row > *',
      '.hosting-toolbar > *',
      '.hosting-ban-tools > *',
      '.loader-shell > *',
      '.update-shell > *',
      '.confirm-actions > *',
      '.tutorial-actions > *'
    ].join(', ');

    document.querySelectorAll(itemTargets).forEach((element, index) => {
      if (!(element instanceof HTMLElement) || element.closest('.hidden, .is-hidden')) {
        return;
      }

      element.classList.add('rb-motion-item');
      const itemIndex = String(index % 24);
      if (element.style.getPropertyValue('--rb-item-index') !== itemIndex) {
        element.style.setProperty('--rb-item-index', itemIndex);
      }
    });
  }

  handleReactBitsPointerMove(event) {
    this.reactBitsPointer = {
      x: event.clientX,
      y: event.clientY
    };

    if (this.reactBitsPointerFrame) {
      return;
    }

    this.reactBitsPointerFrame = requestAnimationFrame(() => {
      this.reactBitsPointerFrame = null;
      this.updateReactBitsPointerEffects();
    });
  }

  updateReactBitsPointerEffects() {
    const pointer = this.reactBitsPointer;
    const targets = document.querySelectorAll('.rb-surface, .rb-motion-item, .btn, .nav-item, .modrinth-type-tab, .input-field');

    targets.forEach((element) => {
      if (!(element instanceof HTMLElement) || element.closest('.hidden, .is-hidden')) {
        return;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const centerX = rect.left + (rect.width / 2);
      const centerY = rect.top + (rect.height / 2);
      const distance = Math.hypot(pointer.x - centerX, pointer.y - centerY);
      const radius = Math.max(160, Math.min(360, Math.max(rect.width, rect.height) * 1.7));
      const active = distance <= radius;

      element.classList.toggle('rb-pointer-active', active);
      if (!active) {
        element.style.removeProperty('--rb-pointer-x');
        element.style.removeProperty('--rb-pointer-y');
        element.style.removeProperty('--rb-magnet-x');
        element.style.removeProperty('--rb-magnet-y');
        return;
      }

      const localX = ((pointer.x - rect.left) / rect.width) * 100;
      const localY = ((pointer.y - rect.top) / rect.height) * 100;
      element.style.setProperty('--rb-pointer-x', `${localX.toFixed(2)}%`);
      element.style.setProperty('--rb-pointer-y', `${localY.toFixed(2)}%`);
    });
  }

  clearReactBitsPointerEffects() {
    document.querySelectorAll('.rb-pointer-active').forEach((element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      element.classList.remove('rb-pointer-active');
      element.style.removeProperty('--rb-pointer-x');
      element.style.removeProperty('--rb-pointer-y');
      element.style.removeProperty('--rb-magnet-x');
      element.style.removeProperty('--rb-magnet-y');
    });
  }

  prepareSectionMotion(section) {
    if (!section) {
      return;
    }

    this.prepareMotionGroup(section, ':scope > *', 45);
    [
      '.mods-list',
      '.packs-list',
      '.servers-list',
      '.accounts-list',
      '.skins-list',
      '.skin-library-results',
      '.modrinth-results',
      '.start-server-list',
      '.hosting-server-list',
      '.hosting-player-list',
      '.hosting-ban-list',
      '.hosting-history-list',
      '.hosting-metric-grid',
      '.settings-container'
    ].forEach((selector) => {
      this.prepareMotionGroup(section.querySelector(selector), ':scope > *', 34);
    });
  }

  prepareMotionGroup(container, selector = ':scope > *', stepMs = 36) {
    // Motion staggering is disabled to avoid touching every rendered list item.
    return;
  }

  setupScrollFade() {
    const sections = this.getScrollFadeContainers();
    const scheduleUpdate = () => this.scheduleScrollFadeUpdate();

    sections.forEach((section) => {
      section.addEventListener('scroll', scheduleUpdate, { passive: true });

      if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(scheduleUpdate);
        observer.observe(section, { childList: true, subtree: true });
        this.scrollFadeObservers.push(observer);
      }
    });

    document.addEventListener('scroll', scheduleUpdate, { passive: true, capture: true });
    window.addEventListener('resize', scheduleUpdate);
    this.scheduleScrollFadeUpdate();
  }

  getNeonFrameSelector() {
    return [
      '.server-card',
      '.server-list-panel',
      '.server-host-card',
      '.hosting-card',
      '.hosted-server-card',
      '.hosted-mod-card',
      '.hosting-player-card',
      '.server-favorite-card',
      '.account-card',
      '.account-list-panel',
      '.account-switch-card',
      '.mod-item',
      '.mods-drop-zone',
      '.modrinth-pack-target',
      '.pack-creator-card',
      '.pack-list-panel',
      '.pack-card',
      '.skin-card',
      '.saved-skin-chip',
      '.online-skin-card',
      '.setting-item',
      '.rgb-sliders',
      '.color-preview',
      '.tutorial-card'
    ].join(', ');
  }

  setupNeonFrameTracking() {
    this.refreshNeonFrameTargets();

    const schedulePointerUpdate = (event) => {
      this.neonFramePointer = {
        x: event.clientX,
        y: event.clientY
      };
      this.scheduleNeonFrameUpdate();
    };

    document.addEventListener('mousemove', schedulePointerUpdate, { passive: true });
    document.addEventListener('mouseleave', () => this.clearNeonFrameHotspots());
    window.addEventListener('blur', () => this.clearNeonFrameHotspots());
    window.addEventListener('resize', () => this.scheduleNeonFrameUpdate());

    if (typeof MutationObserver !== 'undefined') {
      this.neonFrameMutationObserver = new MutationObserver(() => {
        this.refreshNeonFrameTargets();
        this.scheduleNeonFrameUpdate();
      });
      this.neonFrameMutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  refreshNeonFrameTargets() {
    if (!this.neonFramesEnabled) {
      return;
    }

    document.querySelectorAll(this.getNeonFrameSelector()).forEach((element) => {
      if (element instanceof HTMLElement) {
        element.classList.add('neon-frame-hotspot');
        this.getOrCreateNeonFrameCurve(element);
      }
    });
  }

  getOrCreateNeonFrameCurve(element) {
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    let svg = element.querySelector(':scope > .neon-frame-curve');
    let path = svg?.querySelector?.(':scope > .neon-frame-curve-path-core')
      || svg?.querySelector?.(':scope > .neon-frame-curve-path');
    let softPath = svg?.querySelector?.(':scope > .neon-frame-curve-path-soft');
    let gradient = svg?.querySelector?.(':scope > defs > linearGradient.neon-frame-curve-gradient');
    if (!(svg instanceof SVGElement) || !(path instanceof SVGPathElement)) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      gradient = this.createNeonFrameGradient(element);
      softPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      svg.classList.add('neon-frame-curve');
      softPath.classList.add('neon-frame-curve-path', 'neon-frame-curve-path-soft');
      path.classList.add('neon-frame-curve-path', 'neon-frame-curve-path-core');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      defs.appendChild(gradient);
      svg.appendChild(defs);
      svg.appendChild(softPath);
      svg.appendChild(path);
      element.appendChild(svg);
    } else {
      path.classList.add('neon-frame-curve-path', 'neon-frame-curve-path-core');
      if (!(gradient instanceof SVGLinearGradientElement)) {
        const defs = svg.querySelector(':scope > defs') || document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        gradient = this.createNeonFrameGradient(element);
        defs.appendChild(gradient);
        if (!defs.parentElement) {
          svg.insertBefore(defs, svg.firstChild);
        }
      }
      if (!(softPath instanceof SVGPathElement)) {
        softPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        softPath.classList.add('neon-frame-curve-path', 'neon-frame-curve-path-soft');
        svg.insertBefore(softPath, path);
      }
    }

    path.setAttribute('stroke', `url(#${gradient.id})`);
    return { svg, path, softPath, gradient };
  }

  createNeonFrameGradient(element) {
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    const gradientId = element.dataset.neonFrameGradientId
      || `neon-frame-gradient-${this.neonFrameGradientCounter += 1}`;
    element.dataset.neonFrameGradientId = gradientId;
    gradient.id = gradientId;
    gradient.classList.add('neon-frame-curve-gradient');
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');

    [
      ['0%', 'rgb(var(--primary-rgb))', '0'],
      ['18%', 'rgb(var(--primary-rgb))', '0.16'],
      ['50%', 'rgb(245, 253, 255)', '0.96'],
      ['82%', 'rgb(var(--primary-rgb))', '0.16'],
      ['100%', 'rgb(var(--primary-rgb))', '0']
    ].forEach(([offset, color, opacity]) => {
      const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop.setAttribute('offset', offset);
      stop.style.stopColor = color;
      stop.style.stopOpacity = opacity;
      gradient.appendChild(stop);
    });

    return gradient;
  }

  getOrCreateNeonFrameLight(element, variant = 'primary') {
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    const variantClass = `neon-frame-light-${variant}`;
    let light = element.querySelector(`:scope > .${variantClass}`);
    if (!(light instanceof HTMLElement) && variant === 'primary') {
      light = element.querySelector(':scope > .neon-frame-light:not(.neon-frame-light-secondary)');
    }

    if (!(light instanceof HTMLElement)) {
      light = document.createElement('span');
      light.className = `neon-frame-light ${variantClass}`;
      light.setAttribute('aria-hidden', 'true');
      element.appendChild(light);
    } else {
      light.classList.add('neon-frame-light', variantClass);
    }
    return light;
  }

  scheduleNeonFrameUpdate() {
    if (this.neonFrameTrackingFrame) {
      return;
    }

    this.neonFrameTrackingFrame = requestAnimationFrame(() => {
      this.neonFrameTrackingFrame = null;
      this.updateNeonFrameHotspots();
    });
  }

  updateNeonFrameHotspots() {
    if (!this.neonFramesEnabled) {
      this.clearNeonFrameHotspots();
      return;
    }

    if (!this.neonFramePointer) {
      this.clearNeonFrameHotspots();
      return;
    }

    const glowRange = 38;
    const candidates = Array.from(document.querySelectorAll('.neon-frame-hotspot'))
      .filter((element) => element instanceof HTMLElement);
    const nextActive = new Set();

    candidates.forEach((element) => {
      if (!this.isNeonFrameVisible(element)) {
        return;
      }

      const rect = element.getBoundingClientRect();
      if (this.isPointerOutsideNeonFrameRange(rect, this.neonFramePointer, glowRange)) {
        return;
      }

      const curve = this.getOrCreateNeonFrameCurve(element);
      if (!curve) {
        return;
      }

      const hotspot = this.getCurvedFrameHotspot(element, curve.svg, curve.path, rect, this.neonFramePointer);
      if (!hotspot || hotspot.distance > glowRange) {
        return;
      }

      const opacity = Math.max(0, Math.min(1, 1 - (hotspot.distance / glowRange)));
      const easedOpacity = Math.pow(opacity, 0.85);
      this.positionNeonFrameCurve(curve.svg, curve.path, curve.gradient, hotspot, easedOpacity);
      nextActive.add(element);
    });

    this.neonFrameActiveElements.forEach((element) => {
      if (!nextActive.has(element)) {
        this.resetNeonFrameElement(element);
      }
    });
    this.neonFrameActiveElements = nextActive;
  }

  isPointerOutsideNeonFrameRange(rect, pointer, range) {
    return pointer.x < rect.left - range
      || pointer.x > rect.right + range
      || pointer.y < rect.top - range
      || pointer.y > rect.bottom + range;
  }

  getCurvedFrameHotspot(element, svg, path, rect, pointer) {
    this.updateNeonFrameCurvePath(element, svg, path, rect);

    const totalLength = path.getTotalLength();
    if (!Number.isFinite(totalLength) || totalLength <= 0) {
      return null;
    }

    const target = {
      x: pointer.x - rect.left,
      y: pointer.y - rect.top
    };
    const nearest = this.findNearestPointOnNeonFramePath(path, target, totalLength);
    return nearest
      ? {
        ...nearest,
        totalLength
      }
      : null;
  }

  updateNeonFrameCurvePath(element, svg, path, rect) {
    const strokeInset = 4;
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const radius = this.getNeonFrameRadius(element, width, height);
    const x = strokeInset;
    const y = strokeInset;
    const w = Math.max(1, width - (strokeInset * 2));
    const h = Math.max(1, height - (strokeInset * 2));
    const r = Math.max(0, Math.min(radius - strokeInset, w / 2, h / 2));
    const d = r > 0
      ? `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`
      : `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.querySelectorAll(':scope > .neon-frame-curve-path').forEach((curvePath) => {
      curvePath.setAttribute('d', d);
    });
  }

  getNeonFrameRadius(element, width, height) {
    const style = window.getComputedStyle(element);
    const rawRadius = style.borderTopLeftRadius || style.borderRadius || '0';
    const radius = Number.parseFloat(String(rawRadius).split(' ')[0]) || 0;
    return Math.min(radius, width / 2, height / 2);
  }

  findNearestPointOnNeonFramePath(path, target, totalLength) {
    const sampleCount = 96;
    let best = null;

    for (let index = 0; index < sampleCount; index += 1) {
      const length = (index / sampleCount) * totalLength;
      const point = path.getPointAtLength(length);
      const distance = Math.hypot(point.x - target.x, point.y - target.y);
      if (!best || distance < best.distance) {
        best = { length, point, distance };
      }
    }

    let step = totalLength / sampleCount;
    for (let pass = 0; pass < 6; pass += 1) {
      const candidates = [
        this.wrapNeonFrameLength(best.length - step, totalLength),
        best.length,
        this.wrapNeonFrameLength(best.length + step, totalLength)
      ];

      candidates.forEach((length) => {
        const point = path.getPointAtLength(length);
        const distance = Math.hypot(point.x - target.x, point.y - target.y);
        if (distance < best.distance) {
          best = { length, point, distance };
        }
      });
      step /= 2;
    }

    return best;
  }

  wrapNeonFrameLength(length, totalLength) {
    return ((length % totalLength) + totalLength) % totalLength;
  }

  positionNeonFrameCurve(svg, path, gradient, hotspot, opacity) {
    const totalLength = hotspot.totalLength;
    const segmentLength = Math.min(totalLength * 0.52, 114);
    const dashOffset = -(hotspot.length - (segmentLength / 2));
    const startPoint = path.getPointAtLength(this.wrapNeonFrameLength(hotspot.length - (segmentLength / 2), totalLength));
    const endPoint = path.getPointAtLength(this.wrapNeonFrameLength(hotspot.length + (segmentLength / 2), totalLength));

    svg.style.setProperty('--neon-frame-opacity', opacity.toFixed(3));
    svg.classList.add('is-visible');
    gradient.setAttribute('x1', String(startPoint.x));
    gradient.setAttribute('y1', String(startPoint.y));
    gradient.setAttribute('x2', String(endPoint.x));
    gradient.setAttribute('y2', String(endPoint.y));
    path.style.strokeDasharray = `${segmentLength} ${Math.max(1, totalLength - segmentLength)}`;
    path.style.strokeDashoffset = String(dashOffset);
  }

  positionNeonFrameLights(primaryLight, secondaryLight, rect, hotspot, opacity) {
    const thickness = 12;
    const length = 118 + Math.round(opacity * 48);
    const localX = hotspot.x - rect.left;
    const localY = hotspot.y - rect.top;

    this.setNeonFrameLight(primaryLight, rect, hotspot.side, localX, localY, length, thickness, opacity);
    this.positionCornerNeonFrameLight(secondaryLight, rect, hotspot.side, localX, localY, length, thickness, opacity);
  }

  setNeonFrameLight(light, rect, side, localX, localY, length, thickness, opacity) {
    const clampedLeft = Math.min(Math.max(localX - (length / 2), 0), Math.max(0, rect.width - length));
    const clampedTop = Math.min(Math.max(localY - (length / 2), 0), Math.max(0, rect.height - length));

    light.style.setProperty('--neon-frame-opacity', opacity.toFixed(3));
    light.style.setProperty('--neon-frame-thickness', `${thickness}px`);
    light.classList.toggle('is-vertical', side === 'left' || side === 'right');
    light.classList.remove('is-top', 'is-right', 'is-bottom', 'is-left');
    light.classList.add(`is-${side}`);

    if (side === 'left') {
      light.style.setProperty('--neon-frame-light-width', `${thickness}px`);
      light.style.setProperty('--neon-frame-light-height', `${length}px`);
      light.style.setProperty('--neon-frame-light-left', '0px');
      light.style.setProperty('--neon-frame-light-top', `${clampedTop}px`);
    } else if (side === 'right') {
      light.style.setProperty('--neon-frame-light-width', `${thickness}px`);
      light.style.setProperty('--neon-frame-light-height', `${length}px`);
      light.style.setProperty('--neon-frame-light-left', `${Math.max(0, rect.width - thickness)}px`);
      light.style.setProperty('--neon-frame-light-top', `${clampedTop}px`);
    } else if (side === 'bottom') {
      light.style.setProperty('--neon-frame-light-width', `${length}px`);
      light.style.setProperty('--neon-frame-light-height', `${thickness}px`);
      light.style.setProperty('--neon-frame-light-left', `${clampedLeft}px`);
      light.style.setProperty('--neon-frame-light-top', `${Math.max(0, rect.height - thickness)}px`);
    } else {
      light.style.setProperty('--neon-frame-light-width', `${length}px`);
      light.style.setProperty('--neon-frame-light-height', `${thickness}px`);
      light.style.setProperty('--neon-frame-light-left', `${clampedLeft}px`);
      light.style.setProperty('--neon-frame-light-top', '0px');
    }

    light.classList.add('is-visible');
  }

  positionCornerNeonFrameLight(light, rect, side, localX, localY, length, thickness, opacity) {
    const cornerRange = 72;
    const corner = this.getNeonFrameCornerBlend(rect, side, localX, localY, cornerRange);
    if (!corner) {
      light.classList.remove('is-visible');
      light.style.setProperty('--neon-frame-opacity', '0');
      return;
    }

    const cornerOpacity = opacity * corner.strength * 0.72;
    const cornerLength = Math.min(length * 0.72, 104);
    this.setNeonFrameLight(light, rect, corner.side, corner.x, corner.y, cornerLength, thickness, cornerOpacity);
  }

  getNeonFrameCornerBlend(rect, side, localX, localY, range) {
    const nearStartX = localX;
    const nearEndX = rect.width - localX;
    const nearStartY = localY;
    const nearEndY = rect.height - localY;

    if ((side === 'top' || side === 'bottom') && nearStartX < range) {
      return { side: 'left', x: 0, y: side === 'top' ? 0 : rect.height, strength: 1 - (nearStartX / range) };
    }
    if ((side === 'top' || side === 'bottom') && nearEndX < range) {
      return { side: 'right', x: rect.width, y: side === 'top' ? 0 : rect.height, strength: 1 - (nearEndX / range) };
    }
    if ((side === 'left' || side === 'right') && nearStartY < range) {
      return { side: 'top', x: side === 'left' ? 0 : rect.width, y: 0, strength: 1 - (nearStartY / range) };
    }
    if ((side === 'left' || side === 'right') && nearEndY < range) {
      return { side: 'bottom', x: side === 'left' ? 0 : rect.width, y: rect.height, strength: 1 - (nearEndY / range) };
    }

    return null;
  }

  isNeonFrameVisible(element) {
    if (!(element instanceof HTMLElement) || element.classList.contains('hidden') || element.closest('.hidden, .is-hidden')) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width >= 8 && rect.height >= 8
      && rect.bottom >= 0
      && rect.right >= 0
      && rect.top <= window.innerHeight
      && rect.left <= window.innerWidth;
  }

  getFrameHotspot(rect, pointer) {
    if (!rect || rect.width <= 0 || rect.height <= 0 || !pointer) {
      return null;
    }

    const clampedX = Math.min(Math.max(pointer.x, rect.left), rect.right);
    const clampedY = Math.min(Math.max(pointer.y, rect.top), rect.bottom);
    const inside = pointer.x >= rect.left
      && pointer.x <= rect.right
      && pointer.y >= rect.top
      && pointer.y <= rect.bottom;

    if (!inside) {
      const side = this.getNearestFrameSide(rect, pointer, clampedX, clampedY);
      return {
        x: clampedX,
        y: clampedY,
        side,
        distance: Math.hypot(pointer.x - clampedX, pointer.y - clampedY)
      };
    }

    const distances = [
      { side: 'left', value: Math.abs(pointer.x - rect.left) },
      { side: 'right', value: Math.abs(rect.right - pointer.x) },
      { side: 'top', value: Math.abs(pointer.y - rect.top) },
      { side: 'bottom', value: Math.abs(rect.bottom - pointer.y) }
    ].sort((a, b) => a.value - b.value);

    switch (distances[0].side) {
      case 'left':
        return { x: rect.left, y: pointer.y, side: 'left', distance: distances[0].value };
      case 'right':
        return { x: rect.right, y: pointer.y, side: 'right', distance: distances[0].value };
      case 'top':
        return { x: pointer.x, y: rect.top, side: 'top', distance: distances[0].value };
      default:
        return { x: pointer.x, y: rect.bottom, side: 'bottom', distance: distances[0].value };
    }
  }

  getNearestFrameSide(rect, pointer, clampedX, clampedY) {
    const nearLeft = Math.abs(clampedX - rect.left);
    const nearRight = Math.abs(clampedX - rect.right);
    const nearTop = Math.abs(clampedY - rect.top);
    const nearBottom = Math.abs(clampedY - rect.bottom);

    return [
      { side: 'left', value: nearLeft + Math.max(0, rect.left - pointer.x) },
      { side: 'right', value: nearRight + Math.max(0, pointer.x - rect.right) },
      { side: 'top', value: nearTop + Math.max(0, rect.top - pointer.y) },
      { side: 'bottom', value: nearBottom + Math.max(0, pointer.y - rect.bottom) }
    ].sort((a, b) => a.value - b.value)[0].side;
  }

  clearNeonFrameHotspots() {
    this.neonFramePointer = null;
    this.neonFrameActiveElements.forEach((element) => this.resetNeonFrameElement(element));
    this.neonFrameActiveElements.clear();
  }

  resetNeonFrameElement(element) {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const lights = element.querySelectorAll(':scope > .neon-frame-light');
    lights.forEach((light) => {
      if (!(light instanceof HTMLElement)) {
        return;
      }
      light.classList.remove('is-visible');
      light.style.setProperty('--neon-frame-opacity', '0');
    });

    const curve = element.querySelector(':scope > .neon-frame-curve');
    if (curve instanceof SVGElement) {
      curve.classList.remove('is-visible');
      curve.style.setProperty('--neon-frame-opacity', '0');
    }
  }

  getScrollFadeContainerSelector() {
    return [
      '.content-section:not(#dashboard)',
      '.login-box',
      '.tutorial-card',
      '.mods-list',
      '.packs-list',
      '.skins-list',
      '.skin-library-results',
      '.settings-container'
    ].join(', ');
  }

  getScrollFadeContainers() {
    return Array.from(document.querySelectorAll(this.getScrollFadeContainerSelector()))
      .filter((element) => element instanceof HTMLElement);
  }

  getScrollFadeItems(section) {
    const blockSelector = [
      '.modrinth-type-tabs',
      '.modrinth-search-row',
      '.modrinth-load-more',
      '.mods-drop-zone',
      '.mod-item',
      '.pack-creator-card',
      '.pack-list-panel',
      '.pack-card',
      '.skin-card',
      '.setting-item',
      '.saved-skin-chip',
      '.online-skin-card',
      '.section-header',
      '.mods-check-status',
      '.modrinth-status',
      '.mods-empty',
      '.packs-empty',
      '.skins-empty',
      '.skin-library-search-row',
      '.settings-actions',
      '.sound-controls',
      '.sound-select-row',
      '.rgb-sliders',
      '.color-preview'
    ].join(', ');

    const candidates = Array.from(new Set(Array.from(section.querySelectorAll(blockSelector))));
    const candidateSet = new Set(candidates);

    return candidates
      .filter((item) => {
        let parent = item.parentElement;
        while (parent && parent !== section) {
          if (candidateSet.has(parent)) {
            return false;
          }
          parent = parent.parentElement;
        }
        return true;
      })
      .filter((item) => this.isScrollFadeObject(item, section));
  }

  isScrollFadeObject(item, container) {
    if (!(item instanceof HTMLElement) || item === container) {
      return false;
    }

    if (item.classList.contains('hidden') || item.closest('.hidden, .is-hidden')) {
      return false;
    }

    const style = window.getComputedStyle(item);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    const rect = item.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) {
      return false;
    }

    return true;
  }

  scheduleScrollFadeUpdate() {
    if (this.scrollFadeFrame) {
      return;
    }

    this.scrollFadeFrame = requestAnimationFrame(() => {
      this.scrollFadeFrame = null;
      this.updateScrollFade();
    });
  }

  isScrollableFadeContainer(section) {
    if (!(section instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(section);
    if (!/(auto|scroll|overlay)/u.test(style.overflowY)) {
      return false;
    }

    return section.scrollHeight > section.clientHeight + 4;
  }

  hasScrollableFadeAncestor(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const selector = this.getScrollFadeContainerSelector();
    let parent = element.parentElement;
    while (parent) {
      if (parent.matches(selector) && this.isScrollableFadeContainer(parent)) {
        return true;
      }
      parent = parent.parentElement;
    }

    return false;
  }

  resetScrollFadeItem(item) {
    if (!(item instanceof HTMLElement)) {
      return;
    }

    item.classList.remove('scroll-fade-item');
    item.style.removeProperty('--scroll-fade-scale');
    item.style.removeProperty('--scroll-fade-y');
  }

  resetScrollFadeContainer(section) {
    if (!(section instanceof HTMLElement)) {
      return;
    }

    section.querySelectorAll('.scroll-fade-item').forEach((item) => this.resetScrollFadeItem(item));
  }

  updateScrollFade() {
    this.getScrollFadeContainers().forEach((section) => {
      if (section.classList.contains('content-section') && !section.classList.contains('active')) {
        this.resetScrollFadeContainer(section);
        return;
      }

      const containerStyle = window.getComputedStyle(section);
      const sectionRect = section.getBoundingClientRect();
      if (containerStyle.display === 'none' || containerStyle.visibility === 'hidden' || sectionRect.height <= 0) {
        this.resetScrollFadeContainer(section);
        return;
      }

      const items = this.getScrollFadeItems(section);
      const visibleItems = new Set(items);
      section.querySelectorAll('.scroll-fade-item').forEach((item) => {
        if (!visibleItems.has(item)) {
          this.resetScrollFadeItem(item);
        }
      });

      if (!this.isScrollableFadeContainer(section)) {
        if (!this.hasScrollableFadeAncestor(section)) {
          items.forEach((item) => this.resetScrollFadeItem(item));
        }
        return;
      }

      const fadeTop = Math.min(240, Math.max(120, sectionRect.height * 0.34));
      const fadeBottom = Math.min(260, Math.max(130, sectionRect.height * 0.38));
      const visibleTop = sectionRect.top;
      const visibleBottom = sectionRect.bottom;

      items.forEach((item) => {
        item.classList.add('scroll-fade-item');

        const itemRect = item.getBoundingClientRect();
        const itemHeight = Math.max(1, itemRect.height);
        const topVisibleProgress = (itemRect.bottom - visibleTop) / Math.min(fadeTop, itemHeight);
        const bottomVisibleProgress = (visibleBottom - itemRect.top) / Math.min(fadeBottom, itemHeight);
        const edgeProgress = Math.min(1, Math.max(0, Math.min(topVisibleProgress, bottomVisibleProgress)));
        const easedProgress = edgeProgress * edgeProgress * edgeProgress * (edgeProgress * ((edgeProgress * 6) - 15) + 10);
        const hiddenProgress = 1 - easedProgress;
        const scale = 0.8 + (0.2 * easedProgress);
        const direction = topVisibleProgress < bottomVisibleProgress ? -1 : 1;
        const translateY = direction * Math.round(hiddenProgress * 26);

        item.style.setProperty('--scroll-fade-scale', scale.toFixed(3));
        item.style.setProperty('--scroll-fade-y', `${translateY}px`);
      });
    });
  }

  async handleLogin() {
    this.showLoading(this.authConfig?.forcedOfflineMode ? 'Offline-Login wird vorbereitet...' : 'Xbox/Microsoft-Login wird im Browser geöffnet...');

    try {
      const result = await window.electronAPI.login();
      if (result.success) {
        this.user = setCurrentUser(result.user);
        const greeting = this.user.username || 'Spieler';
        this.showNotification(result.warning || `Willkommen, ${greeting}!`);
        this.showMainScreen();
        await this.loadGameData();
      } else {
        this.showNotification(`Anmeldung fehlgeschlagen: ${result.error}`);
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async loadAuthConfig() {
    try {
      const result = await window.electronAPI.getAuthConfig();
      if (!result.success) {
        return;
      }

      this.authConfig = result;
      this.updateMicrosoftConfigUI();
    } catch (error) {
      console.error('Auth config error:', error);
    }
  }

  async loadDiagnosticSettings() {
    const toggle = document.getElementById('debug-mode-toggle');
    if (!toggle || typeof window.electronAPI?.getDebugMode !== 'function') {
      return;
    }

    try {
      const status = await window.electronAPI.getDebugMode();
      this.setSettingToggleChecked(toggle, Boolean(status?.debugMode));
      this.updateDiagnosticsStatus(status?.logFile ? `Logdatei: ${status.logFile}` : '');
    } catch (error) {
      console.error('Diagnostic settings error:', error);
    }
  }

  updateDiagnosticsStatus(text, state = '') {
    const statusEl = document.getElementById('diagnostics-status');
    if (!statusEl) {
      return;
    }

    statusEl.classList.remove('is-error', 'is-warning', 'is-ok');
    if (state) {
      statusEl.classList.add(state);
    }
    statusEl.textContent = this.localizeText(text || 'Logs und Integritätsprüfung bereit.');
  }

  async setDebugMode(enabled) {
    const toggle = document.getElementById('debug-mode-toggle');
    if (typeof window.electronAPI?.setDebugMode !== 'function') {
      if (toggle) {
        this.syncSettingToggleVisualState(toggle);
      }
      return;
    }

    try {
      const result = await window.electronAPI.setDebugMode(Boolean(enabled));
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        await this.loadDiagnosticSettings();
        return;
      }
      if (toggle) {
        this.setSettingToggleChecked(toggle, result.debugMode ?? Boolean(enabled));
      }
      this.showNotification(result.message || 'Debug-Modus gespeichert.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
      await this.loadDiagnosticSettings();
    }
  }

  async cleanupNumberedAndDuplicateMods() {
    if (typeof window.electronAPI?.cleanupNumberedAndDuplicateMods !== 'function') {
      this.showNotification('Fehler: Mod-Bereinigung ist im Launcher nicht verfügbar.');
      return;
    }

    const confirmed = await this.showConfirm({
      title: 'Alle -2-Mods löschen',
      message: 'Jede Mod-Datei mit „-2.jar“ am Ende wird sofort und dauerhaft aus allen Launcher-Modordnern gelöscht. Pflichtmods werden nicht ausgenommen und nicht neu installiert.',
      confirmText: 'Endgültig löschen'
    });
    if (!confirmed) {
      return;
    }

    const button = document.getElementById('cleanup-numbered-mods-btn');
    const status = document.getElementById('numbered-mod-cleanup-status');
    if (button) {
      button.disabled = true;
      button.textContent = 'Löscht...';
    }
    if (status) {
      status.textContent = 'Alle Mod-Dateien mit -2.jar am Ende werden gelöscht...';
    }
    this.showLoading('Lösche alle -2-Mods...');

    try {
      this.suppressModSyncUntil = Date.now() + 10000;
      const result = await window.electronAPI.cleanupNumberedAndDuplicateMods();
      if (!result.success) {
        throw new Error(result.error || 'Mod-Bereinigung fehlgeschlagen.');
      }
      const summary = `${result.removed || 0} Mod-Datei${result.removed === 1 ? '' : 'en'} mit -2.jar am Ende dauerhaft gelöscht.`;
      if (status) {
        status.textContent = summary;
      }
      this.showNotification(result.message || summary);
      await this.loadMods({ skipManagedSync: true });
    } catch (error) {
      if (status) {
        status.textContent = `Fehler: ${error.message}`;
      }
      this.showNotification(`Fehler: ${error.message}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Alle -2-Mods löschen';
      }
      this.hideLoading();
    }
  }

  async runDiagnostics() {
    if (typeof window.electronAPI?.runDiagnostics !== 'function') {
      this.showNotification('Diagnose ist nicht verfügbar.');
      return;
    }

    this.showLoading('Diagnose läuft...');
    try {
      const result = await window.electronAPI.runDiagnostics();
      if (!result.success) {
        this.updateDiagnosticsStatus(`Diagnose fehlgeschlagen: ${result.error}`, 'is-error');
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      this.lastDiagnostics = result;
      const issueCount = result.issues?.length || 0;
      const warningCount = result.warnings?.length || 0;
      const repairCount = result.repairs?.length || 0;
      const crashFinding = Array.isArray(result.crashAnalysis?.findings) ? result.crashAnalysis.findings[0] : null;
      const statusText = issueCount
        ? `${issueCount} Problem${issueCount === 1 ? '' : 'e'}, ${warningCount} Hinweis${warningCount === 1 ? '' : 'e'}, ${repairCount} Reparaturprüfung${repairCount === 1 ? '' : 'en'}.`
        : `${warningCount} Hinweis${warningCount === 1 ? '' : 'e'}, ${repairCount} Reparaturprüfung${repairCount === 1 ? '' : 'en'}.`;
      const crashText = crashFinding ? ` Crash: ${crashFinding.title}.` : '';
      this.updateDiagnosticsStatus(`${statusText}${crashText}`, issueCount ? 'is-error' : (warningCount ? 'is-warning' : 'is-ok'));
      this.showNotification(`Diagnose abgeschlossen: ${statusText}${crashText}`);
    } catch (error) {
      this.updateDiagnosticsStatus(`Diagnose fehlgeschlagen: ${error.message}`, 'is-error');
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async openDiagnosticsFolder() {
    if (typeof window.electronAPI?.openDiagnosticsFolder !== 'function') {
      return;
    }

    try {
      const result = await window.electronAPI.openDiagnosticsFolder();
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.showNotification(`Logs geöffnet: ${result.path}`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  updateMicrosoftConfigUI() {
    const statusEl = document.getElementById('login-config-status');

    if (!statusEl) {
      return;
    }

    if (this.authConfig?.forcedOfflineMode) {
      statusEl.textContent = 'Dauer-Offline-Modus aktiv. Multiplayer geht nur auf Offline-Mode-Servern.';
      statusEl.style.color = 'var(--warning)';
    } else if (this.authConfig?.usesDefaultClientId) {
      statusEl.textContent = 'Xbox/Microsoft-Weblogin aktiv | Kein Azure-Setup nötig | Browser wird automatisch geöffnet';
      statusEl.style.color = this.authConfig?.allowOfficialLauncherFallback ? 'var(--warning)' : 'var(--success)';
    } else {
      statusEl.textContent = 'Xbox/Microsoft-Weblogin wird vorbereitet';
      statusEl.style.color = 'var(--text-gray)';
    }
  }

  async saveMicrosoftClientId(showNotification = true) {
    const clientIdInput = document.getElementById('client-id-input');
    const clientId = clientIdInput?.value.trim() || '';

    try {
      const result = await window.electronAPI.setMicrosoftClientId(clientId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return false;
      }

      this.authConfig = result;
      this.updateMicrosoftConfigUI();

      if (showNotification) {
        this.showNotification(clientId ? 'Client-ID gespeichert.' : 'Client-ID entfernt.');
      }

      return true;
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
      return false;
    }
  }

  async openLauncherConfig() {
    try {
      const result = await window.electronAPI.openLauncherConfig();
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      this.showNotification(`Config geöffnet: ${result.configPath}`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async handleOfflineLogin() {
    this.showLoading('Offline-Account wird vorbereitet...');
    try {
      const result = await window.electronAPI.loginOffline('OfflinePlayer');
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.user = setCurrentUser(result.user);
      this.accountsConfig = {
        activeAccountId: result.activeAccountId || '',
        accounts: result.accounts || []
      };
      this.showMainScreen();
      await this.loadGameData();
      this.showNotification(result.warning || `Offline Login aktiv. Willkommen ${this.user.username}.`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async logout() {
    const confirmed = await this.showConfirm({
      title: 'Abmelden',
      message: 'Möchtest du dich wirklich abmelden?',
      confirmText: 'Abmelden'
    });
    if (!confirmed) {
      return;
    }

    try {
      await window.electronAPI.logout();
      this.user = setCurrentUser(null);
      this.showLoginScreen();
      this.showNotification('Abgemeldet!');
    } catch (error) {
      this.showNotification('Fehler beim Abmelden!');
    }
  }

  showLoginScreen() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('main-screen').classList.remove('active');
    this.scheduleScrollFadeUpdate();
  }

  updateUsernameDisplays() {
    const username = this.user?.username || 'Player';
    const headerUsername = document.getElementById('username-display');

    if (headerUsername) {
      headerUsername.textContent = username;
    }
    const adminStatus = document.getElementById('admin-status');
    if (adminStatus) {
      adminStatus.classList.toggle('hidden', !hasAdminPermission());
    }
    this.updateHostingBetaUI();
  }

  showMainScreen() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    this.updateUsernameDisplays();
    this.scheduleScrollFadeUpdate();
  }

  async launchMinecraft(options = {}) {
    if (!this.user) {
      this.showNotification('Bitte anmelden!');
      return;
    }

    const incompatibleMods = this.getIncompatibleMods();
    if (incompatibleMods.length > 0) {
      this.showNotification(`Start blockiert: ${incompatibleMods.length} Mod${incompatibleMods.length === 1 ? '' : 's'} passen nicht zur ausgewählten Version.`);
      return;
    }

    const launchGate = this.canStartMinecraft();
    if (!launchGate.allowed) {
      this.showNotification(`Start blockiert: ${launchGate.reason || 'Mod-Änderungen laufen noch.'}`);
      this.updateLaunchButtonAvailability();
      return;
    }

    if (this.minecraftLaunchState !== 'idle') {
      this.showNotification('Minecraft startet bereits.');
      return;
    }

    const versionLabel = this.getSelectedVersionDisplayName() || 'Minecraft';
    const launchOptions = {};
    if (options.directJoin) {
      const serverId = options.serverId || this.selectedDirectServerId || '';
      if (!serverId) {
        this.showNotification('Bitte wähle zuerst einen Server-Favoriten aus.');
        return;
      }
      launchOptions.serverId = serverId;
    }

    const launchButton = document.getElementById('launch-btn');
    const previousLaunchButtonText = launchButton?.querySelector('.launch-progress-label')?.textContent || 'Play';
    this.minecraftLaunchButtonIdleText = previousLaunchButtonText;
    this.setMinecraftLaunchState('launching');
    this.showNotification(options.directJoin
      ? `Starte ${versionLabel} und trete Server bei...`
      : `Starte ${versionLabel} als ${this.user.username}...`);

    try {
      const accessToken = this.user?.accessToken || '';
      const result = await window.electronAPI.launchMinecraft(this.user.username, accessToken, launchOptions);
      if (result.success) {
        let processStillRunning = true;
        if (typeof window.electronAPI.getMinecraftRuntimeStatus === 'function') {
          try {
            const runtimeStatus = await window.electronAPI.getMinecraftRuntimeStatus();
            processStillRunning = Boolean(runtimeStatus?.running || runtimeStatus?.launching);
          } catch (_error) {
            // The lifecycle event remains authoritative if the status probe fails.
          }
        }
        if (!processStillRunning) this.setMinecraftLaunchState('idle');
        this.showNotification(result.message);
      } else {
        if (result.alreadyRunning) {
          this.setMinecraftLaunchState('running');
        } else {
          this.setMinecraftLaunchState('idle');
        }
        this.showNotification('Fehler beim Starten: ' + result.error);
      }
    } catch (error) {
      this.setMinecraftLaunchState('idle');
      console.error('Launch error:', error);
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.updateModCompatibilityUI();
      this.resetDashboardSkinLaunchExitAnimation();
    }
  }

  playDashboardSkinLaunchExitAnimation() {
    return;
    /* Exit animations are intentionally disabled: the dashboard skin stays put.
    const stage = document.querySelector('.dashboard-skin-stage');
    const canvas = document.getElementById('dashboard-skin-canvas');
    if (!stage || !canvas || canvas.classList.contains('hidden')) {
      return;
    }

    if (stage.classList.contains('is-sprinting-back')) {
      this.playDashboardSkinContinueRightExitAnimation(stage, canvas);
      return;
    }

    this.clearDashboardSkinCanvasAnimation();
    this.clearDashboardSkinEffects();
    this.clearDashboardSkinLaunchExitAnimationListener(canvas);
    this.dashboardSkinLaunchExitActive = true;
    if (this.dashboardSkinViewer && window.skinview3d?.CrouchAnimation && window.skinview3d?.FunctionAnimation) {
      const crouchAnimation = new window.skinview3d.CrouchAnimation();
      crouchAnimation.speed = 0;
      crouchAnimation.progress = 0.125;

      this.dashboardSkinWalkAnimation = new window.skinview3d.FunctionAnimation((player, progress) => {
        crouchAnimation.animate(player);

        const stride = progress * 5.2;
        player.skin.leftLeg.rotation.x = 0.45 * Math.sin(stride);
        player.skin.rightLeg.rotation.x = 0.45 * Math.sin(stride + Math.PI);
        player.skin.leftArm.rotation.x = 0.33 + (0.16 * Math.sin(stride + Math.PI));
        player.skin.rightArm.rotation.x = 0.33 + (0.16 * Math.sin(stride));
        this.applyDashboardSkinSmoothHeadTracking(player, 0.07);

        const turnProgress = Math.min(1, progress * 3.8);
        const easedTurn = 1 - Math.pow(1 - turnProgress, 3);
        const targetRotation = -Math.PI / 2;
        player.rotation.y = -0.2 + ((targetRotation + 0.2) * easedTurn);
        player.position.y = -3.5;
      });
      this.dashboardSkinWalkAnimation.speed = 1;
      this.dashboardSkinViewer.animation = this.dashboardSkinWalkAnimation;
      this.configureDashboardSkinViewerCamera();
    } else if (this.dashboardSkinViewer && window.skinview3d?.WalkingAnimation) {
      this.dashboardSkinWalkAnimation = new window.skinview3d.WalkingAnimation();
      this.dashboardSkinWalkAnimation.speed = 0.7;
      this.dashboardSkinWalkAnimation.headBobbing = false;
      this.dashboardSkinWalkAnimation.addAnimation((player, progress) => {
        const turnProgress = Math.min(1, progress * 3.8);
        const easedTurn = 1 - Math.pow(1 - turnProgress, 3);
        const targetRotation = -Math.PI / 2;
        player.rotation.y = -0.2 + ((targetRotation + 0.2) * easedTurn);
        player.position.y = -3.5;
        this.applyDashboardSkinSmoothHeadTracking(player, 0.07);
      });
      this.dashboardSkinViewer.animation = this.dashboardSkinWalkAnimation;
      this.configureDashboardSkinViewerCamera();
    }

    document.body.classList.add('dashboard-skin-exiting');
    stage.classList.remove('is-walking-left');
    this.dashboardSkinLaunchExitAnimationEndHandler = (event) => {
      if (event.target !== canvas || event.animationName !== 'dashboardSkinWalkLeft') {
        return;
      }

      this.completeDashboardSkinLaunchExitAnimation();
    };
    canvas.addEventListener('animationend', this.dashboardSkinLaunchExitAnimationEndHandler);
    void stage.offsetWidth;
    stage.classList.add('is-walking-left');
    */
  }

  playDashboardSkinContinueRightExitAnimation(stage, canvas) {
    return;
    /* Exit animations are intentionally disabled.
    this.clearDashboardSkinReturnAnimationListener(canvas);
    this.clearDashboardSkinEffects();

    const computedStyle = window.getComputedStyle(canvas);
    const currentTransform = computedStyle.transform && computedStyle.transform !== 'none'
      ? computedStyle.transform
      : 'translate3d(0, -4%, 0) scale(1)';
    const currentOpacity = computedStyle.opacity || '1';
    const currentFilter = computedStyle.filter && computedStyle.filter !== 'none'
      ? computedStyle.filter
      : 'drop-shadow(0 0 20px rgba(var(--primary-rgb), 0.22))';

    this.clearDashboardSkinCanvasAnimation({ keepInlineStyles: true });
    stage.classList.remove('is-sprinting-back', 'is-walking-left');
    canvas.style.transform = currentTransform;
    canvas.style.opacity = currentOpacity;
    canvas.style.filter = currentFilter;

    if (this.dashboardSkinViewer && window.skinview3d?.FunctionAnimation) {
      this.dashboardSkinWalkAnimation = new window.skinview3d.FunctionAnimation((player, progress) => {
        const stride = progress * 14.6;
        player.rotation.y = Math.PI / 2;
        player.rotation.z = 0.014 * Math.sin(stride + Math.PI);
        player.position.y = -3.5;
        player.skin.body.rotation.x = 0.05;
        player.skin.leftLeg.rotation.x = 0.66 * Math.sin(stride + Math.PI);
        player.skin.rightLeg.rotation.x = 0.66 * Math.sin(stride);
        player.skin.leftArm.rotation.x = 0.72 * Math.sin(stride);
        player.skin.rightArm.rotation.x = 0.72 * Math.sin(stride + Math.PI);
        player.skin.leftArm.rotation.z = 0.05;
        player.skin.rightArm.rotation.z = -0.05;
        this.applyDashboardSkinSmoothHeadTracking(player, 0.07);
      });
      this.dashboardSkinWalkAnimation.speed = 1;
      this.dashboardSkinViewer.animation = this.dashboardSkinWalkAnimation;
      this.configureDashboardSkinViewerCamera();
    }

    document.body.classList.add('dashboard-skin-exiting');
    void canvas.offsetWidth;
    this.dashboardSkinCanvasAnimation = canvas.animate([
      {
        opacity: Number.parseFloat(currentOpacity) || 1,
        filter: currentFilter,
        transform: currentTransform
      },
      {
        opacity: 1,
        filter: 'drop-shadow(0 10px 18px rgba(var(--primary-rgb), 0.18))',
        transform: 'translate3d(46vw, -4%, 0) scale(1)',
        offset: 0.58
      },
      {
        opacity: 0,
        filter: 'drop-shadow(0 0 0 rgba(var(--primary-rgb), 0))',
        transform: 'translate3d(94vw, -4%, 0) scale(1)'
      }
    ], {
      duration: 1120,
      easing: 'linear',
      fill: 'forwards'
    });

    this.dashboardSkinCanvasAnimation.onfinish = () => {
      canvas.style.opacity = '0';
      canvas.style.filter = 'drop-shadow(0 0 0 rgba(var(--primary-rgb), 0))';
      canvas.style.transform = 'translate3d(94vw, -4%, 0) scale(1)';
      this.dashboardSkinCanvasAnimation = null;
    };
    */
  }

  previewDashboardSkinAnimation(animationType) {
    return;
    /* Dashboard skin movement previews were removed with exit animations.
    this.activateSection('dashboard');
    window.setTimeout(() => {
      if (animationType === 'sneak-exit') {
        this.playDashboardSkinLaunchExitAnimation();
        this.dashboardSkinEffectTimers.push(window.setTimeout(() => {
          this.resetDashboardSkinLaunchExitAnimation();
        }, 3450));
        return;
      }

      if (animationType === 'sprint-return') {
        this.playDashboardSkinReturnAnimation('sprint');
        return;
      }

      if (animationType === 'continue-right-exit') {
        const stage = document.querySelector('.dashboard-skin-stage');
        const canvas = document.getElementById('dashboard-skin-canvas');
        if (stage && canvas && !canvas.classList.contains('hidden')) {
          this.playDashboardSkinContinueRightExitAnimation(stage, canvas);
        }
        return;
      }

      this.playDashboardSkinReturnAnimation('random');
    }, 180);
    */
  }

  playDashboardSkinReturnAnimation(mode = 'random') {
    return;
  }

  playDashboardSkinSprintReturnAnimation() {
    return;
    /* Return animations are intentionally disabled.
    const stage = document.querySelector('.dashboard-skin-stage');
    const canvas = document.getElementById('dashboard-skin-canvas');
    if (!stage || !canvas || canvas.classList.contains('hidden')) {
      this.resetDashboardSkinLaunchExitAnimation();
      return;
    }

    this.clearDashboardSkinCanvasAnimation();
    this.clearDashboardSkinEffects();
    if (this.dashboardSkinViewer && window.skinview3d?.FunctionAnimation) {
      this.dashboardSkinWalkAnimation = new window.skinview3d.FunctionAnimation((player, progress) => {
        const clamp01 = (value) => Math.max(0, Math.min(1, value));
        const easeInOut = (value) => value * value * (3 - (2 * value));
        const stride = progress * 14.6;
        const bodyTurnProgress = easeInOut(clamp01((progress - 1.08) / 0.22));
        const recoveryProgress = easeInOut(clamp01((progress - 1.02) / 0.26));
        const motionAmount = 1 - recoveryProgress;
        const startRotation = Math.PI / 2;
        const targetRotation = -0.2;
        player.rotation.y = startRotation + ((targetRotation - startRotation) * bodyTurnProgress);
        player.rotation.z = 0.018 * Math.sin(stride + Math.PI) * motionAmount;
        player.position.y = -3.5;
        player.skin.body.rotation.x = 0.06 * motionAmount;
        player.skin.leftLeg.rotation.x = 0.64 * Math.sin(stride + Math.PI) * motionAmount;
        player.skin.rightLeg.rotation.x = 0.64 * Math.sin(stride) * motionAmount;
        player.skin.leftArm.rotation.x = 0.7 * Math.sin(stride) * motionAmount;
        player.skin.rightArm.rotation.x = 0.7 * Math.sin(stride + Math.PI) * motionAmount;
        player.skin.leftArm.rotation.z = 0.05 * motionAmount;
        player.skin.rightArm.rotation.z = -0.05 * motionAmount;
        this.applyDashboardSkinSmoothHeadTracking(player, 0.07);
      });
      this.dashboardSkinWalkAnimation.speed = 1;
      this.dashboardSkinViewer.animation = this.dashboardSkinWalkAnimation;
      this.configureDashboardSkinViewerCamera();
    } else if (this.dashboardSkinViewer && window.skinview3d?.WalkingAnimation) {
      this.dashboardSkinWalkAnimation = new window.skinview3d.WalkingAnimation();
      this.dashboardSkinWalkAnimation.speed = 1.75;
      this.dashboardSkinWalkAnimation.headBobbing = false;
      this.dashboardSkinWalkAnimation.addAnimation((player, progress) => {
        const clamp01 = (value) => Math.max(0, Math.min(1, value));
        const easeInOut = (value) => value * value * (3 - (2 * value));
        const bodyTurnProgress = easeInOut(clamp01((progress - 1.08) / 0.22));
        const startRotation = Math.PI / 2;
        const targetRotation = -0.2;
        player.rotation.y = startRotation + ((targetRotation - startRotation) * bodyTurnProgress);
        player.position.y = -3.5;
        this.applyDashboardSkinSmoothHeadTracking(player, 0.07);
      });
      this.dashboardSkinViewer.animation = this.dashboardSkinWalkAnimation;
      this.configureDashboardSkinViewerCamera();
    }

    document.body.classList.add('dashboard-skin-exiting');
    stage.classList.remove('is-walking-left', 'is-sprinting-back');

    this.clearDashboardSkinReturnAnimationListener(canvas);
    const handleReturnEnd = (event) => {
      if (event.target !== canvas) {
        return;
      }

      stage.classList.remove('is-sprinting-back');
      this.dashboardSkinReturnAnimationEndHandler = null;
      this.resetDashboardSkinLaunchExitAnimation();
    };

    this.dashboardSkinReturnAnimationEndHandler = handleReturnEnd;
    canvas.addEventListener('animationend', handleReturnEnd, { once: true });
    void stage.offsetWidth;
    stage.classList.add('is-sprinting-back');
    */
  }

  clearDashboardSkinEffects() {
    this.dashboardSkinEffectTimers.forEach((timerId) => window.clearTimeout(timerId));
    this.dashboardSkinEffectTimers = [];
    document.querySelector('.dashboard-skin-effect-layer')?.replaceChildren();
  }

  clearDashboardSkinCanvasAnimation(options = {}) {
    if (this.dashboardSkinCanvasAnimation) {
      this.dashboardSkinCanvasAnimation.cancel();
      this.dashboardSkinCanvasAnimation = null;
    }

    if (!options.keepInlineStyles) {
      const canvas = document.getElementById('dashboard-skin-canvas');
      if (canvas) {
        canvas.style.opacity = '';
        canvas.style.filter = '';
        canvas.style.transform = '';
      }
    }
  }

  clearDashboardSkinLaunchExitAnimationListener(canvas = document.getElementById('dashboard-skin-canvas')) {
    if (!canvas || !this.dashboardSkinLaunchExitAnimationEndHandler) {
      return;
    }

    canvas.removeEventListener('animationend', this.dashboardSkinLaunchExitAnimationEndHandler);
    this.dashboardSkinLaunchExitAnimationEndHandler = null;
  }

  completeDashboardSkinLaunchExitAnimation() {
    this.resetDashboardSkinLaunchExitAnimation();
  }

  clearDashboardSkinReturnAnimationListener(canvas = document.getElementById('dashboard-skin-canvas')) {
    if (!canvas || !this.dashboardSkinReturnAnimationEndHandler) {
      return;
    }

    canvas.removeEventListener('animationend', this.dashboardSkinReturnAnimationEndHandler);
    this.dashboardSkinReturnAnimationEndHandler = null;
  }

  applyDashboardSkinSmoothHeadTracking(player, lerp = 0.12) {
    if (!player?.skin?.head) {
      return;
    }

    this.dashboardSkinHeadCurrentYaw += (this.dashboardSkinHeadTargetYaw - this.dashboardSkinHeadCurrentYaw) * lerp;
    this.dashboardSkinHeadCurrentPitch += (this.dashboardSkinHeadTargetPitch - this.dashboardSkinHeadCurrentPitch) * lerp;
    player.skin.head.rotation.x = this.dashboardSkinHeadCurrentPitch;
    player.skin.head.rotation.y = this.dashboardSkinHeadCurrentYaw;
    player.skin.head.rotation.z = 0;
  }

  updateDashboardSkinHeadTarget(event) {
    const canvas = document.getElementById('dashboard-skin-canvas');
    if (!canvas || canvas.classList.contains('hidden') || !this.dashboardSkinViewer || !this.dashboardSkinIdleAnimation) {
      this.dashboardSkinHeadTargetYaw = 0;
      this.dashboardSkinHeadTargetPitch = 0;
      return;
    }

    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    if (!viewportWidth) {
      this.dashboardSkinHeadTargetYaw = 0;
      this.dashboardSkinHeadTargetPitch = 0;
      return;
    }

    const horizontalDistance = ((Number(event.clientX) || 0) - (viewportWidth / 2)) / Math.max(1, viewportWidth / 2);
    const clampedDistance = Math.max(-1, Math.min(1, horizontalDistance));
    this.dashboardSkinHeadTargetYaw = clampedDistance * 0.92;

    const launchButton = document.getElementById('launch-btn');
    const buttonRect = launchButton?.getBoundingClientRect();
    if (!buttonRect?.width || !buttonRect?.height) {
      this.dashboardSkinHeadTargetPitch = 0;
      return;
    }

    const buttonCenterX = buttonRect.left + (buttonRect.width / 2);
    const buttonCenterY = buttonRect.top + (buttonRect.height / 2);
    const buttonDistance = Math.hypot((Number(event.clientX) || 0) - buttonCenterX, (Number(event.clientY) || 0) - buttonCenterY);
    const closeness = Math.max(0, Math.min(1, 1 - (buttonDistance / 360)));
    this.dashboardSkinHeadTargetPitch = 0.38 * Math.pow(closeness, 1.45);
  }

  startDashboardSkinGlobalCursorTracking() {
    if (this.dashboardSkinCursorTrackingTimer || typeof window.electronAPI?.getGlobalCursorPosition !== 'function') {
      return;
    }

    const trackCursor = async () => {
      if (!this.dashboardSkinCursorTrackingInFlight) {
        this.dashboardSkinCursorTrackingInFlight = true;
        try {
          const cursor = await window.electronAPI.getGlobalCursorPosition();
          if (cursor?.success) {
            this.updateDashboardSkinHeadTarget({
              clientX: Number(cursor.clientX) || 0,
              clientY: Number(cursor.clientY) || 0
            });
          }
        } catch (error) {
          console.warn('Global cursor tracking failed:', error);
        } finally {
          this.dashboardSkinCursorTrackingInFlight = false;
        }
      }
    };

    this.dashboardSkinCursorTrackingTimer = window.setInterval(trackCursor, 33);
    trackCursor();
  }

  resetDashboardSkinLaunchExitAnimation() {
    document.body.classList.remove('dashboard-skin-exiting');
    const stage = document.querySelector('.dashboard-skin-stage');
    stage?.classList.remove('is-walking-left', 'is-sprinting-back');
    this.dashboardSkinLaunchExitActive = false;
    this.clearDashboardSkinLaunchExitAnimationListener();
    this.clearDashboardSkinReturnAnimationListener();
    this.clearDashboardSkinCanvasAnimation();
    this.clearDashboardSkinEffects();
    if (this.dashboardSkinViewer && this.dashboardSkinIdleAnimation) {
      this.dashboardSkinViewer.animation = this.dashboardSkinIdleAnimation;
      this.configureDashboardSkinViewerCamera();
    }
  }

  async installFabric() {
    this.showLoading('Aktiviere lokales Fabric...');

    try {
      const result = await window.electronAPI.installFabric();
      if (result.success) {
        this.selectedVersionId = result.selectedVersionId || this.selectedVersionId;
        await this.refreshPackContext();
        const warningText = result.warning ? ` Hinweis: ${result.warning}` : '';
        this.showNotification(`${result.message}${warningText}`);
      } else {
        this.showNotification('Fehler: ' + result.error);
      }
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async loadMods(options = {}) {
    this.modsLoadGeneration = (this.modsLoadGeneration || 0) + 1;
    const loadGeneration = this.modsLoadGeneration;
    try {
      const getMods = options.skipManagedSync && typeof window.electronAPI?.getModsWithoutSync === 'function'
        ? window.electronAPI.getModsWithoutSync
        : window.electronAPI.getMods;
      const result = await getMods();
      if (loadGeneration !== this.modsLoadGeneration) {
        return;
      }
      this.mods = Array.isArray(result) ? result : [];
      await this.loadInstalledModProjectIds();
      if (loadGeneration !== this.modsLoadGeneration) {
        return;
      }
      this.renderMods();
      this.updateModsCount();
      this.updateRemoveIncompatibleModsButton();
      this.updateModCompatibilityUI();
      this.renderModrinthResults({ force: true });
      this.updatePackContextUI();
      this.updateModsCheckStatus();
    } catch (error) {
      if (loadGeneration !== this.modsLoadGeneration) {
        return;
      }
      console.error('Error loading mods:', error);
      this.mods = [];
      this.installedModProjectIds = new Set();
      this.renderMods();
      this.updateModsCount();
      this.updateRemoveIncompatibleModsButton();
      this.updateModCompatibilityUI();
      this.renderModrinthResults({ force: true });
      this.updatePackContextUI();
      this.updateModsCheckStatus('Mod-Status konnte nicht geladen werden.');
    }
  }

  preloadImageAsset(source, timeoutMs = 12000) {
    const normalizedSource = String(source || '').trim();
    if (!normalizedSource) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        resolve();
      };
      const timer = window.setTimeout(finish, timeoutMs);
      image.onerror = finish;
      image.onload = () => {
        if (typeof image.decode === 'function') {
          image.decode().catch(() => {}).finally(finish);
          return;
        }
        finish();
      };
      image.decoding = 'async';
      image.src = normalizedSource;
    });
  }

  async preloadStartupContentIcons() {
    const iconSources = new Set([
      ...this.mods.map((entry) => entry?.iconUrl),
      ...this.modrinthLoadedResults.map((entry) => entry?.iconUrl),
      ...(this.skinConfig?.skins || []).map((entry) => entry?.previewDataUrl),
      this.skinConfig?.activeSkin?.previewDataUrl
    ].map((source) => String(source || '').trim()).filter(Boolean));
    await Promise.all(Array.from(iconSources, (source) => this.preloadImageAsset(source)));
  }

  getInstalledModProjectIdsFromLoadedMods() {
    return this.mods
      .filter((mod) => mod.managed && mod.projectId)
      .map((mod) => mod.projectId);
  }

  getVisibleInstalledModProjectIds() {
    return this.getInstalledModProjectIdsFromLoadedMods();
  }

  setInstalledModProjectIds(projectIds) {
    this.installedModProjectIds = new Set(
      (Array.isArray(projectIds) ? projectIds : [])
        .map((projectId) => String(projectId || '').trim())
        .filter(Boolean)
    );
  }

  markModrinthProjectInstalled(projectId, options = {}) {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId) {
      return;
    }

    this.setInstalledModProjectIds([...this.installedModProjectIds, normalizedProjectId]);
    const markInstalled = (project) => project?.projectId === normalizedProjectId
      ? { ...project, installed: true }
      : project;
    this.modrinthLoadedResults = this.modrinthLoadedResults.map(markInstalled);
    this.modrinthResults = this.modrinthResults.map(markInstalled);
    if (options.render !== false) {
      this.renderModrinthResults({ force: true });
    }
  }

  getInstalledModSlugsFromLoadedMods() {
    return this.mods
      .filter((mod) => mod.managed && mod.slug)
      .map((mod) => String(mod.slug || '').trim().toLowerCase())
      .filter(Boolean);
  }

  async loadInstalledModProjectIds() {
    const loadedProjectIds = this.getInstalledModProjectIdsFromLoadedMods();
    if (typeof window.electronAPI?.getInstalledModProjectIds !== 'function') {
      this.setInstalledModProjectIds(loadedProjectIds);
      return;
    }

    try {
      const result = await window.electronAPI.getInstalledModProjectIds(this.getActiveContextVersionId());
      this.setInstalledModProjectIds([...loadedProjectIds, ...(Array.isArray(result) ? result : [])]);
    } catch (error) {
      console.warn('Installed mod project id load failed:', error);
      this.setInstalledModProjectIds(loadedProjectIds);
    }
  }

  async loadPacks() {
    try {
      const result = await window.electronAPI.getPacks();
      if (!result.success) {
        return;
      }

      this.packsConfig = result;
      this.hasCopiedProfileSettings = Boolean(result.settingsClipboardAvailable);
      this.renderVersionOptions();
      this.renderPacks();
      this.updatePackContextUI();
    } catch (error) {
      console.error('Profile config error:', error);
    }
  }

  async loadServerFavorites() {
    if (typeof window.electronAPI?.getServerFavorites !== 'function') {
      return;
    }
    try {
      const result = await window.electronAPI.getServerFavorites();
      if (!result.success) {
        return;
      }
      this.serverFavorites = result.servers || [];
      this.renderServerFavorites();
      this.renderStartServerList();
    } catch (error) {
      console.error('Server favorites error:', error);
    }
  }


  async loadHostedServerStatus() {
    if (typeof window.electronAPI?.getHostedServerStatus !== 'function') {
      return;
    }
    try {
      const result = await window.electronAPI.getHostedServerStatus();
      if (!result?.success) {
        this.updateHostedServerStatus({ running: false, error: result?.error || 'Serverstatus konnte nicht geladen werden.' });
        return;
      }
      this.hostedServerStatus = result;
      this.hostedServers = result.servers || [];
      this.activeHostedServerId = result.activeServerId || result.activeServer?.id || '';
      this.updateHostedServerStatus(result);
    } catch (error) {
      console.error('Hosted server status error:', error);
      this.updateHostedServerStatus({ running: false, error: error.message });
    }
  }

  updateHostedServerStatus(status = this.hostedServerStatus || {}) {
    const statusEl = document.getElementById('hosted-server-status');
    const listStatusEl = document.getElementById('hosted-server-list-status');
    const addressEl = document.getElementById('hosted-server-address');
    const hostNote = document.querySelector('.server-host-note');
    const nameInput = document.getElementById('hosted-server-name-input');
    const editionSelect = document.getElementById('hosted-server-edition-select');
    const softwareSelect = document.getElementById('hosted-server-software-select');
    const versionInput = document.getElementById('hosted-server-version-input');
    const ramInput = document.getElementById('hosted-server-ram-input');
    const portInput = document.getElementById('hosted-server-port-input');
    const maxPlayersInput = document.getElementById('hosted-server-max-players-input');
    const difficultySelect = document.getElementById('hosted-server-difficulty-select');
    const gamemodeSelect = document.getElementById('hosted-server-gamemode-select');
    const motdInput = document.getElementById('hosted-server-motd-input');
    const viewDistanceInput = document.getElementById('hosted-server-view-distance-input');
    const simulationDistanceInput = document.getElementById('hosted-server-simulation-distance-input');
    const spawnProtectionInput = document.getElementById('hosted-server-spawn-protection-input');
    const pvpCheckbox = document.getElementById('hosted-server-pvp-checkbox');
    const whitelistCheckbox = document.getElementById('hosted-server-whitelist-checkbox');
    const onlineModeCheckbox = document.getElementById('hosted-server-online-mode-checkbox');
    const commandBlockCheckbox = document.getElementById('hosted-server-command-block-checkbox');
    const eulaCheckbox = document.getElementById('hosted-server-eula-checkbox');
    const startBtn = document.getElementById('hosted-server-start-btn');
    const restartBtn = document.getElementById('hosted-server-restart-btn');
    const runtimeEl = document.getElementById('hosted-server-runtime');
    const consoleEl = document.getElementById('hosted-server-console');
    const commandInput = document.getElementById('hosted-server-command-input');
    const commandSendBtn = document.getElementById('hosted-server-command-send-btn');
    const statusPill = document.getElementById('hosting-status-pill');
    const serverSubtitle = document.getElementById('hosting-server-subtitle');
    const activeServer = status.activeServer || {};
    this.renderHostedServerVersionOptions(activeServer.minecraftVersion || 'latest');
    const runningServerId = status.runningServerId || '';
    const stopping = Boolean(status.stopping);
    const running = Boolean((status.running && (!runningServerId || runningServerId === activeServer.id)) || stopping);
    const anotherServerRunning = false;

    this.hostedServers = status.servers || this.hostedServers || [];
    this.activeHostedServerId = status.activeServerId || activeServer.id || '';
    if (!this.hostedServers.length && this.hostedServerFormMode !== 'create') {
      this.hostedServerFormMode = 'hidden';
    }
    if (this.hostedServerFormMode === 'edit' && !this.activeHostedServerId) {
      this.hostedServerFormMode = 'hidden';
    }
    this.updateHostedServerEditorMode();
    this.renderHostedServerList(status);
    this.renderHostingPlayers(status);
    this.updateHostingBanListFromConsole(status.consoleOutput || '');
    this.renderHostingModeration();

    if (statusEl) {
      statusEl.classList.remove('is-ok', 'is-warning', 'is-error');
      if (status.error) {
        statusEl.textContent = `Fehler: ${status.error}`;
        statusEl.classList.add('is-error');
      } else if (stopping) {
        statusEl.textContent = 'Stoppt...';
        statusEl.classList.add('is-warning');
      } else if (running) {
        statusEl.textContent = `Online: ${activeServer.name || 'Server'}`;
        statusEl.classList.add('is-ok');
      } else if (anotherServerRunning) {
        statusEl.textContent = 'Ein anderer Server läuft gerade. Stoppe ihn zuerst.';
        statusEl.classList.add('is-warning');
      } else {
        statusEl.textContent = status.installed ? 'Bereit.' : 'Download beim Start.';
        statusEl.classList.add(status.installed ? 'is-ok' : 'is-warning');
      }
    }
    if (listStatusEl) {
      listStatusEl.textContent = this.hostedServers.length
        ? `${this.hostedServers.length} Server gespeichert.`
        : 'Du hast noch keine Server erstellt.';
    }
    if (statusPill) {
      statusPill.classList.remove('online', 'offline', 'warning');
      const networkStatus = status.networkStatus || {};
      const warningCodes = new Set(['dns-missing', 'port-closed', 'lan-only', 'firewall-blocked']);
      statusPill.classList.add(stopping || warningCodes.has(networkStatus.code) ? 'warning' : (running ? 'online' : 'offline'));
      statusPill.textContent = stopping ? 'Stoppt' : (networkStatus.label || (running ? 'Online' : 'Offline'));
    }
    if (serverSubtitle) {
      const players = status.players || {};
      const softwareLabel = activeServer.softwareLabel || activeServer.software || (activeServer.edition === 'bedrock' ? 'Bedrock' : 'Vanilla');
      serverSubtitle.textContent = activeServer.name
        ? `${softwareLabel} · ${activeServer.minecraftVersion || 'latest'} · ${players.online ?? 0}/${players.max || activeServer.maxPlayers || 0} · Port ${activeServer.port || 25565}`
        : 'Server öffnen.';
    }

    const network = status.networkAddresses || {};
    const address = status.address || network.domain || status.domain || activeServer.joinAddress || 'Server nicht gestartet.';
    const fallbackAddressEl = document.getElementById('hosted-server-fallback-address');
    const upnp = status.upnp || {};
    const router = status.router || {};
    const protocol = router.protocol || activeServer.networkProtocol || (activeServer.edition === 'bedrock' ? 'UDP' : 'TCP');
    const publicAddressText = [
      network.local ? `Dieser PC: ${network.local}` : '',
      network.lan ? `LAN: ${network.lan}` : '',
      network.public ? `Internet: ${network.public}` : '',
      network.domain ? `Domain: ${network.domain}${status.domainReady ? '' : ' (DNS fehlt)'}` : '',
      upnp.success ? 'Router: automatisch freigegeben' : (network.public ? `Router: Port ${router.externalPort || activeServer.port || 25565} ${protocol} freigeben oder UPnP aktivieren` : ''),
      status.domainReady ? 'Domain: verbunden' : (status.networkStatus?.detail || status.domainStatus || '')
    ].filter(Boolean).join(' | ');
    if (addressEl) {
      addressEl.textContent = address;
    }
    if (fallbackAddressEl) {
      fallbackAddressEl.textContent = publicAddressText;
      fallbackAddressEl.classList.toggle('hidden', !publicAddressText);
    }
    if (nameInput && !nameInput.matches(':focus')) {
      nameInput.value = activeServer.name || '';
    }
    if (editionSelect && !editionSelect.matches(':focus')) {
      editionSelect.value = activeServer.edition || 'java';
    }
    if (softwareSelect && !softwareSelect.matches(':focus')) {
      softwareSelect.value = activeServer.software || activeServer.serverSoftware || (activeServer.edition === 'bedrock' ? 'bedrock' : 'vanilla');
    }
    this.updateHostedServerSoftwareOptions({ preservePort: true });
    if (versionInput && !versionInput.matches(':focus')) {
      versionInput.value = activeServer.minecraftVersion || 'latest';
    }
    if (ramInput && !ramInput.matches(':focus')) {
      ramInput.value = String(activeServer.ramGb || ramInput.value || 2);
    }
    if (portInput && !portInput.matches(':focus')) {
      portInput.value = String(activeServer.port || 25565);
    }
    if (maxPlayersInput && !maxPlayersInput.matches(':focus')) {
      maxPlayersInput.value = String(activeServer.maxPlayers || 20);
    }
    if (difficultySelect && activeServer.difficulty) {
      difficultySelect.value = activeServer.difficulty;
    }
    if (gamemodeSelect && activeServer.gamemode) {
      gamemodeSelect.value = activeServer.gamemode;
    }
    if (motdInput && !motdInput.matches(':focus')) {
      motdInput.value = activeServer.motd || '';
    }
    if (viewDistanceInput && !viewDistanceInput.matches(':focus')) {
      viewDistanceInput.value = String(activeServer.viewDistance || 10);
    }
    if (simulationDistanceInput && !simulationDistanceInput.matches(':focus')) {
      simulationDistanceInput.value = String(activeServer.simulationDistance || 10);
    }
    if (spawnProtectionInput && !spawnProtectionInput.matches(':focus')) {
      spawnProtectionInput.value = String(activeServer.spawnProtection ?? 16);
    }
    if (pvpCheckbox) {
      pvpCheckbox.checked = activeServer.pvp !== false;
    }
    if (whitelistCheckbox) {
      whitelistCheckbox.checked = Boolean(activeServer.whitelist);
    }
    if (onlineModeCheckbox) {
      onlineModeCheckbox.checked = activeServer.onlineMode !== false;
    }
    if (commandBlockCheckbox) {
      commandBlockCheckbox.checked = Boolean(activeServer.enableCommandBlock);
    }
    if (eulaCheckbox && typeof activeServer.eulaAccepted === 'boolean') {
      eulaCheckbox.checked = activeServer.eulaAccepted;
    }
    if (startBtn) {
      startBtn.disabled = running;
    }
    if (restartBtn) {
      restartBtn.disabled = !running || stopping;
    }
    if (hostNote) {
      const primaryFinding = Array.isArray(status.diagnostics?.findings) ? status.diagnostics.findings[0] : '';
      if (primaryFinding && status.networkStatus?.code !== 'internet-ok') {
        hostNote.textContent = primaryFinding;
      } else if (status.domainStatus) {
        hostNote.textContent = status.domainStatus;
      } else if (running) {
        hostNote.textContent = 'Für externe Spieler muss der Port im Router und in der Firewall erlaubt sein.';
      } else {
        hostNote.textContent = 'Für externe Spieler muss der Port im Router und in der Firewall erlaubt sein.';
      }
    }
    if (runtimeEl) {
      const players = status.players || {};
      const resources = status.resources || {};
      const uptime = status.uptimeMs ? this.formatDuration(status.uptimeMs) : '0s';
      runtimeEl.innerHTML = `
        <div class="hosting-metric"><span>Status</span><strong>${running ? 'Online' : (stopping ? 'Stoppt' : 'Offline')}</strong></div>
        <div class="hosting-metric"><span>Port</span><strong>${status.localReachable ? 'Erreichbar' : (running ? 'Startet' : 'Offline')}</strong></div>
        <div class="hosting-metric"><span>Spieler</span><strong>${this.escapeHtml(players.online ?? 0)}/${this.escapeHtml(players.max || activeServer.maxPlayers || 0)}</strong></div>
        <div class="hosting-metric"><span>RAM</span><strong>${resources.memoryMb ? `${this.escapeHtml(resources.memoryMb)} MB` : 'unbekannt'}</strong></div>
        <div class="hosting-metric"><span>CPU</span><strong>${resources.cpuTime ? this.escapeHtml(resources.cpuTime) : 'unbekannt'}</strong></div>
        <div class="hosting-metric"><span>Uptime</span><strong>${this.escapeHtml(uptime)}</strong></div>
        <div class="hosting-metric"><span>Netzwerk</span><strong>${this.escapeHtml(status.networkStatus?.label || 'Unbekannt')}</strong></div>
      `;
    }
    this.renderHostingConsole(status);
    if (commandInput) {
      commandInput.disabled = !running;
    }
    if (commandSendBtn) {
      commandSendBtn.disabled = !running;
    }

    if ((running || this.hostedServerFormMode === 'edit') && !this.hostedServerStatusTimer) {
      this.hostedServerStatusTimer = window.setInterval(() => this.loadHostedServerStatus(), running ? 4000 : 12000);
    } else if (!running && this.hostedServerFormMode !== 'edit' && this.hostedServerStatusTimer) {
      window.clearInterval(this.hostedServerStatusTimer);
      this.hostedServerStatusTimer = null;
    }
  }

  renderHostingConsole(status = this.hostedServerStatus || {}) {
    const consoleEl = document.getElementById('hosted-server-console');
    if (!consoleEl) {
      return;
    }
    const output = status?.consoleOutput || 'Noch keine Konsolen-Ausgabe.';
    const query = String(this.hostingConsoleSearch || '').trim().toLowerCase();
    if (!query) {
      consoleEl.textContent = output;
      consoleEl.scrollTop = consoleEl.scrollHeight;
      return;
    }
    const lines = String(output).split(/\r?\n/u);
    const filtered = lines.filter((line) => line.toLowerCase().includes(query));
    consoleEl.textContent = filtered.length ? filtered.join('\n') : `Keine Konsolenzeile gefunden für "${this.hostingConsoleSearch}".`;
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  getHostedPlayersFromStatus(status = this.hostedServerStatus || {}) {
    const directPlayers = Array.isArray(status?.playerDetails) ? status.playerDetails : [];
    const parsedNames = this.parseHostedPlayerNames(status?.consoleOutput || '');
    const players = directPlayers.length
      ? directPlayers
      : parsedNames.map((name) => ({ name, ping: null, playTimeMs: null }));
    return players.map((player) => ({
      name: String(player.name || player.username || '').trim(),
      ping: Number.isFinite(Number(player.ping)) ? Number(player.ping) : null,
      playTimeMs: Number.isFinite(Number(player.playTimeMs)) ? Number(player.playTimeMs) : null
    })).filter((player) => player.name);
  }

  parseHostedPlayerNames(consoleOutput = '') {
    const lines = String(consoleOutput || '').split(/\r?\n/u).reverse();
    const listLine = lines.find((line) => /There are \d+ of a max of \d+ players online:/iu.test(line));
    if (!listLine) {
      return [];
    }
    const namesText = listLine.split(/players online:/iu).pop() || '';
    return namesText.split(',')
      .map((name) => name.trim())
      .filter((name) => /^[A-Za-z0-9_]{1,16}$/u.test(name));
  }

  renderHostingPlayers(status = this.hostedServerStatus || {}) {
    const list = document.getElementById('hosting-player-list');
    const summary = document.getElementById('hosting-players-summary');
    if (!list) {
      return;
    }
    const query = String(this.hostedPlayerSearch || '').trim().toLowerCase();
    const sortMode = this.hostedPlayerSort || 'name';
    let players = this.getHostedPlayersFromStatus(status);
    if (query) {
      players = players.filter((player) => player.name.toLowerCase().includes(query));
    }
    players.sort((left, right) => {
      if (sortMode === 'ping') {
        return (left.ping ?? Number.MAX_SAFE_INTEGER) - (right.ping ?? Number.MAX_SAFE_INTEGER);
      }
      if (sortMode === 'time') {
        return (right.playTimeMs ?? -1) - (left.playTimeMs ?? -1);
      }
      return left.name.localeCompare(right.name);
    });
    if (summary) {
      const count = status?.players?.online ?? players.length;
      summary.textContent = `${count} online · aktualisiert automatisch`;
    }
    if (!players.length) {
      list.innerHTML = '<p class="hosting-empty-state">Keine Spieler online.</p>';
      return;
    }
    list.innerHTML = players.map((player) => {
      const name = this.escapeHtml(player.name);
      return `
        <article class="hosting-player-card" data-player-name="${name}">
          <div class="hosting-player-avatar" aria-hidden="true">${this.escapeHtml(player.name[0]?.toUpperCase() || '?')}</div>
          <div class="hosting-player-main">
            <span class="hosting-player-name">${name}</span>
            <span class="hosting-player-meta">
              <span>Ping: ${player.ping === null ? 'unbekannt' : `${this.escapeHtml(player.ping)} ms`}</span>
              <span>Spielzeit: ${player.playTimeMs === null ? 'unbekannt' : this.escapeHtml(this.formatDuration(player.playTimeMs))}</span>
            </span>
          </div>
          <div class="hosting-player-actions">
            <button class="btn btn-secondary" type="button" data-player-action="message">Nachricht</button>
            <button class="btn btn-secondary" type="button" data-player-action="tp">TP</button>
            <button class="btn btn-secondary" type="button" data-player-action="op">OP</button>
            <button class="btn btn-secondary" type="button" data-player-action="deop">DeOP</button>
            <button class="btn btn-secondary" type="button" data-player-action="whitelist-add">WL+</button>
            <button class="btn btn-secondary" type="button" data-player-action="whitelist-remove">WL-</button>
            <button class="btn btn-danger" type="button" data-player-action="kick">Kick</button>
            <button class="btn btn-danger" type="button" data-player-action="tempban">TempBan</button>
            <button class="btn btn-danger" type="button" data-player-action="ban">Ban</button>
          </div>
        </article>
      `;
    }).join('');
    this.prepareMotionGroup(list, ':scope > *', 24);
  }

  renderHostingModeration() {
    const bans = document.getElementById('hosting-ban-list');
    const history = document.getElementById('hosting-moderation-history');
    if (bans) {
      if (!this.hostingBanList.length) {
        bans.innerHTML = '<p class="hosting-empty-state">Keine Bans geladen.</p>';
      } else {
        bans.innerHTML = this.hostingBanList.map((player) => `
          <div class="hosting-ban-item">
            <span>${this.escapeHtml(player)}</span>
            <button class="btn btn-secondary" type="button" data-player-name="${this.escapeHtml(player)}" data-player-action="unban">Entbannen</button>
          </div>
        `).join('');
      }
    }
    if (history) {
      if (!this.hostingModerationHistory.length) {
        history.innerHTML = '<p class="hosting-empty-state">Kein Verlauf.</p>';
      } else {
        history.innerHTML = this.hostingModerationHistory.slice(0, 12).map((entry) => `
          <div class="hosting-history-item">
            <span>${this.escapeHtml(entry.action)} · ${this.escapeHtml(entry.target)}</span>
            <span>${this.escapeHtml(entry.actor)} · ${this.escapeHtml(entry.time)}</span>
          </div>
        `).join('');
      }
    }
  }

  updateHostingBanListFromConsole(consoleOutput = '') {
    const lines = String(consoleOutput || '').split(/\r?\n/u).reverse();
    const banLine = lines.find((line) => /There are \d+ bans?:/iu.test(line));
    if (!banLine) {
      return;
    }
    const namesText = banLine.split(/bans?:/iu).pop() || '';
    this.hostingBanList = namesText.split(',')
      .map((name) => name.trim())
      .filter((name) => /^[A-Za-z0-9_]{1,16}$/u.test(name));
  }

  async handleHostingPlayerAction(event) {
    const button = event.target?.closest?.('[data-player-action]');
    if (!button) {
      return;
    }
    const card = button.closest('.hosting-player-card, .hosting-ban-item');
    const playerName = button.getAttribute('data-player-name') || card?.getAttribute('data-player-name') || '';
    const action = button.getAttribute('data-player-action') || '';
    if (!playerName || !/^[A-Za-z0-9_]{1,16}$/u.test(playerName)) {
      this.showNotification('Kein gültiger Spielername für diese Aktion.');
      return;
    }
    await this.runHostingPlayerCommand(action, playerName);
  }

  async runHostingPlayerCommand(action, playerName) {
    const quotedName = playerName;
    const actor = this.user?.username || 'Launcher';
    let command = '';
    let label = action;
    if (action === 'kick') {
      const confirmed = await this.showConfirm({ title: 'Spieler kicken', message: `${playerName} wirklich vom Server kicken?`, confirmText: 'Kick' });
      if (!confirmed) return;
      command = `kick ${quotedName} Moderation durch ${actor}`;
      label = 'Kick';
    } else if (action === 'ban') {
      const confirmed = await this.showConfirm({ title: 'Spieler bannen', message: `${playerName} wirklich dauerhaft bannen?`, confirmText: 'Ban' });
      if (!confirmed) return;
      command = `ban ${quotedName} Moderation durch ${actor}`;
      label = 'Ban';
    } else if (action === 'tempban') {
      const confirmed = await this.showConfirm({ title: 'TempBan senden', message: `${playerName} mit einem TempBan-Befehl bannen? Funktioniert, wenn dein Server/Plugin tempban unterstützt.`, confirmText: 'TempBan' });
      if (!confirmed) return;
      command = `tempban ${quotedName} 30m Moderation durch ${actor}`;
      label = 'TempBan';
    } else if (action === 'op') {
      command = `op ${quotedName}`;
      label = 'OP geben';
    } else if (action === 'deop') {
      command = `deop ${quotedName}`;
      label = 'OP entfernen';
    } else if (action === 'whitelist-add') {
      command = `whitelist add ${quotedName}`;
      label = 'Whitelist hinzufügen';
    } else if (action === 'whitelist-remove') {
      command = `whitelist remove ${quotedName}`;
      label = 'Whitelist entfernen';
    } else if (action === 'message') {
      const message = window.prompt(`Nachricht an ${playerName}:`, '');
      if (!message) return;
      command = `tell ${quotedName} ${message.slice(0, 120)}`;
      label = 'Nachricht';
    } else if (action === 'tp') {
      const target = window.prompt(`${playerName} teleportieren zu Spieler/Koordinaten:`, '');
      if (!target) return;
      command = `tp ${quotedName} ${target.slice(0, 80)}`;
      label = 'Teleport';
    } else if (action === 'unban') {
      command = `pardon ${quotedName}`;
      label = 'Entbannen';
    }
    if (!command) {
      return;
    }
    await this.executeHostedServerCommand(command, `${label}: ${playerName}`);
    this.addHostingModerationHistory(label, playerName, actor);
  }

  addHostingModerationHistory(action, target, actor = 'Launcher') {
    this.hostingModerationHistory.unshift({
      action,
      target,
      actor,
      time: new Date().toLocaleString()
    });
    this.renderHostingModeration();
  }

  async executeHostedServerCommand(command, successLabel = 'Befehl') {
    if (typeof window.electronAPI?.sendHostedServerCommand !== 'function') {
      this.showNotification('Konsolenbefehle sind in dieser Launcher-Version nicht verfügbar.');
      return false;
    }
    if (!this.activeHostedServerId) {
      this.showNotification('Bitte öffne zuerst einen Server.');
      return false;
    }
    try {
      const result = await window.electronAPI.sendHostedServerCommand(this.activeHostedServerId, command);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return false;
      }
      this.hostedServerStatus = result;
      this.updateHostedServerStatus(result);
      this.showNotification(`${successLabel} gesendet.`);
      return true;
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
      return false;
    }
  }

  async requestHostingBanList() {
    const ok = await this.executeHostedServerCommand('banlist', 'Ban-Liste');
    if (ok) {
      this.showNotification('Ban-Liste wurde in der Konsole aktualisiert.');
    }
  }

  async unbanHostingPlayer() {
    const input = document.getElementById('hosting-unban-input');
    const playerName = input?.value.trim() || '';
    if (!/^[A-Za-z0-9_]{1,16}$/u.test(playerName)) {
      this.showNotification('Bitte gib einen gültigen Spielernamen ein.');
      return;
    }
    await this.runHostingPlayerCommand('unban', playerName);
    if (input) {
      input.value = '';
    }
  }

  updateHostedServerSoftwareOptions(options = {}) {
    const editionSelect = document.getElementById('hosted-server-edition-select');
    const softwareSelect = document.getElementById('hosted-server-software-select');
    const portInput = document.getElementById('hosted-server-port-input');
    if (!editionSelect || !softwareSelect) {
      return;
    }
    let edition = editionSelect.value === 'bedrock' ? 'bedrock' : 'java';
    let software = softwareSelect.value || 'vanilla';
    if (software === 'bedrock') {
      edition = 'bedrock';
      editionSelect.value = 'bedrock';
    }
    if (edition === 'bedrock') {
      software = 'bedrock';
      softwareSelect.value = 'bedrock';
    } else if (software === 'bedrock') {
      software = 'vanilla';
      softwareSelect.value = 'vanilla';
    }
    Array.from(softwareSelect.options || []).forEach((option) => {
      const value = option.value;
      option.disabled = edition === 'bedrock' ? value !== 'bedrock' : value === 'bedrock';
    });
    if (!options.preservePort && portInput && !portInput.matches(':focus')) {
      const currentPort = Number(portInput.value || 0);
      if (edition === 'bedrock' && (!currentPort || currentPort === 25565)) {
        portInput.value = '19132';
      }
      if (edition === 'java' && (!currentPort || currentPort === 19132)) {
        portInput.value = '25565';
      }
    }
  }

  renderHostedServerVersionOptions(selectedVersion = 'latest') {
    const select = document.getElementById('hosted-server-version-input');
    if (!select) {
      return;
    }
    const currentValue = String(selectedVersion || select.value || 'latest').trim();
    const versions = this.availableVersions || [];
    const options = [
      '<option value="latest">Latest Release</option>',
      ...versions.map((version) => {
        const minecraftVersion = String(version.minecraftVersion || version.name || this.getVersionDisplayName(version) || version.id || '').trim();
        if (!minecraftVersion) {
          return '';
        }
        return `<option value="${this.escapeHtml(minecraftVersion)}">${this.escapeHtml(minecraftVersion)}</option>`;
      }).filter(Boolean)
    ];
    select.innerHTML = options.join('');
    select.value = Array.from(select.options).some((option) => option.value === currentValue) ? currentValue : 'latest';
  }

  updateHostedServerEditorMode() {
    const editor = document.getElementById('hosted-server-editor');
    const hostingSection = document.getElementById('hosting');
    const title = document.getElementById('hosted-server-editor-title');
    const settingsTitle = document.getElementById('hosted-server-settings-title');
    const statusText = document.getElementById('hosted-server-status');
    const createButton = document.getElementById('hosted-server-final-create-btn');
    const cancelButton = document.getElementById('hosted-server-cancel-create-btn');
    const saveButton = document.getElementById('hosted-server-save-btn');
    const startButton = document.getElementById('hosted-server-start-btn');
    const restartButton = document.getElementById('hosted-server-restart-btn');
    const deleteButton = document.getElementById('hosted-server-delete-btn');
    const addressRow = document.querySelector('.server-address-section');
    const hostNote = document.querySelector('.server-host-note');
    const runtimePanel = document.getElementById('hosted-server-runtime');
    const consolePanel = document.querySelector('.server-host-console-panel');
    const isCreate = this.hostedServerFormMode === 'create';
    const isEdit = this.hostedServerFormMode === 'edit';
    const isOpen = isCreate || isEdit;

    hostingSection?.classList.toggle('hosting-editor-open', isOpen);
    editor?.classList.toggle('hidden', !isOpen);
    editor?.classList.toggle('is-create-mode', isCreate);
    editor?.classList.toggle('is-edit-mode', isEdit);
    if (title) {
      title.textContent = isCreate ? 'Server erstellen' : 'Server bearbeiten';
    }
    if (settingsTitle) {
      settingsTitle.textContent = isCreate ? 'Server erstellen' : 'Einstellungen';
    }
    if (createButton) {
      createButton.classList.toggle('hidden', !isCreate);
      createButton.disabled = !isCreate;
    }
    if (cancelButton) {
      cancelButton.classList.toggle('hidden', !isCreate);
      cancelButton.disabled = !isCreate;
    }
    if (saveButton) {
      saveButton.classList.toggle('hidden', !isEdit);
      saveButton.disabled = !isEdit;
    }
    if (startButton) {
      startButton.classList.toggle('hidden', !isEdit);
    }
    if (restartButton) {
      restartButton.classList.toggle('hidden', !isEdit);
    }
    if (deleteButton) {
      deleteButton.classList.toggle('hidden', !isEdit);
    }
    if (addressRow) {
      addressRow.classList.toggle('hidden', !isEdit);
    }
    if (hostNote) {
      hostNote.classList.toggle('hidden', !isEdit);
    }
    if (runtimePanel) {
      runtimePanel.classList.toggle('hidden', !isEdit);
    }
    if (consolePanel) {
      consolePanel.classList.toggle('hidden', !isEdit);
    }

    const createFields = new Set([
      'hosted-server-name-input',
      'hosted-server-edition-select',
      'hosted-server-software-select',
      'hosted-server-version-input',
      'hosted-server-ram-input',
      'hosted-server-port-input',
      'hosted-server-max-players-input'
    ]);
    [
      'hosted-server-name-input',
      'hosted-server-edition-select',
      'hosted-server-software-select',
      'hosted-server-version-input',
      'hosted-server-ram-input',
      'hosted-server-port-input',
      'hosted-server-max-players-input',
      'hosted-server-difficulty-select',
      'hosted-server-gamemode-select',
      'hosted-server-motd-input',
      'hosted-server-view-distance-input',
      'hosted-server-simulation-distance-input',
      'hosted-server-spawn-protection-input'
    ].forEach((id) => {
      this.setHostedServerFieldVisible(id, isEdit || (isCreate && createFields.has(id)));
    });
    [
      'hosted-server-pvp-checkbox',
      'hosted-server-whitelist-checkbox',
      'hosted-server-online-mode-checkbox',
      'hosted-server-command-block-checkbox'
    ].forEach((id) => {
      const field = document.getElementById(id);
      field?.closest?.('.checkbox-row')?.classList.toggle('hidden', !isEdit);
    });
    const eulaRow = document.querySelector('.server-host-eula');
    eulaRow?.classList.toggle('hidden', !isOpen);
  }

  setHostedServerFieldVisible(id, visible) {
    const field = document.getElementById(id);
    const label = document.querySelector(`label[for="${id}"]`);
    field?.classList.toggle('hidden', !visible);
    label?.classList.toggle('hidden', !visible);
  }

  resetHostedServerForm() {
    const values = {
      'hosted-server-name-input': '',
      'hosted-server-edition-select': 'java',
      'hosted-server-software-select': 'vanilla',
      'hosted-server-ram-input': '2',
      'hosted-server-port-input': '25565',
      'hosted-server-max-players-input': '20',
      'hosted-server-motd-input': '',
      'hosted-server-view-distance-input': '10',
      'hosted-server-simulation-distance-input': '10',
      'hosted-server-spawn-protection-input': '16'
    };
    Object.entries(values).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) {
        input.value = value;
      }
    });
    this.renderHostedServerVersionOptions('latest');
    const difficulty = document.getElementById('hosted-server-difficulty-select');
    const gamemode = document.getElementById('hosted-server-gamemode-select');
    const eula = document.getElementById('hosted-server-eula-checkbox');
    if (difficulty) difficulty.value = 'normal';
    if (gamemode) gamemode.value = 'survival';
    const pvp = document.getElementById('hosted-server-pvp-checkbox');
    const whitelist = document.getElementById('hosted-server-whitelist-checkbox');
    const onlineMode = document.getElementById('hosted-server-online-mode-checkbox');
    const commandBlock = document.getElementById('hosted-server-command-block-checkbox');
    if (pvp) pvp.checked = true;
    if (whitelist) whitelist.checked = false;
    if (onlineMode) onlineMode.checked = true;
    if (commandBlock) commandBlock.checked = false;
    if (eula) eula.checked = false;
    this.updateHostedServerSoftwareOptions({ preservePort: true });
    this.hostedServerDraftDirty = false;
  }

  openHostedServerCreateForm() {
    this.activeHostedServerId = '';
    this.hostedServerFormMode = 'create';
    this.resetHostedServerForm();
    this.updateHostedServerEditorMode();
    document.getElementById('hosted-server-name-input')?.focus();
  }

  closeHostedServerEditor() {
    this.hostedServerFormMode = 'hidden';
    this.hostedServerDraftDirty = false;
    this.updateHostedServerEditorMode();
  }

  getHostedServerOptionsFromUI() {
    return {
      serverId: this.activeHostedServerId,
      name: document.getElementById('hosted-server-name-input')?.value.trim() || '',
      edition: document.getElementById('hosted-server-edition-select')?.value || 'java',
      software: document.getElementById('hosted-server-software-select')?.value || 'vanilla',
      minecraftVersion: document.getElementById('hosted-server-version-input')?.value.trim() || 'latest',
      ramGb: Number(document.getElementById('hosted-server-ram-input')?.value || 2),
      port: Number(document.getElementById('hosted-server-port-input')?.value || 25565),
      maxPlayers: Number(document.getElementById('hosted-server-max-players-input')?.value || 20),
      difficulty: document.getElementById('hosted-server-difficulty-select')?.value || 'normal',
      gamemode: document.getElementById('hosted-server-gamemode-select')?.value || 'survival',
      motd: document.getElementById('hosted-server-motd-input')?.value.trim() || '',
      pvp: Boolean(document.getElementById('hosted-server-pvp-checkbox')?.checked),
      whitelist: Boolean(document.getElementById('hosted-server-whitelist-checkbox')?.checked),
      onlineMode: Boolean(document.getElementById('hosted-server-online-mode-checkbox')?.checked),
      enableCommandBlock: Boolean(document.getElementById('hosted-server-command-block-checkbox')?.checked),
      viewDistance: Number(document.getElementById('hosted-server-view-distance-input')?.value || 10),
      simulationDistance: Number(document.getElementById('hosted-server-simulation-distance-input')?.value || 10),
      spawnProtection: Number(document.getElementById('hosted-server-spawn-protection-input')?.value || 16),
      ownerUsername: this.user?.username || '',
      ownerUuid: this.user?.uuid || '',
      acceptEula: Boolean(document.getElementById('hosted-server-eula-checkbox')?.checked)
    };
  }

  renderHostedServerList(status = this.hostedServerStatus || {}) {
    const list = document.getElementById('hosted-server-list');
    if (!list) {
      return;
    }
    const servers = status.servers || this.hostedServers || [];
    if (!servers.length) {
      list.innerHTML = '<p class="mods-empty">Du hast noch keine Server erstellt.</p>';
      return;
    }
    const activeId = this.hostedServerFormMode === 'edit' ? (status.activeServerId || this.activeHostedServerId) : '';
    const runningIds = new Set(Array.isArray(status.runningServerIds) ? status.runningServerIds : [status.runningServerId || '']);
    list.innerHTML = servers.map((server) => {
      const active = server.id === activeId;
      const running = runningIds.has(server.id);
      const defaultPort = server.edition === 'bedrock' ? 19132 : 25565;
      const softwareLabel = server.softwareLabel || server.software || (server.edition === 'bedrock' ? 'Bedrock' : 'Vanilla');
      const localAddress = `localhost:${server.port || defaultPort}`;
      const visibleAddress = active && status.address ? status.address : (server.joinAddress || server.domain || localAddress);
      return `
        <article class="hosted-server-card${active ? ' active' : ''}" data-server-id="${this.escapeHtml(server.id)}">
          <div>
            <h4>${this.escapeHtml(server.name)}</h4>
            <p>${running ? 'Online' : 'Offline'} · ${this.escapeHtml(visibleAddress)}</p>
            <p>${this.escapeHtml(softwareLabel)} · ${this.escapeHtml(server.minecraftVersion || 'latest')} · Port ${this.escapeHtml(server.port || defaultPort)}</p>
          </div>
          <div class="server-actions">
            <button class="btn btn-primary" type="button" data-host-action="select" data-server-id="${this.escapeHtml(server.id)}" ${active ? 'disabled' : ''}>Öffnen</button>
            <button class="btn btn-secondary" type="button" data-host-action="delete" data-server-id="${this.escapeHtml(server.id)}" data-server-name="${this.escapeHtml(server.name)}" ${running ? 'disabled' : ''}>Löschen</button>
          </div>
        </article>
      `;
    }).join('');
    this.prepareMotionGroup(list, ':scope > *', 34);
  }

  renderHostedServerMods(status = this.hostedServerStatus || {}) {
    const list = document.getElementById('hosted-server-mods-list');
    if (!list) {
      return;
    }
    const mods = status.mods || [];
    if (!mods.length) {
      list.innerHTML = '<p class="mods-empty">Noch keine Server-Mods. Füge Fabric-kompatible JAR-Dateien hinzu.</p>';
      return;
    }
    list.innerHTML = mods.map((mod) => `
      <article class="hosted-mod-card">
        <div>
          <h4>${this.escapeHtml(mod.fileName)}</h4>
          <p>${this.escapeHtml(this.formatBytes(mod.size || 0))}</p>
        </div>
        <div class="server-actions">
          <button class="btn btn-secondary" type="button" data-host-mod-action="delete" data-mod-file="${this.escapeHtml(mod.fileName)}">Entfernen</button>
        </div>
      </article>
    `).join('');
    this.prepareMotionGroup(list, ':scope > *', 34);
  }

  formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) {
      return `${value} B`;
    }
    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KB`;
    }
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  async createHostedServer() {
    if (typeof window.electronAPI?.createHostedServer !== 'function') {
      this.showNotification('Server-Hosting ist in dieser Launcher-Version nicht verfügbar.');
      return;
    }
    const options = this.getHostedServerOptionsFromUI();
    if (!options.name) {
      this.showNotification('Bitte gib einen Servernamen ein, z. B. pizza.');
      return;
    }
    try {
      const result = await window.electronAPI.createHostedServer(options);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.hostedServerStatus = result;
      this.hostedServerFormMode = 'hidden';
      this.hostedServerDraftDirty = false;
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Server erstellt.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  scheduleHostedServerAutoSave() {
    if (this.hostedServerFormMode !== 'edit' || !this.activeHostedServerId) {
      return;
    }
    if (this.hostedServerAutoSaveTimer) {
      window.clearTimeout(this.hostedServerAutoSaveTimer);
    }
    this.hostedServerAutoSaveTimer = window.setTimeout(() => {
      this.hostedServerAutoSaveTimer = null;
      this.saveHostedServer({ silent: true });
    }, 650);
  }

  markHostedServerDirty() {
    if (this.hostedServerFormMode !== 'edit') {
      return;
    }
    this.hostedServerDraftDirty = true;
    const saveButton = document.getElementById('hosted-server-save-btn');
    if (saveButton) {
      saveButton.textContent = 'Änderungen speichern';
    }
  }

  discardHostedServerChanges() {
    if (!this.hostedServerStatus) {
      return;
    }
    document.activeElement?.blur?.();
    this.hostedServerDraftDirty = false;
    this.updateHostedServerStatus(this.hostedServerStatus);
    this.showNotification('Änderungen verworfen.');
  }

  async saveHostedServer(options = {}) {
    if (typeof window.electronAPI?.saveHostedServer !== 'function') {
      if (!options.silent) {
        this.showNotification('Speichern ist in dieser Launcher-Version nicht verfügbar.');
      }
      return;
    }
    if (!this.activeHostedServerId) {
      if (!options.silent) {
        this.showNotification('Bitte wähle zuerst einen Server aus.');
      }
      return;
    }
    const saveOptions = this.getHostedServerOptionsFromUI();
    if (!saveOptions.name) {
      if (!options.silent) {
        this.showNotification('Bitte gib einen Servernamen ein.');
      }
      return;
    }
    try {
      const result = await window.electronAPI.saveHostedServer(saveOptions);
      if (!result.success) {
        if (!options.silent) {
          this.showNotification('Fehler: ' + result.error);
        }
        return;
      }
      this.hostedServerStatus = result;
      this.hostedServerFormMode = 'edit';
      this.hostedServerDraftDirty = false;
      this.updateHostedServerStatus(result);
      if (!options.silent) {
        this.showNotification(result.message || 'Server gespeichert.');
      }
    } catch (error) {
      if (!options.silent) {
        this.showNotification('Fehler: ' + error.message);
      }
    }
  }

  async handleHostedServerListClick(event) {
    const button = event.target?.closest?.('[data-host-action]');
    const card = event.target?.closest?.('.hosted-server-card');
    if (!button && !card) {
      return;
    }
    const action = button?.getAttribute('data-host-action') || 'select';
    const serverId = button?.getAttribute('data-server-id') || card?.getAttribute('data-server-id') || '';
    if (action === 'select') {
      const result = await window.electronAPI.selectHostedServer(serverId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.hostedServerStatus = result;
      this.hostedServerFormMode = 'edit';
      this.hostedServerDraftDirty = false;
      this.updateHostedServerStatus(result);
      return;
    }
    if (action === 'delete') {
      const serverName = button.getAttribute('data-server-name') || 'Server';
      const confirmed = await this.showConfirm({
        title: 'Server löschen',
        message: `"${serverName}" wirklich komplett löschen? Der Serverordner mit Welt und Mods wird entfernt.`,
        confirmText: 'Löschen'
      });
      if (!confirmed) {
        return;
      }
      const result = await window.electronAPI.deleteHostedServer(serverId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.hostedServerStatus = result;
      this.hostedServerDraftDirty = false;
      if (serverId === this.activeHostedServerId) {
        this.hostedServerFormMode = 'hidden';
        this.activeHostedServerId = result.activeServerId || '';
      }
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Server entfernt.');
    }
  }

  async startHostedServer() {
    if (typeof window.electronAPI?.startHostedServer !== 'function') {
      this.showNotification('Server-Hosting ist in dieser Launcher-Version nicht verfügbar.');
      return;
    }
    if (this.hostedServerFormMode !== 'edit' || !this.activeHostedServerId) {
      this.showNotification('Bitte erstelle oder öffne zuerst einen Server.');
      return;
    }
    const options = this.getHostedServerOptionsFromUI();
    if (!options.acceptEula) {
      this.showNotification('Bitte akzeptiere zuerst die Minecraft Server EULA.');
      return;
    }
    const softwareLabel = options.edition === 'bedrock'
      ? 'Bedrock-Server'
      : (options.software === 'paper' ? 'Paper-Server' : 'Vanilla-Server');
    this.showLoading(`${softwareLabel} startet...`, { progress: 18 });
    try {
      const result = await window.electronAPI.startHostedServer(options);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        this.updateHostedServerStatus({ running: false, error: result.error });
        return;
      }
      this.hostedServerStatus = result;
      this.hostedServerDraftDirty = false;
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || `${softwareLabel} läuft.`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async stopHostedServer() {
    if (typeof window.electronAPI?.stopHostedServer !== 'function') {
      return;
    }
    try {
      const result = await window.electronAPI.stopHostedServer(this.activeHostedServerId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.hostedServerStatus = result;
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Server gestoppt.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async restartHostedServer() {
    if (typeof window.electronAPI?.restartHostedServer !== 'function') {
      this.showNotification('Neustart ist in dieser Launcher-Version nicht verfügbar.');
      return;
    }
    if (this.hostedServerFormMode !== 'edit' || !this.activeHostedServerId) {
      this.showNotification('Bitte öffne zuerst einen Server.');
      return;
    }
    const options = this.getHostedServerOptionsFromUI();
    if (!options.acceptEula) {
      this.showNotification('Bitte akzeptiere zuerst die Minecraft Server EULA.');
      return;
    }
    this.showLoading('Server wird neu gestartet...', { progress: 20 });
    try {
      const result = await window.electronAPI.restartHostedServer(options);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.hostedServerStatus = result;
      this.hostedServerDraftDirty = false;
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Server wurde neu gestartet.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async deleteActiveHostedServer() {
    if (!this.activeHostedServerId) {
      this.showNotification('Bitte öffne zuerst einen Server.');
      return;
    }
    const activeServer = this.hostedServerStatus?.activeServer || {};
    const serverName = activeServer.name || document.getElementById('hosted-server-name-input')?.value.trim() || 'Server';
    const confirmed = await this.showConfirm({
      title: 'Server löschen',
      message: `"${serverName}" wirklich komplett löschen? Der Serverordner mit Welt und Mods wird entfernt.`,
      confirmText: 'Löschen'
    });
    if (!confirmed) {
      return;
    }
    try {
      const result = await window.electronAPI.deleteHostedServer(this.activeHostedServerId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.hostedServerStatus = result;
      this.hostedServerDraftDirty = false;
      this.hostedServerFormMode = 'hidden';
      this.activeHostedServerId = result.activeServerId || '';
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Server gelöscht.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async openHostedServerFolder() {
    if (typeof window.electronAPI?.openHostedServerFolder !== 'function') {
      return;
    }
    try {
      const result = await window.electronAPI.openHostedServerFolder();
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.showNotification(`Server-Ordner geöffnet: ${result.path}`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async copyHostedServerAddress() {
    const address = this.hostedServerStatus?.address
      || this.hostedServerStatus?.publicAddress
      || this.hostedServerStatus?.lanAddress
      || this.hostedServerStatus?.localAddress
      || document.getElementById('hosted-server-address')?.textContent?.trim()
      || '';
    if (!address || address === 'Erstelle zuerst einen Servernamen.' || address === 'Portfreigabe erforderlich') {
      this.showNotification('Keine Server-Adresse zum Kopieren.');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = address;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      this.showNotification(`${address} kopiert.`);
    } catch (error) {
      this.showNotification('Kopieren fehlgeschlagen: ' + error.message);
    }
  }

  async openHostedServerModsFolder() {
    if (typeof window.electronAPI?.openHostedServerModsFolder !== 'function') {
      return;
    }
    try {
      const result = await window.electronAPI.openHostedServerModsFolder();
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.showNotification(`Mods-Ordner geöffnet: ${result.path}`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async importHostedServerMods(event) {
    const input = event.target;
    const files = Array.from(input?.files || []);
    const filePaths = files
      .map((file) => window.electronAPI.getPathForFile(file))
      .filter(Boolean);
    if (!filePaths.length) {
      return;
    }
    try {
      const result = await window.electronAPI.importHostedServerMods(filePaths);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.hostedServerStatus = result;
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Mods hinzugefügt.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      if (input) {
        input.value = '';
      }
    }
  }

  async handleHostedServerModsClick(event) {
    const button = event.target?.closest?.('[data-host-mod-action]');
    if (!button) {
      return;
    }
    const fileName = button.getAttribute('data-mod-file') || '';
    const confirmed = await this.showConfirm({
      title: 'Server-Mod entfernen',
      message: `"${fileName}" aus diesem Server entfernen?`,
      confirmText: 'Entfernen'
    });
    if (!confirmed) {
      return;
    }
    try {
      const result = await window.electronAPI.removeHostedServerMod(fileName);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.hostedServerStatus = result;
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Mod entfernt.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async sendHostedServerCommand() {
    if (typeof window.electronAPI?.sendHostedServerCommand !== 'function') {
      this.showNotification('Konsolenbefehle sind in dieser Launcher-Version nicht verfügbar.');
      return;
    }
    if (!this.activeHostedServerId) {
      this.showNotification('Bitte öffne zuerst einen Server.');
      return;
    }
    const input = document.getElementById('hosted-server-command-input');
    const command = input?.value.trim() || '';
    if (!command) {
      this.showNotification('Bitte gib einen Befehl ein.');
      return;
    }
    try {
      const result = await window.electronAPI.sendHostedServerCommand(this.activeHostedServerId, command);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      if (input) {
        input.value = '';
      }
      this.hostedServerStatus = result;
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Befehl gesendet.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async saveHostedServerFavorite() {
    const status = this.hostedServerStatus || {};
    const activeServer = status.activeServer || {};
    const directHost = status.address || status.publicAddress || status.lanAddress || status.localAddress || `localhost:${activeServer.port || 25565}`;
    try {
      const result = await window.electronAPI.addServerFavorite({
        name: activeServer.name || document.getElementById('hosted-server-name-input')?.value.trim() || 'Mein Server',
        host: directHost
      });
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.serverFavorites = result.servers || [];
      this.renderServerFavorites();
      this.renderStartServerList();
      this.showNotification('Lokaler Server wurde als Favorit gespeichert.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  renderStartServerList() {
    const list = document.getElementById('start-server-list');
    if (!list) {
      return;
    }
    if (!this.serverFavorites.length) {
      list.innerHTML = '<p class="start-server-empty">Keine Server-Favoriten</p>';
      this.selectedDirectServerId = '';
      return;
    }
    list.innerHTML = this.serverFavorites.map((server) => `
      <button class="start-server-tile" type="button" data-server-id="${this.escapeHtml(server.id)}" title="${this.escapeHtml(server.name)}" ${this.minecraftLaunchState !== 'idle' ? 'disabled aria-disabled="true"' : 'aria-disabled="false"'}>
        <span class="start-server-name">${this.escapeHtml(server.name)}</span>
      </button>
    `).join('');
    const nextValue = this.serverFavorites.some((server) => server.id === this.selectedDirectServerId)
      ? this.selectedDirectServerId
      : '';
    this.selectedDirectServerId = nextValue;
    this.prepareMotionGroup(list, ':scope > *', 28);
  }

  async handleStartServerClick(event) {
    const button = event.target?.closest?.('.start-server-tile');
    if (!button) {
      return;
    }
    if (this.minecraftLaunchState !== 'idle' || button.disabled) {
      event.preventDefault();
      return;
    }
    const serverId = button.getAttribute('data-server-id') || '';
    this.selectedDirectServerId = serverId;
    await this.launchMinecraft({ directJoin: true, serverId });
  }

  renderServerFavorites() {
    const list = document.getElementById('servers-list');
    const status = document.getElementById('servers-status');
    if (status) {
      status.textContent = this.serverFavorites.length
        ? `${this.serverFavorites.length} Favorit${this.serverFavorites.length === 1 ? '' : 'en'} gespeichert.`
        : 'Noch keine Server-Favoriten gespeichert.';
    }
    if (!list) {
      return;
    }
    if (!this.serverFavorites.length) {
      list.innerHTML = '<p class="mods-empty">Speichere einen Server, um ihn direkt starten zu können.</p>';
      return;
    }
    list.innerHTML = this.serverFavorites.map((server) => `
      <article class="server-favorite-card">
        <div>
          <h4>${this.escapeHtml(server.name)}</h4>
          <p>${this.escapeHtml(server.host)}:${this.escapeHtml(server.port || 25565)}</p>
        </div>
        <div class="server-actions">
          <button class="btn btn-primary" type="button" data-server-action="join" data-server-id="${this.escapeHtml(server.id)}">Beitreten</button>
          ${server.official ? '' : `<button class="btn btn-secondary" type="button" data-server-action="delete" data-server-id="${this.escapeHtml(server.id)}" data-server-name="${this.escapeHtml(server.name)}">Löschen</button>`}
        </div>
      </article>
    `).join('');
    this.prepareMotionGroup(list, ':scope > *', 34);
  }

  async addServerFavorite() {
    const nameInput = document.getElementById('server-name-input');
    const hostInput = document.getElementById('server-host-input');
    const host = hostInput?.value.trim() || '';
    if (!host) {
      this.showNotification('Bitte gib eine Server-Adresse ein.');
      return;
    }
    try {
      const result = await window.electronAPI.addServerFavorite({
        name: nameInput?.value.trim() || '',
        host
      });
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.serverFavorites = result.servers || [];
      if (nameInput) {
        nameInput.value = '';
      }
      if (hostInput) {
        hostInput.value = '';
      }
      this.renderServerFavorites();
      this.renderStartServerList();
      this.showNotification(result.message || 'Server gespeichert.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async handleServerListClick(event) {
    const button = event.target?.closest?.('[data-server-action]');
    if (!button) {
      return;
    }
    const action = button.getAttribute('data-server-action');
    const serverId = button.getAttribute('data-server-id') || '';
    if (action === 'join') {
      this.selectedDirectServerId = serverId;
      await this.launchMinecraft({ directJoin: true, serverId });
      return;
    }
    if (action === 'delete') {
      const serverName = button.getAttribute('data-server-name') || 'Server';
      const confirmed = await this.showConfirm({
        title: 'Server löschen',
        message: `"${serverName}" wirklich aus den Favoriten entfernen?`,
        confirmText: 'Löschen'
      });
      if (!confirmed) {
        return;
      }
      try {
        const result = await window.electronAPI.removeServerFavorite(serverId);
        if (!result.success) {
          this.showNotification('Fehler: ' + result.error);
          return;
        }
        this.serverFavorites = result.servers || [];
        this.renderServerFavorites();
        this.renderStartServerList();
        this.showNotification(result.message || 'Server entfernt.');
      } catch (error) {
        this.showNotification('Fehler: ' + error.message);
      }
    }
  }

  async openAccountSwitcher() {
    this.switchSection('accounts');
    await this.loadAccounts();
    const firstAccountAction = document.querySelector('#accounts-list [data-account-action="switch"]:not([disabled])')
      || document.getElementById('add-microsoft-account-btn')
      || document.getElementById('offline-account-name-input');
    firstAccountAction?.focus?.();
  }

  async loadAccounts() {
    if (typeof window.electronAPI?.getAccounts !== 'function') {
      return;
    }
    try {
      const result = await window.electronAPI.getAccounts();
      if (!result.success) {
        return;
      }
      this.accountsConfig = result;
      this.renderAccounts();
    } catch (error) {
      console.error('Accounts error:', error);
    }
  }

  renderAccounts() {
    const list = document.getElementById('accounts-list');
    const status = document.getElementById('accounts-status');
    const accounts = this.accountsConfig?.accounts || [];
    const activeAccountId = this.accountsConfig?.activeAccountId || '';
    if (status) {
      status.textContent = accounts.length
        ? `${accounts.length} Account${accounts.length === 1 ? '' : 's'} gespeichert.`
        : 'Noch keine Accounts gespeichert.';
    }
    if (!list) {
      return;
    }
    if (!accounts.length) {
      list.innerHTML = '<p class="mods-empty">Füge einen Microsoft- oder Offline-Account hinzu.</p>';
      return;
    }
    list.innerHTML = accounts.map((account) => {
      const active = account.id === activeAccountId;
      const source = String(account.loginSource || account.userType || '').toLowerCase().includes('offline')
        ? 'Offline'
        : 'Microsoft';
      return `
        <article class="account-switch-card${active ? ' active' : ''}">
          <div>
            <h4>${this.escapeHtml(account.username)}</h4>
            <p>${this.escapeHtml(source)}${active ? ' | Aktiv' : ''}</p>
          </div>
          <div class="account-actions">
            <button class="btn btn-primary" type="button" data-account-action="switch" data-account-id="${this.escapeHtml(account.id)}" ${active ? 'disabled' : ''}>Nutzen</button>
            <button class="btn btn-secondary" type="button" data-account-action="delete" data-account-id="${this.escapeHtml(account.id)}" data-account-name="${this.escapeHtml(account.username)}">Entfernen</button>
          </div>
        </article>
      `;
    }).join('');
    this.prepareMotionGroup(list, ':scope > *', 34);
  }

  async addMicrosoftAccount() {
    try {
      const result = await window.electronAPI.login({ addAccount: true });
      if (!result.success) {
        this.showNotification('Anmeldung fehlgeschlagen: ' + result.error);
        return;
      }
      this.user = setCurrentUser(result.user);
      this.showMainScreen();
      await this.loadGameData();
      this.showNotification(result.warning || `${this.user.username} wurde hinzugefügt und aktiviert.`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async addOfflineAccount() {
    const input = document.getElementById('offline-account-name-input');
    const username = input?.value.trim() || '';
    if (!username) {
      this.showNotification('Bitte gib einen Offline-Spielernamen ein.');
      return;
    }
    try {
      const result = await window.electronAPI.loginOffline(username);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.user = setCurrentUser(result.user);
      this.accountsConfig = {
        activeAccountId: result.activeAccountId || '',
        accounts: result.accounts || []
      };
      if (input) {
        input.value = '';
      }
      this.renderAccounts();
      this.updateUsernameDisplays();
      this.showNotification(result.warning || `${this.user.username} wurde hinzugefügt und aktiviert.`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async handleAccountsListClick(event) {
    const button = event.target?.closest?.('[data-account-action]');
    if (!button) {
      return;
    }
    const action = button.getAttribute('data-account-action');
    const accountId = button.getAttribute('data-account-id') || '';
    if (action === 'switch') {
      this.showLoading('Account wird gewechselt...');
      try {
        const result = await window.electronAPI.switchAccount(accountId);
        if (!result.success) {
          this.showNotification('Fehler: ' + result.error);
          return;
        }
        this.user = setCurrentUser(result.user);
        this.accountsConfig = {
          activeAccountId: result.activeAccountId || '',
          accounts: result.accounts || []
        };
        this.updateUsernameDisplays();
        this.renderAccounts();
        await this.loadSkinConfig();
        this.showNotification(result.message || `${this.user.username} ist aktiv.`);
      } catch (error) {
        this.showNotification('Fehler: ' + error.message);
      } finally {
        this.hideLoading();
      }
      return;
    }
    if (action === 'delete') {
      const accountName = button.getAttribute('data-account-name') || 'Account';
      const confirmed = await this.showConfirm({
        title: 'Account entfernen',
        message: `"${accountName}" aus der Accountliste entfernen?`,
        confirmText: 'Entfernen'
      });
      if (!confirmed) {
        return;
      }
      try {
        const result = await window.electronAPI.removeAccount(accountId);
        if (!result.success) {
          this.showNotification('Fehler: ' + result.error);
          return;
        }
        this.accountsConfig = {
          activeAccountId: result.activeAccountId || '',
          accounts: result.accounts || []
        };
        if (result.removedActive) {
          this.user = setCurrentUser(result.user || null);
          if (this.user) {
            this.showMainScreen();
            this.updateUsernameDisplays();
            await this.loadSkinConfig();
          } else {
            this.showLoginScreen();
          }
        } else if (Object.prototype.hasOwnProperty.call(result, 'user') && result.user) {
          this.user = setCurrentUser(result.user);
          this.updateUsernameDisplays();
        } else {
          await this.loadUserInfo();
        }
        this.renderAccounts();
        this.showNotification(result.message || 'Account entfernt.');
      } catch (error) {
        this.showNotification('Fehler: ' + error.message);
      }
    }
  }

  getActivePack() {
    const activePackId = this.packsConfig?.activePackId || this.launcherStatus?.activePackId || '';
    const packs = this.packsConfig?.packs || [];
    const pack = packs.find((entry) => entry.id === activePackId);
    if (pack) {
      return pack;
    }

    if (!activePackId) {
      return null;
    }

    return {
      id: activePackId,
      name: this.launcherStatus?.activePackName || activePackId
    };
  }

  getCurrentContextLabel() {
    const activePack = this.getActivePack();
    return activePack ? `Profil ${activePack.name}` : 'Launcher-Standard';
  }

  getActiveContextVersionId() {
    const activePack = this.getActivePack();
    return String(activePack?.versionId || this.selectedVersionId || this.launcherStatus?.selectedMinecraftVersion || '').trim();
  }

  getStandardAvailableVersions() {
    return (this.availableVersions || []).filter((version) => version?.standardSupported === true);
  }

  getSupportedMinecraftVersionsLabel() {
    return (this.supportedMinecraftVersions || []).join(', ');
  }

  getContextAvailableVersions() {
    return this.getActivePack()
      ? (this.availableVersions || [])
      : this.getStandardAvailableVersions();
  }

  getProfileAvailableVersions() {
    return (this.availableVersions || []).filter((version) => version?.profileSupported !== false);
  }

  getModrinthVersionFilterId() {
    const selectEl = document.getElementById('modrinth-version-filter');
    return String(selectEl?.value || this.modrinthVersionFilterId || '').trim();
  }

  getModrinthVersionFilterDisplayName() {
    const versionId = this.getModrinthVersionFilterId();
    return versionId ? this.getVersionDisplayName(versionId) : '';
  }

  getActiveModrinthPackTargetVersionId() {
    const versions = this.getProfileAvailableVersions();
    const currentFilterId = this.getModrinthVersionFilterId();
    if (versions.some((version) => version.id === currentFilterId)) {
      return currentFilterId;
    }

    return '';
  }

  getActiveModrinthPackSearchTarget() {
    const versionId = this.getActiveModrinthPackTargetVersionId();
    return {
      packId: '',
      packName: '',
      versionId,
      minecraftVersion: this.getVersionDisplayName(versionId)
    };
  }

  getActiveModrinthTarget() {
    const activePack = this.getActivePack();
    return {
      packId: activePack?.id || '',
      packName: activePack?.name || '',
      versionId: this.getActiveContextVersionId()
    };
  }

  updatePackContextUI() {
    const activePack = this.getActivePack();
    const versionLabel = this.getSelectedVersionDisplayName();
    const versionText = versionLabel ? `Fabric ${versionLabel}` : 'keine Fabric-Version';
    const typeConfig = this.getModrinthTypeConfig();

    const modsTitleEl = document.getElementById('mods-section-title');
    if (modsTitleEl) {
      modsTitleEl.textContent = activePack
        ? `Mods in ${activePack.name}`
        : 'Mods für diese Version';
    }

    const modsContextEl = document.getElementById('mods-context-label');
    if (modsContextEl) {
      modsContextEl.textContent = activePack
        ? `${activePack.name} nutzt ${versionText}. Alle prüfen korrigiert die verwalteten Mods in diesem Profil.`
        : `Launcher-Standard nutzt ${versionText}. Alle prüfen korrigiert die verwalteten Mods im Standard-Mods-Ordner.`;
    }

    const modrinthContextEl = document.getElementById('modrinth-context-label');
    if (modrinthContextEl) {
      if (typeConfig.value === 'mod') {
        modrinthContextEl.textContent = activePack
          ? `Neue Mods werden direkt in ${activePack.name} installiert.`
          : 'Neue Mods werden in den Launcher-Standard installiert.';
      } else if (typeConfig.value === 'modpack') {
        modrinthContextEl.textContent = 'Modpacks werden in ein vorhandenes oder neues Profil importiert.';
      } else {
        modrinthContextEl.textContent = typeConfig.value === 'shader'
        ? 'Neue Shader werden im shaderpacks-Ordner des aktiven Profils gespeichert.'
        : 'Ressourcenpakete jeder Minecraft-Version werden im resourcepacks-Ordner des aktiven Profils gespeichert.';
      }
    }

    const packsStatusEl = document.getElementById('packs-status');
    if (packsStatusEl) {
      packsStatusEl.textContent = activePack
        ? `${activePack.name} ist aktiv.`
        : 'Launcher-Standard ist aktiv.';
    }

    this.renderStartPackSelect();
    this.renderModsProfileVersionSelect();
    this.updateModsCheckStatus();
  }

  renderModsProfileVersionSelect() {
    const selectEl = document.getElementById('mods-profile-version-select');
    if (!selectEl) return;
    selectEl.classList.remove('hidden');
    const versions = this.getProfileAvailableVersions();
    const activeVersionId = this.getActiveContextVersionId();
    selectEl.innerHTML = versions.length
      ? versions.map((version) => (
          `<option value="${this.escapeHtml(version.id)}" ${version.id === activeVersionId ? 'selected' : ''}>Minecraft ${this.escapeHtml(this.getVersionDisplayName(version))}</option>`
        )).join('')
      : '<option value="">Keine Version ab 1.8 verfügbar</option>';
    selectEl.disabled = versions.length === 0;
  }

  async changeActiveProfileVersion(versionId) {
    const normalizedVersionId = String(versionId || '').trim();
    if (!normalizedVersionId || normalizedVersionId === this.getActiveContextVersionId()) return;
    try {
      const result = await window.electronAPI.setSelectedVersion(normalizedVersionId);
      if (!result.success) {
        this.renderModsProfileVersionSelect();
        return;
      }
      this.selectedVersionId = result.selectedVersionId || normalizedVersionId;
      await this.refreshPackContext({ reloadMods: false, reloadSearch: false });
      this.loadMods({ skipManagedSync: true }).catch((error) => {
        console.error('Background profile-version mod load failed:', error);
      });
    } catch (error) {
      console.error('Profile version change failed:', error);
      this.renderModsProfileVersionSelect();
    }
  }

  renderPacks() {
    const versionSelectEl = document.getElementById('pack-version-select');
    const createButton = document.getElementById('create-pack-btn');
    const packsListEl = document.getElementById('packs-list');
    const versions = this.availableVersions || [];
    const standardVersions = this.getStandardAvailableVersions();

    if (versionSelectEl) {
      versionSelectEl.innerHTML = '';

      if (!versions.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Keine Fabric-Version verfügbar';
        versionSelectEl.appendChild(option);
        versionSelectEl.disabled = true;
      } else {
        versions.forEach((version) => {
          const option = document.createElement('option');
          option.value = version.id;
          option.textContent = this.getVersionDisplayName(version);
          option.selected = version.id === this.selectedVersionId;
          versionSelectEl.appendChild(option);
        });
        versionSelectEl.disabled = false;
      }
    }

    if (createButton) {
      createButton.disabled = versions.length === 0;
    }

    if (!packsListEl) {
      return;
    }

    const packs = this.packsConfig?.packs || [];
    const activePackId = this.packsConfig?.activePackId || '';
    const standardVersionId = this.packsConfig?.standardVersionId || (!activePackId ? this.selectedVersionId : '');
    const standardVersionAllowed = standardVersions.some((version) => version.id === standardVersionId);
    const standardVersion = standardVersionId && standardVersionAllowed ? this.getVersionDisplayName(standardVersionId) : '';
    const standardCard = `
      <article class="pack-card${activePackId ? '' : ' active'}">
        <div class="pack-card-head">
          <div>
            <h4>Launcher-Standard</h4>
            <p>Nutze den offiziellen .minecraft-Mods-Ordner ohne eigenes Profil.</p>
          </div>
          <div class="pack-head-actions">
            ${activePackId ? '' : '<span class="pack-badge">Aktiv</span>'}
            <details class="pack-more-menu">
              <summary aria-label="Profil-Aktionen">•••</summary>
              <div class="pack-more-popover">
                <button type="button" data-pack-action="copy-settings" data-pack-id="">Einstellungen kopieren</button>
                ${this.hasCopiedProfileSettings ? '<button type="button" data-pack-action="paste-settings" data-pack-id="">Einstellungen einfügen</button>' : ''}
              </div>
            </details>
          </div>
        </div>
          <div class="pack-meta">
            ${standardVersion ? `<span class="pack-tag">Fabric ${this.escapeHtml(standardVersion)}</span>` : ''}
            <span class="pack-tag">Standard-Mods-Ordner</span>
          </div>
          <div class="pack-actions">
          <button class="btn btn-secondary" data-pack-action="activate-standard" ${activePackId ? '' : 'disabled'}>Aktivieren</button>
        </div>
      </article>
    `;

    const packCards = packs.map((pack) => {
      const isActive = pack.id === activePackId;
      const versionName = this.getVersionDisplayName(pack.versionId);
      return `
        <article class="pack-card${isActive ? ' active' : ''}">
          <div class="pack-card-head">
            <div>
              <h4>${this.escapeHtml(pack.name)}</h4>
              <p>Eigener Mods-Ordner und genau eine Fabric-Version pro Profil.</p>
            </div>
            <div class="pack-head-actions">
              ${isActive ? '<span class="pack-badge">Aktiv</span>' : ''}
              <details class="pack-more-menu">
                <summary aria-label="Profil-Aktionen">•••</summary>
                <div class="pack-more-popover">
                  <button type="button" data-pack-action="copy-settings" data-pack-id="${this.escapeHtml(pack.id)}" data-pack-name="${this.escapeHtml(pack.name)}">Einstellungen kopieren</button>
                  ${this.hasCopiedProfileSettings ? `<button type="button" data-pack-action="paste-settings" data-pack-id="${this.escapeHtml(pack.id)}" data-pack-name="${this.escapeHtml(pack.name)}">Einstellungen einfügen</button>` : ''}
                  <button type="button" class="is-danger" data-pack-action="delete" data-pack-id="${this.escapeHtml(pack.id)}" data-pack-name="${this.escapeHtml(pack.name)}">Profil löschen</button>
                </div>
              </details>
            </div>
          </div>
          <div class="pack-meta">
            <span class="pack-tag">Fabric ${this.escapeHtml(versionName || pack.versionId)}</span>
            <span class="pack-tag">eigener Mods-Ordner</span>
          </div>
          <div class="pack-actions">
            <button class="btn btn-primary" data-pack-action="activate" data-pack-id="${this.escapeHtml(pack.id)}" data-pack-name="${this.escapeHtml(pack.name)}" ${isActive ? 'disabled' : ''}>Aktivieren</button>
          </div>
        </article>
      `;
    });

    packsListEl.innerHTML = [standardCard, ...packCards].join('');
    this.prepareMotionGroup(packsListEl, ':scope > *', 34);
    this.renderStartPackSelect();
  }

  renderStartPackSelect() {
    const startPackSelectEl = document.getElementById('start-pack-select');
    if (!startPackSelectEl) {
      return;
    }

    const packs = this.packsConfig?.packs || [];
    const activePackId = this.packsConfig?.activePackId || this.launcherStatus?.activePackId || '';
    const standardVersion = this.getStandardVersionDisplayName();
    const options = [
      {
        id: '',
        name: standardVersion ? `Launcher-Standard (${standardVersion})` : 'Launcher-Standard'
      },
      ...packs.map((pack) => {
        const versionName = this.getVersionDisplayName(pack.versionId);
        return {
          id: pack.id,
          name: versionName ? `${pack.name} (${versionName})` : pack.name
        };
      })
    ];

    startPackSelectEl.innerHTML = options.map((option) => (
      `<option value="${this.escapeHtml(option.id)}" ${option.id === activePackId ? 'selected' : ''}>${this.escapeHtml(option.name)}</option>`
    )).join('');
    startPackSelectEl.disabled = options.length <= 1;
  }

  async refreshPackContext(options = {}) {
    const reloadSearch = options.reloadSearch !== false;
    const reloadMods = options.reloadMods !== false;
    this.launcherStatus = await window.electronAPI.getLauncherStatus();
    await this.loadAvailableVersions();
    await this.loadPacks();
    this.updateVersionStatus();
    this.updateMinecraftStatus();
    this.updateJavaStatus();
    if (reloadMods) {
      await this.loadMods();
    } else {
      this.updateModsCheckStatus('Mod-Prüfung läuft im Hintergrund.');
    }

    if (reloadSearch) {
      await this.searchModrinthMods({ showLoading: false });
      return;
    }

    this.updateModrinthSearchStatus();
    this.renderModrinthResults();
  }

  handlePacksListClick(event) {
    const button = event.target.closest('[data-pack-action]');
    if (!button) {
      return;
    }

    const action = button.getAttribute('data-pack-action') || '';
    const packId = button.getAttribute('data-pack-id') || '';
    const packName = button.getAttribute('data-pack-name') || '';

    if (action === 'activate-standard') {
      this.setPackContext('', 'Launcher-Standard');
      return;
    }

    if (action === 'activate' && packId) {
      this.setPackContext(packId, packName);
      return;
    }

    if (action === 'delete' && packId) {
      this.deletePack(packId, packName);
      return;
    }

    if (action === 'copy-settings') {
      this.copyProfileSettings(packId);
      return;
    }

    if (action === 'paste-settings') {
      this.pasteProfileSettings(packId, packName || 'Launcher-Standard');
    }
  }

  async copyProfileSettings(packId) {
    try {
      const result = await window.electronAPI.copyProfileSettings(packId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.hasCopiedProfileSettings = true;
      this.renderPacks();
      this.showNotification(result.message || 'Einstellungen kopiert.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async pasteProfileSettings(packId, packName) {
    try {
      const result = await window.electronAPI.pasteProfileSettings(packId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.showNotification(result.message || `Einstellungen in ${packName} eingefügt.`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  handleStartPackChange(event) {
    const selectEl = event.target;
    const packId = selectEl?.value || '';
    const activePackId = this.packsConfig?.activePackId || this.launcherStatus?.activePackId || '';

    if (packId === activePackId) {
      return;
    }

    const selectedOption = selectEl?.selectedOptions?.[0];
    const packName = selectedOption?.textContent || (packId ? 'Profil' : 'Launcher-Standard');
    this.setPackContext(packId, packName);
  }

  handlePacksListChange(event) {
    const selectEl = event.target?.closest('[data-pack-action="set-standard-version"]');
    if (!selectEl) {
      return;
    }

    this.setStandardVersionFromPacks(selectEl.value);
  }

  async createPack() {
    const nameInput = document.getElementById('pack-name-input');
    const versionSelectEl = document.getElementById('pack-version-select');
    const packName = nameInput?.value.trim() || '';
    const versionId = versionSelectEl?.value || '';

    if (!packName) {
      this.showNotification('Bitte gib einen Profil-Namen ein.');
      return;
    }

    if (!versionId) {
      this.showNotification('Bitte wähle eine Fabric-Version für das Profil aus.');
      return;
    }

    this.showLoading(`Erstelle Profil ${packName}...`);

    try {
      const result = await window.electronAPI.createPack(packName, versionId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      if (nameInput) {
        nameInput.value = '';
      }

      await this.refreshPackContext();
      this.showNotification(result.message || `Profil ${packName} wurde erstellt.`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async setPackContext(packId, packName = '') {
    this.showLoading(packId ? `Aktiviere ${packName || 'Profil'}...` : 'Aktiviere Launcher-Standard...');

    try {
      const result = await window.electronAPI.setActivePack(packId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      await this.refreshPackContext();
      this.showNotification(result.message || `${packName || 'Profil'} aktiviert.`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async setStandardVersionFromPacks(versionId) {
    const normalizedVersionId = String(versionId || '').trim();
    if (!normalizedVersionId) {
      return;
    }

    this.showLoading(`Speichere Launcher-Standard ${this.getVersionDisplayName(normalizedVersionId)}...`);

    try {
      const result = await window.electronAPI.setStandardVersion(normalizedVersionId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      await this.refreshPackContext({ reloadMods: false, reloadSearch: false });
      this.loadMods().catch((error) => console.error('Background mod reload failed:', error));
      const warningText = result.warning ? ` Hinweis: ${result.warning}` : '';
      const syncText = result.syncPending ? ' Mods werden im Hintergrund geprüft.' : '';
      this.showNotification(`Launcher-Standard nutzt jetzt Fabric ${this.getVersionDisplayName(result.selectedVersionId || normalizedVersionId)}.${syncText}${warningText}`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async deletePack(packId, packName) {
    const confirmed = await this.showConfirm({
      title: 'Profil löschen',
      message: `Profil "${packName}" wirklich löschen? Die zugehörigen Profil-Daten werden entfernt.`,
      confirmText: 'Profil löschen'
    });
    if (!confirmed) {
      return;
    }

    const previousPacksConfig = this.packsConfig;
    const deletingActivePack = String(this.packsConfig?.activePackId || '') === String(packId);
    this.packsConfig = {
      ...(this.packsConfig || {}),
      activePackId: deletingActivePack ? '' : (this.packsConfig?.activePackId || ''),
      packs: (this.packsConfig?.packs || []).filter((pack) => pack.id !== packId)
    };
    if (deletingActivePack) {
      this.mods = [];
      this.installedModProjectIds = new Set();
      this.modrinthLoadedResults = this.modrinthLoadedResults.map((project) => ({ ...project, installed: false }));
      this.modrinthResults = this.modrinthResults.map((project) => ({ ...project, installed: false }));
      this.renderMods();
      this.renderModrinthResults({ force: true });
    }
    this.renderPacks();
    this.renderStartPackSelect();
    try {
      const result = await window.electronAPI.deletePack(packId);
      if (!result.success) {
        this.packsConfig = previousPacksConfig;
        this.renderPacks();
        this.renderStartPackSelect();
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      await this.refreshPackContext({ reloadMods: true, reloadSearch: false });
      const nameInput = document.getElementById('pack-name-input');
      if (nameInput) {
        nameInput.value = packName || '';
        nameInput.focus();
        nameInput.select();
      }
      this.showNotification(result.message || `${packName} wurde gelöscht.`);
    } catch (error) {
      this.packsConfig = previousPacksConfig;
      this.renderPacks();
      this.renderStartPackSelect();
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async loadSkinConfig() {
    try {
      const result = await window.electronAPI.getSkinConfig();
      if (!result.success) {
        return;
      }

      this.skinConfig = result;
      if (result.warning) {
        console.warn(result.warning);
      }
      this.updateSkinUI();
      if (result.autoImportedAccountSkin) {
        this.showNotification(result.message || 'Dein aktueller Account-Skin wurde automatisch importiert.');
      }
    } catch (error) {
      console.error('Skin config error:', error);
    }
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  getSkinById(skinId) {
    return this.skinConfig?.skins?.find((skin) => skin.id === skinId) || null;
  }

  updateSkinUI() {
    const statusEl = document.getElementById('skin-status');
    const clearButton = document.getElementById('clear-skin-btn');

    if (!statusEl) {
      return;
    }

    const activeSkin = this.skinConfig?.activeSkin || null;
    const configured = Boolean(activeSkin);
    const skinCount = this.skinConfig?.skins?.length || 0;

    statusEl.textContent = configured
      ? `Aktiver Skin: ${activeSkin.name}${skinCount > 1 ? ` · ${skinCount} gespeichert` : ''}`
      : 'Noch kein Skin ausgewählt.';
    statusEl.style.color = configured ? 'var(--success)' : 'var(--text-gray)';

    if (clearButton) {
      clearButton.disabled = !configured;
    }

    this.renderSkinLibrary();
    this.updateSkinHeads(activeSkin);
    this.updateAdaptiveSkinColor(activeSkin);
  }

  async updateAdaptiveSkinColor(activeSkin) {
    this.updateSkinColorSettingUI();
    const requestId = ++this.skinColorRequestId;

    if (!this.skinColorSyncEnabled || !activeSkin?.previewDataUrl) {
      this.skinPrimaryColor = null;
      this.applyTheme();
      return;
    }

    try {
      const color = await this.extractPrimaryColorFromSkin(activeSkin);
      if (requestId !== this.skinColorRequestId) {
        return;
      }

      this.skinPrimaryColor = color;
      this.applyTheme();
    } catch (error) {
      if (requestId !== this.skinColorRequestId) {
        return;
      }

      console.warn('Skin color sync error:', error);
      this.skinPrimaryColor = null;
      this.applyTheme();
    }
  }

  async extractPrimaryColorFromSkin(activeSkin) {
    const texture = await this.loadSkinTexture(activeSkin.previewDataUrl);
    const width = texture.sourceCanvas.width;
    const height = texture.sourceCanvas.height;
    const imageData = texture.sourceContext.getImageData(0, 0, width, height).data;
    const hueBinCount = 36;
    const hueWindowRadius = 4;
    const colorBins = Array.from({ length: hueBinCount }, () => ({
      x: 0,
      y: 0,
      score: 0,
      saturation: 0,
      lightness: 0,
      brightLightness: 0,
      brightScore: 0
    }));
    const neutralBuckets = new Map();
    const neutralBucketSize = 16;
    const minColoredSaturation = 0.16;
    const minUsableLuminance = 0.18;
    const minUsableLightness = 0.22;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = ((y * width) + x) * 4;
        const a = imageData[index + 3];
        if (a < 150) {
          continue;
        }

        const r = imageData[index];
        const g = imageData[index + 1];
        const b = imageData[index + 2];
        const hsl = this.rgbToHsl(r, g, b);
        const luminance = ((0.2126 * r) + (0.7152 * g) + (0.0722 * b)) / 255;
        const alphaWeight = a / 255;
        if (hsl.s >= minColoredSaturation) {
          const hueIndex = Math.floor(hsl.h * hueBinCount) % hueBinCount;
          const angle = hsl.h * Math.PI * 2;
          const score = alphaWeight * (0.55 + hsl.s);
          const bin = colorBins[hueIndex];

          bin.x += Math.cos(angle) * score;
          bin.y += Math.sin(angle) * score;
          bin.score += score;
          bin.saturation += hsl.s * score;
          bin.lightness += hsl.l * score;
          if (luminance >= minUsableLuminance && hsl.l >= minUsableLightness) {
            bin.brightLightness += hsl.l * score;
            bin.brightScore += score;
          }
          continue;
        }

        if (luminance >= minUsableLuminance && hsl.l >= minUsableLightness) {
          const key = `${Math.floor(r / neutralBucketSize)}:${Math.floor(g / neutralBucketSize)}:${Math.floor(b / neutralBucketSize)}`;
          const bucket = neutralBuckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };

          bucket.r += r * alphaWeight;
          bucket.g += g * alphaWeight;
          bucket.b += b * alphaWeight;
          bucket.count += alphaWeight;
          neutralBuckets.set(key, bucket);
        }
      }
    }

    let bestHueCenter = -1;
    let bestHueScore = 0;
    for (let center = 0; center < hueBinCount; center += 1) {
      let windowScore = 0;
      for (let offset = -hueWindowRadius; offset <= hueWindowRadius; offset += 1) {
        const index = (center + offset + hueBinCount) % hueBinCount;
        windowScore += colorBins[index].score;
      }

      if (windowScore > bestHueScore) {
        bestHueScore = windowScore;
        bestHueCenter = center;
      }
    }

    if (bestHueCenter >= 0 && bestHueScore > 0) {
      const combined = {
        x: 0,
        y: 0,
        score: 0,
        saturation: 0,
        lightness: 0,
        brightLightness: 0,
        brightScore: 0
      };

      for (let offset = -hueWindowRadius; offset <= hueWindowRadius; offset += 1) {
        const index = (bestHueCenter + offset + hueBinCount) % hueBinCount;
        const bin = colorBins[index];

        combined.x += bin.x;
        combined.y += bin.y;
        combined.score += bin.score;
        combined.saturation += bin.saturation;
        combined.lightness += bin.lightness;
        combined.brightLightness += bin.brightLightness;
        combined.brightScore += bin.brightScore;
      }

      const hue = ((Math.atan2(combined.y, combined.x) / (Math.PI * 2)) + 1) % 1;
      const saturation = combined.saturation / combined.score;
      const lightness = combined.brightScore > 0
        ? combined.brightLightness / combined.brightScore
        : combined.lightness / combined.score;
      const tuned = this.hslToRgb(
        hue,
        Math.min(0.86, Math.max(0.38, saturation)),
        Math.min(0.68, Math.max(0.44, lightness))
      );

      return this.rgbToHex(tuned.r, tuned.g, tuned.b);
    }

    let bestNeutral = null;
    neutralBuckets.forEach((bucket) => {
      if (!bestNeutral || bucket.count > bestNeutral.count) {
        bestNeutral = bucket;
      }
    });

    if (!bestNeutral || bestNeutral.count <= 0) {
      return this.primaryColor;
    }

    const r = Math.round(bestNeutral.r / bestNeutral.count);
    const g = Math.round(bestNeutral.g / bestNeutral.count);
    const b = Math.round(bestNeutral.b / bestNeutral.count);
    const hsl = this.rgbToHsl(r, g, b);
    const tuned = this.hslToRgb(hsl.h, hsl.s, Math.min(0.7, Math.max(0.44, hsl.l)));

    return this.rgbToHex(tuned.r, tuned.g, tuned.b);
  }

  renderSkinLibrary() {
    const container = document.getElementById('skins-list');
    if (!container) {
      return;
    }

    const skins = this.skinConfig?.skins || [];
    if (!skins.length) {
      container.innerHTML = '<p class="skins-empty">Noch keine Skins gespeichert.</p>';
      this.prepareMotionGroup(container, ':scope > *', 34);
      return;
    }

    container.innerHTML = skins.map((skin) => {
      const variantLabel = skin.variant === 'slim' ? 'Slim' : 'Wide';
      const canToggleVariant = skin.height === 64;
      const activateDisabled = skin.active ? 'disabled' : '';
      const toggleDisabled = canToggleVariant ? '' : 'disabled';

      return `
        <article class="saved-skin-chip${skin.active ? ' active' : ''}">
          <img class="saved-skin-thumb" src="${skin.previewDataUrl}" alt="${this.escapeHtml(skin.name)}">
          <div class="saved-skin-chip-content">
            <div class="saved-skin-head">
              <h5>${this.escapeHtml(skin.name)}</h5>
              ${skin.active ? '<span class="saved-skin-badge">Aktiv</span>' : ''}
            </div>
            <p>${variantLabel}${skin.height === 64 ? '' : ' · 64x32'}</p>
          </div>
          <div class="saved-skin-actions">
            <button class="btn btn-primary" data-skin-action="activate" data-skin-id="${skin.id}" ${activateDisabled}>Aktivieren</button>
            <button class="btn btn-secondary" data-skin-action="toggle-variant" data-skin-id="${skin.id}" ${toggleDisabled}>${canToggleVariant ? variantLabel : 'Wide'}</button>
            <button class="btn btn-secondary" data-skin-action="remove" data-skin-id="${skin.id}">Löschen</button>
          </div>
        </article>
      `;
    }).join('');
    this.prepareMotionGroup(container, ':scope > *', 34);
  }

  setSkinHeadTexture(elementId, activeSkin) {
    const element = document.getElementById(elementId);
    if (!element) {
      return;
    }

    if (!activeSkin?.previewDataUrl) {
      element.style.removeProperty('--skin-image');
      element.style.removeProperty('--skin-sheet-height-units');
      element.classList.add('hidden');
      return;
    }

    element.style.setProperty('--skin-image', `url("${activeSkin.previewDataUrl}")`);
    element.style.setProperty('--skin-sheet-height-units', activeSkin.height === 32 ? '4' : '8');
    element.classList.remove('hidden');
  }

  async setDashboardSkinPreview(activeSkin) {
    const canvas = document.getElementById('dashboard-skin-canvas');
    const emptyEl = document.getElementById('dashboard-skin-empty');

    if (!canvas || !emptyEl) {
      return;
    }

    // Use the same canvas renderer as the preview in the Skins tab. The
    // skinview3d viewer used here previously had a different framing and could
    // cut off the lower legs in shorter launcher windows.
    this.disposeDashboardSkinViewer();

    if (this.dashboardSkinAnimationFrame) {
      cancelAnimationFrame(this.dashboardSkinAnimationFrame);
      this.dashboardSkinAnimationFrame = null;
    }

    const dashboardPreviewScale = 24;
    const rendered = await this.renderSkin3DPreviewCanvas(canvas, activeSkin, dashboardPreviewScale, 0);
    canvas.setAttribute('aria-hidden', rendered ? 'false' : 'true');
    emptyEl.classList.toggle('hidden', rendered);
    emptyEl.setAttribute('aria-hidden', rendered ? 'true' : 'false');
    this.updateUsernameDisplays();

    if (!rendered) {
      return;
    }

    const animationStart = performance.now();
    const animate = (timestamp) => {
      this.renderSkin3DPreviewCanvas(canvas, activeSkin, dashboardPreviewScale, timestamp - animationStart).catch((error) => {
        console.error('Dashboard skin animation error:', error);
      });
      this.dashboardSkinAnimationFrame = requestAnimationFrame(animate);
    };
    this.dashboardSkinAnimationFrame = requestAnimationFrame(animate);
  }

  async setDashboardSkinViewerPreview(canvas, activeSkin) {
    if (!canvas || !activeSkin?.previewDataUrl) {
      this.disposeDashboardSkinViewer();
      canvas?.classList.add('hidden');
      return false;
    }

    if (this.dashboardSkinAnimationFrame) {
      cancelAnimationFrame(this.dashboardSkinAnimationFrame);
      this.dashboardSkinAnimationFrame = null;
    }

    if (!this.dashboardSkinLaunchExitActive) {
      this.resetDashboardSkinLaunchExitAnimation();
    }
    const skinview = window.skinview3d;
    if (!this.dashboardSkinViewer) {
      const dashboardSkinPixelRatio = Math.min(2, Math.max(1.5, Number(window.devicePixelRatio) || 1));
      this.dashboardSkinIdleAnimation = new skinview.IdleAnimation();
      this.dashboardSkinIdleAnimation.speed = 0.16;
      this.dashboardSkinIdleAnimation.addAnimation((player) => {
        this.applyDashboardSkinSmoothHeadTracking(player, 0.12);
      });
      this.dashboardSkinViewer = new skinview.SkinViewer({
        canvas,
        width: 460,
        height: 720,
        enableControls: false,
        background: null,
        fov: 34,
        zoom: 0.74,
        pixelRatio: dashboardSkinPixelRatio,
        animation: this.dashboardSkinIdleAnimation
      });
      this.dashboardSkinViewer.renderer.setClearColor(0x000000, 0);
      this.dashboardSkinViewer.globalLight.intensity = 2.6;
      this.dashboardSkinViewer.cameraLight.intensity = 0.7;
      this.configureDashboardSkinViewerCamera();
    }

    const nextSource = `${activeSkin.id || ''}:${activeSkin.previewDataUrl}`;
    if (this.dashboardSkinViewerSource !== nextSource) {
      this.dashboardSkinViewerSource = nextSource;
      await this.dashboardSkinViewer.loadSkin(activeSkin.previewDataUrl, {
        model: activeSkin.variant === 'slim' ? 'slim' : 'default'
      });
    }

    if (!this.dashboardSkinLaunchExitActive) {
      this.dashboardSkinViewer.animation = this.dashboardSkinIdleAnimation;
      this.configureDashboardSkinViewerCamera();
    }
    this.dashboardSkinViewer.renderPaused = false;
    canvas.classList.remove('hidden');
    return true;
  }

  configureDashboardSkinViewerCamera() {
    if (!this.dashboardSkinViewer) {
      return;
    }

    const viewer = this.dashboardSkinViewer;
    viewer.playerObject.rotation.y = -0.2;
    viewer.playerObject.position.set(0, -3.5, 0);
    viewer.playerObject.skin.head.rotation.x = 0;
    viewer.playerObject.skin.head.rotation.y = 0;
    viewer.playerObject.skin.head.rotation.z = 0;
    viewer.camera.position.set(0, 7, 58);
    viewer.camera.lookAt(0, 8, 0);
    viewer.camera.updateProjectionMatrix();
  }

  disposeDashboardSkinViewer() {
    if (this.dashboardSkinViewer) {
      this.dashboardSkinViewer.dispose();
      this.dashboardSkinViewer = null;
      this.dashboardSkinIdleAnimation = null;
      this.dashboardSkinWalkAnimation = null;
      this.dashboardSkinViewerSource = '';
    }
  }

  loadImageSource(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Skin-Vorschau konnte nicht geladen werden.'));
      image.src = source;
    });
  }

  async loadSkinTexture(source) {
    if (this.skinTextureCache.has(source)) {
      return this.skinTextureCache.get(source);
    }

    const image = await this.loadImageSource(source);
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = image.naturalWidth || image.width;
    sourceCanvas.height = image.naturalHeight || image.height;
    const sourceContext = sourceCanvas.getContext('2d');
    if (!sourceContext) {
      return null;
    }

    sourceContext.imageSmoothingEnabled = false;
    sourceContext.drawImage(image, 0, 0);

    const texture = {
      sourceCanvas,
      sourceContext
    };
    this.skinTextureCache.set(source, texture);
    return texture;
  }

  async renderSkinFrontPreviewCanvas(canvas, activeSkin, scale = 8) {
    if (!canvas) {
      return false;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return false;
    }

    if (!activeSkin?.previewDataUrl) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.classList.add('hidden');
      return false;
    }

    const image = await this.loadImageSource(activeSkin.previewDataUrl);
    const isLegacy = activeSkin.height === 32;
    const isSlim = activeSkin.variant === 'slim' && !isLegacy;
    const armWidth = isSlim ? 3 : 4;
    const previewWidth = armWidth * 2 + 8;
    const legDrop = 0.5;
    const previewHeight = 32 + Math.max(legDrop, 0);
    const bodyLeft = armWidth;
    const rightArmLeft = bodyLeft + 8;
    const legY = 20 + legDrop;

    canvas.width = previewWidth * scale;
    canvas.height = previewHeight * scale;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;

    const drawPart = (sx, sy, sw, sh, dx, dy) => {
      context.drawImage(
        image,
        sx,
        sy,
        sw,
        sh,
        dx * scale,
        dy * scale,
        sw * scale,
        sh * scale
      );
    };

    drawPart(8, 8, 8, 8, bodyLeft, 0);
    drawPart(20, 20, 8, 12, bodyLeft, 8);
    drawPart(44, 20, armWidth, 12, 0, 8);
    drawPart(isLegacy ? 44 : 36, isLegacy ? 20 : 52, armWidth, 12, rightArmLeft, 8);
    drawPart(4, 20, 4, 12, bodyLeft, legY);
    drawPart(isLegacy ? 4 : 20, isLegacy ? 20 : 52, 4, 12, bodyLeft + 4, legY);

    drawPart(40, 8, 8, 8, bodyLeft, 0);
    if (!isLegacy) {
      drawPart(20, 36, 8, 12, bodyLeft, 8);
      drawPart(44, 36, armWidth, 12, 0, 8);
      drawPart(52, 52, armWidth, 12, rightArmLeft, 8);
      drawPart(4, 36, 4, 12, bodyLeft, legY);
      drawPart(4, 52, 4, 12, bodyLeft + 4, legY);
    }

    canvas.classList.remove('hidden');
    return true;
  }

  async renderSkin3DPreviewCanvas(canvas, activeSkin, scale = 10, animationTime = 0, options = {}) {
    // 1) Canvas und aktiven Skin prüfen.
    if (!canvas) {
      return false;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return false;
    }

    if (!activeSkin?.previewDataUrl) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.classList.add('hidden');
      return false;
    }

    // 2) Skin-PNG als Textur laden. Die Textur kommt aus dem aktiven Skin.
    const texture = await this.loadSkinTexture(activeSkin.previewDataUrl);
    if (!texture) {
      return false;
    }
    const { sourceContext } = texture;

    // 3) Minecraft-Skin-Modell erkennen: Classic/Slim und alte 64x32-Skins.
    const isLegacy = activeSkin.height === 32;
    const isSlim = activeSkin.variant === 'slim' && !isLegacy;
    const armWidth = isSlim ? 3 : 4;

    // 4) 3D-Tiefe und Canvas-Größe berechnen.
    const depth = {
      x: Math.round(scale * 0.62),
      y: -Math.round(scale * 0.42)
    };
    const modelLeft = 3.55;
    const modelRight = 12.45 + (armWidth * 2);
    const modelWidth = modelRight - modelLeft;
    const legDrop = 0.5;
    const modelHeight = 32 + Math.max(legDrop, 0);
    const padding = scale * 5;
    const animationPadding = scale * 1.7;
    const stageWidth = Math.ceil((modelWidth * scale) + depth.x + (padding * 2) + (animationPadding * 2));
    const stageHeight = Math.ceil((modelHeight * scale) - depth.y + (padding * 2) + (animationPadding * 2));

    // 5) Canvas für den aktuellen Frame vorbereiten.
    canvas.width = stageWidth;
    canvas.height = stageHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;

    // 6) Modell mittig platzieren und leichte Idle-Bewegung berechnen.
    const originX = ((stageWidth - (modelWidth * scale) - depth.x) / 2) - (modelLeft * scale);
    const originY = ((stageHeight - (modelHeight * scale) + depth.y) / 2) - depth.y;
    const sway = Math.sin(animationTime / 720) * 0.26;
    const smallSway = Math.sin((animationTime / 720) + Math.PI) * 0.18;

    // 7) Ruhige Standpose: alles bleibt am Körper, aber nicht komplett steif.
    const pose = {
      bodyRotation: 0,
      headRotation: -2,
      leftArmRotation: -5,
      rightArmRotation: 6,
      leftLegRotation: 2,
      rightLegRotation: -2,
      leftArmX: 3.85,
      leftArmY: 8.15,
      rightArmX: 12.15 + armWidth,
      rightArmY: 8.2,
      leftLegX: 4 + armWidth,
      leftLegY: 20 + legDrop,
      rightLegX: 8 + armWidth,
      rightLegY: 20 + legDrop
    };

    // 8) Pixel-Farben aus der Skin-Textur lesen und cachen.
    const rgbaCache = new Map();
    const getPixel = (sx, sy) => {
      const key = `${sx},${sy}`;
      if (rgbaCache.has(key)) {
        return rgbaCache.get(key);
      }

      const pixel = sourceContext.getImageData(sx, sy, 1, 1).data;
      const value = {
        r: pixel[0],
        g: pixel[1],
        b: pixel[2],
        a: pixel[3] / 255
      };
      rgbaCache.set(key, value);
      return value;
    };
    const getColor = (sx, sy, shade) => {
      const pixel = getPixel(sx, sy);
      if (pixel.a <= 0) {
        return null;
      }

      const clampColor = (value) => Math.max(0, Math.min(255, Math.round(value * shade)));
      return `rgba(${clampColor(pixel.r)}, ${clampColor(pixel.g)}, ${clampColor(pixel.b)}, ${pixel.a})`;
    };

    // 9) Einen Punkt innerhalb einer 3D-Fläche auf Canvas-Koordinaten abbilden.
    const project = (point, xRatio, yRatio) => ({
      x: point.topLeft.x + ((point.topRight.x - point.topLeft.x) * xRatio) + ((point.bottomLeft.x - point.topLeft.x) * yRatio),
      y: point.topLeft.y + ((point.topRight.y - point.topLeft.y) * xRatio) + ((point.bottomLeft.y - point.topLeft.y) * yRatio)
    });

    // 10) Ein einzelnes Skin-Pixel als leicht überlappendes Viereck zeichnen.
    const drawQuad = (points, color) => {
      const center = points.reduce((sum, point) => ({
        x: sum.x + point.x,
        y: sum.y + point.y
      }), { x: 0, y: 0 });
      center.x /= points.length;
      center.y /= points.length;
      const expandedPoints = points.map((point) => {
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        const length = Math.hypot(dx, dy) || 1;

        return {
          x: point.x + ((dx / length) * 0.45),
          y: point.y + ((dy / length) * 0.45)
        };
      });

      context.beginPath();
      context.moveTo(expandedPoints[0].x, expandedPoints[0].y);
      context.lineTo(expandedPoints[1].x, expandedPoints[1].y);
      context.lineTo(expandedPoints[2].x, expandedPoints[2].y);
      context.lineTo(expandedPoints[3].x, expandedPoints[3].y);
      context.closePath();
      context.fillStyle = color;
      context.fill();
    };

    // 11) Eine ganze Texturfläche Pixel für Pixel auf eine 3D-Fläche zeichnen.
    const drawTexturedFace = (src, quad, shade) => {
      for (let y = 0; y < src.h; y += 1) {
        for (let x = 0; x < src.w; x += 1) {
          const color = getColor(src.x + x, src.y + y, shade);
          if (!color) {
            continue;
          }

          const topLeft = project(quad, x / src.w, y / src.h);
          const topRight = project(quad, (x + 1) / src.w, y / src.h);
          const bottomRight = project(quad, (x + 1) / src.w, (y + 1) / src.h);
          const bottomLeft = project(quad, x / src.w, (y + 1) / src.h);
          drawQuad([topLeft, topRight, bottomRight, bottomLeft], color);
        }
      }
    };

    // 12) Aus Position/Größe/Rotation die sichtbaren 3D-Flächen bauen.
    const makeFace = (x, y, w, h, inflate = 0, rotation = 0, pivot = null) => {
      const radians = (rotation * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const inflatedX = x - inflate;
      const inflatedY = y - inflate;
      const inflatedWidth = w + (inflate * 2);
      const inflatedHeight = h + (inflate * 2);
      const pivotX = pivot?.x ?? (inflatedX + (inflatedWidth / 2));
      const pivotY = pivot?.y ?? (inflatedY + (inflatedHeight / 2));
      const makePoint = (pointX, pointY) => {
        const localX = pointX - pivotX;
        const localY = pointY - pivotY;
        const rotatedX = pivotX + ((localX * cos) - (localY * sin));
        const rotatedY = pivotY + ((localX * sin) + (localY * cos));

        return {
          x: originX + (rotatedX * scale),
          y: originY + (rotatedY * scale)
        };
      };
      const topLeft = makePoint(inflatedX, inflatedY);
      const topRight = makePoint(inflatedX + inflatedWidth, inflatedY);
      const bottomRight = makePoint(inflatedX + inflatedWidth, inflatedY + inflatedHeight);
      const bottomLeft = makePoint(inflatedX, inflatedY + inflatedHeight);

      return {
        front: {
          topLeft,
          topRight,
          bottomLeft
        },
        right: {
          topLeft: topRight,
          topRight: { x: topRight.x + depth.x, y: topRight.y + depth.y },
          bottomLeft: bottomRight
        },
        top: {
          topLeft,
          topRight,
          bottomLeft: { x: topLeft.x + depth.x, y: topLeft.y + depth.y }
        }
      };
    };

    // 13) Einen Körperteil-Block zeichnen, inklusive zweiter Overlay-Layer.
    const drawBox = ({ x, y, w, h, rotation = 0, pivot = null, front, right, top, overlayFront, overlayRight, overlayTop }) => {
      const faces = makeFace(x, y, w, h, 0, rotation, pivot);
      drawTexturedFace(top, faces.top, 1.08);
      drawTexturedFace(right, faces.right, 0.72);
      drawTexturedFace(front, faces.front, 1);

      const overlayFaces = makeFace(x, y, w, h, 0.34, rotation, pivot);
      if (overlayTop) {
        drawTexturedFace(overlayTop, overlayFaces.top, 1.08);
      }
      if (overlayRight) {
        drawTexturedFace(overlayRight, overlayFaces.right, 0.72);
      }
      if (overlayFront) {
        drawTexturedFace(overlayFront, overlayFaces.front, 1);
      }
    };

    const drawNameplate = ({ x, y, w, h, rotation = 0, pivot = null }) => {
      if (!options.showNameplate) {
        return;
      }

      const username = String(this.user?.username || 'Player').trim() || 'Player';
      const headFaces = makeFace(x, y, w, h, 0.34, rotation, pivot);
      const topRightBack = {
        x: headFaces.top.topRight.x + depth.x,
        y: headFaces.top.topRight.y + depth.y
      };
      const points = [
        headFaces.top.topLeft,
        headFaces.top.topRight,
        headFaces.top.bottomLeft,
        topRightBack
      ];
      const nameplateScale = Number(options.nameplateScale) || 0.58;
      const anchorX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
      const pixelSize = Math.max(3, Math.round(scale * nameplateScale * 0.12));
      const bob = Math.sin(animationTime / 900) * scale * 0.08;
      const anchorY = Math.min(...points.map((point) => point.y)) - (scale * 1.75) + bob;
      const glyphGap = pixelSize;
      const glyphs = {
        A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
        B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
        C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
        D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
        E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
        F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
        G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
        H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
        I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
        J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
        K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
        L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
        M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
        N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
        O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
        P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
        Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
        R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
        S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
        T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
        U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
        V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
        W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
        X: ['10001', '01010', '01010', '00100', '01010', '01010', '10001'],
        Y: ['10001', '01010', '01010', '00100', '00100', '00100', '00100'],
        Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
        0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
        1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
        2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
        3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
        4: ['10010', '10010', '10010', '11111', '00010', '00010', '00010'],
        5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
        6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
        7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
        8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
        9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
        _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
        '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
        '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100']
      };
      const getGlyph = (char) => {
        if (char === ' ') {
          return ['000', '000', '000', '000', '000', '000', '000'];
        }
        return glyphs[char.toUpperCase()] || glyphs._;
      };
      const measurePixelText = (text) => Array.from(text).reduce((width, char, index) => {
        const glyph = getGlyph(char);
        return width + (glyph[0].length * pixelSize) + (index > 0 ? glyphGap : 0);
      }, 0);
      const drawPixelText = (targetContext, text, x, y, color) => {
        let cursorX = Math.round(x);
        const baseY = Math.round(y);
        targetContext.fillStyle = color;
        Array.from(text).forEach((char, charIndex) => {
          const glyph = getGlyph(char);
          if (charIndex > 0) {
            cursorX += glyphGap;
          }
          glyph.forEach((row, rowIndex) => {
            Array.from(row).forEach((cell, colIndex) => {
              if (cell === '1') {
                targetContext.fillRect(cursorX + (colIndex * pixelSize), baseY + (rowIndex * pixelSize), pixelSize, pixelSize);
              }
            });
          });
          cursorX += glyph[0].length * pixelSize;
        });
      };

      let label = username;
      const maxTextWidth = Math.max(40, stageWidth - (scale * 5));
      if (measurePixelText(label) > maxTextWidth) {
        while (label.length > 3 && measurePixelText(`${label}...`) > maxTextWidth) {
          label = label.slice(0, -1);
        }
        label = `${label}...`;
      }

      const textWidth = Math.ceil(measurePixelText(label));
      const textHeight = pixelSize * 7;
      const paddingX = Math.max(5, Math.round(pixelSize * 1.8));
      const paddingY = Math.max(3, Math.round(pixelSize * 0.9));
      const shadowOffset = Math.max(2, Math.round(pixelSize * 0.42));
      const depthX = Math.max(2, Math.round(pixelSize * 0.42));
      const depthY = Math.max(2, Math.round(pixelSize * 0.32));
      const rectWidth = textWidth + (paddingX * 2) + depthX;
      const rectHeight = textHeight + (paddingY * 2) + depthY;
      const rectX = Math.round(anchorX - (rectWidth / 2));
      const rectY = anchorY - (rectHeight / 2);
      const textX = Math.round((rectWidth - textWidth) / 2);
      const textY = Math.round((rectHeight - textHeight) / 2);
      const nameplateCanvas = document.createElement('canvas');
      nameplateCanvas.width = rectWidth;
      nameplateCanvas.height = rectHeight;
      const nameplateContext = nameplateCanvas.getContext('2d');
      if (!nameplateContext) {
        return;
      }
      nameplateContext.imageSmoothingEnabled = false;

      context.save();
      nameplateContext.fillStyle = 'rgba(0, 0, 0, 0.42)';
      nameplateContext.fillRect(0, 0, rectWidth, rectHeight);
      nameplateContext.fillStyle = 'rgba(255, 255, 255, 0.08)';
      nameplateContext.fillRect(0, 0, rectWidth - depthX, Math.max(1, Math.round(pixelSize * 0.28)));
      for (let layer = 3; layer >= 1; layer -= 1) {
        const layerShade = 38 + (layer * 12);
        const layerOffsetX = Math.round(depthX * layer * 0.55);
        const layerOffsetY = Math.round(depthY * layer * 0.55);
        drawPixelText(
          nameplateContext,
          label,
          textX + layerOffsetX,
          textY + layerOffsetY,
          `rgba(${layerShade}, ${layerShade}, ${layerShade}, 0.98)`
        );
      }
      drawPixelText(nameplateContext, label, textX + shadowOffset, textY + shadowOffset, 'rgba(18, 18, 18, 0.95)');
      drawPixelText(nameplateContext, label, textX, textY, '#ffffff');
      context.imageSmoothingEnabled = true;
      context.drawImage(nameplateCanvas, rectX, rectY);
      context.imageSmoothingEnabled = false;
      context.restore();
    };

    // 14) UV-Positionen für rechte Arm-/Bein-Texturen, je nach Skin-Format.
    const rightArmSourceY = isLegacy ? 20 : 52;
    const rightArmTopY = isLegacy ? 16 : 48;
    const rightLegSourceX = isLegacy ? 4 : 20;
    const rightLegTopX = isLegacy ? 4 : 20;
    const rightLegSourceY = isLegacy ? 20 : 52;
    const rightLegTopY = isLegacy ? 16 : 48;

    // 15) Linker Arm.
    drawBox({
      x: pose.leftArmX,
      y: pose.leftArmY + sway,
      w: armWidth,
      h: 12,
      rotation: pose.leftArmRotation,
      pivot: { x: pose.leftArmX + armWidth, y: 8.9 },
      front: { x: 44, y: 20, w: armWidth, h: 12 },
      right: { x: 40, y: 20, w: 4, h: 12 },
      top: { x: 44, y: 16, w: armWidth, h: 4 },
      overlayFront: isLegacy ? null : { x: 44, y: 36, w: armWidth, h: 12 },
      overlayRight: isLegacy ? null : { x: 40, y: 36, w: 4, h: 12 },
      overlayTop: isLegacy ? null : { x: 44, y: 32, w: armWidth, h: 4 }
    });

    // 16) Körper.
    drawBox({
      x: 4 + armWidth,
      y: 8,
      w: 8,
      h: 12,
      rotation: pose.bodyRotation,
      front: { x: 20, y: 20, w: 8, h: 12 },
      right: { x: 16, y: 20, w: 4, h: 12 },
      top: { x: 20, y: 16, w: 8, h: 4 },
      overlayFront: isLegacy ? null : { x: 20, y: 36, w: 8, h: 12 },
      overlayRight: isLegacy ? null : { x: 16, y: 36, w: 4, h: 12 },
      overlayTop: isLegacy ? null : { x: 20, y: 32, w: 8, h: 4 }
    });

    // 17) Rechter Arm.
    drawBox({
      x: pose.rightArmX,
      y: pose.rightArmY - sway,
      w: armWidth,
      h: 12,
      rotation: pose.rightArmRotation,
      pivot: { x: pose.rightArmX, y: 8.9 },
      front: { x: 36, y: rightArmSourceY, w: armWidth, h: 12 },
      right: { x: 32, y: rightArmSourceY, w: 4, h: 12 },
      top: { x: 36, y: rightArmTopY, w: armWidth, h: 4 },
      overlayFront: isLegacy ? null : { x: 52, y: 52, w: armWidth, h: 12 },
      overlayRight: isLegacy ? null : { x: 48, y: 52, w: 4, h: 12 },
      overlayTop: isLegacy ? null : { x: 52, y: 48, w: armWidth, h: 4 }
    });

    // 18) Linkes Bein.
    drawBox({
      x: pose.leftLegX,
      y: pose.leftLegY + smallSway,
      w: 4,
      h: 12,
      rotation: pose.leftLegRotation,
      pivot: { x: pose.leftLegX + 2, y: pose.leftLegY },
      front: { x: 4, y: 20, w: 4, h: 12 },
      right: { x: 0, y: 20, w: 4, h: 12 },
      top: { x: 4, y: 16, w: 4, h: 4 },
      overlayFront: isLegacy ? null : { x: 4, y: 36, w: 4, h: 12 },
      overlayRight: isLegacy ? null : { x: 0, y: 36, w: 4, h: 12 },
      overlayTop: isLegacy ? null : { x: 4, y: 32, w: 4, h: 4 }
    });

    // 19) Rechtes Bein.
    drawBox({
      x: pose.rightLegX,
      y: pose.rightLegY - smallSway,
      w: 4,
      h: 12,
      rotation: pose.rightLegRotation,
      pivot: { x: pose.rightLegX + 2, y: pose.rightLegY },
      front: { x: rightLegSourceX, y: rightLegSourceY, w: 4, h: 12 },
      right: { x: rightLegSourceX - 4, y: rightLegSourceY, w: 4, h: 12 },
      top: { x: rightLegTopX, y: rightLegTopY, w: 4, h: 4 },
      overlayFront: isLegacy ? null : { x: 4, y: 52, w: 4, h: 12 },
      overlayRight: isLegacy ? null : { x: 0, y: 52, w: 4, h: 12 },
      overlayTop: isLegacy ? null : { x: 4, y: 48, w: 4, h: 4 }
    });

    // 20) Kopf inklusive Hut-/Helm-Overlay.
    const headBox = {
      x: 4 + armWidth,
      y: 0,
      w: 8,
      h: 8,
      rotation: pose.headRotation,
      pivot: { x: 8 + armWidth, y: 8 },
      front: { x: 8, y: 8, w: 8, h: 8 },
      right: { x: 16, y: 8, w: 8, h: 8 },
      top: { x: 8, y: 0, w: 8, h: 8 },
      overlayFront: { x: 40, y: 8, w: 8, h: 8 },
      overlayRight: { x: 48, y: 8, w: 8, h: 8 },
      overlayTop: { x: 40, y: 0, w: 8, h: 8 }
    };
    drawBox(headBox);
    drawNameplate(headBox);

    // 21) Fertigen Frame anzeigen.
    canvas.classList.remove('hidden');
    return true;
  }

  async renderSkinPreview(activeSkin) {
    const canvas = document.getElementById('skin-preview-canvas');
    const emptyEl = document.getElementById('skin-preview-empty');

    if (!canvas || !emptyEl) {
      return;
    }

    if (this.skinPreviewAnimationFrame) {
      cancelAnimationFrame(this.skinPreviewAnimationFrame);
      this.skinPreviewAnimationFrame = null;
    }

    const rendered = await this.renderSkin3DPreviewCanvas(canvas, activeSkin, 14, 0);
    canvas.setAttribute('aria-hidden', rendered ? 'false' : 'true');
    emptyEl.classList.toggle('hidden', rendered);
    emptyEl.setAttribute('aria-hidden', rendered ? 'true' : 'false');

    if (!rendered) {
      return;
    }

    const animationStart = performance.now();
    const animate = (timestamp) => {
      this.renderSkin3DPreviewCanvas(canvas, activeSkin, 14, timestamp - animationStart).catch((error) => {
        console.error('Skin preview animation error:', error);
      });
      this.skinPreviewAnimationFrame = requestAnimationFrame(animate);
    };
    this.skinPreviewAnimationFrame = requestAnimationFrame(animate);
  }

  updateSkinHeads(activeSkin) {
    const emptyEl = document.getElementById('skin-preview-empty');
    const canvas = document.getElementById('skin-preview-canvas');
    const configured = Boolean(activeSkin?.previewDataUrl);

    this.setSkinHeadTexture('header-skin-head', activeSkin);
    this.setDashboardSkinPreview(activeSkin).catch((error) => {
      console.error('Dashboard skin preview error:', error);
      const dashboardCanvas = document.getElementById('dashboard-skin-canvas');
      const dashboardEmpty = document.getElementById('dashboard-skin-empty');
      dashboardCanvas?.classList.add('hidden');
      dashboardCanvas?.setAttribute('aria-hidden', 'true');
      dashboardEmpty?.classList.remove('hidden');
      dashboardEmpty?.setAttribute('aria-hidden', 'false');
    });
    this.renderSkinPreview(activeSkin).catch((error) => {
      console.error('Skin preview error:', error);
      canvas?.classList.add('hidden');
      emptyEl?.classList.remove('hidden');
    });

    if (emptyEl) {
      emptyEl.classList.toggle('hidden', configured);
    }
  }

  async handleSkinListClick(event) {
    const button = event.target.closest('[data-skin-action]');
    if (!button) {
      return;
    }

    const skinId = button.getAttribute('data-skin-id') || '';
    const action = button.getAttribute('data-skin-action') || '';
    if (!skinId || !action) {
      return;
    }

    if (action === 'activate') {
      await this.activateSkin(skinId);
      return;
    }

    if (action === 'toggle-variant') {
      await this.toggleSkinVariant(skinId);
      return;
    }

    if (action === 'remove') {
      await this.removeSkin(skinId);
    }
  }

  updateSkinLibraryStatus(message, tone = '') {
    const statusEl = document.getElementById('skin-library-status');
    if (!statusEl) {
      return;
    }

    statusEl.textContent = this.localizeText(message);
    statusEl.classList.remove('is-error', 'is-ok', 'is-warning');
    if (tone) {
      statusEl.classList.add(`is-${tone}`);
    }
  }

  ensureSkinLibrarySuggestions() {
    if (this.skinLibraryInitialSearchDone || this.skinLibraryIsLoading) {
      return;
    }

    this.skinLibraryInitialSearchDone = true;
    const inputEl = document.getElementById('skin-library-search-input');
    if (inputEl && !inputEl.value.trim() && this.user?.username) {
      inputEl.value = this.user.username;
    }

    this.searchOnlineSkins({ showLoading: false });
  }

  getOnlineSkinById(onlineSkinId) {
    return this.onlineSkinResults.find((skin) => skin.id === onlineSkinId) || null;
  }

  handleOnlineSkinResultsClick(event) {
    const button = event.target.closest('[data-online-skin-action]');
    if (!button) {
      return;
    }

    const action = button.getAttribute('data-online-skin-action') || '';
    const onlineSkinId = button.getAttribute('data-online-skin-id') || '';
    if (action === 'download' && onlineSkinId) {
      this.downloadOnlineSkin(onlineSkinId);
    }
  }

  async searchOnlineSkins(options = {}) {
    if (typeof window.electronAPI?.searchOnlineSkins !== 'function') {
      this.updateSkinLibraryStatus('Online-Skin-Bibliothek ist in diesem Build nicht verfügbar.', 'error');
      return;
    }

    const inputEl = document.getElementById('skin-library-search-input');
    const button = document.getElementById('skin-library-search-btn');
    const query = inputEl?.value.trim() || '';
    const previousButtonText = button?.textContent || '';

    this.onlineSkinQuery = query;
    this.onlineSkinResults = [];
    this.skinLibraryIsLoading = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'Sucht...';
    }
    this.updateSkinLibraryStatus(query ? `Suche passende Skins für "${query}"...` : 'Lade beliebte Skin-Vorschläge...');
    this.renderOnlineSkinResults();

    try {
      const result = await window.electronAPI.searchOnlineSkins(query);
      if (!result.success) {
        this.onlineSkinResults = [];
        this.updateSkinLibraryStatus('Fehler: ' + result.error, 'error');
        this.renderOnlineSkinResults();
        return;
      }

      this.onlineSkinResults = result.results || [];
      const resultQuery = result.query || query;
      if (this.onlineSkinResults.length) {
        this.updateSkinLibraryStatus(
          resultQuery
            ? `${this.onlineSkinResults.length} Vorschläge passend zu "${resultQuery}".`
            : `${this.onlineSkinResults.length} beliebte Skin-Vorschläge.`,
          'ok'
        );
      } else {
        this.updateSkinLibraryStatus(
          resultQuery
            ? `Keine passenden Online-Skins für "${resultQuery}" gefunden.`
            : 'Keine Online-Skins gefunden.',
          'warning'
        );
      }
      this.renderOnlineSkinResults();
    } catch (error) {
      this.onlineSkinResults = [];
      this.updateSkinLibraryStatus('Fehler: ' + error.message, 'error');
      this.renderOnlineSkinResults();
    } finally {
      this.skinLibraryIsLoading = false;
      if (button) {
        button.disabled = false;
        button.textContent = previousButtonText || 'Suchen';
      }
      this.renderOnlineSkinResults();
    }
  }

  renderOnlineSkinResults() {
    const container = document.getElementById('skin-library-results');
    if (!container) {
      return;
    }

    if (this.skinLibraryIsLoading && !this.onlineSkinResults.length) {
      container.innerHTML = '<p class="skins-empty">Online-Skins werden geladen...</p>';
      this.prepareMotionGroup(container, ':scope > *', 34);
      return;
    }

    if (!this.onlineSkinResults.length) {
      container.innerHTML = '<p class="skins-empty">Noch keine Online-Skins geladen.</p>';
      this.prepareMotionGroup(container, ':scope > *', 34);
      return;
    }

    container.innerHTML = this.onlineSkinResults.map((skin) => {
      const variantLabel = skin.variant === 'slim' ? 'Slim' : 'Wide';
      const sheetHeightUnits = skin.height === 32 ? '4' : '8';
      const previewDataUrl = this.escapeHtml(skin.previewDataUrl || '');

      return `
        <article class="online-skin-card">
          <div class="skin-head skin-library-head" style="--skin-image: url(${previewDataUrl}); --skin-sheet-height-units: ${sheetHeightUnits};" aria-hidden="true">
            <div class="skin-head-layer base"></div>
            <div class="skin-head-layer hat"></div>
          </div>
          <div class="online-skin-content">
            <div class="saved-skin-head">
              <h4>${this.escapeHtml(skin.name)}</h4>
            </div>
            <p>${this.escapeHtml(skin.sourceLabel || 'Skin-Bibliothek')} · ${variantLabel}</p>
          </div>
          <div class="online-skin-actions">
            <button class="btn btn-primary" type="button" data-online-skin-action="download" data-online-skin-id="${this.escapeHtml(skin.id)}">Download</button>
          </div>
        </article>
      `;
    }).join('');
    this.prepareMotionGroup(container, ':scope > *', 34);
  }

  async downloadOnlineSkin(onlineSkinId) {
    const onlineSkin = this.getOnlineSkinById(onlineSkinId);
    if (!onlineSkin || typeof window.electronAPI?.downloadOnlineSkin !== 'function') {
      return;
    }

    this.showLoading(`Lade ${onlineSkin.name} herunter...`);

    try {
      const result = await window.electronAPI.downloadOnlineSkin({
        name: onlineSkin.name,
        skinId: onlineSkin.skinId,
        sourceUrl: onlineSkin.sourceUrl,
        variant: onlineSkin.variant
      });
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      this.skinConfig = result;
      this.updateSkinUI();
      this.showNotification(result.message || `Skin ${onlineSkin.name} heruntergeladen.`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async chooseSkin() {
    this.showLoading('Importiere Skin...');

    try {
      const result = await window.electronAPI.chooseSkinFile();
      if (result?.canceled) {
        return;
      }

      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      this.skinConfig = result;
      this.updateSkinUI();
      this.showNotification(result.message || 'Skin gespeichert.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async activateSkin(skinId) {
    const skin = this.getSkinById(skinId);
    if (!skin) {
      return;
    }

    this.showLoading(`Aktiviere ${skin.name}...`);

    try {
      const result = await window.electronAPI.setActiveSkin(skinId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      this.skinConfig = result;
      this.updateSkinUI();
      this.showNotification(result.message || `Skin ${skin.name} aktiviert.`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async toggleSkinVariant(skinId) {
    const skin = this.getSkinById(skinId);
    if (!skin || skin.height !== 64) {
      return;
    }

    const nextVariant = skin.variant === 'slim' ? 'classic' : 'slim';
    this.showLoading(`Setze Modell für ${skin.name}...`);

    try {
      const result = await window.electronAPI.setSkinVariant(skinId, nextVariant);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      this.skinConfig = result;
      this.updateSkinUI();
      this.showNotification(result.message || `Modell für ${skin.name} aktualisiert.`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async removeSkin(skinId) {
    const skin = this.getSkinById(skinId);
    if (!skin) {
      return;
    }

    const confirmed = await this.showConfirm({
      title: 'Skin löschen',
      message: `Skin "${skin.name}" wirklich löschen?`,
      confirmText: 'Skin löschen'
    });
    if (!confirmed) {
      return;
    }

    this.showLoading(`Entferne ${skin.name}...`);

    try {
      const result = await window.electronAPI.removeSkinFile(skinId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      this.skinConfig = result;
      this.updateSkinUI();
      this.showNotification(result.message || `Skin ${skin.name} entfernt.`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async clearSkin() {
    if (!this.skinConfig?.activeSkin) {
      this.showNotification('Es ist kein Skin gespeichert.');
      return;
    }

    const confirmed = await this.showConfirm({
      title: 'Aktiven Skin entfernen',
      message: `Aktiven Skin "${this.skinConfig.activeSkin.name}" wirklich entfernen?`,
      confirmText: 'Skin entfernen'
    });
    if (!confirmed) {
      return;
    }

    this.showLoading('Entferne aktiven Skin...');

    try {
      const result = await window.electronAPI.clearSkinFile();
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      this.skinConfig = result;
      this.updateSkinUI();
      this.showNotification(result.message || 'Skin entfernt.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async loadAvailableVersions(showNotification = false) {
    try {
      const result = await window.electronAPI.getAvailableVersions();
      if (!result.success) {
        this.showNotification(`Versionen konnten nicht geladen werden: ${result.error}`);
        return;
      }

      this.availableVersions = result.versions || [];
      this.selectedVersionId = result.selectedVersionId || '';
      this.supportedMinecraftVersions = Array.isArray(result.supportedMinecraftVersions) && result.supportedMinecraftVersions.length
        ? result.supportedMinecraftVersions
        : this.supportedMinecraftVersions;
      this.renderVersionOptions();
      this.renderModrinthVersionFilter();
      this.updateVersionStatus();
      this.renderPacks();
      this.updatePackContextUI();
      this.updateModrinthSearchStatus();

      if (showNotification) {
        this.showNotification('Versionsliste aktualisiert.');
      }
    } catch (error) {
      console.error('Version load error:', error);
      this.showNotification('Fehler beim Laden der Versionen: ' + error.message);
    }
  }

  renderVersionOptions() {
    const selectEl = document.getElementById('version-select');
    if (!selectEl) {
      return;
    }

    selectEl.innerHTML = '';
    const versions = this.getContextAvailableVersions();

    if (versions.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = this.getActivePack()
        ? 'Keine Versionen gefunden'
        : `Keine unterstützte Version gefunden (${this.getSupportedMinecraftVersionsLabel()})`;
      selectEl.appendChild(option);
      return;
    }

    versions.forEach((version) => {
      const option = document.createElement('option');
      option.value = version.id;
      option.textContent = this.getVersionDisplayName(version);
      option.selected = version.id === this.selectedVersionId;
      selectEl.appendChild(option);
    });
  }

  renderModrinthVersionFilter() {
    const selectEl = document.getElementById('modrinth-version-filter');
    const searchRowEl = document.querySelector('.modrinth-search-row');
    if (!selectEl) {
      return;
    }

    const isModpackSearch = this.modrinthProjectType === 'modpack';
    selectEl.classList.toggle('is-hidden', !isModpackSearch);
    searchRowEl?.classList.toggle('has-version-filter', isModpackSearch);

    if (!isModpackSearch) {
      selectEl.disabled = true;
      return;
    }

    const versions = this.getProfileAvailableVersions();
    selectEl.innerHTML = '';
    const selectedVersionId = this.getActiveModrinthPackTargetVersionId();

    const anyVersionOption = document.createElement('option');
    anyVersionOption.value = '';
    anyVersionOption.textContent = 'Jede Version';
    anyVersionOption.selected = !selectedVersionId;
    selectEl.appendChild(anyVersionOption);

    if (!versions.length) {
      selectEl.disabled = false;
      this.modrinthVersionFilterId = '';
      return;
    }

    versions.forEach((version) => {
      const option = document.createElement('option');
      option.value = version.id;
      option.textContent = this.getVersionDisplayName(version);
      option.selected = version.id === selectedVersionId;
      selectEl.appendChild(option);
    });

    selectEl.disabled = false;
    this.modrinthVersionFilterId = selectedVersionId;
  }

  findSelectedVersion() {
    const contextVersionId = this.getActiveContextVersionId();
    return this.getContextAvailableVersions().find((version) => version.id === contextVersionId) || null;
  }

  extractMinecraftVersion(versionId) {
    const normalizedVersionId = String(versionId || '').trim();
    const match = normalizedVersionId.match(/^fabric-loader-[^-]+-(.+)$/u);
    return match ? match[1] : normalizedVersionId;
  }

  getVersionDisplayName(version) {
    if (!version) {
      return '';
    }

    if (typeof version === 'string') {
      return this.extractMinecraftVersion(version);
    }

    return version.name || version.minecraftVersion || this.extractMinecraftVersion(version.id);
  }

  findVersionById(versionId) {
    const normalizedVersionId = String(versionId || '').trim();
    return this.availableVersions.find((version) => version.id === normalizedVersionId) || null;
  }

  getVersionDisplayNameById(versionId) {
    const normalizedVersionId = String(versionId || '').trim();
    return this.getVersionDisplayName(this.findVersionById(normalizedVersionId) || normalizedVersionId);
  }

  getStandardVersionDisplayName() {
    const standardVersionId = this.packsConfig?.standardVersionId || (!this.getActivePack() ? this.selectedVersionId : '');
    return this.getVersionDisplayNameById(standardVersionId);
  }

  getSelectedVersionDisplayName() {
    const contextVersionId = this.getActiveContextVersionId();
    const selectedVersion = this.findSelectedVersion();
    return this.getVersionDisplayName(selectedVersion || contextVersionId || this.launcherStatus?.selectedVersionName || this.launcherStatus?.selectedMinecraftVersion);
  }

  updateVersionStatus() {
    const versionStatusEl = document.getElementById('version-status');
    if (!versionStatusEl) {
      return;
    }

    const selectedVersion = this.findSelectedVersion();
    if (!selectedVersion) {
      versionStatusEl.textContent = 'Keine Version ausgewählt';
      return;
    }

    const stateLabel = selectedVersion.installed ? 'bereits installiert' : 'wird beim Download geladen';
    versionStatusEl.textContent = `Fabric ${this.getVersionDisplayName(selectedVersion)} ist ${stateLabel}`;
  }

  async refreshVersions() {
    this.showLoading('Lade Fabric-Versionen...');
    try {
      await this.refreshPackContext({ reloadSearch: false });
      this.showNotification('Versionsliste aktualisiert.');
    } finally {
      this.hideLoading();
    }
  }

  async handleVersionChange() {
    const selectEl = document.getElementById('version-select');
    const versionId = selectEl?.value || '';
    if (!versionId) {
      return;
    }

    this.showLoading(`Speichere Fabric ${this.getVersionDisplayName(versionId)}...`);

    try {
      const result = await window.electronAPI.setSelectedVersion(versionId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      this.selectedVersionId = result.selectedVersionId;
      await this.refreshPackContext({ reloadMods: false, reloadSearch: false });
      this.loadMods().catch((error) => console.error('Background mod reload failed:', error));
      const warningText = result.warning ? ` Hinweis: ${result.warning}` : '';
      const syncText = result.syncPending ? ' Mods werden im Hintergrund geprüft.' : '';
      this.showNotification(`Fabric ${this.getVersionDisplayName(versionId)} ausgewählt.${syncText}${warningText}`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async downloadSelectedVersion() {
    const selectEl = document.getElementById('version-select');
    const versionId = selectEl?.value || this.selectedVersionId;
    if (!versionId) {
      this.showNotification('Bitte zuerst eine Version auswählen.');
      return;
    }

    this.showLoading(`Lade Fabric ${this.getVersionDisplayName(versionId)} herunter...`);

    try {
      const result = await window.electronAPI.downloadVersion(versionId);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      this.selectedVersionId = result.selectedVersionId;
      await this.refreshPackContext();
      const warningText = result.warning ? ` Hinweis: ${result.warning}` : '';
      this.showNotification(`${result.message}${warningText}`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  updateModrinthSearchStatus(customText = '') {
    const statusEl = document.getElementById('modrinth-search-status');
    if (!statusEl) {
      return;
    }

    if (customText) {
      statusEl.textContent = customText;
      return;
    }

    const versionLabel = this.getSelectedVersionDisplayName();
    const contextLabel = this.getCurrentContextLabel();
    const typeConfig = this.getModrinthTypeConfig();
    if (typeConfig.value === 'modpack') {
      const modpackVersionLabel = this.getModrinthVersionFilterDisplayName();
      statusEl.textContent = modpackVersionLabel
        ? `Suche Modpacks auf Modrinth für Minecraft ${modpackVersionLabel}.`
        : 'Suche Modpacks auf Modrinth für jede Version.';
      return;
    }

    statusEl.textContent = versionLabel
      ? `Suche ${typeConfig.pluralLabel.toLowerCase()} für ${contextLabel} auf Fabric ${versionLabel}.`
      : 'Wähle zuerst eine Fabric-Version aus.';
  }

  formatDownloads(downloads) {
    return new Intl.NumberFormat(this.language === 'de' ? 'de-DE' : 'en-US').format(Number(downloads || 0));
  }

  getModrinthTypeConfig(projectType = this.modrinthProjectType) {
    if (projectType === 'modpack') {
      return {
        value: 'modpack',
        pluralLabel: 'Modpacks',
        singularLabel: 'Modpack',
        placeholder: 'Auf Modrinth nach Modpacks suchen...',
        installLabel: 'In Profil installieren'
      };
    }

    if (projectType === 'shader') {
      return {
        value: 'shader',
        pluralLabel: 'Shader',
        singularLabel: 'Shader',
        placeholder: 'Auf Modrinth nach Shadern suchen...',
        installLabel: 'Herunterladen'
      };
    }

    if (projectType === 'resourcepack') {
      return {
        value: 'resourcepack',
        pluralLabel: 'Ressourcenpakete',
        singularLabel: 'Ressourcenpaket',
        placeholder: 'Auf Modrinth nach Ressourcenpaketen suchen...',
        installLabel: 'Herunterladen'
      };
    }

    return {
      value: 'mod',
      pluralLabel: 'Mods',
      singularLabel: 'Mod',
      placeholder: 'Auf Modrinth nach Fabric-Mods suchen...',
      installLabel: 'Installieren'
    };
  }

  updateModrinthTypeUI() {
    const typeConfig = this.getModrinthTypeConfig();
    const inputEl = document.getElementById('modrinth-search-input');
    const tabButtons = document.querySelectorAll('[data-modrinth-type]');

    tabButtons.forEach((button) => {
      const isActive = button.getAttribute('data-modrinth-type') === typeConfig.value;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (inputEl) {
      inputEl.placeholder = typeConfig.placeholder;
    }

    this.renderModrinthVersionFilter();
  }

  handleModrinthTypeChange(event) {
    const button = event.target?.closest('[data-modrinth-type]');
    if (!button) {
      return;
    }

    this.modrinthProjectType = button.getAttribute('data-modrinth-type') || 'mod';
    this.resetModrinthSearchInput();
    this.updateModrinthTypeUI();
    this.updatePackContextUI();
    this.searchModrinthMods({ showLoading: false, forceRefresh: true });
  }

  resetModrinthSearchInput() {
    if (this.modrinthSearchDebounceTimer) {
      window.clearTimeout(this.modrinthSearchDebounceTimer);
      this.modrinthSearchDebounceTimer = null;
    }

    const inputEl = document.getElementById('modrinth-search-input');
    if (inputEl) {
      inputEl.value = '';
    }
    this.modrinthQuery = '';
  }

  handleModrinthVersionFilterChange() {
    const selectEl = document.getElementById('modrinth-version-filter');
    this.modrinthVersionFilterId = String(selectEl?.value || '').trim();

    if (this.modrinthProjectType === 'modpack') {
      this.searchModrinthMods({ showLoading: false });
    }
  }

  scheduleModrinthInstantSearch() {
    if (this.modrinthSearchDebounceTimer) {
      window.clearTimeout(this.modrinthSearchDebounceTimer);
    }

    const inputEl = document.getElementById('modrinth-search-input');
    this.modrinthQuery = inputEl?.value.trim() || '';
    if (this.modrinthQuery && this.modrinthQuery.length < 2) {
      this.applyModrinthLocalSearch();
      const typeConfig = this.getModrinthTypeConfig();
      this.updateModrinthSearchStatus(`Tippe noch ein Zeichen, um ${typeConfig.pluralLabel.toLowerCase()} auf Modrinth zu suchen.`);
      return;
    }

    const cachedTarget = this.modrinthProjectType === 'modpack'
      ? this.getActiveModrinthPackSearchTarget()
      : this.getActiveModrinthTarget();
    const cachedResult = this.getCachedModrinthSearch(this.modrinthQuery, 0, cachedTarget);
    if (cachedResult) {
      this.applyModrinthSearchResult(cachedResult, { append: false, fromCache: true });
      this.modrinthSearchDebounceTimer = window.setTimeout(() => {
        this.modrinthSearchDebounceTimer = null;
        this.searchModrinthMods({ showLoading: false });
      }, 1000);
      return;
    }

    this.modrinthSearchDebounceTimer = window.setTimeout(() => {
      this.modrinthSearchDebounceTimer = null;
      this.searchModrinthMods({ showLoading: false });
    }, 1000);
  }

  hideModrinthSuggestions() {
    const container = document.getElementById('modrinth-suggestions');
    if (!container) return;
    container.classList.add('hidden');
    container.innerHTML = '';
  }

  updateModrinthSuggestions() {
    // Autocomplete intentionally disabled. Search matches are rendered only in
    // the virtualized result list after the debounce interval.
    this.hideModrinthSuggestions();
  }

  submitModrinthSearch() {
    if (this.modrinthSearchDebounceTimer) {
      window.clearTimeout(this.modrinthSearchDebounceTimer);
      this.modrinthSearchDebounceTimer = null;
    }

    const inputEl = document.getElementById('modrinth-search-input');
    const query = inputEl?.value.trim() || '';
    if (query && query.length < 2) {
      this.modrinthQuery = query;
      this.applyModrinthLocalSearch({ forceRender: true });
      const typeConfig = this.getModrinthTypeConfig();
      this.updateModrinthSearchStatus('Bitte gib mindestens 2 Zeichen ein.');
      return null;
    }

    return this.searchModrinthMods({
      forceRefresh: true,
      showLoading: false
    });
  }

  normalizeModrinthSearchText(value) {
    return String(value || '').trim().toLowerCase();
  }

  buildModrinthSearchIndex() {
    this.modrinthSearchIndex = this.modrinthLoadedResults.map((project, index) => {
      const title = this.normalizeModrinthSearchText(project.title);
      const slug = this.normalizeModrinthSearchText(project.slug);
      const author = this.normalizeModrinthSearchText(project.author);
      const categories = Array.isArray(project.categories)
        ? project.categories.map((category) => this.normalizeModrinthSearchText(category)).join(' ')
        : '';
      const description = this.normalizeModrinthSearchText(project.description);

      return {
        index,
        title,
        searchable: `${title} ${slug} ${author} ${categories} ${description}`
      };
    });
  }

  applyModrinthLocalSearch(options = {}) {
    const inputEl = document.getElementById('modrinth-search-input');
    const query = inputEl?.value.trim() || '';
    const normalizedQuery = this.normalizeModrinthSearchText(query);
    this.modrinthQuery = query;

    if (!normalizedQuery) {
      this.modrinthResults = this.modrinthLoadedResults;
    } else {
      const startsWithMatches = [];
      const containsMatches = [];
      this.modrinthSearchIndex.forEach((entry) => {
        if (!entry.searchable.includes(normalizedQuery)) {
          return;
        }

        if (entry.title.startsWith(normalizedQuery)) {
          startsWithMatches.push(this.modrinthLoadedResults[entry.index]);
          return;
        }

        containsMatches.push(this.modrinthLoadedResults[entry.index]);
      });
      this.modrinthResults = [...startsWithMatches, ...containsMatches];
    }

    this.updateModrinthLocalSearchStatus();
    this.renderModrinthResults({ force: Boolean(options.forceRender) });
  }

  updateModrinthLocalSearchStatus() {
    const typeConfig = this.getModrinthTypeConfig();
    const loadedCount = this.modrinthLoadedResults.length;
    const visibleCount = this.modrinthResults.length;
    if (this.modrinthQuery) {
      this.updateModrinthSearchStatus(`${visibleCount} von ${loadedCount} geladenen ${typeConfig.pluralLabel.toLowerCase()} gefunden.`);
      return;
    }

    this.updateModrinthSearchStatus(`${loadedCount} geladene ${typeConfig.pluralLabel.toLowerCase()} angezeigt.`);
  }

  handleModrinthResultsClick(event) {
    const button = event.target.closest('[data-modrinth-action]');
    if (!button) {
      return;
    }

    const action = button.getAttribute('data-modrinth-action') || '';
    if (action === 'load-more') {
      this.loadMoreModrinthResults();
      return;
    }

    const projectId = button.getAttribute('data-project-id') || '';
    if (!projectId) {
      return;
    }

    if (action === 'install') {
      const project = this.modrinthResults.find((entry) => entry.projectId === projectId);
      const typeConfig = this.getModrinthTypeConfig(project?.projectType || this.modrinthProjectType);
      if (this.isModrinthProjectWrongVersion(project)) {
        this.showNotification('Diese Mod ist nicht für die ausgewählte Minecraft-Version verfügbar.');
        return;
      }
      if (typeConfig.value === 'modpack') {
        const card = this.getModrinthProjectCard(projectId);
        const targetPanel = card?.querySelector('[data-modrinth-pack-target-panel]');
        if (targetPanel?.classList.contains('is-hidden')) {
          this.showModrinthPackTarget(card);
          return;
        }
      }

      this.installModrinthMod(projectId);
      return;
    }

    if (action === 'install-hosted-server') {
      this.showNotification('Vanilla-Server unterstützt keine Mods.');
    }
  }

  handleModrinthResultsChange(event) {
    const selectEl = event.target?.closest?.('[data-modrinth-pack-target]');
    if (!selectEl) {
      return;
    }

    const card = selectEl.closest('[data-modrinth-project-card]');
    this.updateModrinthPackTargetFields(card);
  }

  handleModsListClick(event) {
    const button = event.target.closest('[data-mod-action]');
    if (!button) {
      return;
    }

    const action = button.getAttribute('data-mod-action') || '';
    if (action === 'menu') {
      event.stopPropagation();
      const menuWrap = button.closest('.installed-mod-menu-wrap');
      const menu = menuWrap?.querySelector('.installed-mod-menu');
      const willOpen = Boolean(menu?.classList.contains('hidden'));
      this.closeInstalledModMenus();
      menu?.classList.toggle('hidden', !willOpen);
      menuWrap?.closest('.mod-item')?.classList.toggle('is-menu-open', willOpen);
      button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      return;
    }

    const modId = button.getAttribute('data-mod-id') || '';
    const modName = button.getAttribute('data-mod-name') || '';
    if (!modId || !action) {
      return;
    }

    if (action === 'remove') {
      this.closeInstalledModMenus();
      this.removeMod(modId, modName);
      return;
    }

    if (action === 'enable') {
      this.setModEnabled(modId, true, modName);
      return;
    }

    if (action === 'disable') {
      this.setModEnabled(modId, false, modName);
    }
  }

  closeInstalledModMenus() {
    document.querySelectorAll('.installed-mod-menu').forEach((menu) => menu.classList.add('hidden'));
    document.querySelectorAll('.installed-mod-card.is-menu-open').forEach((card) => card.classList.remove('is-menu-open'));
    document.querySelectorAll('[data-mod-action="menu"][aria-expanded="true"]')
      .forEach((button) => button.setAttribute('aria-expanded', 'false'));
  }

  handleModsViewChange(event) {
    const button = event.target?.closest?.('[data-mods-view]');
    if (!button) {
      return;
    }

    const nextView = String(button.getAttribute('data-mods-view') || 'mod').trim();
    if (!['mod', 'resourcepack', 'shader', 'hidden'].includes(nextView)) {
      return;
    }

    this.modsViewType = nextView;
    this.renderMods();
    this.updateModsCheckStatus();
  }

  handleGlobalActionClick(event) {
    const urlButton = event.target?.closest?.('[data-open-url]');
    if (urlButton) {
      event.preventDefault();
      this.openExternalUrl(urlButton.getAttribute('data-open-url') || '');
      return;
    }

    const incompatibleButton = event.target?.closest?.('[data-launcher-action="remove-incompatible-mods"], #remove-incompatible-mods-btn');
    if (incompatibleButton) {
      event.preventDefault();
      this.removeIncompatibleMods(incompatibleButton);
      return;
    }

    const button = event.target?.closest?.('[data-launcher-action="update-all-mods"], #update-all-btn, #update-mods-btn');
    if (!button) {
      return;
    }
    event.preventDefault();
    this.updateAllMods(button);
  }

  async openExternalUrl(url) {
    if (!url || typeof window.electronAPI?.openExternalUrl !== 'function') {
      this.showNotification('Link konnte nicht geöffnet werden.');
      return;
    }
    try {
      const result = await window.electronAPI.openExternalUrl(url);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
      }
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async searchModrinthMods(options = {}) {
    const inputEl = document.getElementById('modrinth-search-input');
    const hasExplicitNetworkQuery = Object.prototype.hasOwnProperty.call(options, 'networkQuery');
    const query = String(hasExplicitNetworkQuery ? options.networkQuery : (inputEl?.value || '')).trim();
    this.modrinthQuery = query;
    const append = Boolean(options.append);
    const offset = append ? this.modrinthNextOffset : 0;
    const showLoading = options.showLoading !== false && !append;
    const typeConfig = this.getModrinthTypeConfig();

    const target = typeConfig.value === 'modpack'
      ? this.getActiveModrinthPackSearchTarget()
      : this.getActiveModrinthTarget();
    if (typeConfig.value === 'modpack') {
      this.modrinthVersionFilterId = target.versionId;
    }

    const cached = this.getCachedModrinthSearch(query, offset, target);
    const refreshingCachedFirstPage = Boolean(cached && !append && (!options.forceRefresh || options.backgroundRefresh));
    if (cached && !append && !options.forceRefresh) {
      this.applyModrinthSearchResult(cached, {
        append: false,
        fromCache: true
      });
    }

    if (append) {
      if (this.modrinthIsLoadingMore || !this.modrinthHasMore) {
        return;
      }
      this.modrinthIsLoadingMore = true;
      this.renderModrinthResults();
    } else if (!refreshingCachedFirstPage) {
      this.modrinthHasMore = false;
      this.modrinthTotalHits = 0;
      this.modrinthLoadedResults = [];
      this.modrinthLoadedStartOffset = 0;
      this.modrinthNextOffset = 0;
      this.modrinthResults = [];
      this.modrinthSearchIndex = [];
      this.modrinthLastRenderedSignature = '';
      this.modrinthDataRevision += 1;
      const scrollHost = document.getElementById('modrinth');
      if (scrollHost) {
        scrollHost.scrollTop = 0;
      }
    }

    if (showLoading) {
      this.showLoading(query ? `Suche ${typeConfig.pluralLabel.toLowerCase()} auf Modrinth...` : `Lade Top ${typeConfig.pluralLabel.toLowerCase()} von Modrinth...`);
    } else if (!append && !cached) {
      this.modrinthSearchInFlight = true;
      this.updateModrinthSearchStatus(query
        ? `Suche ${typeConfig.pluralLabel.toLowerCase()} nach "${query}"...`
        : `Lade Top ${typeConfig.pluralLabel.toLowerCase()}...`);
    }

    const requestId = ++this.modrinthSearchRequestId;
    try {
      const result = await window.electronAPI.searchModrinthMods(
        query,
        target.versionId,
        this.modrinthProjectType,
        offset,
        this.modrinthPageSize,
        Boolean(options.forceRefresh)
      );
      if (requestId !== this.modrinthSearchRequestId) {
        return;
      }

      if (!result.success) {
        if (!refreshingCachedFirstPage) {
          this.showNotification('Fehler: ' + result.error);
        }
        return;
      }

      this.cacheModrinthSearch(query, offset, target, result);
      this.applyModrinthSearchResult(result, { append });
      this.scheduleModrinthPrefetch();
      if (result.diskCache && !options.forceRefresh && !append) {
        window.setTimeout(() => {
          if (requestId === this.modrinthSearchRequestId) {
            this.searchModrinthMods({
              showLoading: false,
              forceRefresh: true,
              backgroundRefresh: true
            }).catch(() => {});
          }
        }, 0);
      }
    } catch (error) {
      if (requestId === this.modrinthSearchRequestId && !refreshingCachedFirstPage) {
        this.showNotification('Fehler: ' + error.message);
      }
    } finally {
      if (!append && requestId === this.modrinthSearchRequestId) {
        this.modrinthSearchInFlight = false;
      }
      if (append) {
        this.modrinthIsLoadingMore = false;
        this.renderModrinthResults();
      }
      if (showLoading && requestId === this.modrinthSearchRequestId) {
        this.hideLoading();
      }
    }
  }

  loadMoreModrinthResults() {
    return this.searchModrinthMods({ append: true, showLoading: false });
  }

  async loadPreviousModrinthResults() {
    if (this.modrinthIsLoadingPrevious || this.modrinthLoadedStartOffset <= 0) {
      return;
    }
    const inputEl = document.getElementById('modrinth-search-input');
    const query = String(inputEl?.value || this.modrinthQuery || '').trim();
    const target = this.modrinthProjectType === 'modpack'
      ? this.getActiveModrinthPackSearchTarget()
      : this.getActiveModrinthTarget();
    const currentStartOffset = this.modrinthLoadedStartOffset;
    const offset = Math.max(0, currentStartOffset - this.modrinthPageSize);
    const limit = Math.max(1, currentStartOffset - offset);
    const requestContext = this.getModrinthSearchCacheKey(query, 0, target);
    this.modrinthIsLoadingPrevious = true;
    try {
      let result = this.getCachedModrinthSearch(query, offset, target);
      if (!result) {
        result = await window.electronAPI.searchModrinthMods(
          query,
          target.versionId,
          this.modrinthProjectType,
          offset,
          limit,
          false
        );
        if (result?.success) {
          this.cacheModrinthSearch(query, offset, target, result);
        }
      }
      const activeContext = this.getModrinthSearchCacheKey(this.modrinthQuery, 0, target);
      if (!result?.success
        || requestContext !== activeContext
        || currentStartOffset !== this.modrinthLoadedStartOffset) {
        return;
      }
      this.applyModrinthSearchResult(result, { prepend: true });
    } catch (error) {
      console.error('Background Modrinth previous-page load failed:', error);
    } finally {
      this.modrinthIsLoadingPrevious = false;
    }
  }

  scheduleModrinthPrefetch() {
    if (this.modrinthPrefetchTimer) {
      window.clearTimeout(this.modrinthPrefetchTimer);
    }
    this.modrinthPrefetchTimer = window.setTimeout(() => {
      this.modrinthPrefetchTimer = null;
      this.ensureModrinthPrefetch();
    }, 40);
  }

  ensureModrinthPrefetch() {
    if (!this.modrinthResults.length) {
      return;
    }
    const scrollHost = document.getElementById('modrinth');
    const container = document.getElementById('modrinth-results');
    if (!scrollHost || !container || !document.getElementById('modrinth')?.classList.contains('active')) {
      return;
    }
    const rowHeight = this.modrinthProjectType === 'modpack'
      ? (container.clientWidth >= 700 ? 250 : 390)
      : (container.clientWidth >= 700 ? 108 : 168);
    const columnCount = 1;
    const listTop = container.getBoundingClientRect().top;
    const viewportTop = scrollHost.getBoundingClientRect().top;
    const firstVisibleRow = Math.max(0, Math.floor(Math.max(0, viewportTop - listTop) / rowHeight));
    const firstVisibleIndex = firstVisibleRow * columnCount;
    const visibleCount = Math.max(1, Math.ceil(scrollHost.clientHeight / rowHeight) * columnCount);
    const preparedAhead = this.modrinthResults.length - firstVisibleIndex - visibleCount;
    if (firstVisibleIndex <= 15 && this.modrinthLoadedStartOffset > 0 && !this.modrinthIsLoadingPrevious) {
      this.loadPreviousModrinthResults();
    }
    // Network pagination is deliberately user-driven through "Mehr anzeigen".
    // Automatic fetching here caused request/render storms when opening the tab.
    void preparedAhead;
  }

  getModrinthSearchCacheKey(query, offset = 0, target = null) {
    const activeTarget = target || (
      this.modrinthProjectType === 'modpack'
        ? this.getActiveModrinthPackSearchTarget()
        : this.getActiveModrinthTarget()
    );
    return [
      this.modrinthProjectType,
      String(activeTarget?.versionId || ''),
      String(query || '').trim().toLowerCase(),
      Number(offset) || 0,
      this.modrinthPageSize
    ].join('|');
  }

  getCachedModrinthSearch(query, offset = 0, target = null) {
    const key = this.getModrinthSearchCacheKey(query, offset, target);
    const cached = this.modrinthSearchCache.get(key);
    if (cached && Date.now() - Number(cached.createdAt || 0) <= this.modrinthSearchCacheTtlMs) {
      this.modrinthSearchCache.delete(key);
      this.modrinthSearchCache.set(key, cached);
      return cached.result;
    }
    if (cached) {
      this.modrinthSearchCache.delete(key);
    }
    if (Number(offset) !== 0) return null;
    try {
      const persistentCache = JSON.parse(localStorage.getItem(this.modrinthPersistentCacheStorageKey) || '{}');
      const persistentEntry = persistentCache[key];
      if (!persistentEntry
        || Date.now() - Number(persistentEntry.createdAt || 0) > this.modrinthPersistentCacheTtlMs
        || !persistentEntry.result?.success) {
        return null;
      }
      this.modrinthSearchCache.set(key, persistentEntry);
      return persistentEntry.result;
    } catch (_error) {
      return null;
    }
  }

  cacheModrinthSearch(query, offset = 0, target = null, result = null) {
    if (!result?.success) {
      return;
    }

    const key = this.getModrinthSearchCacheKey(query, offset, target);
    this.modrinthSearchCache.delete(key);
    const entry = { createdAt: Date.now(), result };
    this.modrinthSearchCache.set(key, entry);
    if (this.modrinthSearchCache.size > 80) {
      const oldestKey = this.modrinthSearchCache.keys().next().value;
      this.modrinthSearchCache.delete(oldestKey);
    }
    if (Number(offset) === 0) {
      try {
        const persistentCache = JSON.parse(localStorage.getItem(this.modrinthPersistentCacheStorageKey) || '{}');
        persistentCache[key] = entry;
        const newestEntries = Object.entries(persistentCache)
          .sort((left, right) => Number(right[1]?.createdAt || 0) - Number(left[1]?.createdAt || 0))
          .slice(0, 16);
        localStorage.setItem(this.modrinthPersistentCacheStorageKey, JSON.stringify(Object.fromEntries(newestEntries)));
      } catch (_error) {
        // In-memory caching remains available when persistent storage is full.
      }
    }
  }

  applyModrinthSearchResult(result, options = {}) {
    const append = Boolean(options.append);
    const prepend = Boolean(options.prepend);
    const nextResults = result.results || [];
    if (Array.isArray(result.installedProjectIds)) {
      this.setInstalledModProjectIds([...this.getVisibleInstalledModProjectIds(), ...result.installedProjectIds]);
    }
    if (prepend) {
      const seenProjectIds = new Set(this.modrinthLoadedResults.map((entry) => entry.projectId).filter(Boolean));
      const uniquePreviousResults = nextResults.filter((entry) => !entry.projectId || !seenProjectIds.has(entry.projectId));
      const addedCount = uniquePreviousResults.length;
      this.modrinthLoadedResults = [
        ...uniquePreviousResults,
        ...this.modrinthLoadedResults
      ];
      this.modrinthLoadedStartOffset = Number(result.offset || 0);
      const overflow = Math.max(0, this.modrinthLoadedResults.length - this.modrinthMaxLoadedResults);
      if (overflow > 0) {
        this.modrinthLoadedResults = this.modrinthLoadedResults.slice(0, this.modrinthMaxLoadedResults);
      }
      this.adjustModrinthScrollAfterHeadPrepend(addedCount);
    } else if (append) {
      const seenProjectIds = new Set(this.modrinthLoadedResults.map((entry) => entry.projectId).filter(Boolean));
      const uniqueNextResults = nextResults.filter((entry) => {
        if (!entry.projectId || seenProjectIds.has(entry.projectId)) {
          return false;
        }
        seenProjectIds.add(entry.projectId);
        return true;
      });
      this.modrinthLoadedResults = [
        ...this.modrinthLoadedResults,
        ...uniqueNextResults
      ];
      this.modrinthNextOffset = Math.max(
        this.modrinthNextOffset,
        Number(result.offset || 0) + nextResults.length
      );
      const overflow = Math.max(0, this.modrinthLoadedResults.length - this.modrinthMaxLoadedResults);
      if (overflow > 0) {
        this.modrinthLoadedResults = this.modrinthLoadedResults.slice(overflow);
        this.modrinthLoadedStartOffset += overflow;
        this.adjustModrinthScrollAfterHeadTrim(overflow);
      }
    } else {
      this.modrinthLoadedResults = nextResults;
      this.modrinthLoadedStartOffset = Number(result.offset || 0);
      this.modrinthNextOffset = Number(result.offset || 0) + nextResults.length;
    }
    this.modrinthHasMore = Boolean(result.hasMore);
    this.modrinthTotalHits = Number(result.totalHits || this.modrinthLoadedResults.length);
    this.modrinthDataRevision += 1;
    this.buildModrinthSearchIndex();
    this.applyModrinthLocalSearch({ forceRender: true });
  }

  adjustModrinthScrollAfterHeadPrepend(addedCount) {
    const scrollHost = document.getElementById('modrinth');
    const container = document.getElementById('modrinth-results');
    if (!scrollHost || !container || addedCount <= 0) {
      return;
    }
    const columnCount = 1;
    const rowHeight = this.modrinthProjectType === 'modpack'
      ? (container.clientWidth >= 700 ? 250 : 390)
      : (container.clientWidth >= 700 ? 108 : 168);
    const addedRows = Math.ceil(addedCount / columnCount);
    scrollHost.scrollTop += addedRows * rowHeight;
    this.modrinthLastScrollTop = scrollHost.scrollTop;
    this.modrinthVirtualRangeKey = '';
    this.modrinthLastRenderedSignature = '';
  }

  adjustModrinthScrollAfterHeadTrim(removedCount) {
    const scrollHost = document.getElementById('modrinth');
    const container = document.getElementById('modrinth-results');
    if (!scrollHost || !container || removedCount <= 0) {
      return;
    }
    const columnCount = 1;
    const rowHeight = this.modrinthProjectType === 'modpack'
      ? (container.clientWidth >= 700 ? 250 : 390)
      : (container.clientWidth >= 700 ? 108 : 168);
    const removedRows = Math.ceil(removedCount / columnCount);
    scrollHost.scrollTop = Math.max(0, scrollHost.scrollTop - (removedRows * rowHeight));
    this.modrinthLastScrollTop = scrollHost.scrollTop;
    this.modrinthVirtualRangeKey = '';
    this.modrinthLastRenderedSignature = '';
  }

  updateModrinthResultStatus(result) {
    const contextLabel = this.getCurrentContextLabel();
    const versionLabel = result.minecraftVersion || this.getSelectedVersionDisplayName() || 'deine Version';
    const resultTypeConfig = this.getModrinthTypeConfig(result.projectType || this.modrinthProjectType);
    if (resultTypeConfig.value === 'modpack') {
      const modpackVersionLabel = result.minecraftVersion || this.getModrinthVersionFilterDisplayName();
      this.updateModrinthSearchStatus(
        result.mode === 'top-downloads'
          ? (
            this.modrinthResults.length
              ? (modpackVersionLabel ? `Top Modpacks auf Modrinth für Minecraft ${modpackVersionLabel}.` : 'Top Modpacks auf Modrinth.')
              : (modpackVersionLabel ? `Keine beliebten Modpacks für Minecraft ${modpackVersionLabel} gefunden.` : 'Keine beliebten Modpacks gefunden.')
          )
          : (
            this.modrinthResults.length
              ? (modpackVersionLabel ? `${this.modrinthResults.length} Treffer für Modpacks auf Modrinth für Minecraft ${modpackVersionLabel}.` : `${this.modrinthResults.length} Treffer für Modpacks auf Modrinth.`)
              : (modpackVersionLabel ? `Keine Modpack-Treffer auf Modrinth für Minecraft ${modpackVersionLabel}.` : 'Keine Modpack-Treffer auf Modrinth.')
          )
      );
      return;
    }

    this.updateModrinthSearchStatus(
      result.mode === 'top-downloads'
        ? (
          this.modrinthResults.length
            ? `Top ${resultTypeConfig.pluralLabel.toLowerCase()} für ${contextLabel} auf Fabric ${versionLabel}.`
            : `Keine beliebten ${resultTypeConfig.pluralLabel.toLowerCase()} für ${contextLabel} auf Fabric ${versionLabel} gefunden.`
        )
        : (
          this.modrinthResults.length
            ? `${this.modrinthResults.length} Treffer für ${resultTypeConfig.pluralLabel.toLowerCase()} in ${contextLabel} auf Fabric ${versionLabel}.`
            : `Keine Modrinth-Treffer für ${resultTypeConfig.pluralLabel.toLowerCase()} in ${contextLabel} auf Fabric ${versionLabel}.`
        )
    );
  }

  renderModrinthPackTargetControls(project) {
    const minecraftVersion = this.getModrinthProjectMinecraftVersion(project);
    const packs = this.getCompatibleModrinthPackTargets(project);
    const packOptions = packs.map((pack) => {
      const versionName = this.getVersionDisplayName(pack.versionId);
      const label = versionName ? `${pack.name} (${versionName})` : pack.name;
      return `<option value="${this.escapeHtml(pack.id)}">${this.escapeHtml(label)}</option>`;
    }).join('');
    const noMatchingPacksOption = packs.length
      ? ''
      : `<option value="__no-matching-profile" disabled>Keine passenden Profile${minecraftVersion ? ` (${this.escapeHtml(minecraftVersion)})` : ''}</option>`;
    const suggestedName = this.escapeHtml(project.title || project.slug || 'Modpack');
    const newProfileLabel = minecraftVersion ? `Neues Profil (${minecraftVersion})` : 'Neues Profil';

    return `
      <div class="modrinth-pack-target is-hidden" data-modrinth-pack-target-panel>
        <label class="modrinth-pack-field">
          <span>Zielprofil</span>
          <select class="input-field modrinth-pack-profile-select" data-modrinth-pack-target>
            <option value="">${this.escapeHtml(newProfileLabel)}</option>
            ${packOptions}
            ${noMatchingPacksOption}
          </select>
        </label>
        <label class="modrinth-pack-field modrinth-pack-name-field">
          <span>Neuer Profilname</span>
          <input class="input-field" type="text" maxlength="48" spellcheck="false" value="${suggestedName}" data-modrinth-pack-name>
        </label>
      </div>
    `;
  }

  getModrinthProjectMinecraftVersion(project) {
    return String(project?.targetMinecraftVersion || this.getVersionDisplayName(project?.targetVersionId) || this.getModrinthVersionFilterDisplayName() || '').trim();
  }

  getModrinthProjectSupportedMinecraftVersions(project) {
    return [...new Set((Array.isArray(project?.versions) ? project.versions : [])
      .map((version) => String(version || '').trim())
      .filter(Boolean))];
  }

  isModrinthProjectWrongVersion(project) {
    const typeConfig = this.getModrinthTypeConfig(project?.projectType || this.modrinthProjectType);
    if (typeConfig.value === 'modpack' || typeConfig.value === 'resourcepack') {
      return false;
    }

    const targetMinecraftVersion = this.getModrinthProjectMinecraftVersion(project);
    const supportedVersions = this.getModrinthProjectSupportedMinecraftVersions(project);
    return Boolean(targetMinecraftVersion && supportedVersions.length && !supportedVersions.includes(targetMinecraftVersion));
  }

  getCompatibleModrinthPackTargets(project) {
    const minecraftVersion = this.getModrinthProjectMinecraftVersion(project);
    const packs = this.packsConfig?.packs || [];
    if (!minecraftVersion) {
      const supportedVersions = this.getModrinthProjectSupportedMinecraftVersions(project);
      if (!supportedVersions.length) {
        return [];
      }

      return packs.filter((pack) => supportedVersions.includes(this.getVersionDisplayName(pack.versionId)));
    }

    return packs.filter((pack) => this.getVersionDisplayName(pack.versionId) === minecraftVersion);
  }

  showModrinthPackTarget(card) {
    if (!card) {
      return;
    }

    this.closeOtherModrinthPackTargets(card);

    const panel = card.querySelector('[data-modrinth-pack-target-panel]');
    const button = card.querySelector('[data-modrinth-action="install"]');
    card.classList.add('is-pack-target-open');
    if (panel) {
      panel.classList.remove('is-hidden');
    }
    if (button) {
      button.textContent = 'Jetzt installieren';
    }

    this.updateModrinthPackTargetFields(card);
    const nameInput = card.querySelector('[data-modrinth-pack-name]');
    const targetSelect = card.querySelector('[data-modrinth-pack-target]');
    (targetSelect || (nameInput && !nameInput.disabled ? nameInput : null))?.focus?.();
  }

  closeOtherModrinthPackTargets(activeCard = null) {
    document.querySelectorAll('[data-modrinth-project-card]').forEach((card) => {
      if (activeCard && card === activeCard) {
        return;
      }

      const panel = card.querySelector('[data-modrinth-pack-target-panel]');
      if (!panel) {
        return;
      }

      panel.classList.add('is-hidden');
      card.classList.remove('is-pack-target-open');

      const projectId = card.getAttribute('data-project-id') || '';
      const project = this.modrinthResults.find((entry) => entry.projectId === projectId);
      const typeConfig = this.getModrinthTypeConfig(project?.projectType || this.modrinthProjectType);
      const button = card.querySelector('[data-modrinth-action="install"]');
      if (button && typeConfig.value === 'modpack') {
        button.textContent = typeConfig.installLabel;
      }
    });
  }

  updateModrinthPackTargetFields(card) {
    if (!card) {
      return;
    }

    const selectEl = card.querySelector('[data-modrinth-pack-target]');
    const nameInput = card.querySelector('[data-modrinth-pack-name]');
    const nameField = card.querySelector('.modrinth-pack-name-field');
    const isNewProfile = !selectEl?.value;

    if (nameInput) {
      nameInput.disabled = !isNewProfile;
    }
    if (nameField) {
      nameField.classList.toggle('is-disabled', !isNewProfile);
    }
  }

  getModrinthProjectCard(projectId) {
    return Array.from(document.querySelectorAll('[data-modrinth-project-card]'))
      .find((card) => card.getAttribute('data-project-id') === projectId) || null;
  }

  getModrinthModpackInstallTarget(project) {
    const card = this.getModrinthProjectCard(project.projectId);
    const selectedPackId = card?.querySelector('[data-modrinth-pack-target]')?.value || '';
    const filteredVersionId = String(project.targetVersionId || this.getModrinthVersionFilterId() || '').trim();
    const filteredMinecraftVersion = this.getModrinthProjectMinecraftVersion(project);

    if (selectedPackId) {
      const selectedPack = (this.packsConfig?.packs || []).find((pack) => pack.id === selectedPackId);
      if (!selectedPack) {
        throw new Error('Das ausgewählte Profil wurde nicht gefunden.');
      }
      const selectedPackMinecraftVersion = this.getVersionDisplayName(selectedPack.versionId);
      const supportedVersions = this.getModrinthProjectSupportedMinecraftVersions(project);
      const profileMatchesFilter = filteredMinecraftVersion
        ? selectedPackMinecraftVersion === filteredMinecraftVersion
        : supportedVersions.includes(selectedPackMinecraftVersion);
      if (!profileMatchesFilter) {
        const expectedText = filteredMinecraftVersion || (supportedVersions.length ? supportedVersions.join(', ') : 'eine passende Version');
        throw new Error(`Das ausgewählte Profil nutzt Minecraft ${selectedPackMinecraftVersion || 'eine andere Version'}, das Modpack ist für Minecraft ${expectedText}.`);
      }

      return {
        installMode: 'existing-profile',
        packId: selectedPackId,
        versionId: selectedPack.versionId,
        minecraftVersion: selectedPackMinecraftVersion
      };
    }

    return {
      installMode: 'new-profile',
      packName: card?.querySelector('[data-modrinth-pack-name]')?.value.trim() || project.title || project.slug || 'Modpack',
      versionId: filteredVersionId,
      minecraftVersion: filteredMinecraftVersion
    };
  }

  renderModrinthResults(options = {}) {
    const container = document.getElementById('modrinth-results');
    if (!container) {
      return;
    }

    const scrollHost = document.getElementById('modrinth');
    const gap = 12;
    const gridWidth = Math.max(280, container.clientWidth || scrollHost?.clientWidth || 900);
    const columnCount = 1;
    const compactLayout = gridWidth >= 700;
    const rowHeight = this.modrinthProjectType === 'modpack'
      ? (compactLayout ? 250 : 390)
      : (compactLayout ? 108 : 168);
    const totalRows = Math.ceil(this.modrinthResults.length / columnCount);
    const containerTop = container.getBoundingClientRect().top;
    const viewportTop = scrollHost?.getBoundingClientRect().top || 0;
    const offsetIntoList = Math.max(0, viewportTop - containerTop);
    const visibleRows = Math.max(1, Math.ceil(Number(scrollHost?.clientHeight || 800) / rowHeight));
    const firstVisibleRow = Math.floor(offsetIntoList / rowHeight);
    const firstRow = Math.max(0, firstVisibleRow - this.modrinthVirtualOverscanBefore);
    const lastRow = Math.min(totalRows, firstVisibleRow + visibleRows + this.modrinthVirtualOverscanAfter);
    const startIndex = firstRow * columnCount;
    const endIndex = Math.min(this.modrinthResults.length, lastRow * columnCount);
    const rangeKey = `${columnCount}:${rowHeight}:${firstRow}:${lastRow}:${this.modrinthResults.length}:${this.modrinthHasMore ? 1 : 0}:${this.modrinthIsLoadingMore ? 1 : 0}`;
    const renderSignature = [
      this.modrinthQuery,
      this.modrinthDataRevision,
      this.modrinthHasMore ? 'more' : 'done',
      this.modrinthIsLoadingMore ? 'loading-more' : 'idle',
      this.modrinthSearchInFlight ? 'searching' : 'ready'
    ].join('|');
    if (!options.force
      && renderSignature === this.modrinthLastRenderedSignature
      && rangeKey === this.modrinthVirtualRangeKey) {
      return;
    }
    this.modrinthLastRenderedSignature = renderSignature;
    this.modrinthVirtualRangeKey = rangeKey;

    const reusableCards = new Map(Array.from(container.querySelectorAll('[data-modrinth-project-card]'))
      .map((card) => [card.getAttribute('data-project-id') || '', card]));
    container.replaceChildren();
    container.style.height = '';

    if (!this.modrinthResults.length) {
      const typeConfig = this.getModrinthTypeConfig();
      if (this.modrinthSearchInFlight) {
        container.innerHTML = '<p class="mods-empty">Suche läuft...</p>';
        this.prepareMotionGroup(container, ':scope > *', 34);
        return;
      }

      container.innerHTML = `<p class="mods-empty">${this.modrinthQuery ? `Keine ${typeConfig.pluralLabel.toLowerCase()} gefunden.` : `Keine Top ${typeConfig.pluralLabel.toLowerCase()} gefunden.`}</p>`;
      this.prepareMotionGroup(container, ':scope > *', 34);
      return;
    }
    const footerHeight = this.modrinthHasMore ? 72 : 0;
    container.style.height = `${Math.max(1, totalRows * rowHeight + footerHeight)}px`;

    const installedProjectIds = new Set([
      ...this.getVisibleInstalledModProjectIds(),
      ...this.installedModProjectIds
    ]);
    const installedSlugs = new Set(this.getInstalledModSlugsFromLoadedMods());

    // Fixed coordinates make the total height independent from mounted cards.
    // Only viewport rows plus overscan are present in the DOM.
    this.modrinthResults.slice(startIndex, endIndex).forEach((project, visibleIndex) => {
      const absoluteIndex = startIndex + visibleIndex;
      const row = Math.floor(absoluteIndex / columnCount);
      const column = absoluteIndex % columnCount;
      const cardWidth = (gridWidth - gap * (columnCount - 1)) / columnCount;
      const typeConfig = this.getModrinthTypeConfig(project.projectType || this.modrinthProjectType);
      const projectSlug = String(project.slug || '').trim().toLowerCase();
      const isInstalled = typeConfig.value !== 'modpack'
        && (installedProjectIds.has(project.projectId) || (projectSlug && installedSlugs.has(projectSlug)) || project.installed === true);
      const isWrongVersion = !isInstalled && this.isModrinthProjectWrongVersion(project);
      const installButtonText = isInstalled
        ? 'Schon installiert'
        : (isWrongVersion ? 'Falsche Version' : typeConfig.installLabel);
      const installButtonClass = isInstalled || isWrongVersion
        ? 'btn-secondary modrinth-state-button'
        : 'btn-primary';
      const cardState = `compact-v2:${isInstalled ? 1 : 0}:${isWrongVersion ? 1 : 0}:${typeConfig.value}`;
      let card = reusableCards.get(project.projectId);
      if (!card || card.dataset.modrinthCardState !== cardState || options.force) {
        card = document.createElement('article');
        card.className = 'mod-item';
        card.setAttribute('data-modrinth-project-card', 'true');
        card.setAttribute('data-project-id', project.projectId);
        card.dataset.modrinthCardState = cardState;
        card.innerHTML = `
          <div class="mod-head">
            <div class="mod-title-wrap">
              ${project.iconUrl ? `<img class="mod-icon" src="${this.escapeHtml(project.iconUrl)}" alt="${this.escapeHtml(project.title)}" loading="eager" decoding="async">` : '<div class="mod-icon mod-icon-placeholder">M</div>'}
              <div>
                <h4>${this.escapeHtml(project.title)}</h4>
              </div>
            </div>
          </div>
          ${project.description ? `<p>${this.escapeHtml(project.description)}</p>` : ''}
          ${typeConfig.value === 'modpack' ? this.renderModrinthPackTargetControls(project) : ''}
          <div class="mod-actions">
            <button class="btn ${installButtonClass}" data-modrinth-action="install" data-project-id="${this.escapeHtml(project.projectId)}" ${isInstalled || isWrongVersion ? 'disabled' : ''}>
              <span>${this.escapeHtml(installButtonText)}</span>
            </button>
          </div>
        `;
      }
      card.style.left = `${column * (cardWidth + gap)}px`;
      card.style.top = `${row * rowHeight}px`;
      card.style.width = `${cardWidth}px`;
      card.style.height = `${rowHeight - gap}px`;
      container.appendChild(card);
      this.updateModrinthPackTargetFields(card);
    });

    if (this.modrinthHasMore) {
      const loadMoreWrap = document.createElement('div');
      loadMoreWrap.className = 'modrinth-load-more';
      loadMoreWrap.style.top = `${totalRows * rowHeight}px`;
      loadMoreWrap.setAttribute('data-modrinth-load-sentinel', 'true');
      loadMoreWrap.innerHTML = `
        <button class="btn btn-secondary" data-modrinth-action="load-more" ${this.modrinthIsLoadingMore ? 'disabled' : ''}>
          ${this.modrinthIsLoadingMore ? 'Lade...' : 'Mehr anzeigen'}
        </button>
      `;
      container.appendChild(loadMoreWrap);
    }

    this.observeModrinthImages(container);
    this.observeModrinthLoadSentinel(container);
  }

  observeModrinthImages(container) {
    // Images are assigned eagerly while results are rendered and decoded by
    // the central startup preloader before the loading screen is dismissed.
    void container;
  }

  observeModrinthLoadSentinel(container) {
    this.modrinthLoadObserver?.disconnect();
    // The button remains available, but opening the tab no longer auto-loads
    // every following result page because its sentinel happens to be visible.
  }

  async installModrinthMod(projectId) {
    const project = this.modrinthResults.find((entry) => entry.projectId === projectId);
    if (!project || this.pendingModrinthInstalls.has(projectId)) {
      return;
    }

    const typeConfig = this.getModrinthTypeConfig(project.projectType || this.modrinthProjectType);
    const card = this.getModrinthProjectCard(projectId);
    const button = card?.querySelector('[data-modrinth-action="install"]');
    const previousLabel = button?.textContent || typeConfig.installLabel;
    const wasInstalled = Boolean(project.installed);
    this.pendingModrinthInstalls.add(projectId);
    this.suppressOwnModFolderRefreshUntil = Date.now() + 2500;
    this.installedModProjectIds.add(projectId);
    this.modrinthLoadedResults = this.modrinthLoadedResults.map((entry) => (
      entry.projectId === projectId ? { ...entry, installed: true } : entry
    ));
    this.modrinthResults = this.modrinthResults.map((entry) => (
      entry.projectId === projectId ? { ...entry, installed: true } : entry
    ));
    if (button) {
      button.disabled = true;
      button.classList.add('modrinth-state-button');
      button.textContent = typeConfig.value === 'modpack' ? 'Importiere…' : 'Installiere…';
    }

    try {
      const target = typeConfig.value === 'modpack'
        ? this.getModrinthModpackInstallTarget(project)
        : this.getActiveModrinthTarget();
      const result = await window.electronAPI.installModrinthMod(project, target);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        if (!wasInstalled) this.rollbackOptimisticModrinthInstall(projectId);
        if (button) {
          button.disabled = false;
          button.textContent = previousLabel;
        }
        return;
      }

      if (typeConfig.value === 'modpack') {
        window.setTimeout(() => {
          this.refreshPackContext({ reloadSearch: false }).catch((error) => {
            console.error('Background pack refresh failed:', error);
          });
        }, 0);
      } else {
        this.markModrinthProjectInstalled(project.projectId, { render: false });
        if (button) {
          button.textContent = 'Installiert';
        }
        if (this.activeSectionId === 'mods') {
          window.setTimeout(() => {
            this.loadMods({ skipManagedSync: true }).catch((error) => {
              console.error('Background mod refresh failed:', error);
            });
          }, 250);
        }
      }
      const warningText = result.warning ? ` Hinweis: ${result.warning}` : '';
      this.showNotification(`${result.message || `${project.title} installiert.`}${warningText}`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
      if (!wasInstalled) this.rollbackOptimisticModrinthInstall(projectId);
      if (button) {
        button.disabled = false;
        button.textContent = previousLabel;
      }
    } finally {
      this.pendingModrinthInstalls.delete(projectId);
      if (button) button.classList.remove('modrinth-state-button');
    }
  }

  rollbackOptimisticModrinthInstall(projectId) {
    this.installedModProjectIds.delete(projectId);
    this.modrinthLoadedResults = this.modrinthLoadedResults.map((entry) => (
      entry.projectId === projectId ? { ...entry, installed: false } : entry
    ));
    this.modrinthResults = this.modrinthResults.map((entry) => (
      entry.projectId === projectId ? { ...entry, installed: false } : entry
    ));
  }

  async installHostedServerModrinthMod(projectId) {
    const project = this.modrinthResults.find((entry) => entry.projectId === projectId);
    if (!project) {
      return;
    }
    if (!this.activeHostedServerId) {
      this.showNotification('Bitte erstelle oder wähle zuerst einen Hosting-Server aus.');
      return;
    }

    this.showLoading(`Füge ${project.title} zum Server hinzu...`);
    try {
      const result = await window.electronAPI.installHostedServerModrinthMod(project);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.hostedServerStatus = result;
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || `${project.title} wurde zum Server hinzugefügt.`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async loadModsFolder() {
    try {
      const result = await window.electronAPI.loadModsFolder();
      if (result.success) {
        this.showNotification(`Mods-Ordner geöffnet: ${result.modsPath}`);
        await this.loadMods();
      } else {
        this.showNotification(`Fehler: ${result.error || 'Mods-Ordner konnte nicht geöffnet werden.'}`);
      }
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  }

  async updateAllMods(triggerButton = null) {
    if (this.isUpdatingAllMods) {
      this.showNotification('Alle Mods werden bereits geprüft.');
      return;
    }

    if (typeof window.electronAPI?.updateAllMods !== 'function') {
      this.showNotification('Fehler: Mod-Prüfung ist im Launcher nicht verfügbar.');
      return;
    }

    this.isUpdatingAllMods = true;
    const button = triggerButton || document.getElementById('update-all-btn') || document.getElementById('update-mods-btn');
    const previousText = button?.textContent || '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Prüft...';
    }

    this.showLoading('Prüfe und korrigiere alle Mods...');

    try {
      const result = await window.electronAPI.updateAllMods();
      if (result.success) {
        this.lastModsCheckResult = {
          ...result,
          versionId: this.getActiveContextVersionId()
        };
        const warningText = result.warning ? ` Hinweis: ${result.warning}` : (result.warnings?.length ? ` Hinweis: ${result.warnings.slice(0, 2).join(' | ')}` : '');
        this.showNotification(`${result.message || `${result.updated}/${result.total} Mods wurden aktualisiert!`}${warningText}`);
        await this.loadMods();
      } else {
        this.lastModsCheckResult = null;
        this.showNotification('Fehler: ' + result.error);
      }
    } catch (error) {
      this.lastModsCheckResult = null;
      this.showNotification('Fehler: ' + error.message);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previousText || 'Alle prüfen';
      }
      this.isUpdatingAllMods = false;
      this.hideLoading();
    }
  }

  getRemovableIncompatibleMods() {
    return this.mods.filter((mod) => (
      mod.autoDisabled === true
      && !mod.isProtected
      && !mod.hiddenInModsTab
    ));
  }

  getIncompatibleMods() {
    return this.mods.filter((mod) => mod.autoDisabled === true && mod.enabled !== false);
  }

  updateModCompatibilityUI() {
    const launchButton = document.getElementById('launch-btn');
    if (!launchButton) {
      return;
    }

    const incompatibleCount = this.getIncompatibleMods().length;
    const isBlocked = incompatibleCount > 0;
    launchButton.classList.toggle('is-mod-blocked', isBlocked);
    if (!this.minecraftLaunchInProgress) {
      launchButton.disabled = isBlocked;
    }
    const label = isBlocked
      ? `Start blockiert: ${incompatibleCount} unpassende Mod${incompatibleCount === 1 ? '' : 's'}`
      : 'Minecraft starten';
    launchButton.title = label;
    launchButton.setAttribute('aria-label', label);
  }

  updateRemoveIncompatibleModsButton() {
    const button = document.getElementById('remove-incompatible-mods-btn');
    if (!button) {
      return;
    }

    const count = this.getRemovableIncompatibleMods().length;
    button.disabled = count === 0;
    const label = count > 0
      ? `${count} unpassende Mod${count === 1 ? '' : 's'} löschen`
      : 'Keine unpassenden Mods vorhanden';
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  async removeIncompatibleMods(triggerButton = null) {
    const incompatibleMods = this.getRemovableIncompatibleMods();
    if (!incompatibleMods.length) {
      this.showNotification('Keine entfernbaren unpassenden Mods gefunden.');
      return;
    }
    if (typeof window.electronAPI?.removeIncompatibleMods !== 'function') {
      this.showNotification('Fehler: Sammellöschen ist im Launcher nicht verfügbar.');
      return;
    }

    const confirmed = await this.showConfirm({
      title: 'Unpassende Mods löschen',
      message: `${incompatibleMods.length} unpassende Mod${incompatibleMods.length === 1 ? '' : 's'} wirklich dauerhaft entfernen? Versteckte und geschützte Mods bleiben erhalten.`,
      confirmText: 'Alle löschen'
    });
    if (!confirmed) {
      return;
    }

    const button = triggerButton || document.getElementById('remove-incompatible-mods-btn');
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-label', 'Unpassende Mods werden gelöscht');
      button.title = 'Unpassende Mods werden gelöscht';
    }
    this.showLoading('Entferne unpassende Mods...');

    try {
      const result = await window.electronAPI.removeIncompatibleMods();
      await this.loadMods();
      const errorText = result.errors?.length ? ` Fehler: ${result.errors.slice(0, 2).join(' | ')}` : '';
      this.showNotification(`${result.message || `${result.removed || 0} unpassende Mods wurden entfernt.`}${errorText}`);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.updateRemoveIncompatibleModsButton();
      this.hideLoading();
    }
  }

  getModsViewConfig(viewType = this.modsViewType) {
    if (viewType === 'resourcepack') {
      return {
        value: 'resourcepack',
        title: 'Ressourcenpakete',
        emptyText: 'Keine Ressourcenpakete installiert.',
        dropTitle: 'Ressourcenpakete über Modrinth installieren',
        dropHint: 'ZIP-Dateien werden im resourcepacks-Ordner verwaltet.'
      };
    }

    if (viewType === 'shader') {
      return {
        value: 'shader',
        title: 'Shader',
        emptyText: 'Keine Shader installiert.',
        dropTitle: 'Shader über Modrinth installieren',
        dropHint: 'ZIP-Dateien werden im shaderpacks-Ordner verwaltet.'
      };
    }

    if (viewType === 'hidden') {
      return {
        value: 'hidden',
        title: 'Ausgeblendete Pflichtmods',
        emptyText: 'Keine ausgeblendeten Mods installiert.',
        dropTitle: 'Ausgeblendete Mods',
        dropHint: 'Pflicht- und Performance-Mods'
      };
    }

    return {
      value: 'mod',
      title: 'Mods für diese Version',
      emptyText: '',
      dropTitle: 'Mods hier ablegen',
      dropHint: 'JAR-Dateien'
    };
  }

  updateModsViewUI() {
    const config = this.getModsViewConfig();
    document.querySelectorAll('[data-mods-view]').forEach((button) => {
      const isActive = button.getAttribute('data-mods-view') === config.value;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const titleEl = document.getElementById('mods-section-title');
    if (titleEl) {
      titleEl.textContent = config.title;
    }

    const dropZone = document.getElementById('mods-drop-zone');
    const dropTitleEl = dropZone?.querySelector('strong');
    const dropHintEl = dropZone?.querySelector('span');
    if (dropTitleEl) {
      dropTitleEl.textContent = config.dropTitle;
    }
    if (dropHintEl) {
      dropHintEl.textContent = config.dropHint;
    }
    dropZone?.classList.toggle('is-download-only', config.value !== 'mod');
  }

  renderMods() {
    const container = document.getElementById('mods-list');
    if (!container) {
      return;
    }

    this.updateModsViewUI();
    container.innerHTML = '';
    const viewConfig = this.getModsViewConfig();
    const visibleMods = this.mods.filter((mod) => {
      return viewConfig.value === 'hidden'
        ? Boolean(mod.hiddenInModsTab)
        : !mod.hiddenInModsTab && String(mod.itemType || 'mod') === viewConfig.value;
    });

    if (visibleMods.length === 0) {
      const activePack = this.getActivePack();
      const emptyText = viewConfig.emptyText || (activePack ? `Keine Mods in ${this.escapeHtml(activePack.name)} aktiv.` : 'Keine Mods für diese Version aktiv.');
      container.innerHTML = `<p class="mods-empty">${emptyText}</p>`;
      this.prepareMotionGroup(container, ':scope > *', 34);
      return;
    }

    visibleMods.forEach((mod) => {
      const modEl = document.createElement('div');
      const isPending = Boolean(mod.pendingDisable || mod.pendingDelete || this.pendingModOperationIds.has(mod.id));
      modEl.className = `mod-item installed-mod-card${mod.enabled === false || mod.pendingDisable ? ' is-disabled' : ''}${mod.autoDisabled === true ? ' is-incompatible' : ''}${isPending ? ' is-pending' : ''}`;
      const sourceLabel = mod.sourceLabel || (mod.managed ? 'Verwaltet' : 'Manuell');
      const itemType = String(mod.itemType || 'mod');
      const placeholderLabel = mod.hiddenInModsTab ? 'H' : (itemType === 'resourcepack' ? 'R' : (itemType === 'shader' ? 'S' : 'M'));
      const isProtected = Boolean(mod.isProtected || mod.hiddenInModsTab);
      const isEnabled = mod.enabled !== false;
      const canDisable = itemType === 'mod' && !mod.hiddenInModsTab && mod.canDisable !== false;
      const toggleDisabled = isEnabled && !canDisable;
      const disabledText = mod.disabledReason
        || (mod.autoDisabled ? 'Ausgeschaltet: keine passende Version gefunden.' : 'Ausgeschaltet.');
      const protectedText = isProtected
        ? (canDisable ? 'Pflichtmod: Kann ausgeschaltet, aber nicht entfernt werden.' : 'Pflichtmod: Bleibt immer eingeschaltet.')
        : '';
      modEl.innerHTML = `
        <div class="mod-head">
          <div class="mod-title-wrap">
            ${mod.iconUrl ? `<img class="mod-icon" src="${this.escapeHtml(mod.iconUrl)}" alt="${this.escapeHtml(mod.name)}">` : `<div class="mod-icon mod-icon-placeholder">${this.escapeHtml(placeholderLabel)}</div>`}
            <div class="installed-mod-copy">
              <div class="installed-mod-name-row">
                <h4 title="${this.escapeHtml(mod.name)}">${this.escapeHtml(mod.name)}</h4>
                <div class="installed-mod-controls">
                  ${itemType === 'mod' && !mod.hiddenInModsTab ? `
                    <button class="installed-mod-switch${isEnabled ? ' is-on' : ''}" type="button" role="switch"
                      aria-checked="${isEnabled ? 'true' : 'false'}"
                      aria-label="${this.escapeHtml(mod.name)} ${isEnabled ? 'ausschalten' : 'einschalten'}"
                      data-mod-action="${isEnabled ? 'disable' : 'enable'}"
                      data-mod-id="${this.escapeHtml(mod.id)}"
                      data-mod-name="${this.escapeHtml(mod.name)}" ${toggleDisabled ? 'disabled' : ''}>
                      <span></span>
                    </button>
                  ` : ''}
                  <div class="installed-mod-menu-wrap">
                    <button class="installed-mod-more" type="button" aria-label="Menü für ${this.escapeHtml(mod.name)}"
                      aria-haspopup="menu" aria-expanded="false" data-mod-action="menu">•••</button>
                    <div class="installed-mod-menu hidden" role="menu">
                      <button type="button" role="menuitem" data-mod-action="remove"
                        data-mod-id="${this.escapeHtml(mod.id)}" data-mod-name="${this.escapeHtml(mod.name)}"
                        ${isProtected ? 'disabled' : ''}>
                        ${isProtected ? 'Nicht entfernbar' : 'Löschen'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <span class="mod-source-badge">${this.escapeHtml(sourceLabel)}</span>
            </div>
          </div>
        </div>
        ${isEnabled ? '' : `<p class="mod-disabled-text">${this.escapeHtml(disabledText)}</p>`}
        ${protectedText ? `<p>${this.escapeHtml(protectedText)}</p>` : ''}
      `;
      container.appendChild(modEl);
    });

    this.prepareMotionGroup(container, ':scope > *', 34);
  }

  canStartMinecraft() {
    const reasons = [];
    if (this.pendingModOperations > 0 || this.modOperationState !== 'idle') {
      reasons.push('Mod-Änderungen laufen noch');
    }
    if (this.minecraftLaunchState !== 'idle') {
      reasons.push(this.minecraftLaunchState === 'launching' ? 'Minecraft wird gestartet' : 'Minecraft läuft bereits');
    }
    if (this.pendingModOperationIds.size > 0) {
      reasons.push('Mod-Operationen sind ausstehend');
    }
    return { allowed: reasons.length === 0, reason: reasons[0] || '' };
  }

  updateLaunchButtonAvailability() {
    const launchButton = document.getElementById('launch-btn');
    if (!launchButton) {
      return;
    }
    const launchGate = this.canStartMinecraft();
    const busy = this.minecraftLaunchState !== 'idle' || this.pendingModOperations > 0 || this.modOperationState !== 'idle';
    const blockedReason = !launchGate.allowed ? launchGate.reason : '';
    launchButton.disabled = busy || !launchGate.allowed;
    launchButton.classList.toggle('is-mod-blocked', !launchGate.allowed);
    const label = blockedReason
      ? `Start blockiert: ${blockedReason}`
      : (this.minecraftLaunchState === 'launching' ? 'Minecraft wird gestartet' : 'Minecraft starten');
    launchButton.title = label;
    launchButton.setAttribute('aria-label', label);
  }

  beginModOperation(modId, kind = 'toggle') {
    const key = String(modId || '').trim();
    if (!key) {
      return;
    }
    this.pendingModOperationIds.add(key);
    this.pendingModOperations += 1;
    this.modOperationState = 'processing';
    this.modOperationError = '';
    this.mods = this.mods.map((mod) => {
      if (mod.id !== key) {
        return mod;
      }
      const nextMod = { ...mod };
      if (kind === 'delete') {
        nextMod.pendingDelete = true;
        nextMod.pendingDisable = false;
      } else if (kind === 'disable') {
        nextMod.pendingDisable = true;
        nextMod.pendingDelete = false;
      } else if (kind === 'enable') {
        nextMod.pendingDisable = false;
        nextMod.pendingDelete = false;
      }
      return nextMod;
    });
    this.renderMods();
    this.updateLaunchButtonAvailability();
  }

  finishModOperation(modId, { success = false, error = '', reload = false } = {}) {
    const key = String(modId || '').trim();
    if (key) {
      this.pendingModOperationIds.delete(key);
      this.pendingModOperations = Math.max(0, this.pendingModOperations - 1);
    }
    if (this.pendingModOperations <= 0) {
      this.modOperationState = 'idle';
    }
    this.modOperationError = success ? '' : (error || this.modOperationError);
    this.mods = this.mods.map((mod) => {
      if (mod.id !== key) {
        return mod;
      }
      const nextMod = { ...mod, pendingDelete: false, pendingDisable: false, pendingEnable: false };
      if (!success && typeof mod.enabled === 'boolean') {
        nextMod.enabled = mod.enabled;
      }
      return nextMod;
    });
    this.renderMods();
    this.updateLaunchButtonAvailability();
    if (reload) {
      this.loadMods({ skipManagedSync: true }).catch((loadError) => {
        console.error('Mod state reload after operation failed:', loadError);
      });
    }
  }

  async setModEnabled(modId, enabled, modName) {
    const mod = this.mods.find((entry) => entry.id === modId);
    const lockKey = String(modId || '').trim();
    if (!lockKey) {
      return;
    }
    if (this.pendingModToggles.has(modId)) {
      this.queuedModToggleStates.set(modId, { enabled, modName });
      return;
    }

    this.mods = this.mods.map((entry) => entry.id === modId ? { ...entry, enabled, pendingDisable: !enabled, pendingDelete: false } : entry);
    const switchButton = Array.from(document.querySelectorAll('#mods-list .installed-mod-switch'))
      .find((entry) => entry.getAttribute('data-mod-id') === modId);
    const card = switchButton?.closest('.installed-mod-card');
    switchButton?.classList.toggle('is-on', enabled);
    switchButton?.setAttribute('aria-checked', enabled ? 'true' : 'false');
    switchButton?.setAttribute('data-mod-action', enabled ? 'disable' : 'enable');
    switchButton?.setAttribute('aria-label', `${modName} ${enabled ? 'ausschalten' : 'einschalten'}`);
    card?.classList.toggle('is-disabled', !enabled);

    this.queuedModToggleStates.set(modId, { enabled, modName });
    this.pendingModToggles.add(modId);
    this.beginModOperation(modId, enabled ? 'enable' : 'disable');
    this.suppressOwnModFolderRefreshUntil = Date.now() + 4000;
    try {
      while (this.queuedModToggleStates.has(modId)) {
        const requested = this.queuedModToggleStates.get(modId);
        this.queuedModToggleStates.delete(modId);
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const result = await window.electronAPI.setModEnabled(modId, requested.enabled);
        if (!result.success) {
          if (!this.queuedModToggleStates.has(modId)) {
            this.showNotification('Fehler: ' + (result.error || 'Mod konnte nicht geändert werden.'));
            this.mods = this.mods.map((entry) => entry.id === modId ? { ...entry, enabled: !!mod?.enabled, pendingDisable: false, pendingDelete: false } : entry);
            this.renderMods();
          }
          continue;
        }
        this.mods = this.mods.map((entry) => entry.id === modId ? { ...entry, enabled: requested.enabled, pendingDisable: false, pendingDelete: false } : entry);
        this.renderMods();
      }
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.pendingModToggles.delete(modId);
      this.finishModOperation(modId, { success: true, reload: true });
      if (this.queuedModToggleStates.has(modId)) {
        const latest = this.queuedModToggleStates.get(modId);
        this.setModEnabled(modId, latest.enabled, latest.modName);
      }
    }
  }

  async removeMod(modId, modName) {
    const currentMod = this.mods.find((entry) => entry.id === modId);
    if (this.pendingModRemovals.has(modId)) {
      return;
    }
    if (currentMod?.isProtected || currentMod?.hiddenInModsTab) {
      this.showNotification('Diese Pflichtmod ist erforderlich und kann nicht entfernt werden.');
      return;
    }

    const itemType = String(currentMod?.itemType || 'mod');
    const itemLabel = itemType === 'resourcepack'
      ? 'Ressourcenpaket'
      : (itemType === 'shader' ? 'Shader' : 'Mod');
    const confirmed = await this.showConfirm({
      title: `${itemLabel} löschen`,
      message: `${itemLabel} "${modName}" wirklich löschen?`,
      confirmText: 'Löschen'
    });
    if (!confirmed) {
      return;
    }

    // Optimistic removal keeps the list responsive; restore the exact entry if
    // the filesystem operation fails instead of reloading every installed mod.
    const previousMods = this.mods;
    this.pendingModRemovals.add(modId);
    this.suppressOwnModFolderRefreshUntil = Date.now() + 2500;
    this.mods = this.mods.filter((entry) => entry.id !== modId);
    const modCard = Array.from(document.querySelectorAll('#mods-list [data-mod-id]'))
      .find((entry) => entry.getAttribute('data-mod-id') === modId)
      ?.closest('.mod-item');
    if (modCard) {
      modCard.remove();
    } else {
      this.renderMods();
    }
    this.updateModsCount();

    try {
      const result = await window.electronAPI.removeMod(modId);
      if (!result.success) {
        this.mods = previousMods;
        this.renderMods();
        this.showNotification('Fehler: ' + result.error);
        return;
      }

      const projectId = String(currentMod?.projectId || currentMod?.modrinthProjectId || '').trim();
      if (projectId) {
        this.installedModProjectIds.delete(projectId);
        this.modrinthLoadedResults = this.modrinthLoadedResults.map((project) => (
          project.projectId === projectId ? { ...project, installed: false } : project
        ));
        this.modrinthResults = this.modrinthResults.map((project) => (
          project.projectId === projectId ? { ...project, installed: false } : project
        ));
        if (this.activeSectionId === 'modrinth') {
          this.renderModrinthResults({ force: true });
        }
      }
      const warningText = result.warning ? ` Hinweis: ${result.warning}` : '';
      this.showNotification(`${result.message || `Mod "${modName}" wurde entfernt.`}${warningText}`);
    } catch (error) {
      this.mods = previousMods;
      this.renderMods();
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.pendingModRemovals.delete(modId);
    }
  }

  async updateMod(modId, modName) {
    try {
      const result = await window.electronAPI.refreshMod(modId);
      if (!result.success) {
        return;
      }

      this.loadMods({ skipManagedSync: true }).catch((error) => {
        console.error('Background adapted-mod reload failed:', error);
      });
    } catch (error) {
      console.error(`Mod adaptation failed for ${modName}:`, error);
    }
  }

  updateMinecraftStatus() {
    const statusEl = document.getElementById('minecraft-status');
    if (!statusEl) {
      return;
    }

    if (this.minecraftPath) {
      statusEl.textContent = '';
      statusEl.style.color = '';
    } else {
      statusEl.textContent = 'Minecraft-Ordner wird erstellt';
      statusEl.style.color = 'var(--danger)';
    }
  }

  updateJavaStatus() {
    const javaStatusEl = document.getElementById('java-status');
    const fabricStatusEl = document.getElementById('fabric-status');

    if (javaStatusEl) {
      if (!this.launcherStatus?.javaFound) {
        javaStatusEl.textContent = 'Java nicht gefunden';
        javaStatusEl.style.color = 'var(--danger)';
      } else if (this.launcherStatus.needsJavaUpgrade) {
        javaStatusEl.textContent = `Java ${this.launcherStatus.javaMajorVersion} erkannt, Java 21 empfohlen`;
        javaStatusEl.style.color = 'var(--warning, #f1c40f)';
      } else {
        javaStatusEl.textContent = `Java ${this.launcherStatus.javaMajorVersion} erkannt`;
        javaStatusEl.style.color = 'var(--success)';
      }
    }

    if (fabricStatusEl) {
      if (!this.launcherStatus?.success) {
        fabricStatusEl.textContent = 'Java-Status nicht verfügbar';
      } else {
        const activePack = this.getActivePack();
        const activeVersion = this.getSelectedVersionDisplayName() || 'keine Auswahl';
        fabricStatusEl.textContent = activePack
          ? `Aktiv: ${activePack.name} | ${activeVersion}`
          : `Aktiv: ${activeVersion}`;
        fabricStatusEl.style.color = 'var(--success)';
      }
    }
  }

  updateModsCount() {
    const countEl = document.getElementById('mods-count');
    if (countEl) {
      countEl.textContent = `${this.mods.length} Mod${this.mods.length !== 1 ? 's' : ''}`;
    }
  }

  updateModsCheckStatus(overrideText = '') {
    const statusEl = document.getElementById('mods-check-status');
    if (!statusEl) {
      return;
    }

    statusEl.classList.remove('is-ok', 'is-warning', 'is-error');
    if (overrideText) {
      statusEl.textContent = overrideText;
      statusEl.classList.add('is-error');
      return;
    }

    const versionLabel = this.getSelectedVersionDisplayName();
    const versionText = versionLabel ? `Fabric ${versionLabel}` : 'die ausgewählte Version';
    const viewConfig = this.getModsViewConfig();
    const visibleMods = this.mods.filter((mod) => (
      viewConfig.value === 'hidden'
        ? Boolean(mod.hiddenInModsTab)
        : !mod.hiddenInModsTab && String(mod.itemType || 'mod') === viewConfig.value
    ));
    if (viewConfig.value === 'hidden') {
      if (!visibleMods.length) {
        statusEl.textContent = viewConfig.emptyText;
        statusEl.classList.add('is-warning');
        return;
      }

      const enabledHiddenMods = visibleMods.filter((mod) => mod.enabled !== false);
      statusEl.textContent = `${enabledHiddenMods.length}/${visibleMods.length} Pflicht- und Systemmods aktiv.`;
      statusEl.classList.add(enabledHiddenMods.length === visibleMods.length ? 'is-ok' : 'is-warning');
      return;
    }
    if (viewConfig.value !== 'mod') {
      if (!visibleMods.length) {
        statusEl.textContent = viewConfig.emptyText;
        statusEl.classList.add('is-warning');
        return;
      }

      statusEl.textContent = `${visibleMods.length} ${viewConfig.title}${visibleMods.length === 1 ? '' : ''} installiert.`;
      statusEl.classList.add('is-ok');
      return;
    }

    const activeMods = visibleMods.filter((mod) => mod.enabled !== false);
    const managedActiveMods = activeMods.filter((mod) => mod.managed);
    const manualActiveMods = activeMods.filter((mod) => !mod.managed);
    const disabledMods = visibleMods.filter((mod) => mod.enabled === false);
    const autoDisabledMods = disabledMods.filter((mod) => mod.autoDisabled);
    const currentVersionId = this.getActiveContextVersionId();
    const lastResult = this.lastModsCheckResult?.versionId === currentVersionId
      ? this.lastModsCheckResult
      : null;

    if (!visibleMods.length) {
      statusEl.textContent = `Keine Mods für ${versionText} installiert.`;
      statusEl.classList.add('is-warning');
      return;
    }

    if (manualActiveMods.length > 0) {
      statusEl.textContent = `${manualActiveMods.length} aktive Mod${manualActiveMods.length === 1 ? '' : 's'} sind manuell und können nicht sicher automatisch korrigiert werden. Alle prüfen übernimmt erkennbare Modrinth-JARs oder schaltet unpassende Dateien aus.`;
      statusEl.classList.add('is-warning');
      return;
    }

    if (autoDisabledMods.length > 0) {
      statusEl.textContent = `${autoDisabledMods.length} Mod${autoDisabledMods.length === 1 ? '' : 's'} sind ausgeschaltet, weil keine passende Version für ${versionText} gefunden wurde.`;
      statusEl.classList.add('is-warning');
      return;
    }

    if (disabledMods.length > 0) {
      statusEl.textContent = `${disabledMods.length} Mod${disabledMods.length === 1 ? ' ist' : 's sind'} ausgeschaltet. Aktive verwaltete Mods sind passend für ${versionText}.`;
      statusEl.classList.add('is-warning');
      return;
    }

    const checkedText = lastResult?.success && Number.isFinite(Number(lastResult.updated)) && Number.isFinite(Number(lastResult.total))
      ? ` Zuletzt geprüft: ${lastResult.updated}/${lastResult.total}.`
      : '';
    statusEl.textContent = `Alles richtig: ${managedActiveMods.length} verwaltete Mod${managedActiveMods.length === 1 ? '' : 's'} sind passend für ${versionText} aktiv.${checkedText}`;
    statusEl.classList.add('is-ok');
  }

  switchSection(sectionId) {
    this.activateSection(sectionId);
  }

  handleNavClick(event) {
    const item = event.target.closest('.nav-item');
    if (item) {
      this.activateSection(item.getAttribute('data-section'));
    }
  }

  updateLoadingState({ text, progress, reset = false } = {}) {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const progressBar = document.getElementById('loading-progress');
    const percentEl = document.getElementById('loading-percent');

    if (loadingText && typeof text === 'string') {
      loadingText.textContent = this.localizeText(text);
    }

    if (reset) {
      this.loadingProgress = 0;
    }

    if (Number.isFinite(Number(progress))) {
      const normalizedProgress = Math.min(100, Math.max(0, Number(progress)));
      this.loadingProgress = reset
        ? normalizedProgress
        : Math.max(this.loadingProgress || 0, normalizedProgress);
    }

    const visibleProgress = Math.round(this.loadingProgress || 0);
    if (progressBar) {
      progressBar.style.width = `${visibleProgress}%`;
    }
    if (percentEl) {
      percentEl.textContent = `${visibleProgress}%`;
    }

    overlay?.setAttribute('aria-busy', visibleProgress < 100 ? 'true' : 'false');
  }

  restartLoaderBrandAnimation(overlay) {
    if (!overlay) {
      return;
    }
    const brand = overlay.querySelector('.loader-brand');
    const subbrand = overlay.querySelector('.loader-subbrand');
    if (brand) brand.textContent = 'Minecraft';
    if (subbrand) subbrand.textContent = 'X Client';
    overlay.classList.remove('is-brand-animating');
    // A layout read intentionally creates a fresh animation timeline on every display.
    void overlay.offsetWidth;
    overlay.classList.add('is-brand-animating');
  }

  showLoading(text = 'Wird geladen...', options = {}) {
    const overlay = document.getElementById('loading-overlay');
    const isNewPresentation = Boolean(overlay?.classList.contains('hidden'));
    if (this.loadingHideTimer) {
      clearTimeout(this.loadingHideTimer);
      this.loadingHideTimer = null;
    }
    if (isNewPresentation && this.loadingWelcomeTimer) {
      clearTimeout(this.loadingWelcomeTimer);
      this.loadingWelcomeTimer = null;
    }

    // Never let a stalled operation trap the user behind the loading overlay.
    // Progress updates do not restart this deadline.
    if (isNewPresentation) {
      if (this.loadingAutoHideTimer) {
        clearTimeout(this.loadingAutoHideTimer);
      }
      this.loadingAutoHideTimer = window.setTimeout(() => {
        this.loadingAutoHideTimer = null;
        this.hideLoading();
      }, 7000);
    }

    this.loadingShownAt = Date.now();
    overlay?.classList.remove('hidden', 'is-completing', 'is-compact');
    if (isNewPresentation) {
      overlay?.classList.remove('is-welcome-visible');
      this.restartLoaderBrandAnimation(overlay);
    }
    overlay?.setAttribute('aria-hidden', 'false');
    this.updateLoadingPlayerName(this.user?.username || options.playerName || '');
    if (options.sound) {
      this.playLoadingSound(options.sound);
    }
    this.updateLoadingState({
      text,
      progress: Number.isFinite(Number(options.progress)) ? Number(options.progress) : 18,
      reset: true
    });
    if (isNewPresentation) {
      overlay?.classList.add('is-welcome-visible');
    }
  }

  updateLoadingPlayerName(username = '') {
    const overlay = document.getElementById('loading-overlay');
    const playerName = String(username || '').trim();
    const playerElement = overlay?.querySelector('.loader-player');
    if (playerElement) {
      playerElement.textContent = playerName;
      playerElement.hidden = !playerName;
    }
    const welcomeLabel = overlay?.querySelector('.loader-welcome');
    if (welcomeLabel) {
      welcomeLabel.textContent = this.language === 'de' ? 'Willkommen zurück' : 'Welcome back';
      welcomeLabel.hidden = !playerName;
    }
    if (playerName) {
      overlay?.classList.add('is-welcome-visible');
    }
  }

  finishLoading(text = 'Bereit.') {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay || overlay.classList.contains('hidden')) {
      return;
    }

    this.updateLoadingState({
      text,
      progress: 100
    });
    this.playLoadingSound('complete');
    overlay.classList.add('is-completing');

    if (this.loadingHideTimer) {
      clearTimeout(this.loadingHideTimer);
    }
    this.hideLoading();
  }

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (this.loadingHideTimer) {
      clearTimeout(this.loadingHideTimer);
      this.loadingHideTimer = null;
    }
    if (this.loadingAutoHideTimer) {
      clearTimeout(this.loadingAutoHideTimer);
      this.loadingAutoHideTimer = null;
    }
    if (this.loadingWelcomeTimer) {
      clearTimeout(this.loadingWelcomeTimer);
      this.loadingWelcomeTimer = null;
    }
    overlay?.classList.add('hidden');
    overlay?.classList.remove('is-completing', 'is-welcome-visible');
    overlay?.setAttribute('aria-hidden', 'true');
    overlay?.setAttribute('aria-busy', 'false');
  }

  showNotification(message) {
    const notification = document.getElementById('notification');
    if (this.notificationHideTimer) {
      clearTimeout(this.notificationHideTimer);
      this.notificationHideTimer = null;
    }
    notification?.classList.add('hidden');
    notification?.classList.remove('is-hiding');
  }

  startServiceStatusMonitor() {
    if (this.serviceStatusCheckTimer) {
      return;
    }

    if (!this.serviceStatusListenersAttached) {
      window.addEventListener('offline', () => {
        this.setServiceStatus({
          id: 'internet',
          level: 'critical',
          message: 'Keine Internetverbindung.'
        });
      });
      window.addEventListener('online', () => this.checkServiceHealth({ force: true }));
      this.serviceStatusListenersAttached = true;
    }

    if (navigator.onLine === false) {
      this.setServiceStatus({
        id: 'internet',
        level: 'critical',
        message: 'Keine Internetverbindung.'
      });
    }

    const initialCheck = this.checkServiceHealth();
    this.serviceStatusCheckTimer = setInterval(() => {
      this.checkServiceHealth();
    }, X_LAUNCHER_SERVICE_HEALTH_INTERVAL_MS);
    return initialCheck;
  }

  async checkServiceHealth(options = {}) {
    if (this.serviceStatusCheckInFlight && !options.force) {
      return;
    }

    if (typeof window.electronAPI?.checkServiceHealth !== 'function') {
      return;
    }

    this.serviceStatusCheckInFlight = true;
    try {
      const result = await window.electronAPI.checkServiceHealth();
      this.applyServiceHealthResult(result);
    } catch (error) {
      this.setServiceStatus({
        id: 'launcher-server',
        level: 'critical',
        message: 'Launcher-Server antwortet nicht.',
        detail: error.message
      });
    } finally {
      this.serviceStatusCheckInFlight = false;
    }
  }

  applyServiceHealthResult(result) {
    const statuses = Array.isArray(result?.statuses) ? result.statuses : [];
    if (!statuses.length) {
      return;
    }

    statuses.forEach((status) => {
      const id = String(status?.id || '').trim();
      if (!id) {
        return;
      }

      if (status.ok) {
        this.clearServiceStatus(id);
        return;
      }

      this.setServiceStatus({
        id,
        level: status.level || 'warning',
        message: status.message || 'Dienst momentan nicht erreichbar.',
        detail: status.error || ''
      });
    });
  }

  setServiceStatus(status) {
    const id = String(status?.id || '').trim();
    if (!id) {
      return;
    }

    const recoveryTimer = this.serviceStatusRecoveredTimers.get(id);
    if (recoveryTimer) {
      clearTimeout(recoveryTimer);
      this.serviceStatusRecoveredTimers.delete(id);
    }

    const nextStatus = {
      id,
      level: ['ok', 'warning', 'critical'].includes(status.level) ? status.level : 'warning',
      message: this.localizeText(status.message || ''),
      detail: status.detail || '',
      recovery: Boolean(status.recovery),
      updatedAt: Date.now()
    };
    const current = this.serviceStatusMap.get(id);
    if (
      current
      && current.level === nextStatus.level
      && current.message === nextStatus.message
      && current.recovery === nextStatus.recovery
    ) {
      return;
    }

    this.serviceStatusMap.set(id, nextStatus);
    this.renderServiceStatuses();
  }

  clearServiceStatus(id) {
    const normalizedId = String(id || '').trim();
    const current = this.serviceStatusMap.get(normalizedId);
    if (!current) {
      return;
    }

    this.serviceStatusMap.delete(normalizedId);
    this.renderServiceStatuses();

    if (!current.recovery && normalizedId !== 'downloads-disabled') {
      this.showServiceRecoveredStatus(normalizedId);
    }
  }

  showServiceRecoveredStatus(id) {
    this.setServiceStatus({
      id,
      level: 'ok',
      message: 'Verbindung wiederhergestellt',
      recovery: true
    });

    const timer = setTimeout(() => {
      const current = this.serviceStatusMap.get(id);
      if (current?.recovery) {
        this.serviceStatusMap.delete(id);
        this.renderServiceStatuses();
      }
      this.serviceStatusRecoveredTimers.delete(id);
    }, X_LAUNCHER_SERVICE_RECOVERY_VISIBLE_MS);
    this.serviceStatusRecoveredTimers.set(id, timer);
  }

  renderServiceStatuses() {
    const stack = document.getElementById('service-status-stack');
    if (!stack) {
      return;
    }

    const statuses = Array.from(this.serviceStatusMap.values())
      .sort((left, right) => {
        const levelOrder = { critical: 0, warning: 1, ok: 2 };
        return (levelOrder[left.level] ?? 3) - (levelOrder[right.level] ?? 3)
          || left.updatedAt - right.updatedAt;
      });

    stack.classList.toggle('is-empty', statuses.length === 0);
    stack.innerHTML = statuses.map((status) => `
      <div class="service-status service-status-${this.escapeHtml(status.level)}" role="status" data-service-id="${this.escapeHtml(status.id)}">
        <span class="service-status-dot" aria-hidden="true"></span>
        <p>${this.escapeHtml(status.message)}</p>
      </div>
    `).join('');
  }
}

Object.assign(MinecraftLauncher.prototype, {
  async loadHostedServerStatus() {
    if (typeof window.electronAPI?.getHostedServerStatus !== 'function') {
      return;
    }
    try {
      const result = await window.electronAPI.getHostedServerStatus();
      this.hostedServerStatus = result || {};
      this.hostedServers = result?.servers || [];
      this.activeHostedServerId = result?.activeServerId || result?.activeServer?.id || '';
      this.updateHostedServerStatus(result || {});
    } catch (error) {
      this.updateHostedServerStatus({ success: false, error: error.message, servers: [] });
    }
  },

  showRouterPasswordPrompt() {
    const modal = document.getElementById('router-password-modal');
    const input = document.getElementById('router-password-input');
    if (!modal || !input) return Promise.resolve('');
    if (this.pendingRouterPasswordPrompt) this.resolveRouterPasswordPrompt('');
    input.value = '';
    modal.classList.remove('hidden');
    return new Promise((resolve) => {
      this.pendingRouterPasswordPrompt = { resolve, previousFocus: document.activeElement };
      window.setTimeout(() => input.focus(), 0);
    });
  },

  resolveRouterPasswordPrompt(password = '') {
    if (!this.pendingRouterPasswordPrompt) return;
    const modal = document.getElementById('router-password-modal');
    const input = document.getElementById('router-password-input');
    const { resolve, previousFocus } = this.pendingRouterPasswordPrompt;
    this.pendingRouterPasswordPrompt = null;
    if (input) input.value = '';
    modal?.classList.add('hidden');
    previousFocus?.focus?.();
    resolve(String(password || ''));
  },

  updateHostedServerStatus(status = this.hostedServerStatus || {}) {
    this.hostedServerStatus = status;
    this.hostedServers = status.servers || [];
    this.activeHostedServerId = status.activeServerId || status.activeServer?.id || '';
    const activeServer = status.activeServer || {};
    const running = Boolean(status.running);
    const powerButton = document.getElementById('hosted-server-start-btn');
    if (powerButton) {
      const stopping = Boolean(status.stopping);
      powerButton.textContent = stopping ? 'Stoppt…' : (running ? 'Stoppen' : 'Starten & Online');
      powerButton.classList.toggle('btn-success', !running && !stopping);
      powerButton.classList.toggle('btn-danger', running || stopping);
      powerButton.disabled = !this.activeHostedServerId || stopping;
      powerButton.setAttribute('aria-label', running || stopping ? 'Minecraft-Server stoppen' : 'Minecraft-Server starten und online stellen');
    }

    const statusEl = document.getElementById('hosted-server-status');
    if (statusEl) {
      statusEl.classList.remove('is-ok', 'is-warning', 'is-error');
      if (status.error) {
        statusEl.textContent = `Hosting: ${status.error}`;
        statusEl.classList.add('is-error');
      } else if (status.publiclyReachable) {
        statusEl.textContent = `Online: ${status.address}`;
        statusEl.classList.add('is-ok');
      } else if (status.connectionError) {
        statusEl.textContent = status.connectionError;
        statusEl.classList.add('is-error');
      } else if (status.running) {
        statusEl.textContent = status.connectionChecking
          ? `Öffentliche Verbindung wird geprüft: ${status.address || status.localAddress || 'localhost'}`
          : `Server läuft, ist aber von außen nicht erreichbar: ${status.address || status.localAddress || 'localhost'}`;
        statusEl.classList.add('is-warning');
      } else {
        statusEl.textContent = `${this.hostedServers.length} lokaler Server · offline`;
        statusEl.classList.add('is-warning');
      }
    }

    const listStatusEl = document.getElementById('hosted-server-list-status');
    if (listStatusEl) {
      listStatusEl.textContent = this.hostedServers.length
        ? `${this.hostedServers.length} Server gespeichert.`
        : 'Noch keine lokalen Server erstellt.';
    }

    const title = document.getElementById('hosted-server-editor-title');
    if (title) {
      title.textContent = activeServer.displayName || activeServer.name || 'Dashboard';
    }

    const subtitle = document.getElementById('hosting-server-subtitle');
    if (subtitle) {
      const version = activeServer.minecraftVersion || 'latest';
      subtitle.textContent = activeServer.id
        ? `Paper ${version} · ${activeServer.ramGb || 4} GB RAM · Port ${activeServer.port || 25565}`
        : 'Wähle einen Server oder erstelle einen neuen lokalen Paper-Server.';
    }

    const statusPill = document.getElementById('hosting-status-pill');
    if (statusPill) {
      statusPill.classList.remove('online', 'offline', 'warning');
      statusPill.classList.add(status.publiclyReachable ? 'online' : (running ? 'warning' : 'offline'));
      statusPill.textContent = status.publiclyReachable ? 'Online' : (running ? 'Lokal' : 'Offline');
    }

    const addressEl = document.getElementById('hosted-server-address');
    if (addressEl) {
      addressEl.textContent = status.address || status.localAddress || 'Nicht gestartet';
    }
    const directConnectionStatus = document.getElementById('direct-connection-status');
    if (directConnectionStatus) {
      directConnectionStatus.classList.remove('online', 'warning', 'offline');
      if (status.publiclyReachable) {
        directConnectionStatus.textContent = 'Extern erreichbar';
        directConnectionStatus.classList.add('online');
      } else if (running) {
        directConnectionStatus.textContent = status.connectionChecking ? 'Wird geprüft' : 'Nicht extern';
        directConnectionStatus.classList.add('warning');
      } else {
        directConnectionStatus.textContent = 'Offline';
        directConnectionStatus.classList.add('offline');
      }
    }
    const fallbackAddress = document.getElementById('hosted-server-fallback-address');
    if (fallbackAddress) {
      fallbackAddress.textContent = status.connectionError
        || status.externalCheck?.reason
        || (running
          ? (status.upnp?.success
            ? 'Port 25565 TCP wurde per UPnP freigegeben; der externe Test läuft.'
            : status.upnp?.reason || 'UPnP-Portfreigabe ist nicht verfügbar.')
          : 'Beim Start werden UPnP, Windows-Firewall und öffentliche IPv4 automatisch geprüft.');
    }
    const routerButton = document.getElementById('hosted-server-router-btn');
    if (routerButton) {
      routerButton.classList.toggle('hidden', !running || status.publiclyReachable || status.upnp?.success || !status.routerSettingsUrl);
    }

    const runtimeEl = document.getElementById('hosted-server-runtime');
    if (runtimeEl) {
      const resources = status.resources || {};
      const players = status.players || {};
      runtimeEl.innerHTML = `
        <div class="hosting-metric"><span>Status</span><strong>${status.publiclyReachable ? 'Online' : (running ? 'Lokal' : 'Offline')}</strong></div>
        <div class="hosting-metric"><span>Direkte Verbindung</span><strong>${status.publiclyReachable ? 'Erreichbar' : (status.connectionChecking ? 'Prüfung läuft' : 'Nicht erreichbar')}</strong></div>
        <div class="hosting-metric"><span>Spieler</span><strong>${this.escapeHtml(players.online ?? 0)}/${this.escapeHtml(players.max || activeServer.maxPlayers || 0)}</strong></div>
        <div class="hosting-metric"><span>TPS</span><strong>${this.escapeHtml(status.tps || 'über Konsole')}</strong></div>
        <div class="hosting-metric"><span>CPU</span><strong>${this.escapeHtml(resources.cpu || 'unbekannt')}</strong></div>
        <div class="hosting-metric"><span>RAM</span><strong>${this.escapeHtml(resources.memory || 'unbekannt')}</strong></div>
        <div class="hosting-metric"><span>Disk</span><strong>${this.escapeHtml(resources.disk || 'unbekannt')}</strong></div>
        <div class="hosting-metric"><span>Netzwerk</span><strong>${this.escapeHtml(resources.network || 'unbekannt')}</strong></div>
      `;
    }

    this.renderHostedServerList(status);
    this.renderOracleVmList(status);
    this.renderHostingConsole(status);
    this.renderHostingPlayers(status);
    this.renderHostingFiles(status);
    this.fillHostedServerForm(activeServer);
    this.updateHostedServerEditorMode();

    if (!this.hostedServerStatusTimer) {
      this.hostedServerStatusTimer = window.setInterval(() => this.loadHostedServerStatus(), 10000);
    }
  },

  updateHostedServerEditorMode() {
    const editor = document.getElementById('hosted-server-editor');
    const hostingSection = document.getElementById('hosting');
    const isCreate = this.hostedServerFormMode === 'create' || !this.activeHostedServerId;
    const isHidden = this.hostedServerFormMode === 'hidden' && !this.activeHostedServerId;
    editor?.classList.toggle('hidden', isHidden);
    editor?.classList.toggle('is-create-mode', !isHidden && isCreate);
    hostingSection?.classList.toggle('hosting-editor-open', !isHidden);
    document.getElementById('hosted-server-final-create-btn')?.classList.toggle('hidden', !isCreate);
    document.getElementById('hosted-server-cancel-create-btn')?.classList.toggle('hidden', !isCreate);
    document.getElementById('hosted-server-save-btn')?.classList.toggle('hidden', isCreate);
    document.getElementById('hosted-server-delete-btn')?.classList.toggle('hidden', isCreate);
    const hasServer = Boolean(this.activeHostedServerId);
    ['hosted-server-start-btn', 'hosted-server-restart-btn'].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.disabled = !hasServer;
    });
    document.querySelector('.server-summary-card')?.classList.toggle('is-disabled-panel', !hasServer);
    document.querySelector('.live-players-card')?.classList.toggle('is-disabled-panel', !hasServer);
    document.querySelector('.moderation-card')?.classList.toggle('is-disabled-panel', !hasServer);
    document.querySelector('.server-host-console-panel')?.classList.toggle('is-disabled-panel', !hasServer);
  },

  fillHostedServerForm(server = {}) {
    const values = {
      'hosted-server-name-input': server.displayName || server.name || '',
      'hosted-server-ram-input': server.ramGb || 4,
      'hosted-server-port-input': server.port || 25565,
      'hosted-server-max-players-input': server.maxPlayers || 20,
      'hosted-server-seed-input': server.seed || '',
      'hosted-server-domain-input': server.customDomain || '',
      'hosted-server-view-distance-input': server.viewDistance || 10,
      'hosted-server-simulation-distance-input': server.simulationDistance || 10,
      'hosted-server-spawn-protection-input': server.spawnProtection ?? 16
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element && !element.matches(':focus')) element.value = String(value);
    });
    const selects = {
      'hosted-server-edition-select': 'java',
      'hosted-server-software-select': 'paper',
      'hosted-server-version-input': server.minecraftVersion || 'latest',
      'hosted-server-java-input': server.javaVersion || 21,
      'hosted-server-difficulty-select': server.difficulty || 'normal',
      'hosted-server-gamemode-select': server.gamemode || 'survival'
    };
    this.renderHostedServerVersionOptions(selects['hosted-server-version-input']);
    Object.entries(selects).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element && !element.matches(':focus')) element.value = String(value);
    });
    const checks = {
      'hosted-server-pvp-checkbox': server.pvp !== false,
      'hosted-server-whitelist-checkbox': Boolean(server.whitelist),
      'hosted-server-online-mode-checkbox': server.onlineMode !== false,
      'hosted-server-command-block-checkbox': Boolean(server.enableCommandBlock),
      'hosted-server-hardcore-checkbox': Boolean(server.hardcore),
      'hosted-server-nether-checkbox': server.allowNether !== false,
      'hosted-server-end-checkbox': server.allowEnd !== false,
      'hosted-server-eula-checkbox': true
    };
    Object.entries(checks).forEach(([id, checked]) => {
      const element = document.getElementById(id);
      if (element) element.checked = checked;
    });
  },

  getHostedServerOptionsFromUI() {
    return {
      serverId: this.activeHostedServerId,
      name: document.getElementById('hosted-server-name-input')?.value.trim() || '',
      displayName: document.getElementById('hosted-server-name-input')?.value.trim() || '',
      minecraftVersion: document.getElementById('hosted-server-version-input')?.value || 'latest',
      javaVersion: Number(document.getElementById('hosted-server-java-input')?.value || 21),
      ramGb: Number(document.getElementById('hosted-server-ram-input')?.value || 4),
      port: Number(document.getElementById('hosted-server-port-input')?.value || 25565),
      seed: document.getElementById('hosted-server-seed-input')?.value.trim() || '',
      gamemode: document.getElementById('hosted-server-gamemode-select')?.value || 'survival',
      difficulty: document.getElementById('hosted-server-difficulty-select')?.value || 'normal',
      pvp: Boolean(document.getElementById('hosted-server-pvp-checkbox')?.checked),
      hardcore: Boolean(document.getElementById('hosted-server-hardcore-checkbox')?.checked),
      onlineMode: Boolean(document.getElementById('hosted-server-online-mode-checkbox')?.checked),
      spawnProtection: Number(document.getElementById('hosted-server-spawn-protection-input')?.value || 16),
      viewDistance: Number(document.getElementById('hosted-server-view-distance-input')?.value || 10),
      simulationDistance: Number(document.getElementById('hosted-server-simulation-distance-input')?.value || 10),
      allowNether: Boolean(document.getElementById('hosted-server-nether-checkbox')?.checked),
      allowEnd: Boolean(document.getElementById('hosted-server-end-checkbox')?.checked),
      enableCommandBlock: Boolean(document.getElementById('hosted-server-command-block-checkbox')?.checked),
      whitelist: Boolean(document.getElementById('hosted-server-whitelist-checkbox')?.checked),
      maxPlayers: Number(document.getElementById('hosted-server-max-players-input')?.value || 20),
      customDomain: document.getElementById('hosted-server-domain-input')?.value.trim() || '',
      acceptEula: Boolean(document.getElementById('hosted-server-eula-checkbox')?.checked)
    };
  },

  renderHostedServerVersionOptions(selectedVersion = 'latest') {
    const select = document.getElementById('hosted-server-version-input');
    if (!select || select.options.length) return;
    ['latest', '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4', '1.20.6', '1.20.4'].forEach((version) => {
      const option = document.createElement('option');
      option.value = version;
      option.textContent = version === 'latest' ? 'Neueste Paper-Version' : version;
      select.appendChild(option);
    });
    select.value = selectedVersion || 'latest';
  },

  renderHostedServerList(status = this.hostedServerStatus || {}) {
    const list = document.getElementById('hosted-server-list');
    if (!list) return;
    const servers = status.servers || [];
    const signature = JSON.stringify(servers.map((server) => ({
      id: server.id,
      name: server.displayName || server.name,
      version: server.minecraftVersion,
      ram: server.ramGb,
      port: server.port,
      running: Boolean(server.running),
      public: Boolean(server.publiclyReachable),
      address: server.visibleAddress || ''
    })));
    if (signature === this.hostedServerListSignature) {
      this.updateHostedServerListSelection(status);
      return;
    }
    this.hostedServerListSignature = signature;
    if (!servers.length) {
      list.innerHTML = '<p class="mods-empty">Noch keine lokalen Server.</p>';
      return;
    }
    list.innerHTML = servers.map((server) => {
      const active = server.id === (status.activeServerId || this.activeHostedServerId);
      const isActive = server.id === (status.activeServerId || this.activeHostedServerId);
      const address = (isActive && status.address) || server.visibleAddress || `localhost:${server.port || 25565}`;
      const serverState = server.publiclyReachable || (active && status.publiclyReachable)
        ? 'Online'
        : (server.running || (active && status.running) ? 'Lokal' : 'Offline');
      return `
        <article class="hosted-server-card${active ? ' active' : ''}" data-server-id="${this.escapeHtml(server.id)}">
          <div>
            <h4>${this.escapeHtml(server.displayName || server.name)}</h4>
            <p>${this.escapeHtml(serverState)} · ${this.escapeHtml(address)}</p>
            <p>Paper ${this.escapeHtml(server.minecraftVersion || 'latest')} · ${this.escapeHtml(server.ramGb || 4)} GB RAM</p>
          </div>
          <div class="server-actions">
            <button class="btn btn-primary" type="button" data-host-action="select" data-server-id="${this.escapeHtml(server.id)}">Öffnen</button>
            <button class="btn btn-danger" type="button" data-host-action="delete" data-server-id="${this.escapeHtml(server.id)}" data-server-name="${this.escapeHtml(server.displayName || server.name)}">Löschen</button>
          </div>
        </article>
      `;
    }).join('');
  },

  updateHostedServerListSelection(status = this.hostedServerStatus || {}) {
    const activeId = status.activeServerId || this.activeHostedServerId || '';
    document.querySelectorAll('#hosted-server-list .hosted-server-card').forEach((card) => {
      card.classList.toggle('active', card.getAttribute('data-server-id') === activeId);
    });
  },

  renderOracleVmList(status = this.hostedServerStatus || {}) {
    const list = document.getElementById('oracle-vm-list');
    if (!list) return;
    const vms = status.cloudInstances || [];
    list.innerHTML = vms.length
      ? vms.map((vm) => `<div class="hosting-vm-row"><strong>${this.escapeHtml(vm.displayName)}</strong><span>${this.escapeHtml(vm.lifecycleState)} · ${this.escapeHtml(vm.shape || '')}</span></div>`).join('')
      : '<p class="mods-empty">Keine bestehenden X-Launcher-VMs erkannt.</p>';
  },

  renderHostingConsole(status = this.hostedServerStatus || {}) {
    const consoleEl = document.getElementById('hosted-server-console');
    if (!consoleEl) return;
    const output = status.consoleOutput || 'Noch keine Logs geladen.';
    const query = String(this.hostingConsoleSearch || '').trim().toLowerCase();
    const text = query
      ? output.split(/\r?\n/u).filter((line) => line.toLowerCase().includes(query)).join('\n')
      : output;
    consoleEl.textContent = text || `Keine Konsolenzeile gefunden für "${this.hostingConsoleSearch}".`;
    consoleEl.scrollTop = consoleEl.scrollHeight;
  },

  renderHostingPlayers(status = this.hostedServerStatus || {}) {
    const list = document.getElementById('hosting-player-list');
    const summary = document.getElementById('hosting-players-summary');
    if (!list) return;
    const players = status.playerDetails || [];
    if (summary) summary.textContent = `${status.players?.online ?? players.length} online · ${status.players?.max || status.activeServer?.maxPlayers || 0} Slots`;
    list.innerHTML = players.length
      ? players.map((player) => `<article class="hosting-player-card"><div class="hosting-player-avatar">${this.escapeHtml((player.name || '?')[0].toUpperCase())}</div><div class="hosting-player-main"><span class="hosting-player-name">${this.escapeHtml(player.name)}</span><span class="hosting-player-meta">Online</span></div></article>`).join('')
      : '<p class="hosting-empty-state">Keine Spieler online.</p>';
  },

  renderHostingFiles(status = this.hostedServerStatus || {}) {
    const list = document.getElementById('hosting-file-list');
    if (!list) return;
    const files = status.files || [];
    const mods = status.mods || [];
    const jobs = status.jobs || [];
    list.innerHTML = [
      ...mods.map((mod) => `<div class="hosting-history-item"><span>Plugin: ${this.escapeHtml(mod.fileName || mod.name)}</span><button class="btn btn-secondary" type="button" data-host-mod-action="delete" data-mod-file="${this.escapeHtml(mod.fileName || mod.name)}">Löschen</button></div>`),
      ...files.slice(0, 80).map((file) => `<div class="hosting-history-item"><span>${this.escapeHtml(file.name)}</span><span>Lokal</span></div>`),
      ...jobs.slice(-8).reverse().map((job) => `<div class="hosting-history-item"><span>${this.escapeHtml(job.message)}</span><span>${this.escapeHtml(new Date(job.at).toLocaleTimeString())}</span></div>`)
    ].join('') || '<p class="hosting-empty-state">Noch keine Dateien geladen.</p>';
  },

  resetHostedServerForm() {
    this.fillHostedServerForm({
      displayName: '',
      minecraftVersion: 'latest',
      javaVersion: 21,
      ramGb: 4,
      port: 25565,
      maxPlayers: 20,
      gamemode: 'survival',
      difficulty: 'normal',
      pvp: true,
      onlineMode: true,
      allowNether: true,
      allowEnd: true,
      viewDistance: 10,
      simulationDistance: 10,
      spawnProtection: 16
    });
  },

  openHostedServerCreateForm() {
    this.activeHostedServerId = '';
    this.hostedServerFormMode = 'create';
    this.resetHostedServerForm();
    this.updateHostedServerEditorMode();
    document.getElementById('hosted-server-name-input')?.focus();
  },

  closeHostedServerEditor() {
    this.hostedServerFormMode = this.activeHostedServerId ? 'edit' : 'hidden';
    this.fillHostedServerForm(this.hostedServerStatus?.activeServer || {});
    this.updateHostedServerEditorMode();
  },

  async saveOracleHostingCredentials() {
    const credentials = {
      ociConfig: document.getElementById('oracle-config-input')?.value.trim() || '',
      tenancyOcid: document.getElementById('oracle-tenancy-input')?.value.trim() || '',
      userOcid: document.getElementById('oracle-user-input')?.value.trim() || '',
      fingerprint: document.getElementById('oracle-fingerprint-input')?.value.trim() || '',
      region: document.getElementById('oracle-region-input')?.value.trim() || 'eu-zurich-1',
      compartmentOcid: document.getElementById('oracle-compartment-input')?.value.trim() || '',
      privateKey: document.getElementById('oracle-private-key-input')?.value.trim() || '',
      sshUsername: document.getElementById('oracle-ssh-user-input')?.value.trim() || 'ubuntu'
    };
    this.showLoading('Verbinde Oracle Cloud...', { progress: 20 });
    try {
      const result = await window.electronAPI.saveOracleHostingCredentials(credentials);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      document.getElementById('oracle-private-key-input').value = '';
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Oracle Cloud verbunden.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  },

  async loginOracleCloud() {
    if (typeof window.electronAPI?.loginOracleCloud !== 'function') {
      this.showNotification('Oracle-Anmeldung ist nicht verfügbar.');
      return;
    }
    this.showLoading('Oracle-Anmeldung wird im Browser geöffnet...', { progress: 20 });
    try {
      const result = await window.electronAPI.loginOracleCloud({ region: 'eu-zurich-1' });
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Mit Oracle Cloud angemeldet.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  },

  async logoutOracleCloud() {
    if (typeof window.electronAPI?.logoutOracleCloud !== 'function') {
      return;
    }
    const confirmed = await this.showConfirm({
      title: 'Oracle abmelden',
      message: 'Oracle Cloud wirklich aus diesem Launcher abmelden?',
      confirmText: 'Abmelden'
    });
    if (!confirmed) {
      return;
    }
    try {
      const result = await window.electronAPI.logoutOracleCloud();
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Oracle Cloud abgemeldet.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  },

  async createHostedServer() {
    const options = this.getHostedServerOptionsFromUI();
    if (!options.name) {
      this.showNotification('Bitte gib einen Servernamen ein.');
      return;
    }
    if (!options.acceptEula) {
      this.showNotification('Bitte akzeptiere die Minecraft EULA.');
      return;
    }
    this.showLoading('Oracle-VM wird erstellt und Minecraft wird eingerichtet...', { progress: 10 });
    try {
      const result = await window.electronAPI.createHostedServer(options);
      if (!result.success) {
        this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.hostedServerFormMode = 'edit';
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Server wurde erstellt.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  },

  async saveHostedServer(options = {}) {
    if (!this.activeHostedServerId) {
      if (!options.silent) this.showNotification('Bitte öffne zuerst einen Server.');
      return;
    }
    try {
      const result = await window.electronAPI.saveHostedServer(this.getHostedServerOptionsFromUI());
      if (!result.success) {
        if (!options.silent) this.showNotification('Fehler: ' + result.error);
        return;
      }
      this.updateHostedServerStatus(result);
      if (!options.silent) this.showNotification(result.message || 'Server gespeichert.');
    } catch (error) {
      if (!options.silent) this.showNotification('Fehler: ' + error.message);
    }
  },

  async handleHostedServerListClick(event) {
    const button = event.target?.closest?.('[data-host-action]');
    const card = event.target?.closest?.('.hosted-server-card');
    if (!button && !card) return;
    const serverId = button?.getAttribute('data-server-id') || card?.getAttribute('data-server-id') || '';
    const action = button?.getAttribute('data-host-action') || 'select';
    if (action === 'delete') {
      const confirmed = await this.showConfirm({ title: 'Cloud-Server löschen', message: 'VM und Minecraft-Server wirklich löschen?', confirmText: 'Löschen' });
      if (!confirmed) return;
      const result = await window.electronAPI.deleteHostedServer(serverId);
      if (!result.success) return this.showNotification('Fehler: ' + result.error);
      this.hostedServerFormMode = 'hidden';
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Server gelöscht.');
      return;
    }
    const result = await window.electronAPI.selectHostedServer(serverId);
    if (!result.success) return this.showNotification('Fehler: ' + result.error);
    this.hostedServerFormMode = 'edit';
    this.updateHostedServerStatus(result);
  },

  async runHostedServerAction(action) {
    if (!this.activeHostedServerId) return this.showNotification('Bitte öffne zuerst einen Server.');
    const label = action === 'start' ? 'startet' : (action === 'stop' ? 'stoppt' : 'wird neu gestartet');
    this.showLoading(`Server ${label}...`, { progress: 20 });
    try {
      const apiCall = action === 'start'
        ? window.electronAPI.startHostedServer(this.getHostedServerOptionsFromUI())
        : (action === 'stop'
          ? window.electronAPI.stopHostedServer(this.activeHostedServerId)
          : window.electronAPI.restartHostedServer(this.getHostedServerOptionsFromUI()));
      const result = await apiCall;
      if (!result.success) return this.showNotification('Fehler: ' + result.error);
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'Aktion abgeschlossen.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    } finally {
      this.hideLoading();
    }
  },

  startHostedServer() { return this.runHostedServerAction('start'); },
  stopHostedServer() { return this.runHostedServerAction('stop'); },
  restartHostedServer() { return this.runHostedServerAction('restart'); },

  async runHostedVmAction(action) {
    if (!this.activeHostedServerId) return this.showNotification('Bitte öffne zuerst einen Server.');
    try {
      const result = await window.electronAPI.hostedServerVmAction(this.activeHostedServerId, action);
      if (!result.success) return this.showNotification('Fehler: ' + result.error);
      this.updateHostedServerStatus(result);
      this.showNotification(result.message || 'VM-Aktion abgeschlossen.');
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  },

  async deleteActiveHostedServer() {
    if (!this.activeHostedServerId) return this.showNotification('Bitte öffne zuerst einen Server.');
    const confirmed = await this.showConfirm({ title: 'Cloud-Server löschen', message: 'Diese Aktion beendet und löscht die Oracle-VM.', confirmText: 'Löschen' });
    if (!confirmed) return;
    const result = await window.electronAPI.deleteHostedServer(this.activeHostedServerId);
    if (!result.success) return this.showNotification('Fehler: ' + result.error);
    this.hostedServerFormMode = 'hidden';
    this.updateHostedServerStatus(result);
    this.showNotification(result.message || 'Server gelöscht.');
  },

  async sendHostedServerCommand() {
    const input = document.getElementById('hosted-server-command-input');
    const command = input?.value.trim() || '';
    if (!command) return this.showNotification('Bitte gib einen Befehl ein.');
    try {
      const result = await window.electronAPI.sendHostedServerCommand(this.activeHostedServerId, command);
      if (!result.success) return this.showNotification('Fehler: ' + result.error);
      if (input) input.value = '';
      this.updateHostedServerStatus(result);
    } catch (error) {
      this.showNotification('Fehler: ' + error.message);
    }
  },

  async importHostedServerMods(event) {
    const files = Array.from(event.target?.files || []).map((file) => window.electronAPI.getPathForFile(file)).filter(Boolean);
    if (!files.length) return;
    const result = await window.electronAPI.importHostedServerMods(files);
    if (!result.success) return this.showNotification('Fehler: ' + result.error);
    this.updateHostedServerStatus(result);
    this.showNotification(result.message || 'Plugins hochgeladen.');
  },

  async createHostedServerBackup() {
    const result = await window.electronAPI.createHostedServerBackup();
    if (!result.success) return this.showNotification('Fehler: ' + result.error);
    this.updateHostedServerStatus(result);
    this.showNotification(result.message || 'Backup erstellt.');
  },

  async restoreHostedServerBackup() {
    const fileName = document.getElementById('hosting-backup-restore-input')?.value.trim() || '';
    if (!fileName) return this.showNotification('Bitte Backup-Dateiname eingeben.');
    const result = await window.electronAPI.restoreHostedServerBackup(fileName);
    if (!result.success) return this.showNotification('Fehler: ' + result.error);
    this.updateHostedServerStatus(result);
    this.showNotification(result.message || 'Backup wiederhergestellt.');
  },

  async openHostedServerFolder() {
    const result = await window.electronAPI.openHostedServerFolder();
    if (!result.success) return this.showNotification('Fehler: ' + result.error);
    this.showNotification(`Hosting-Ordner geöffnet: ${result.path}`);
  }
});

const launcher = new MinecraftLauncher();
window.launcher = launcher;

window.addEventListener('load', () => {
  const activeColor = localStorage.getItem('primaryColor') || '#00d9ff';
  document.querySelectorAll('.color-btn').forEach((btn) => {
    if (btn.getAttribute('data-color') === activeColor) {
      btn.classList.add('active');
    }
  });
});
