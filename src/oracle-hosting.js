const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const https = require('https');
const net = require('net');

function createOracleHostingBackend({ configDir, robustness, logger, shell, safeStorage }) {
  const ROOT_DIR = path.join(configDir, 'oracle-hosting');
  const STATE_FILE = path.join(ROOT_DIR, 'state.json');
  const CREDENTIALS_FILE = path.join(ROOT_DIR, 'credentials.json');
  const OCI_CONFIG_FILE = path.join(ROOT_DIR, 'oci-config');
  const OCI_KEY_FILE = path.join(ROOT_DIR, 'oci-api-key.pem');
  const OCI_SESSION_PROFILE = 'X_LAUNCHER';
  const SSH_KEY_FILE = path.join(ROOT_DIR, 'oracle-minecraft-key');
  const SSH_PUBLIC_KEY_FILE = `${SSH_KEY_FILE}.pub`;
  const REMOTE_ROOT = '/opt/x-launcher-minecraft';
  const DEFAULT_SHAPE = 'VM.Standard.A1.Flex';
  const DEFAULT_IMAGE_OS = 'Canonical Ubuntu';
  const DEFAULT_IMAGE_VERSION = '22.04';
  const DEFAULT_REGION = 'eu-zurich-1';

  function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
  }

  function readJson(filePath, fallback) {
    try {
      if (robustness?.readJsonFile) {
        return robustness.readJsonFile(filePath, fallback);
      }
      return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback;
    } catch (error) {
      logger?.warn?.('Oracle hosting json read failed', { filePath, error: error.message });
      return fallback;
    }
  }

  function writeJson(filePath, value) {
    ensureDir(path.dirname(filePath));
    if (robustness?.writeJsonFileAtomic) {
      robustness.writeJsonFileAtomic(filePath, value, { label: 'oracle-hosting' });
      return;
    }
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  }

  function encryptText(value) {
    const text = String(value || '');
    if (!text) {
      return '';
    }
    if (safeStorage?.isEncryptionAvailable?.()) {
      return `safe:${safeStorage.encryptString(text).toString('base64')}`;
    }
    return `plain:${Buffer.from(text, 'utf8').toString('base64')}`;
  }

  function decryptText(value) {
    const stored = String(value || '');
    if (!stored) {
      return '';
    }
    if (stored.startsWith('safe:')) {
      if (!safeStorage?.isEncryptionAvailable?.()) {
        throw new Error('Die gespeicherten Oracle-Zugangsdaten können auf diesem System nicht entschlüsselt werden.');
      }
      return safeStorage.decryptString(Buffer.from(stored.slice(5), 'base64'));
    }
    if (stored.startsWith('plain:')) {
      return Buffer.from(stored.slice(6), 'base64').toString('utf8');
    }
    return stored;
  }

  function getDefaultState() {
    return {
      activeServerId: '',
      servers: [],
      jobs: [],
      network: {},
      updatedAt: ''
    };
  }

  function readState() {
    const state = readJson(STATE_FILE, getDefaultState());
    return {
      ...getDefaultState(),
      ...state,
      servers: Array.isArray(state.servers) ? state.servers : [],
      jobs: Array.isArray(state.jobs) ? state.jobs.slice(-80) : []
    };
  }

  function writeState(state) {
    const next = {
      ...getDefaultState(),
      ...state,
      updatedAt: new Date().toISOString()
    };
    writeJson(STATE_FILE, next);
    return next;
  }

  function normalizeCredentialInput(input = {}) {
    const configValues = parseOciConfigText(input.ociConfig || input.configText || '');
    return {
      tenancyOcid: String(input.tenancyOcid || configValues.tenancy || '').trim(),
      userOcid: String(input.userOcid || configValues.user || '').trim(),
      fingerprint: String(input.fingerprint || configValues.fingerprint || '').trim(),
      region: String(input.region || configValues.region || DEFAULT_REGION).trim(),
      compartmentOcid: String(input.compartmentOcid || input.tenancyOcid || configValues.compartment || configValues.tenancy || '').trim(),
      privateKey: String(input.privateKey || '').trim(),
      sshUsername: String(input.sshUsername || 'ubuntu').trim() || 'ubuntu'
    };
  }

  function parseOciConfigText(value = '') {
    const parsed = {};
    String(value || '').split(/\r?\n/u).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('#')) {
        return;
      }
      const separator = trimmed.indexOf('=');
      if (separator <= 0) {
        return;
      }
      const key = trimmed.slice(0, separator).trim();
      const text = trimmed.slice(separator + 1).trim();
      parsed[key] = text;
    });
    return parsed;
  }

  function saveCredentials(input = {}) {
    const credentials = normalizeCredentialInput(input);
    const missing = ['tenancyOcid', 'userOcid', 'fingerprint', 'region', 'compartmentOcid', 'privateKey']
      .filter((key) => !credentials[key]);
    if (missing.length) {
      return { success: false, error: `Oracle-Zugangsdaten unvollstaendig: ${missing.join(', ')}` };
    }
    ensureDir(ROOT_DIR);
    writeJson(CREDENTIALS_FILE, {
      ...credentials,
      privateKey: encryptText(credentials.privateKey),
      savedAt: new Date().toISOString()
    });
    materializeOciConfig();
    return getHostedServerStatus({ refreshCloud: false, message: 'Oracle Cloud wurde verbunden.' });
  }

  function readCredentials({ includePrivateKey = false } = {}) {
    const stored = readJson(CREDENTIALS_FILE, null);
    if (!stored) {
      return null;
    }
    const credentials = normalizeCredentialInput({
      ...stored,
      privateKey: includePrivateKey ? decryptText(stored.privateKey) : ''
    });
    return credentials;
  }

  function materializeOciConfig() {
    const credentials = readCredentials({ includePrivateKey: true });
    if (!credentials) {
      return readSessionCredentials();
    }
    ensureDir(ROOT_DIR);
    fs.writeFileSync(OCI_KEY_FILE, `${credentials.privateKey.replace(/\r\n/g, '\n')}\n`, { mode: 0o600 });
    fs.writeFileSync(OCI_CONFIG_FILE, [
      `[${OCI_SESSION_PROFILE}]`,
      `user=${credentials.userOcid}`,
      `fingerprint=${credentials.fingerprint}`,
      `tenancy=${credentials.tenancyOcid}`,
      `region=${credentials.region}`,
      `key_file=${OCI_KEY_FILE.replace(/\\/g, '/')}`,
      ''
    ].join('\n'), { mode: 0o600 });
    return credentials;
  }

  function hasCredentials() {
    return Boolean(readCredentials() || readSessionCredentials());
  }

  function parseOciConfigFile() {
    if (!fs.existsSync(OCI_CONFIG_FILE)) {
      return {};
    }
    const profiles = {};
    let current = 'DEFAULT';
    String(fs.readFileSync(OCI_CONFIG_FILE, 'utf8') || '').split(/\r?\n/u).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }
      const section = trimmed.match(/^\[([^\]]+)\]$/u);
      if (section) {
        current = section[1].trim() || 'DEFAULT';
        profiles[current] = profiles[current] || {};
        return;
      }
      const separator = trimmed.indexOf('=');
      if (separator > 0) {
        profiles[current] = profiles[current] || {};
        profiles[current][trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
      }
    });
    return profiles;
  }

  function readSessionCredentials() {
    const profile = parseOciConfigFile()[OCI_SESSION_PROFILE] || parseOciConfigFile().DEFAULT || null;
    if (!profile?.security_token_file && !profile?.tenancy) {
      return null;
    }
    return {
      tenancyOcid: String(profile.tenancy || '').trim(),
      userOcid: String(profile.user || '').trim(),
      fingerprint: '',
      region: String(profile.region || DEFAULT_REGION).trim(),
      compartmentOcid: String(profile.tenancy || '').trim(),
      privateKey: '',
      sshUsername: 'ubuntu',
      authMode: 'security_token'
    };
  }

  function runProcess(command, args, options = {}) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: ROOT_DIR,
        windowsHide: true,
        shell: false,
        env: {
          ...process.env,
          OCI_CONFIG_FILE,
          OCI_CLI_SUPPRESS_FILE_PERMISSIONS_WARNING: 'True'
        },
        ...options
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', (error) => resolve({ ok: false, code: -1, stdout, stderr: error.message || String(error) }));
      child.on('close', (code) => resolve({ ok: code === 0, code, stdout, stderr }));
    });
  }

  function ensureOciCli() {
    const check = spawnSync('oci', ['--version'], { encoding: 'utf8', windowsHide: true });
    if (check.error || check.status !== 0) {
      throw new Error('Die Oracle-Anmeldekomponente fehlt auf diesem PC. Installiere die Oracle Cloud CLI einmalig oder nutze eine Launcher-Version mit gebuendelter Oracle-Komponente.');
    }
    return String(check.stdout || check.stderr || '').trim();
  }

  async function runOci(args, { json = true } = {}) {
    const auth = materializeOciConfig();
    ensureOciCli();
    if (auth?.authMode === 'security_token') {
      await refreshSessionToken();
    }
    const fullArgs = [...args, '--config-file', OCI_CONFIG_FILE, '--profile', OCI_SESSION_PROFILE];
    if (auth?.authMode === 'security_token') {
      fullArgs.push('--auth', 'security_token');
    }
    if (json && !fullArgs.includes('--output')) {
      fullArgs.push('--output', 'json');
    }
    const result = await runProcess('oci', fullArgs);
    if (!result.ok) {
      throw new Error((result.stderr || result.stdout || `oci ${args.join(' ')} fehlgeschlagen`).trim());
    }
    if (!json) {
      return result.stdout;
    }
    const raw = String(result.stdout || '').trim();
    return raw ? JSON.parse(raw) : {};
  }

  async function refreshSessionToken() {
    const result = await runProcess('oci', [
      'session',
      'refresh',
      '--profile',
      OCI_SESSION_PROFILE,
      '--config-file',
      OCI_CONFIG_FILE
    ]);
    if (!result.ok) {
      logger?.warn?.('Oracle session refresh failed', { error: (result.stderr || result.stdout || '').trim() });
    }
  }

  async function loginWithOracleCloud(options = {}) {
    ensureDir(ROOT_DIR);
    ensureOciCli();
    const region = String(options.region || DEFAULT_REGION).trim() || DEFAULT_REGION;
    addJob('Oracle Browser-Anmeldung gestartet.');
    const result = await runProcess('oci', [
      'session',
      'authenticate',
      '--region',
      region,
      '--profile-name',
      OCI_SESSION_PROFILE,
      '--config-file',
      OCI_CONFIG_FILE
    ], { timeout: 10 * 60 * 1000 });
    if (!result.ok) {
      return {
        success: false,
        error: (result.stderr || result.stdout || 'Oracle-Anmeldung wurde abgebrochen.').trim()
      };
    }
    addJob('Oracle Browser-Anmeldung erfolgreich.');
    return getHostedServerStatus({ refreshCloud: true, message: 'Mit Oracle Cloud angemeldet.' });
  }

  async function logoutOracleCloud() {
    try {
      if (fs.existsSync(CREDENTIALS_FILE)) fs.unlinkSync(CREDENTIALS_FILE);
      if (fs.existsSync(OCI_CONFIG_FILE)) fs.unlinkSync(OCI_CONFIG_FILE);
      const sessionDir = path.join(ROOT_DIR, 'sessions');
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
      addJob('Oracle-Anmeldung entfernt.');
      return getHostedServerStatus({ refreshCloud: false, message: 'Oracle Cloud wurde abgemeldet.' });
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  }

  function addJob(message, type = 'info') {
    const state = readState();
    state.jobs.push({ id: crypto.randomUUID(), type, message, at: new Date().toISOString() });
    writeState(state);
  }

  function sanitizeName(value) {
    return String(value || 'minecraft')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 32) || 'minecraft';
  }

  function normalizePort(value, fallback = 25565) {
    return Math.max(1024, Math.min(65535, Math.round(Number(value) || fallback)));
  }

  function normalizeServerOptions(options = {}) {
    const name = sanitizeName(options.name || 'minecraft');
    const id = String(options.serverId || options.id || crypto.createHash('sha1').update(`${Date.now()}:${name}`).digest('hex').slice(0, 14)).replace(/[^\w.-]/g, '');
    const port = normalizePort(options.port, 25565);
    const javaVersion = Number(options.javaVersion || 21) >= 21 ? 21 : 17;
    return {
      id,
      name,
      displayName: String(options.displayName || options.name || name).trim().slice(0, 48) || name,
      minecraftVersion: String(options.minecraftVersion || 'latest').trim() || 'latest',
      ramGb: Math.max(1, Math.min(24, Math.round(Number(options.ramGb) || 4))),
      javaVersion,
      port,
      seed: String(options.seed || '').trim().slice(0, 80),
      gamemode: ['survival', 'creative', 'adventure', 'spectator'].includes(String(options.gamemode || '').toLowerCase()) ? String(options.gamemode).toLowerCase() : 'survival',
      difficulty: ['peaceful', 'easy', 'normal', 'hard'].includes(String(options.difficulty || '').toLowerCase()) ? String(options.difficulty).toLowerCase() : 'normal',
      pvp: options.pvp !== false,
      hardcore: Boolean(options.hardcore),
      onlineMode: options.onlineMode !== false,
      spawnProtection: Math.max(0, Math.min(64, Math.round(Number(options.spawnProtection) || 16))),
      viewDistance: Math.max(2, Math.min(32, Math.round(Number(options.viewDistance) || 10))),
      simulationDistance: Math.max(2, Math.min(32, Math.round(Number(options.simulationDistance) || 10))),
      allowNether: options.allowNether !== false,
      allowEnd: options.allowEnd !== false,
      enableCommandBlock: Boolean(options.enableCommandBlock),
      whitelist: Boolean(options.whitelist),
      maxPlayers: Math.max(1, Math.min(100, Math.round(Number(options.maxPlayers) || 20))),
      customDomain: String(options.customDomain || '').trim().slice(0, 253),
      rconPassword: String(options.rconPassword || crypto.randomBytes(18).toString('base64url')).slice(0, 64),
      instanceId: String(options.instanceId || '').trim(),
      publicIp: String(options.publicIp || '').trim(),
      lifecycleState: String(options.lifecycleState || 'LOCAL').trim(),
      createdAt: String(options.createdAt || new Date().toISOString()),
      updatedAt: new Date().toISOString()
    };
  }

  async function ensureSshKeyPair() {
    ensureDir(ROOT_DIR);
    if (fs.existsSync(SSH_KEY_FILE) && fs.existsSync(SSH_PUBLIC_KEY_FILE)) {
      return fs.readFileSync(SSH_PUBLIC_KEY_FILE, 'utf8').trim();
    }
    const check = await runProcess('ssh-keygen', ['-t', 'ed25519', '-N', '', '-C', 'x-launcher-oracle-minecraft', '-f', SSH_KEY_FILE]);
    if (!check.ok) {
      throw new Error('SSH-Schlüssel konnte nicht erzeugt werden. OpenSSH/ssh-keygen wird für die automatische Einrichtung benötigt.');
    }
    return fs.readFileSync(SSH_PUBLIC_KEY_FILE, 'utf8').trim();
  }

  async function getAvailabilityDomain(credentials) {
    const result = await runOci(['iam', 'availability-domain', 'list', '--compartment-id', credentials.tenancyOcid]);
    const first = result.data?.[0]?.name;
    if (!first) {
      throw new Error('Keine Oracle Availability Domain gefunden.');
    }
    return first;
  }

  async function getUbuntuImage(compartmentOcid) {
    const result = await runOci([
      'compute', 'image', 'list',
      '--compartment-id', compartmentOcid,
      '--operating-system', DEFAULT_IMAGE_OS,
      '--operating-system-version', DEFAULT_IMAGE_VERSION,
      '--shape', DEFAULT_SHAPE,
      '--sort-by', 'TIMECREATED',
      '--sort-order', 'DESC',
      '--all'
    ]);
    const image = result.data?.[0];
    if (!image?.id) {
      throw new Error('Kein Ubuntu Always-Free-kompatibles Image gefunden.');
    }
    return image.id;
  }

  async function ensureNetwork(compartmentOcid) {
    const state = readState();
    if (state.network?.subnetId) {
      return state.network;
    }
    const vcn = await runOci([
      'network', 'vcn', 'create',
      '--compartment-id', compartmentOcid,
      '--display-name', 'x-launcher-minecraft-vcn',
      '--cidr-block', '10.42.0.0/16',
      '--dns-label', 'xlaunchermc',
      '--wait-for-state', 'AVAILABLE'
    ]);
    const vcnId = vcn.data.id;
    const igw = await runOci([
      'network', 'internet-gateway', 'create',
      '--compartment-id', compartmentOcid,
      '--vcn-id', vcnId,
      '--display-name', 'x-launcher-minecraft-internet',
      '--is-enabled', 'true',
      '--wait-for-state', 'AVAILABLE'
    ]);
    const route = await runOci([
      'network', 'route-table', 'create',
      '--compartment-id', compartmentOcid,
      '--vcn-id', vcnId,
      '--display-name', 'x-launcher-minecraft-route',
      '--route-rules', JSON.stringify([{ cidrBlock: '0.0.0.0/0', networkEntityId: igw.data.id }]),
      '--wait-for-state', 'AVAILABLE'
    ]);
    const sec = await runOci([
      'network', 'security-list', 'create',
      '--compartment-id', compartmentOcid,
      '--vcn-id', vcnId,
      '--display-name', 'x-launcher-minecraft-security',
      '--egress-security-rules', JSON.stringify([{ destination: '0.0.0.0/0', protocol: 'all' }]),
      '--ingress-security-rules', JSON.stringify([
        { protocol: '6', source: '0.0.0.0/0', tcpOptions: { destinationPortRange: { min: 22, max: 22 } } },
        { protocol: '6', source: '0.0.0.0/0', tcpOptions: { destinationPortRange: { min: 25565, max: 25590 } } }
      ]),
      '--wait-for-state', 'AVAILABLE'
    ]);
    const subnet = await runOci([
      'network', 'subnet', 'create',
      '--compartment-id', compartmentOcid,
      '--vcn-id', vcnId,
      '--display-name', 'x-launcher-minecraft-public-subnet',
      '--cidr-block', '10.42.10.0/24',
      '--dns-label', 'mc',
      '--route-table-id', route.data.id,
      '--security-list-ids', JSON.stringify([sec.data.id]),
      '--prohibit-public-ip-on-vnic', 'false',
      '--wait-for-state', 'AVAILABLE'
    ]);
    const network = { vcnId, subnetId: subnet.data.id, securityListId: sec.data.id, routeTableId: route.data.id, internetGatewayId: igw.data.id };
    writeState({ ...state, network });
    return network;
  }

  async function openFirewallPort(port) {
    const state = readState();
    if (!state.network?.securityListId) {
      return;
    }
    const current = await runOci(['network', 'security-list', 'get', '--security-list-id', state.network.securityListId]);
    const rules = current.data?.['ingress-security-rules'] || [];
    const exists = rules.some((rule) => Number(rule?.tcpOptions?.destinationPortRange?.min) <= port && Number(rule?.tcpOptions?.destinationPortRange?.max) >= port);
    if (exists) {
      return;
    }
    rules.push({ protocol: '6', source: '0.0.0.0/0', tcpOptions: { destinationPortRange: { min: port, max: port } } });
    await runOci(['network', 'security-list', 'update', '--security-list-id', state.network.securityListId, '--ingress-security-rules', JSON.stringify(rules), '--force']);
  }

  function buildCloudInit(server, publicKey) {
    const script = buildProvisionScript(server);
    return Buffer.from(`#cloud-config
package_update: true
users:
  - default
  - name: ubuntu
    groups: sudo
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    ssh_authorized_keys:
      - ${publicKey}
write_files:
  - path: /root/x-launcher-provision.sh
    permissions: '0755'
    encoding: b64
    content: ${Buffer.from(script, 'utf8').toString('base64')}
runcmd:
  - [ bash, /root/x-launcher-provision.sh ]
`).toString('base64');
  }

  function propertyLine(key, value) {
    return `${key}=${String(value).replace(/\r?\n/g, ' ')}`;
  }

  function buildServerProperties(server) {
    return [
      propertyLine('server-port', server.port),
      propertyLine('motd', server.displayName),
      propertyLine('level-seed', server.seed),
      propertyLine('gamemode', server.gamemode),
      propertyLine('difficulty', server.difficulty),
      propertyLine('pvp', server.pvp),
      propertyLine('hardcore', server.hardcore),
      propertyLine('online-mode', server.onlineMode),
      propertyLine('spawn-protection', server.spawnProtection),
      propertyLine('view-distance', server.viewDistance),
      propertyLine('simulation-distance', server.simulationDistance),
      propertyLine('allow-nether', server.allowNether),
      propertyLine('allow-end', server.allowEnd),
      propertyLine('enable-command-block', server.enableCommandBlock),
      propertyLine('white-list', server.whitelist),
      propertyLine('max-players', server.maxPlayers),
      propertyLine('enable-rcon', true),
      propertyLine('rcon.port', server.port + 1000),
      propertyLine('rcon.password', server.rconPassword),
      propertyLine('sync-chunk-writes', false)
    ].join('\n');
  }

  function buildProvisionScript(server) {
    const props = buildServerProperties(server);
    return `#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
SERVER_DIR="${REMOTE_ROOT}/${server.id}"
JAVA_VERSION="${server.javaVersion}"
MC_VERSION="${server.minecraftVersion}"
RAM_GB="${server.ramGb}"
PORT="${server.port}"
RCON_PORT="${server.port + 1000}"
mkdir -p "$SERVER_DIR/plugins" "$SERVER_DIR/backups"
apt-get update
apt-get install -y "openjdk-${server.javaVersion}-jre-headless" curl python3 unzip ufw tar gzip
ufw allow OpenSSH || true
ufw allow "${server.port}/tcp" || true
ufw --force enable || true
cd "$SERVER_DIR"
python3 - <<'PY'
import json, os, urllib.request
version=os.environ.get('MC_VERSION','latest')
if version == 'latest':
    manifest=json.load(urllib.request.urlopen('https://api.papermc.io/v2/projects/paper'))
    version=manifest['versions'][-1]
os.environ['RESOLVED_MC_VERSION']=version
builds=json.load(urllib.request.urlopen(f'https://api.papermc.io/v2/projects/paper/versions/{version}'))['builds']
build=builds[-1]
info=json.load(urllib.request.urlopen(f'https://api.papermc.io/v2/projects/paper/versions/{version}/builds/{build}'))
name=info['downloads']['application']['name']
url=f'https://api.papermc.io/v2/projects/paper/versions/{version}/builds/{build}/downloads/{name}'
urllib.request.urlretrieve(url, 'server.jar')
open('.x-launcher-version','w').write(version)
PY
cat > eula.txt <<'EOF'
eula=true
EOF
cat > server.properties <<'EOF'
${props}
EOF
python3 - <<'PY'
import json, os, urllib.request
mods = ['viaversion', 'viabackwards', 'viarewind']
os.makedirs('plugins', exist_ok=True)
for slug in mods:
    versions=json.load(urllib.request.urlopen(f'https://api.modrinth.com/v2/project/{slug}/version'))
    chosen=None
    for entry in versions:
        files=[f for f in entry.get('files',[]) if f.get('filename','').endswith('.jar')]
        if files:
            chosen=files[0]
            break
    if chosen:
        urllib.request.urlretrieve(chosen['url'], os.path.join('plugins', chosen['filename']))
PY
cat > /etc/systemd/system/x-minecraft-${server.id}.service <<EOF
[Unit]
Description=X Client Minecraft ${server.displayName}
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=${REMOTE_ROOT}/${server.id}
User=root
Restart=always
RestartSec=8
ExecStart=/usr/bin/java -Xms1G -Xmx${server.ramGb}G -jar server.jar nogui
ExecStop=/bin/bash -lc 'python3 ${REMOTE_ROOT}/${server.id}/rcon.py "${server.rconPassword}" ${server.port + 1000} stop || true'
StandardOutput=append:${REMOTE_ROOT}/${server.id}/console.log
StandardError=append:${REMOTE_ROOT}/${server.id}/console.log

[Install]
WantedBy=multi-user.target
EOF
cat > "$SERVER_DIR/rcon.py" <<'PY'
import socket, struct, sys
password=sys.argv[1]; port=int(sys.argv[2]); command=' '.join(sys.argv[3:])
def pkt(i,t,b):
    data=struct.pack('<ii',i,t)+b.encode()+b'\\x00\\x00'
    return struct.pack('<i',len(data))+data
def rec(s):
    raw=s.recv(4)
    if not raw: return b''
    size=struct.unpack('<i',raw)[0]
    return s.recv(size)
s=socket.create_connection(('127.0.0.1',port),5)
s.sendall(pkt(1,3,password)); rec(s)
if command:
    s.sendall(pkt(2,2,command)); print(rec(s).decode('utf-8','ignore'))
s.close()
PY
chmod +x "$SERVER_DIR/rcon.py"
systemctl daemon-reload
systemctl enable --now x-minecraft-${server.id}.service
`;
  }

  async function waitForInstancePublicIp(instanceId, compartmentOcid, timeoutMs = 180000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const ip = await getInstancePublicIp(instanceId, compartmentOcid).catch(() => '');
      if (ip) {
        return ip;
      }
      await new Promise((resolve) => setTimeout(resolve, 6000));
    }
    return '';
  }

  async function getInstancePublicIp(instanceId, compartmentOcid) {
    const attachments = await runOci(['compute', 'vnic-attachment', 'list', '--compartment-id', compartmentOcid, '--instance-id', instanceId, '--all']);
    const attachment = attachments.data?.[0];
    if (!attachment?.['vnic-id']) {
      return '';
    }
    const vnic = await runOci(['network', 'vnic', 'get', '--vnic-id', attachment['vnic-id']]);
    return String(vnic.data?.['public-ip'] || '').trim();
  }

  async function createVmForServer(server) {
    const credentials = materializeOciConfig();
    if (!credentials) {
      throw new Error('Bitte zuerst Oracle Cloud verbinden.');
    }
    const publicKey = await ensureSshKeyPair();
    const network = await ensureNetwork(credentials.compartmentOcid);
    const availabilityDomain = await getAvailabilityDomain(credentials);
    const imageId = await getUbuntuImage(credentials.compartmentOcid);
    await openFirewallPort(server.port);
    const result = await runOci([
      'compute', 'instance', 'launch',
      '--availability-domain', availabilityDomain,
      '--compartment-id', credentials.compartmentOcid,
      '--display-name', `x-minecraft-${server.name}`,
      '--shape', DEFAULT_SHAPE,
      '--shape-config', JSON.stringify({ ocpus: 1, memoryInGBs: Math.max(6, server.ramGb + 2) }),
      '--source-details', JSON.stringify({ sourceType: 'image', imageId }),
      '--subnet-id', network.subnetId,
      '--assign-public-ip', 'true',
      '--metadata', JSON.stringify({ ssh_authorized_keys: publicKey, user_data: buildCloudInit(server, publicKey) }),
      '--wait-for-state', 'RUNNING'
    ]);
    const instanceId = result.data.id;
    const publicIp = await waitForInstancePublicIp(instanceId, credentials.compartmentOcid);
    return { instanceId, publicIp, lifecycleState: 'RUNNING' };
  }

  async function listCloudInstances() {
    const credentials = readCredentials();
    if (!credentials) {
      return [];
    }
    const result = await runOci(['compute', 'instance', 'list', '--compartment-id', credentials.compartmentOcid, '--all']);
    return (result.data || [])
      .filter((item) => String(item['display-name'] || '').startsWith('x-minecraft-'))
      .map((item) => ({
        id: item.id,
        displayName: item['display-name'],
        lifecycleState: item['lifecycle-state'],
        shape: item.shape,
        timeCreated: item['time-created']
      }));
  }

  function findServer(state, serverId = '') {
    return state.servers.find((server) => server.id === String(serverId || state.activeServerId || '').trim()) || state.servers[0] || null;
  }

  async function remoteCommand(server, command, options = {}) {
    if (!server?.publicIp) {
      throw new Error('Keine öffentliche IPv4-Adresse für diese VM bekannt.');
    }
    const args = [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'ConnectTimeout=12',
      '-i', SSH_KEY_FILE,
      `${readCredentials()?.sshUsername || 'ubuntu'}@${server.publicIp}`,
      command
    ];
    const result = await runProcess('ssh', args, { timeout: options.timeoutMs || 30000 });
    if (!result.ok && options.optional !== true) {
      throw new Error((result.stderr || result.stdout || 'SSH-Befehl fehlgeschlagen').trim());
    }
    return result.stdout || result.stderr || '';
  }

  async function scpToServer(server, localPath, remotePath) {
    const result = await runProcess('scp', [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-i', SSH_KEY_FILE,
      localPath,
      `${readCredentials()?.sshUsername || 'ubuntu'}@${server.publicIp}:${remotePath}`
    ]);
    if (!result.ok) {
      throw new Error((result.stderr || result.stdout || 'Datei konnte nicht hochgeladen werden').trim());
    }
  }

  async function sendRcon(server, command) {
    const clean = String(command || '').replace(/[\r\n]+/g, ' ').trim();
    if (!clean) {
      return '';
    }
    const escaped = clean.replace(/(["$`\\])/g, '\\$1');
    return remoteCommand(server, `sudo python3 ${REMOTE_ROOT}/${server.id}/rcon.py "${server.rconPassword}" ${server.port + 1000} "${escaped}"`, { timeoutMs: 12000 });
  }

  function parsePlayers(logs) {
    const line = String(logs || '').split(/\r?\n/).reverse().find((entry) => /There are \d+ of a max of \d+ players online:/i.test(entry));
    if (!line) {
      return { online: 0, max: 0, names: [] };
    }
    const match = line.match(/There are (\d+) of a max of (\d+) players online: ?(.*)$/i);
    return {
      online: Number(match?.[1] || 0),
      max: Number(match?.[2] || 0),
      names: String(match?.[3] || '').split(',').map((name) => name.trim()).filter(Boolean)
    };
  }

  async function getRemoteRuntime(server) {
    if (!server?.publicIp) {
      return { service: 'unknown', logs: '', resources: {}, files: [] };
    }
    const command = [
      `SERVICE=x-minecraft-${server.id}.service`,
      `systemctl is-active "$SERVICE" || true`,
      `systemctl show "$SERVICE" -p ActiveEnterTimestamp -p NRestarts --value || true`,
      `free -m | awk 'NR==2{print $3"/"$2" MB"}'`,
      `df -h / | awk 'NR==2{print $3"/"$2" ("$5")"}'`,
      `top -bn1 | awk '/Cpu\\(s\\)/{print 100-$8"%"}'`,
      `ss -tn sport = :${server.port} | tail -n +2 | wc -l`,
      `tail -n 180 ${REMOTE_ROOT}/${server.id}/logs/latest.log ${REMOTE_ROOT}/${server.id}/console.log 2>/dev/null || true`,
      `find ${REMOTE_ROOT}/${server.id} -maxdepth 2 -type f | sed "s#${REMOTE_ROOT}/${server.id}/##" | head -300 || true`
    ].join('; echo "__XL__"; ');
    const output = await remoteCommand(server, command, { optional: true, timeoutMs: 18000 });
    const parts = String(output || '').split('__XL__').map((part) => part.trim());
    const logs = parts[6] || '';
    return {
      service: parts[0] || 'unknown',
      resources: {
        memory: parts[2] || '',
        disk: parts[3] || '',
        cpu: parts[4] || '',
        network: `${Number(parts[5] || 0)} Verbindungen`
      },
      logs,
      players: parsePlayers(logs),
      files: String(parts[7] || '').split(/\r?\n/).filter(Boolean).map((name) => ({ name }))
    };
  }

  async function getHostedServerStatus(options = {}) {
    const state = readState();
    const credentials = readCredentials() || readSessionCredentials();
    let cloudInstances = [];
    let error = '';
    if (credentials && options.refreshCloud !== false) {
      try {
        cloudInstances = await listCloudInstances();
        const byId = new Map(cloudInstances.map((vm) => [vm.id, vm]));
        let changed = false;
        state.servers = await Promise.all(state.servers.map(async (server) => {
          if (!server.instanceId) return server;
          const vm = byId.get(server.instanceId);
          if (!vm) return server;
          const publicIp = server.publicIp || await getInstancePublicIp(server.instanceId, credentials.compartmentOcid).catch(() => '');
          changed = true;
          return { ...server, lifecycleState: vm.lifecycleState, publicIp: publicIp || server.publicIp };
        }));
        if (changed) writeState(state);
      } catch (err) {
        error = err.message || String(err);
      }
    }
    const activeServer = findServer(state);
    const runtime = activeServer ? await getRemoteRuntime(activeServer).catch((err) => ({ error: err.message, service: 'unknown', logs: '' })) : {};
    const running = runtime.service === 'active';
    const address = activeServer?.publicIp ? `${activeServer.publicIp}:${activeServer.port || 25565}` : '';
    return {
      success: !error,
      error,
      credentialsConfigured: Boolean(credentials),
      authMode: credentials?.authMode || (credentials ? 'api_key' : ''),
      ociCliVersion: credentials ? (() => { try { return ensureOciCli(); } catch (err) { return ''; } })() : '',
      activeServerId: activeServer?.id || '',
      activeServer,
      servers: state.servers,
      cloudInstances,
      running,
      installed: Boolean(activeServer?.instanceId),
      address,
      publicAddress: address,
      networkAddresses: { public: activeServer?.publicIp || '', domain: activeServer?.customDomain || '' },
      players: runtime.players || { online: 0, max: activeServer?.maxPlayers || 0, names: [] },
      playerDetails: (runtime.players?.names || []).map((name) => ({ name })),
      resources: runtime.resources || {},
      consoleOutput: runtime.logs || runtime.error || 'Noch keine Logs geladen.',
      files: runtime.files || [],
      jobs: state.jobs,
      message: options.message || ''
    };
  }

  async function createHostedServer(options = {}) {
    const server = normalizeServerOptions(options);
    const state = readState();
    if (state.servers.some((entry) => entry.name === server.name)) {
      return { success: false, error: 'Ein Server mit diesem Namen existiert bereits.' };
    }
    addJob(`Erstelle Oracle Always-Free VM für ${server.displayName}...`);
    const vm = await createVmForServer(server);
    const nextServer = { ...server, ...vm };
    const nextState = writeState({ ...state, activeServerId: nextServer.id, servers: [...state.servers, nextServer] });
    return { ...(await getHostedServerStatus({ message: `${server.displayName} wurde erstellt und automatisch eingerichtet.` })), activeServerId: nextState.activeServerId };
  }

  async function selectHostedServer(serverId) {
    const state = readState();
    const server = findServer(state, serverId);
    if (!server) return { success: false, error: 'Server wurde nicht gefunden.' };
    writeState({ ...state, activeServerId: server.id });
    return getHostedServerStatus({ message: `${server.displayName || server.name} ist ausgewaehlt.` });
  }

  async function saveHostedServer(options = {}) {
    const state = readState();
    const selected = findServer(state, options.serverId);
    if (!selected) return { success: false, error: 'Bitte zuerst einen Server auswählen.' };
    const nextServer = normalizeServerOptions({ ...selected, ...options, id: selected.id, instanceId: selected.instanceId, publicIp: selected.publicIp, createdAt: selected.createdAt });
    writeState({ ...state, servers: state.servers.map((server) => server.id === selected.id ? nextServer : server), activeServerId: selected.id });
    if (nextServer.publicIp) {
      await openFirewallPort(nextServer.port).catch((error) => addJob(`Firewall-Regel konnte nicht aktualisiert werden: ${error.message}`, 'warning'));
      const properties = buildServerProperties(nextServer).replace(/'/g, "'\\''");
      await remoteCommand(nextServer, `sudo bash -lc 'cat > ${REMOTE_ROOT}/${nextServer.id}/server.properties <<EOF\n${properties}\nEOF\nufw allow ${nextServer.port}/tcp || true\nsystemctl daemon-reload'`, { optional: true });
    }
    return getHostedServerStatus({ message: `${nextServer.displayName} wurde gespeichert.` });
  }

  async function startHostedServer(options = {}) {
    const saved = await saveHostedServer(options);
    if (!saved.success) return saved;
    const server = saved.activeServer;
    await runOci(['compute', 'instance', 'action', '--instance-id', server.instanceId, '--action', 'START', '--wait-for-state', 'RUNNING']).catch(() => null);
    await remoteCommand(server, `sudo systemctl start x-minecraft-${server.id}.service`, { optional: true });
    return getHostedServerStatus({ message: `${server.displayName || server.name} startet.` });
  }

  async function stopHostedServer(serverId = '') {
    const state = readState();
    const server = findServer(state, serverId);
    if (!server) return { success: false, error: 'Server wurde nicht gefunden.' };
    await remoteCommand(server, `sudo systemctl stop x-minecraft-${server.id}.service`, { optional: true });
    return getHostedServerStatus({ message: `${server.displayName || server.name} wurde gestoppt.` });
  }

  async function restartHostedServer(options = {}) {
    const saved = await saveHostedServer(options);
    if (!saved.success) return saved;
    const server = saved.activeServer;
    await remoteCommand(server, `sudo systemctl restart x-minecraft-${server.id}.service`, { optional: true });
    return getHostedServerStatus({ message: `${server.displayName || server.name} wurde neu gestartet.` });
  }

  async function deleteHostedServer(serverId = '') {
    const state = readState();
    const server = findServer(state, serverId);
    if (!server) return { success: false, error: 'Server wurde nicht gefunden.' };
    if (server.instanceId) {
      await runOci(['compute', 'instance', 'terminate', '--instance-id', server.instanceId, '--force', '--wait-for-state', 'TERMINATED']).catch((error) => addJob(`VM konnte nicht geloescht werden: ${error.message}`, 'warning'));
    }
    const servers = state.servers.filter((entry) => entry.id !== server.id);
    writeState({ ...state, servers, activeServerId: servers[0]?.id || '' });
    return getHostedServerStatus({ message: `${server.displayName || server.name} wurde geloescht.` });
  }

  async function sendHostedServerCommand(serverId = '', command = '') {
    const server = findServer(readState(), serverId);
    if (!server) return { success: false, error: 'Server wurde nicht gefunden.' };
    const output = await sendRcon(server, command);
    addJob(`Konsole: ${command}`);
    const status = await getHostedServerStatus({ message: `Befehl gesendet: ${command}` });
    return { ...status, consoleOutput: `${status.consoleOutput || ''}\n> ${command}\n${output}`.trim() };
  }

  async function vmAction(serverId = '', action = '') {
    const server = findServer(readState(), serverId);
    if (!server?.instanceId) return { success: false, error: 'VM wurde nicht gefunden.' };
    const normalized = String(action || '').toUpperCase();
    const allowed = { START: 'RUNNING', STOP: 'STOPPED', RESET: 'RUNNING', SOFTRESET: 'RUNNING' };
    if (!allowed[normalized]) return { success: false, error: 'Unbekannte VM-Aktion.' };
    await runOci(['compute', 'instance', 'action', '--instance-id', server.instanceId, '--action', normalized, '--wait-for-state', allowed[normalized]]);
    return getHostedServerStatus({ message: `VM-Aktion ${normalized} abgeschlossen.` });
  }

  async function importHostedServerMods(filePaths = []) {
    const server = findServer(readState());
    if (!server) return { success: false, error: 'Bitte zuerst einen Server auswählen.' };
    let count = 0;
    for (const source of Array.isArray(filePaths) ? filePaths : []) {
      if (!/\.jar$/i.test(String(source || '')) || !fs.existsSync(source)) continue;
      await scpToServer(server, source, `${REMOTE_ROOT}/${server.id}/plugins/${path.basename(source).replace(/[^\w .+()[\]-]/g, '_')}`);
      count += 1;
    }
    await remoteCommand(server, `sudo systemctl restart x-minecraft-${server.id}.service`, { optional: true });
    return getHostedServerStatus({ message: `${count} Plugin-Datei(en) hochgeladen.` });
  }

  async function removeHostedServerMod(fileName = '') {
    const server = findServer(readState());
    if (!server) return { success: false, error: 'Bitte zuerst einen Server auswählen.' };
    const safe = path.basename(String(fileName || ''));
    if (!safe) return { success: false, error: 'Keine Datei angegeben.' };
    await remoteCommand(server, `sudo rm -f ${REMOTE_ROOT}/${server.id}/plugins/${safe.replace(/'/g, "'\\''")}`);
    return getHostedServerStatus({ message: `${safe} wurde geloescht.` });
  }

  function fetchJsonUrl(url) {
    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: { 'User-Agent': 'XClient/1.0 Oracle Hosting' }
      }, (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk.toString(); });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode}: ${url}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  async function installHostedServerModrinthMod(projectReference) {
    const server = findServer(readState());
    if (!server) return { success: false, error: 'Bitte zuerst einen Server auswählen.' };
    const projectId = String(projectReference?.projectId || projectReference?.id || projectReference?.slug || projectReference || '').trim();
    if (!projectId) return { success: false, error: 'Modrinth-Projekt wurde nicht erkannt.' };
    const versions = await fetchJsonUrl(`https://api.modrinth.com/v2/project/${encodeURIComponent(projectId)}/version`);
    const serverVersion = String(server.minecraftVersion || '').toLowerCase() === 'latest' ? '' : String(server.minecraftVersion || '');
    const version = (Array.isArray(versions) ? versions : []).find((entry) => {
      const loaders = entry.loaders || [];
      const gameVersions = entry.game_versions || [];
      const hasPaper = loaders.includes('paper') || loaders.includes('spigot') || loaders.includes('bukkit');
      const matchesVersion = !serverVersion || gameVersions.includes(serverVersion);
      return hasPaper && matchesVersion && (entry.files || []).some((file) => file.url && /\.jar$/i.test(file.filename || ''));
    }) || (Array.isArray(versions) ? versions : []).find((entry) => (entry.files || []).some((file) => file.url && /\.jar$/i.test(file.filename || '')));
    const file = (version?.files || []).find((entry) => entry.url && /\.jar$/i.test(entry.filename || ''));
    if (!file) return { success: false, error: 'Keine passende Plugin-JAR auf Modrinth gefunden.' };
    const remoteUrl = String(file.url).replace(/'/g, "'\\''");
    const fileName = path.basename(file.filename).replace(/[^\w .+()[\]-]/g, '_');
    await remoteCommand(server, `sudo bash -lc 'cd ${REMOTE_ROOT}/${server.id}/plugins && curl -L --fail -o "${fileName}" "${remoteUrl}" && systemctl restart x-minecraft-${server.id}.service'`);
    return getHostedServerStatus({ message: `${projectReference?.title || projectId} wurde installiert.` });
  }

  async function createBackup() {
    const server = findServer(readState());
    if (!server) return { success: false, error: 'Bitte zuerst einen Server auswählen.' };
    const name = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`;
    await remoteCommand(server, `sudo tar -czf ${REMOTE_ROOT}/${server.id}/backups/${name} -C ${REMOTE_ROOT}/${server.id} world world_nether world_the_end server.properties plugins 2>/dev/null || true`);
    return getHostedServerStatus({ message: `Backup erstellt: ${name}` });
  }

  async function restoreBackup(fileName = '') {
    const server = findServer(readState());
    const safe = path.basename(String(fileName || ''));
    if (!server || !safe) return { success: false, error: 'Backup wurde nicht gefunden.' };
    await remoteCommand(server, `sudo systemctl stop x-minecraft-${server.id}.service; sudo tar -xzf ${REMOTE_ROOT}/${server.id}/backups/${safe} -C ${REMOTE_ROOT}/${server.id}; sudo systemctl start x-minecraft-${server.id}.service`);
    return getHostedServerStatus({ message: `Backup wiederhergestellt: ${safe}` });
  }

  async function openHostedServerFolder() {
    ensureDir(ROOT_DIR);
    const error = await shell.openPath(ROOT_DIR);
    return error ? { success: false, error } : { success: true, path: ROOT_DIR };
  }

  async function openHostedServerModsFolder() {
    return openHostedServerFolder();
  }

  return {
    saveCredentials,
    loginWithOracleCloud,
    logoutOracleCloud,
    hasCredentials,
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
    installHostedServerModrinthMod,
    removeHostedServerMod,
    createBackup,
    restoreBackup,
    openHostedServerFolder,
    openHostedServerModsFolder,
    vmAction
  };
}

module.exports = createOracleHostingBackend;
