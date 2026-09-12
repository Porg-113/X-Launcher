const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const dgram = require('dgram');
const { spawn, spawnSync } = require('child_process');

function createLocalDirectHostingBackend({ configDir, robustness, logger, shell }) {
  const ROOT_DIR = path.join(configDir, 'local-hosting');
  const SERVERS_DIR = path.join(ROOT_DIR, 'servers');
  const TOOLS_DIR = path.join(ROOT_DIR, 'tools');
  const JAVA_DIR = path.join(TOOLS_DIR, 'java21');
  const STATE_FILE = path.join(ROOT_DIR, 'state.json');
  const runtimeByServerId = new Map();
  const connectionByServerId = new Map();
  const PUBLIC_PORT = 25565;

  function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
  }

  function readJson(file, fallback) {
    try {
      if (robustness?.readJsonFile) return robustness.readJsonFile(file, fallback);
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeJson(file, value) {
    ensureDir(path.dirname(file));
    if (robustness?.writeJsonFileAtomic) {
      robustness.writeJsonFileAtomic(file, value, { label: 'local-direct-hosting' });
      return;
    }
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
  }

  function defaultState() {
    return { activeServerId: '', servers: [], jobs: [] };
  }

  function readState() {
    const state = readJson(STATE_FILE, defaultState());
    return {
      ...defaultState(),
      ...state,
      servers: Array.isArray(state.servers) ? state.servers : [],
      jobs: Array.isArray(state.jobs) ? state.jobs.slice(-80) : []
    };
  }

  function writeState(state) {
    const next = { ...defaultState(), ...state, updatedAt: new Date().toISOString() };
    writeJson(STATE_FILE, next);
    return next;
  }

  function addJob(message, type = 'info') {
    const state = readState();
    state.jobs.push({ id: crypto.randomUUID(), message, type, at: new Date().toISOString() });
    writeState(state);
  }

  function sanitizeName(value) {
    return String(value || 'server')
      .trim()
      .replace(/[^a-z0-9 _.-]/giu, '-')
      .replace(/\s+/gu, '-')
      .replace(/-+/gu, '-')
      .replace(/^-|-$/gu, '')
      .slice(0, 36) || 'server';
  }

  function normalizeBool(value, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
  }

  function normalizeServer(raw = {}) {
    const id = String(raw.id || raw.serverId || crypto.randomBytes(7).toString('hex')).replace(/[^\w.-]/gu, '');
    const name = sanitizeName(raw.name || raw.displayName || 'Survival');
    const port = Math.max(1024, Math.min(65535, Math.round(Number(raw.port) || 25565)));
    return {
      id,
      name,
      displayName: String(raw.displayName || raw.name || name).trim().slice(0, 48) || name,
      minecraftVersion: String(raw.minecraftVersion || 'latest').trim() || 'latest',
      ramGb: Math.max(1, Math.min(16, Math.round(Number(raw.ramGb) || 4))),
      port,
      maxPlayers: Math.max(1, Math.min(100, Math.round(Number(raw.maxPlayers) || 20))),
      motd: String(raw.motd || 'X Client Server').trim().slice(0, 120),
      seed: String(raw.seed || '').trim().slice(0, 80),
      gamemode: ['survival', 'creative', 'adventure', 'spectator'].includes(String(raw.gamemode || '').toLowerCase()) ? String(raw.gamemode).toLowerCase() : 'survival',
      difficulty: ['peaceful', 'easy', 'normal', 'hard'].includes(String(raw.difficulty || '').toLowerCase()) ? String(raw.difficulty).toLowerCase() : 'normal',
      pvp: normalizeBool(raw.pvp, true),
      whitelist: normalizeBool(raw.whitelist, false),
      onlineMode: normalizeBool(raw.onlineMode, true),
      enableCommandBlock: normalizeBool(raw.enableCommandBlock, false),
      hardcore: normalizeBool(raw.hardcore, false),
      allowNether: normalizeBool(raw.allowNether, true),
      allowEnd: normalizeBool(raw.allowEnd, true),
      viewDistance: Math.max(2, Math.min(32, Math.round(Number(raw.viewDistance) || 10))),
      simulationDistance: Math.max(2, Math.min(32, Math.round(Number(raw.simulationDistance) || 10))),
      spawnProtection: Math.max(0, Math.min(64, Math.round(Number(raw.spawnProtection) || 16))),
      createdAt: String(raw.createdAt || new Date().toISOString()),
      updatedAt: new Date().toISOString(),
      installedAt: String(raw.installedAt || ''),
      resolvedMinecraftVersion: String(raw.resolvedMinecraftVersion || ''),
      publicAddress: String(raw.publicAddress || ''),
      customDomain: String(raw.customDomain || '').trim().toLowerCase().replace(/^https?:\/\//u, '').replace(/\/.*$/u, '').slice(0, 253)
    };
  }

  function findServer(state, serverId = '') {
    const id = String(serverId || state.activeServerId || '').trim();
    return state.servers.find((server) => server.id === id) || state.servers[0] || null;
  }

  function getServerDir(server) {
    return path.join(SERVERS_DIR, `${server.name}-${server.id}`);
  }

  function getLogPath(server) {
    return path.join(getServerDir(server), 'server.log');
  }

  function getPluginsDir(server) {
    return path.join(getServerDir(server), 'plugins');
  }

  function httpsJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const request = https.get(url, { headers: { 'User-Agent': 'XClient/1.3.1 (local Minecraft hosting; https://github.com/Porg-113/X-Launcher)', ...headers } }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk.toString(); });
        res.on('end', () => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            httpsJson(new URL(res.headers.location, url).toString(), headers).then(resolve, reject);
            return;
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${url}`));
            return;
          }
          try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
        });
      });
      request.setTimeout(12000, () => request.destroy(new Error(`Zeitüberschreitung: ${url}`)));
      request.on('error', reject);
    });
  }

  function downloadFile(url, destination) {
    ensureDir(path.dirname(destination));
    return new Promise((resolve, reject) => {
      const request = https.get(url, { headers: { 'User-Agent': 'XClient/1.3.1 (local Minecraft hosting; https://github.com/Porg-113/X-Launcher)' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadFile(new URL(res.headers.location, url).toString(), destination).then(resolve, reject);
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Download fehlgeschlagen (${res.statusCode})`));
          return;
        }
        const out = fs.createWriteStream(destination);
        res.pipe(out);
        out.on('finish', () => out.close(resolve));
        out.on('error', reject);
      });
      request.on('error', reject);
    });
  }

  function getSystemJavaPath() {
    const check = spawnSync('java', ['-version'], { encoding: 'utf8', windowsHide: true });
    if (!check.error && check.status === 0) return 'java';
    return '';
  }

  async function ensureJavaPath() {
    const systemJava = getSystemJavaPath();
    if (systemJava) return systemJava;
    const javaExe = findJavaInDir(JAVA_DIR);
    if (javaExe) return javaExe;
    ensureDir(JAVA_DIR);
    const zipPath = path.join(TOOLS_DIR, 'temurin-jre-21.zip');
    await downloadFile('https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse', zipPath);
    const expanded = spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath ${JSON.stringify(zipPath)} -DestinationPath ${JSON.stringify(JAVA_DIR)} -Force`], {
      encoding: 'utf8',
      windowsHide: true
    });
    if (expanded.status !== 0) {
      throw new Error('Java konnte nicht automatisch entpackt werden.');
    }
    const managedJava = findJavaInDir(JAVA_DIR);
    if (!managedJava) {
      throw new Error('Java wurde heruntergeladen, aber java.exe wurde nicht gefunden.');
    }
    return managedJava;
  }

  function findJavaInDir(dir) {
    if (!fs.existsSync(dir)) return '';
    const stack = [dir];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        if (entry.isFile() && entry.name.toLowerCase() === 'java.exe' && full.toLowerCase().includes(`${path.sep}bin${path.sep}`)) {
          return full;
        }
      }
    }
    return '';
  }

  async function resolvePaper(version) {
    const project = await httpsJson('https://fill.papermc.io/v3/projects/paper');
    const versions = Object.values(project.versions || {}).flat();
    const requestedVersion = String(version || '').toLowerCase() === 'latest'
      ? versions[0]
      : version;
    const candidates = requestedVersion
      ? [requestedVersion, ...versions.filter((entry) => entry !== requestedVersion)]
      : versions;

    for (const minecraftVersion of candidates) {
      const builds = await httpsJson(`https://fill.papermc.io/v3/projects/paper/versions/${minecraftVersion}/builds`);
      const stable = (Array.isArray(builds) ? builds : [])
        .find((entry) => entry.channel === 'STABLE' && entry.downloads?.['server:default']?.url);
      const fallback = (Array.isArray(builds) ? builds : [])
        .find((entry) => entry.downloads?.['server:default']?.url);
      const build = stable || fallback;
      if (build?.downloads?.['server:default']?.url) {
        return {
          minecraftVersion,
          build: build.id || build.number || '',
          url: build.downloads['server:default'].url
        };
      }
    }

    throw new Error('Kein Paper-Download gefunden.');
  }

  function writeServerFiles(server) {
    const dir = getServerDir(server);
    ensureDir(dir);
    ensureDir(getPluginsDir(server));
    fs.writeFileSync(path.join(dir, 'eula.txt'), 'eula=true\n', 'utf8');
    const props = {
      'server-port': server.port,
      motd: server.motd || server.displayName,
      'max-players': server.maxPlayers,
      'level-seed': server.seed,
      gamemode: server.gamemode,
      difficulty: server.difficulty,
      pvp: server.pvp,
      'white-list': server.whitelist,
      'online-mode': server.onlineMode,
      'enable-command-block': server.enableCommandBlock,
      hardcore: server.hardcore,
      'allow-nether': server.allowNether,
      'allow-end': server.allowEnd,
      'view-distance': server.viewDistance,
      'simulation-distance': server.simulationDistance,
      'spawn-protection': server.spawnProtection
    };
    fs.writeFileSync(path.join(dir, 'server.properties'), Object.entries(props).map(([key, value]) => `${key}=${value}`).join('\n'), 'utf8');
  }

  async function ensurePaperJar(server) {
    const jar = path.join(getServerDir(server), 'server.jar');
    if (fs.existsSync(jar)) return server.resolvedMinecraftVersion || server.minecraftVersion;
    const paper = await resolvePaper(server.minecraftVersion);
    await downloadFile(paper.url, jar);
    return paper.minecraftVersion;
  }

  async function createHostedServer(options = {}) {
    const state = readState();
    const server = normalizeServer(options);
    if (state.servers.some((entry) => entry.name.toLowerCase() === server.name.toLowerCase())) {
      return { success: false, error: 'Ein Server mit diesem Namen existiert bereits.' };
    }
    ensureDir(getServerDir(server));
    writeServerFiles(server);
    const resolvedMinecraftVersion = await ensurePaperJar(server);
    const nextServer = { ...server, resolvedMinecraftVersion, installedAt: new Date().toISOString() };
    writeState({ ...state, activeServerId: nextServer.id, servers: [...state.servers, nextServer] });
    addJob(`${nextServer.displayName} erstellt.`);
    return getHostedServerStatus({ message: 'Server erstellt.' });
  }

  async function saveHostedServer(options = {}) {
    const state = readState();
    const current = findServer(state, options.serverId);
    if (!current) return { success: false, error: 'Bitte zuerst einen Server auswählen.' };
    const next = normalizeServer({ ...current, ...options, id: current.id, createdAt: current.createdAt, installedAt: current.installedAt, resolvedMinecraftVersion: current.resolvedMinecraftVersion });
    writeServerFiles(next);
    writeState({ ...state, activeServerId: next.id, servers: state.servers.map((server) => server.id === next.id ? next : server) });
    return getHostedServerStatus({ message: 'Server gespeichert.' });
  }

  async function selectHostedServer(serverId) {
    const state = readState();
    const server = findServer(state, serverId);
    if (!server) return { success: false, error: 'Server wurde nicht gefunden.' };
    writeState({ ...state, activeServerId: server.id });
    return getHostedServerStatus({ message: `${server.displayName} geöffnet.` });
  }

  async function startHostedServer(options = {}) {
    const saved = await saveHostedServer(options);
    if (!saved.success) return saved;
    const server = findServer(readState(), saved.activeServerId);
    if (runtimeByServerId.has(server.id)) return getHostedServerStatus({ message: 'Server läuft bereits.' });
    const otherRunningServer = [...runtimeByServerId.keys()].find((serverId) => serverId !== server.id);
    if (otherRunningServer) {
      return { success: false, error: 'Du kannst mehrere Server speichern, aber über die direkte Adresse 25565 immer nur einen gleichzeitig starten.' };
    }
    const javaPath = await ensureJavaPath();
    const resolvedMinecraftVersion = await ensurePaperJar(server);
    const dir = getServerDir(server);
    const log = fs.createWriteStream(getLogPath(server), { flags: 'a' });
    log.write(`\n[${new Date().toISOString()}] Starting Paper ${resolvedMinecraftVersion}\n`);
    const child = spawn(javaPath, [`-Xms1G`, `-Xmx${server.ramGb}G`, '-jar', 'server.jar', 'nogui'], {
      cwd: dir,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    runtimeByServerId.set(server.id, { process: child, startedAt: Date.now(), log });
    child.stdout.on('data', (chunk) => log.write(chunk));
    child.stderr.on('data', (chunk) => log.write(chunk));
    child.on('exit', () => {
      log.end();
      runtimeByServerId.delete(server.id);
      connectionByServerId.delete(server.id);
    });
    addJob(`${server.displayName} gestartet.`);
    const connection = await configureDirectConnection(server);
    scheduleExternalReachabilityCheck(server.id);
    return getHostedServerStatus({ message: connection.message });
  }

  function stopServerProcess(serverId) {
    const runtime = runtimeByServerId.get(serverId);
    if (!runtime) return false;
    try { runtime.process.stdin.write('stop\n'); } catch (_error) { runtime.process.kill(); }
    setTimeout(() => {
      if (runtimeByServerId.has(serverId)) {
        try { runtime.process.kill(); } catch (_error) {}
      }
    }, 9000);
    return true;
  }

  async function stopHostedServer(serverId = '') {
    const server = findServer(readState(), serverId);
    if (!server) return { success: false, error: 'Server wurde nicht gefunden.' };
    connectionByServerId.delete(server.id);
    stopServerProcess(server.id);
    addJob(`${server.displayName} gestoppt.`);
    return getHostedServerStatus({ message: 'Server wird gestoppt.', stopping: true });
  }

  async function restartHostedServer(options = {}) {
    const state = readState();
    const server = findServer(state, options.serverId);
    if (server) stopServerProcess(server.id);
    await new Promise((resolve) => setTimeout(resolve, 1800));
    return startHostedServer(options);
  }

  async function deleteHostedServer(serverId = '') {
    const state = readState();
    const server = findServer(state, serverId);
    if (!server) return { success: false, error: 'Server wurde nicht gefunden.' };
    connectionByServerId.delete(server.id);
    stopServerProcess(server.id);
    const dir = getServerDir(server);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    const servers = state.servers.filter((entry) => entry.id !== server.id);
    writeState({ ...state, servers, activeServerId: servers[0]?.id || '' });
    return getHostedServerStatus({ message: 'Server gelöscht.' });
  }

  function readConsole(server) {
    try {
      if (!server || !fs.existsSync(getLogPath(server))) return 'Noch keine Logs.';
      return fs.readFileSync(getLogPath(server), 'utf8').slice(-24000);
    } catch (_error) {
      return 'Logs konnten nicht gelesen werden.';
    }
  }

  function parsePlayers(output) {
    const line = String(output || '').split(/\r?\n/u).reverse().find((entry) => /There are \d+ of a max of \d+ players online:/iu.test(entry));
    if (!line) return { online: 0, max: 0, names: [] };
    const match = line.match(/There are (\d+) of a max of (\d+) players online:\s*(.*)$/iu);
    const names = String(match?.[3] || '').split(',').map((name) => name.trim()).filter(Boolean);
    return { online: Number(match?.[1] || 0), max: Number(match?.[2] || 0), names };
  }

  function processStats(server) {
    const runtime = server ? runtimeByServerId.get(server.id) : null;
    if (!runtime?.process?.pid || process.platform !== 'win32') return { cpu: '', memory: '' };
    const pid = runtime.process.pid;
    try {
      const ps = spawnSync('powershell', ['-NoProfile', '-Command', `$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if($p){[math]::Round($p.WorkingSet64/1MB).ToString()+' MB|'+[math]::Round($p.CPU).ToString()+'s'}`], { encoding: 'utf8', windowsHide: true });
      const [memory, cpu] = String(ps.stdout || '').trim().split('|');
      return { memory: memory || '', cpu: cpu || '' };
    } catch (_error) {
      return { cpu: '', memory: '' };
    }
  }

  function isValidIpv4(value = '') {
    const parts = String(value).trim().split('.').map(Number);
    return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
  }

  function isPublicIpv4(value = '') {
    if (!isValidIpv4(value)) return false;
    const [a, b, c] = value.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || a === 100 && b >= 64 && b <= 127
      || a === 169 && b === 254
      || a === 172 && b >= 16 && b <= 31
      || a === 192 && b === 0 && c === 0
      || a === 192 && b === 0 && c === 2
      || a === 192 && b === 168
      || a === 198 && (b === 18 || b === 19)
      || a === 198 && b === 51 && c === 100
      || a === 203 && b === 0 && c === 113);
  }

  function getLocalLanIpv4() {
    for (const entries of Object.values(os.networkInterfaces())) {
      const address = (entries || []).find((entry) => entry.family === 'IPv4' && !entry.internal)?.address;
      if (address) return address;
    }
    return '';
  }

  function getRouterSettingsUrl() {
    if (process.platform !== 'win32') return '';
    try {
      const result = spawnSync('powershell', ['-NoProfile', '-Command',
        "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1 -ExpandProperty NextHop)"
      ], { encoding: 'utf8', windowsHide: true, timeout: 4000 });
      const gateway = String(result.stdout || '').trim();
      return isValidIpv4(gateway) ? `http://${gateway}/#network/settings/port-forwarding` : '';
    } catch (_error) {
      return '';
    }
  }

  async function fetchPublicIpv4() {
    for (const [url, field] of [
      ['https://api.ipify.org?format=json', 'ip'],
      ['https://api4.my-ip.io/v2/ip.json', 'ip']
    ]) {
      try {
        const result = await httpsJson(url);
        const ip = String(result?.[field] || '').trim();
        if (isPublicIpv4(ip)) return ip;
      } catch (error) {
        logger?.warn?.('Could not determine public IPv4', { url, error: error.message || String(error) });
      }
    }
    return '';
  }

  function ensureWindowsFirewallRule(server) {
    if (process.platform !== 'win32') {
      return { attempted: false, success: false, reason: 'Die automatische Firewall-Regel ist nur unter Windows verfügbar.' };
    }
    const ruleName = `X Client Minecraft Java TCP ${server.port}`;
    const existing = spawnSync('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${ruleName}`], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000
    });
    if (existing.status === 0 && /Enabled:\s+Yes|Aktiviert:\s+Ja/iu.test(String(existing.stdout || ''))) {
      return { attempted: false, success: true, port: server.port, output: String(existing.stdout || ''), reason: '' };
    }
    const netshArgs = `advfirewall firewall add rule name="${ruleName}" dir=in action=allow protocol=TCP localport=${server.port} profile=any`;
    const elevationScript = `$process=Start-Process -FilePath netsh.exe -ArgumentList '${netshArgs.replace(/'/gu, "''")}' -Verb RunAs -Wait -PassThru; exit $process.ExitCode`;
    const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', elevationScript], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000
    });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    const success = result.status === 0 || /\b(?:ok|bereits|exists)\b/iu.test(output);
    return {
      attempted: true,
      success,
      port: server.port,
      output,
      reason: success ? '' : 'Die Firewall-Regel konnte nicht automatisch erstellt werden. Starte den Launcher einmal als Administrator.'
    };
  }

  function fetchText(url, options = {}) {
    return new Promise((resolve, reject) => {
      const transport = new URL(url).protocol === 'https:' ? https : http;
      const request = transport.request(url, options, (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk.toString(); });
        response.on('end', () => response.statusCode >= 200 && response.statusCode < 300
          ? resolve(body)
          : reject(new Error(`Router antwortete mit HTTP ${response.statusCode}.`)));
      });
      request.setTimeout(5000, () => request.destroy(new Error('Zeitüberschreitung bei der Router-Anfrage.')));
      request.on('error', reject);
      if (options.body) request.write(options.body);
      request.end();
    });
  }

  function discoverUpnpGateway() {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      let finished = false;
      const finish = (error, value) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try { socket.close(); } catch (_error) {}
        error ? reject(error) : resolve(value);
      };
      const timer = setTimeout(() => finish(new Error('Kein UPnP-Router im lokalen Netzwerk gefunden.')), 5000);
      socket.on('error', (error) => finish(error));
      socket.on('message', (message) => {
        const location = message.toString().match(/^location:\s*(.+)$/imu)?.[1]?.trim();
        if (location) finish(null, { location, localIp: socket.address().address });
      });
      socket.bind(0, () => {
        const requests = [
          'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
          'urn:schemas-upnp-org:service:WANIPConnection:1',
          'urn:schemas-upnp-org:service:WANPPPConnection:1'
        ];
        for (const searchTarget of requests) {
          const payload = Buffer.from(`M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ${searchTarget}\r\n\r\n`);
          socket.send(payload, 1900, '239.255.255.250');
        }
      });
    });
  }

  async function getUpnpService(gateway) {
    const xml = await fetchText(gateway.location);
    const serviceMatch = xml.match(/<service>[\s\S]*?<serviceType>\s*(urn:schemas-upnp-org:service:(?:WANIPConnection|WANPPPConnection):\d+)\s*<\/serviceType>[\s\S]*?<controlURL>\s*([^<]+)\s*<\/controlURL>[\s\S]*?<\/service>/iu);
    if (!serviceMatch) throw new Error('Der Router bietet keinen kompatiblen UPnP-WAN-Dienst an.');
    return {
      serviceType: serviceMatch[1],
      controlUrl: new URL(serviceMatch[2].trim(), gateway.location).toString(),
      localIp: gateway.localIp
    };
  }

  async function upnpSoap(service, action, content = '') {
    const body = `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${action} xmlns:u="${service.serviceType}">${content}</u:${action}></s:Body></s:Envelope>`;
    return fetchText(service.controlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        SOAPAction: `"${service.serviceType}#${action}"`,
        'Content-Length': Buffer.byteLength(body)
      },
      body
    });
  }

  async function ensureUpnpMapping(server) {
    let localIp = getLocalLanIpv4();
    try {
      const gateway = await discoverUpnpGateway();
      const service = await getUpnpService(gateway);
      localIp = service.localIp && service.localIp !== '0.0.0.0' ? service.localIp : localIp;
      if (!localIp || localIp === '0.0.0.0') throw new Error('Keine passende lokale IPv4-Adresse für den Router gefunden.');
      const externalResponse = await upnpSoap(service, 'GetExternalIPAddress');
      const wanIp = externalResponse.match(/<NewExternalIPAddress>\s*([^<]+)\s*<\/NewExternalIPAddress>/iu)?.[1]?.trim() || '';
      await upnpSoap(service, 'AddPortMapping', [
        '<NewRemoteHost></NewRemoteHost>',
        `<NewExternalPort>${PUBLIC_PORT}</NewExternalPort>`,
        '<NewProtocol>TCP</NewProtocol>',
        `<NewInternalPort>${server.port}</NewInternalPort>`,
        `<NewInternalClient>${localIp}</NewInternalClient>`,
        '<NewEnabled>1</NewEnabled>',
        '<NewPortMappingDescription>X Client Minecraft Java</NewPortMappingDescription>',
        '<NewLeaseDuration>0</NewLeaseDuration>'
      ].join(''));
      return { attempted: true, success: true, externalPort: PUBLIC_PORT, internalPort: server.port, localIp, wanIp, reason: '' };
    } catch (error) {
      return {
        attempted: true,
        success: false,
        externalPort: PUBLIC_PORT,
        internalPort: server.port,
        localIp,
        wanIp: '',
        output: error.message || String(error),
        reason: `UPnP-Portfreigabe fehlgeschlagen: ${error.message || String(error)}`
      };
    }
  }

  async function checkExternalMinecraftServer(publicIp) {
    if (!isPublicIpv4(publicIp)) return { attempted: false, reachable: false };
    try {
      const result = await httpsJson(`https://api.mcsrvstat.us/3/${publicIp}:${PUBLIC_PORT}`);
      return {
        attempted: true,
        reachable: Boolean(result?.online),
        checkedAt: Date.now(),
        reason: result?.online
          ? 'Der Minecraft-Java-Server ist von außen erreichbar.'
          : 'Der externe Test konnte den Minecraft-Java-Server nicht erreichen. Mögliche Ursachen sind deaktiviertes UPnP, eine Router-/Firewall-Sperre oder CGNAT/DS-Lite beim Internetanbieter.'
      };
    } catch (error) {
      return { attempted: true, reachable: false, checkedAt: Date.now(), reason: `Externer Erreichbarkeitstest fehlgeschlagen: ${error.message || String(error)}` };
    }
  }

  async function configureDirectConnection(server) {
    const firewall = ensureWindowsFirewallRule(server);
    const upnp = await ensureUpnpMapping(server);
    const publicIp = await fetchPublicIpv4();
    const routerWanIp = upnp.wanIp || '';
    const cgnatDetected = Boolean(routerWanIp && (!isPublicIpv4(routerWanIp) || routerWanIp !== publicIp));
    let error = '';
    if (!publicIp) {
      error = 'Keine öffentliche IPv4 erkannt. Bei CGNAT oder DS-Lite teilt der Anbieter keine direkt erreichbare IPv4 zu; eine direkte Verbindung ist dann nicht möglich.';
    } else if (cgnatDetected) {
      error = 'CGNAT oder Double NAT erkannt: Die WAN-Adresse des Routers stimmt nicht mit der öffentlichen IPv4 überein. Deshalb kann Port 25565 nicht direkt zu diesem PC weitergeleitet werden.';
    }
    const connection = {
      publicIp,
      address: publicIp ? `${publicIp}:${PUBLIC_PORT}` : '',
      firewall,
      upnp,
      routerWanIp,
      cgnatDetected,
      reachable: false,
      checking: Boolean(publicIp && !cgnatDetected),
      checkedAt: 0,
      error,
      routerSettingsUrl: getRouterSettingsUrl(),
      message: error || (upnp.success
        ? `Server gestartet. Port ${PUBLIC_PORT} TCP wurde per UPnP freigegeben.`
        : `Server gestartet. UPnP-Freigabe für Port ${PUBLIC_PORT} TCP ist fehlgeschlagen.`)
    };
    connectionByServerId.set(server.id, connection);
    addJob(connection.message, error ? 'warning' : 'info');
    return connection;
  }

  function scheduleExternalReachabilityCheck(serverId, attempt = 1) {
    setTimeout(async () => {
      const connection = connectionByServerId.get(serverId);
      if (!connection || connection.cgnatDetected || !connection.publicIp || !runtimeByServerId.has(serverId)) return;
      Object.assign(connection, await checkExternalMinecraftServer(connection.publicIp), { checking: false });
      addJob(connection.reason, connection.reachable ? 'info' : 'warning');
      if (!connection.reachable && attempt < 3 && runtimeByServerId.has(serverId)) {
        connection.checking = true;
        scheduleExternalReachabilityCheck(serverId, attempt + 1);
      }
    }, attempt === 1 ? 15000 : 20000);
  }

  async function sendHostedServerCommand(serverId = '', command = '') {
    const server = findServer(readState(), serverId);
    if (!server) return { success: false, error: 'Server wurde nicht gefunden.' };
    const runtime = runtimeByServerId.get(server.id);
    if (!runtime) return { success: false, error: 'Server läuft nicht.' };
    const clean = String(command || '').replace(/[\r\n]+/gu, ' ').trim();
    if (!clean) return { success: false, error: 'Bitte Befehl eingeben.' };
    runtime.process.stdin.write(`${clean}\n`);
    fs.appendFileSync(getLogPath(server), `\n> ${clean}\n`, 'utf8');
    return getHostedServerStatus({ message: `Befehl gesendet: ${clean}` });
  }

  async function importHostedServerMods(filePaths = []) {
    const server = findServer(readState());
    if (!server) return { success: false, error: 'Bitte zuerst einen Server auswählen.' };
    ensureDir(getPluginsDir(server));
    let count = 0;
    for (const source of Array.isArray(filePaths) ? filePaths : []) {
      if (!/\.jar$/iu.test(String(source || '')) || !fs.existsSync(source)) continue;
      fs.copyFileSync(source, path.join(getPluginsDir(server), path.basename(source).replace(/[^\w .+()[\]-]/gu, '_')));
      count += 1;
    }
    return getHostedServerStatus({ message: `${count} Plugin(s) hochgeladen.` });
  }

  async function removeHostedServerMod(fileName = '') {
    const server = findServer(readState());
    const safe = path.basename(String(fileName || ''));
    if (!server || !safe) return { success: false, error: 'Plugin wurde nicht gefunden.' };
    const target = path.join(getPluginsDir(server), safe);
    if (fs.existsSync(target)) fs.unlinkSync(target);
    return getHostedServerStatus({ message: 'Plugin gelöscht.' });
  }

  async function createBackup() {
    const server = findServer(readState());
    if (!server) return { success: false, error: 'Bitte zuerst einen Server auswählen.' };
    const backups = path.join(getServerDir(server), 'backups');
    ensureDir(backups);
    const name = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const destination = path.join(backups, name);
    fs.cpSync(getServerDir(server), destination, { recursive: true, filter: (src) => !src.includes(`${path.sep}backups${path.sep}`) });
    return getHostedServerStatus({ message: `Backup erstellt: ${name}` });
  }

  async function restoreBackup(name = '') {
    const server = findServer(readState());
    const safe = path.basename(String(name || ''));
    if (!server || !safe) return { success: false, error: 'Backup wurde nicht gefunden.' };
    const source = path.join(getServerDir(server), 'backups', safe);
    if (!fs.existsSync(source)) return { success: false, error: 'Backup wurde nicht gefunden.' };
    stopServerProcess(server.id);
    fs.cpSync(source, getServerDir(server), { recursive: true, force: true });
    return getHostedServerStatus({ message: 'Backup wiederhergestellt.' });
  }

  async function openHostedServerFolder() {
    const server = findServer(readState());
    const dir = server ? getServerDir(server) : ROOT_DIR;
    ensureDir(dir);
    const error = await shell.openPath(dir);
    return error ? { success: false, error } : { success: true, path: dir };
  }

  async function getHostedServerStatus(options = {}) {
    const state = readState();
    const activeServer = findServer(state);
    const running = activeServer ? runtimeByServerId.has(activeServer.id) : false;
    const connection = activeServer ? connectionByServerId.get(activeServer.id) : null;
    const logs = readConsole(activeServer);
    const players = parsePlayers(logs);
    const stats = processStats(activeServer);
    const files = activeServer && fs.existsSync(getServerDir(activeServer))
      ? fs.readdirSync(getServerDir(activeServer)).map((name) => ({ name }))
      : [];
    const mods = activeServer && fs.existsSync(getPluginsDir(activeServer))
      ? fs.readdirSync(getPluginsDir(activeServer)).filter((name) => name.endsWith('.jar')).map((fileName) => ({ fileName, name: fileName, size: fs.statSync(path.join(getPluginsDir(activeServer), fileName)).size }))
      : [];
    const address = running ? (connection?.address || '') : '';
    const publiclyReachable = Boolean(running && connection?.reachable && !connection?.cgnatDetected);
    const servers = state.servers.map((server) => ({
      ...server,
      running: runtimeByServerId.has(server.id),
      publiclyReachable: Boolean(runtimeByServerId.has(server.id) && connectionByServerId.get(server.id)?.reachable),
      visibleAddress: runtimeByServerId.has(server.id)
        ? (connectionByServerId.get(server.id)?.address || `localhost:${server.port}`)
        : `localhost:${server.port}`
    }));
    return {
      success: true,
      activeServerId: activeServer?.id || '',
      activeServer: activeServer ? {
        ...activeServer,
        running,
        publiclyReachable,
        visibleAddress: address || `localhost:${activeServer.port}`
      } : null,
      servers,
      running,
      installed: Boolean(activeServer?.installedAt),
      publiclyReachable,
      address,
      publicAddress: address,
      publicIp: connection?.publicIp || '',
      publicPort: PUBLIC_PORT,
      connectionChecking: Boolean(connection?.checking),
      connectionError: connection?.error || '',
      cgnatDetected: Boolean(connection?.cgnatDetected),
      firewall: connection?.firewall || null,
      upnp: connection?.upnp || null,
      routerSettingsUrl: connection?.routerSettingsUrl || '',
      externalCheck: connection ? {
        attempted: Boolean(connection.checkedAt),
        reachable: Boolean(connection.reachable),
        reason: connection.reason || ''
      } : null,
      localAddress: activeServer ? `localhost:${activeServer.port}` : '',
      players,
      playerDetails: players.names.map((name) => ({ name })),
      resources: { cpu: stats.cpu || '0s', memory: stats.memory || '0 MB' },
      consoleOutput: logs,
      files,
      mods,
      jobs: state.jobs,
      stopping: Boolean(options.stopping),
      message: options.message || ''
    };
  }

  return {
    getHostedServerStatus,
    createHostedServer,
    saveHostedServer,
    selectHostedServer,
    startHostedServer,
    stopHostedServer,
    restartHostedServer,
    deleteHostedServer,
    sendHostedServerCommand,
    importHostedServerMods,
    removeHostedServerMod,
    createBackup,
    restoreBackup,
    openHostedServerFolder,
    openHostedServerModsFolder: openHostedServerFolder,
    configureDirectConnection: async (serverId) => {
      const server = findServer(readState(), serverId);
      if (!server) return { success: false, error: 'Server wurde nicht gefunden.' };
      if (!runtimeByServerId.has(server.id)) return startHostedServer({ ...server, serverId: server.id });
      await configureDirectConnection(server);
      scheduleExternalReachabilityCheck(server.id);
      return getHostedServerStatus({ message: 'Direkte öffentliche Verbindung wird geprüft.' });
    }
  };
}

module.exports = createLocalDirectHostingBackend;
