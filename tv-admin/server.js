const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const BRAND_DIR = path.join(ROOT, 'branding');
const BRAND_PROPS_PATH = path.join(BRAND_DIR, 'brand.properties');
const LOCAL_PROPS_PATH = path.join(ROOT, 'local.properties');
const DEFAULT_VOD_JSON_PATH = path.join(ROOT, 'app', 'src', 'main', 'assets', 'brand', 'default_vod.json');
const HOME_LOGO_DIR = path.join(ROOT, 'app', 'src', 'main', 'assets', 'brand');
const LAUNCHER_FOREGROUND_XML_PATH = path.join(ROOT, 'app', 'src', 'main', 'res', 'drawable', 'ic_launcher_foreground.xml');
const LAUNCHER_BITMAP_PATH = path.join(ROOT, 'app', 'src', 'main', 'res', 'drawable-nodpi', 'ic_brand_launcher.png');
const BANNER_PATH = path.join(ROOT, 'app', 'src', 'leanback', 'res', 'drawable', 'ic_banner.png');
const APP_NAMES = [
  path.join(ROOT, 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
  path.join(ROOT, 'app', 'src', 'main', 'res', 'values-zh-rCN', 'strings.xml'),
  path.join(ROOT, 'app', 'src', 'main', 'res', 'values-zh-rTW', 'strings.xml')
];
const LAUNCHER_PNGS = [
  path.join(ROOT, 'app', 'src', 'main', 'res', 'mipmap-mdpi', 'ic_launcher.png'),
  path.join(ROOT, 'app', 'src', 'main', 'res', 'mipmap-hdpi', 'ic_launcher.png'),
  path.join(ROOT, 'app', 'src', 'main', 'res', 'mipmap-xhdpi', 'ic_launcher.png'),
  path.join(ROOT, 'app', 'src', 'main', 'res', 'mipmap-xxhdpi', 'ic_launcher.png'),
  path.join(ROOT, 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher.png')
];

const BRAND_KEYS = [
  'applicationId',
  'defaultVodConfig',
  'defaultLiveConfig',
  'defaultWallConfig',
  'updateBaseUrl',
  'javaHome'
];

const SIGNING_KEYS = ['storeFile', 'keyAlias', 'storePassword'];

function hasCustomSigningConfig(signing) {
  return SIGNING_KEYS.every((key) => Boolean(signing?.[key]));
}

function execCapture(command) {
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-Command', command], { cwd: ROOT });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk.toString()));
    child.stderr.on('data', (chunk) => (output += chunk.toString()));
    child.on('error', () => resolve(''));
    child.on('close', () => resolve(output.trim()));
  });
}

async function getMachineEnv(name) {
  if (process.env[name]) return process.env[name];
  const escaped = name.replace(/'/g, "''");
  return execCapture(`[Environment]::GetEnvironmentVariable('${escaped}','Machine')`);
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function text(res, status, payload, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(payload);
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseProperties(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    result[key] = value;
  }
  return result;
}

async function readProperties(filePath) {
  try {
    return parseProperties(await fsp.readFile(filePath, 'utf8'));
  } catch {
    return {};
  }
}

async function writeProperties(filePath, keys, values) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const lines = [];
  for (const key of keys) {
    if (values[key] !== undefined) lines.push(`${key}=${values[key] ?? ''}`);
  }
  await fsp.writeFile(filePath, `${lines.join('\n')}\n`, 'utf8');
}

async function readText(filePath, fallback = '') {
  try {
    return await fsp.readFile(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

async function writeText(filePath, content) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, 'utf8');
}

function getStringValue(xml) {
  const match = xml.match(/<string\s+name="app_name"[^>]*>([\s\S]*?)<\/string>/);
  return match ? match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') : '';
}

async function setStringValue(filePath, value) {
  const xml = await readText(filePath);
  const next = xml.replace(
    /<string\s+name="app_name"[^>]*>[\s\S]*?<\/string>/,
    `<string name="app_name">${escapeXml(value)}</string>`
  );
  await writeText(filePath, next);
}

function extFromMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'bin';
}

function parseDataUrl(dataUrl) {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Unsupported data URL payload.');
  return {
    mime: match[1],
    ext: extFromMime(match[1]),
    buffer: Buffer.from(match[2], 'base64')
  };
}

async function writeBinary(filePath, buffer) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, buffer);
}

async function findJavaVersion(javaHome) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    if (javaHome) {
      env.JAVA_HOME = javaHome;
      env.Path = `${path.join(javaHome, 'bin')};${env.Path || env.PATH || ''}`;
    }
    const child = spawn('cmd.exe', ['/c', 'java', '-version'], { cwd: ROOT, env });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk.toString()));
    child.stderr.on('data', (chunk) => (output += chunk.toString()));
    child.on('error', () => resolve({ ok: false, output: 'java command not found' }));
    child.on('close', (code) => resolve({ ok: code === 0, output: output.trim() }));
  });
}

async function findPython310() {
  return new Promise((resolve) => {
    const child = spawn('py', ['-3.10', '--version'], { cwd: ROOT });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk.toString()));
    child.stderr.on('data', (chunk) => (output += chunk.toString()));
    child.on('error', () => resolve({ ok: false, output: 'Python 3.10 not found' }));
    child.on('close', (code) => resolve({ ok: code === 0, output: output.trim() }));
  });
}

async function findApksignerPath() {
  const androidHome = (await getMachineEnv('ANDROID_HOME')) || (await getMachineEnv('ANDROID_SDK_ROOT'));
  if (!androidHome) return '';
  const buildToolsDir = path.join(androidHome, 'build-tools');
  let entries = [];
  try {
    entries = await fsp.readdir(buildToolsDir, { withFileTypes: true });
  } catch {
    return '';
  }

  const versions = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));

  for (const version of versions) {
    const candidate = path.join(buildToolsDir, version, 'apksigner.bat');
    if (fs.existsSync(candidate)) return candidate;
  }
  return '';
}

async function verifyApkSignature(apkPath, env) {
  const apksignerPath = await findApksignerPath();
  if (!apksignerPath || !apkPath || !fs.existsSync(apkPath)) {
    return { ok: false, output: 'apksigner not found or APK missing.' };
  }

  return new Promise((resolve) => {
    const child = spawn(apksignerPath, ['verify', '--verbose', '--print-certs', apkPath], { cwd: ROOT, env });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk.toString()));
    child.stderr.on('data', (chunk) => (output += chunk.toString()));
    child.on('error', () => resolve({ ok: false, output: 'Failed to run apksigner.' }));
    child.on('close', (code) => resolve({ ok: code === 0, output: output.trim() }));
  });
}

function expectedApkPath(mode, abi, buildType) {
  const variantDir = `${mode}${abi.charAt(0).toUpperCase()}${abi.slice(1)}`;
  if (buildType === 'release') {
    return path.join(ROOT, 'app', 'build', 'outputs', 'apk', variantDir, 'release', `${mode}-${abi}.apk`);
  }
  return path.join(ROOT, 'app', 'build', 'outputs', 'apk', variantDir, 'debug', `app-${mode}-${abi}-debug.apk`);
}

async function readState() {
  const brand = await readProperties(BRAND_PROPS_PATH);
  const signing = await readProperties(LOCAL_PROPS_PATH);
  const customSigning = hasCustomSigningConfig(signing);
  const [appName, appNameZhCN, appNameZhTW] = await Promise.all(APP_NAMES.map((item) => readText(item)));
  const vodJson = await readText(DEFAULT_VOD_JSON_PATH, '{\n  "sites": []\n}\n');
  const machineJavaHome = await getMachineEnv('JAVA_HOME');
  const machineAndroidHome = await getMachineEnv('ANDROID_HOME');
  const machineSdkRoot = await getMachineEnv('ANDROID_SDK_ROOT');
  const javaHome = brand.javaHome || machineJavaHome;
  const [javaInfo, pythonInfo] = await Promise.all([findJavaVersion(javaHome), findPython310()]);
  return {
    brand,
    signing: {
      ...signing,
      mode: customSigning ? 'custom' : 'debugFallback',
      message: customSigning
        ? '已配置自定义发布签名'
        : '未配置证书，release 将回退到默认调试签名，可直接安装但不适合正式分发'
    },
    appNames: {
      default: getStringValue(appName),
      zhCN: getStringValue(appNameZhCN),
      zhTW: getStringValue(appNameZhTW)
    },
    vodJson,
    java: javaInfo,
    python: pythonInfo,
    android: {
      ok: Boolean(machineAndroidHome || machineSdkRoot),
      androidHome: machineAndroidHome,
      androidSdkRoot: machineSdkRoot
    },
    paths: {
      brandProperties: BRAND_PROPS_PATH,
      localProperties: LOCAL_PROPS_PATH,
      builtInVodConfig: DEFAULT_VOD_JSON_PATH
    }
  };
}

async function saveBranding(body) {
  const brand = await readProperties(BRAND_PROPS_PATH);
  const nextBrand = {
    ...brand,
    applicationId: body.applicationId?.trim() || 'com.fongmi.android.tv',
    defaultVodConfig: body.defaultVodConfig?.trim() || brand.defaultVodConfig || '',
    defaultLiveConfig: body.defaultLiveConfig?.trim() || '',
    defaultWallConfig: body.defaultWallConfig?.trim() || '',
    updateBaseUrl: body.updateBaseUrl?.trim() || '',
    javaHome: body.javaHome?.trim() || ''
  };

  await setStringValue(APP_NAMES[0], body.appName || 'TV');
  await setStringValue(APP_NAMES[1], body.appNameZhCN || body.appName || '影视');
  await setStringValue(APP_NAMES[2], body.appNameZhTW || body.appName || '影視');

  let vodObject = {};
  const jsonText = body.vodJson?.trim();
  if (jsonText) vodObject = JSON.parse(jsonText);
  if (typeof vodObject !== 'object' || Array.isArray(vodObject) || vodObject === null) {
    throw new Error('Built-in VOD config must be a JSON object.');
  }

  if (!Array.isArray(vodObject.sites)) vodObject.sites = [];
  if (!Array.isArray(vodObject.parses)) vodObject.parses = [];
  if (!Array.isArray(vodObject.flags)) vodObject.flags = [];
  if (!Array.isArray(vodObject.ads)) vodObject.ads = [];
  if (body.brandNotice?.trim()) vodObject.notice = body.brandNotice.trim();

  const homeLogo = parseDataUrl(body.homeLogoDataUrl);
  if (homeLogo) {
    const logoPath = path.join(HOME_LOGO_DIR, `home_logo.${homeLogo.ext}`);
    await writeBinary(logoPath, homeLogo.buffer);
    vodObject.logo = `assets://brand/${path.basename(logoPath)}`;
  }

  if (!vodObject.notice) {
    vodObject.notice = 'Managed by tv-admin. Replace with your own source list before release.';
  }

  await writeText(DEFAULT_VOD_JSON_PATH, `${JSON.stringify(vodObject, null, 2)}\n`);
  nextBrand.defaultVodConfig = 'assets://brand/default_vod.json';

  const background = parseDataUrl(body.backgroundDataUrl);
  if (background) {
    const wallPath = path.join(HOME_LOGO_DIR, `default_wallpaper.${background.ext}`);
    await writeBinary(wallPath, background.buffer);
    nextBrand.defaultWallConfig = `assets://brand/${path.basename(wallPath)}`;
  }

  const launcher = parseDataUrl(body.launcherIconDataUrl);
  if (launcher) {
    await writeBinary(LAUNCHER_BITMAP_PATH, launcher.buffer);
    await Promise.all(LAUNCHER_PNGS.map((item) => writeBinary(item, launcher.buffer)));
    await writeText(
      LAUNCHER_FOREGROUND_XML_PATH,
      [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<bitmap xmlns:android="http://schemas.android.com/apk/res/android"',
        '    android:gravity="center"',
        '    android:src="@drawable/ic_brand_launcher" />'
      ].join('\n')
    );
  }

  const banner = parseDataUrl(body.tvBannerDataUrl);
  if (banner) await writeBinary(BANNER_PATH, banner.buffer);

  await writeProperties(BRAND_PROPS_PATH, BRAND_KEYS, nextBrand);
  return readState();
}

async function saveSigning(body) {
  const next = {
    storeFile: body.storeFile?.trim() || '',
    keyAlias: body.keyAlias?.trim() || '',
    storePassword: body.storePassword?.trim() || ''
  };
  if (!next.storeFile && !next.keyAlias && !next.storePassword) {
    if (fs.existsSync(LOCAL_PROPS_PATH)) await fsp.unlink(LOCAL_PROPS_PATH);
    return readState();
  }
  await writeProperties(LOCAL_PROPS_PATH, SIGNING_KEYS, next);
  return readState();
}

function buildTaskName(mode, abi, buildType) {
  const modeMap = { leanback: 'Leanback', mobile: 'Mobile' };
  const abiMap = { arm64_v8a: 'Arm64_v8a', armeabi_v7a: 'Armeabi_v7a' };
  const typeMap = { release: 'Release', debug: 'Debug' };
  return `assemble${modeMap[mode] || 'Leanback'}${abiMap[abi] || 'Arm64_v8a'}${typeMap[buildType] || 'Release'}`;
}

async function findBuiltApk(buildType) {
  const candidates = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.apk')) candidates.push(fullPath);
    }
  }
  if (buildType === 'release') await walk(path.join(ROOT, 'Release', 'apk'));
  await walk(path.join(ROOT, 'app', 'build', 'outputs', 'apk'));
  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return candidates[0] || '';
}

async function buildApk(body) {
  const brand = await readProperties(BRAND_PROPS_PATH);
  const signing = await readProperties(LOCAL_PROPS_PATH);
  const machineJavaHome = await getMachineEnv('JAVA_HOME');
  const machineAndroidHome = await getMachineEnv('ANDROID_HOME');
  const machineSdkRoot = await getMachineEnv('ANDROID_SDK_ROOT');
  const javaHome = body.javaHome?.trim() || brand.javaHome || machineJavaHome || '';
  if (!javaHome && !process.env.JAVA_HOME) {
    throw new Error('JAVA_HOME is empty. Save a JDK path first, then build again.');
  }

  if (javaHome) {
    const javaExe = path.join(javaHome, 'bin', 'java.exe');
    if (!fs.existsSync(javaExe)) throw new Error(`JAVA_HOME is invalid: ${javaHome}`);
  }

  const task = buildTaskName(body.mode, body.abi, body.buildType);
  const env = { ...process.env };
  if (javaHome) {
    env.JAVA_HOME = javaHome;
    env.Path = `${path.join(javaHome, 'bin')};${env.Path || env.PATH || ''}`;
  }
  if (machineAndroidHome) env.ANDROID_HOME = machineAndroidHome;
  if (machineSdkRoot) env.ANDROID_SDK_ROOT = machineSdkRoot;

  return new Promise((resolve, reject) => {
    const child = spawn('cmd.exe', ['/c', 'gradlew.bat', task], { cwd: ROOT, env });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk.toString()));
    child.stderr.on('data', (chunk) => (output += chunk.toString()));
    child.on('error', (error) => reject(error));
    child.on('close', async (code) => {
      let apkPath = '';
      if (code === 0) {
        const expected = expectedApkPath(body.mode || 'leanback', body.abi || 'arm64_v8a', body.buildType || 'release');
        apkPath = fs.existsSync(expected) ? expected : await findBuiltApk(body.buildType);
      }
      if (code !== 0) reject(new Error(output.trim() || `Gradle exited with code ${code}`));
      else {
        const signature = await verifyApkSignature(apkPath, env);
        resolve({
          task,
          output: output.trim(),
          apkPath,
          signature,
          signingMode: hasCustomSigningConfig(signing) ? 'custom' : 'debugFallback'
        });
      }
    });
  });
}

async function parseJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function getMimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const target = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, target));
  if (!filePath.startsWith(PUBLIC_DIR)) return text(res, 403, 'Forbidden');
  try {
    const content = await fsp.readFile(filePath);
    text(res, 200, content, getMimeType(filePath));
  } catch {
    text(res, 404, 'Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, await readState());
    if (req.method === 'POST' && url.pathname === '/api/save-branding') return json(res, 200, await saveBranding(await parseJsonBody(req)));
    if (req.method === 'POST' && url.pathname === '/api/save-signing') return json(res, 200, await saveSigning(await parseJsonBody(req)));
    if (req.method === 'POST' && url.pathname === '/api/build') return json(res, 200, await buildApk(await parseJsonBody(req)));
    return serveStatic(req, res);
  } catch (error) {
    return json(res, 500, { error: error.message || String(error) });
  }
});

const port = Number(process.env.TV_ADMIN_PORT || 8787);
server.listen(port, () => {
  console.log(`tv-admin is running at http://127.0.0.1:${port}`);
});
