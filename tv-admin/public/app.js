const stateEls = {
  javaStatus: document.getElementById('javaStatus'),
  androidStatus: document.getElementById('androidStatus'),
  pythonStatus: document.getElementById('pythonStatus'),
  signingStatus: document.getElementById('signingStatus'),
  vodConfigStatus: document.getElementById('vodConfigStatus'),
  buildResult: document.getElementById('buildResult'),
  buildLog: document.getElementById('buildLog')
};

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function readFileAsDataUrl(input) {
  const file = input.files?.[0];
  if (!file) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

function renderState(data) {
  setValue('appName', data.appNames.default);
  setValue('appNameZhCN', data.appNames.zhCN);
  setValue('appNameZhTW', data.appNames.zhTW);
  setValue('applicationId', data.brand.applicationId);
  setValue('updateBaseUrl', data.brand.updateBaseUrl);
  setValue('javaHome', data.brand.javaHome);
  setValue('defaultLiveConfig', data.brand.defaultLiveConfig);
  setValue('defaultWallConfig', data.brand.defaultWallConfig);
  setValue('storeFile', data.signing.storeFile);
  setValue('keyAlias', data.signing.keyAlias);
  setValue('storePassword', data.signing.storePassword);
  setValue('vodJson', data.vodJson);

  stateEls.javaStatus.textContent = data.java.ok ? '可用' : '未就绪';
  stateEls.androidStatus.textContent = data.android.ok ? '可用' : '未就绪';
  stateEls.pythonStatus.textContent = data.python.ok ? '可用' : '未就绪';
  stateEls.signingStatus.textContent = data.signing.message || '未检测';
  stateEls.vodConfigStatus.textContent = data.brand.defaultVodConfig || '未启用';
}

async function loadState() {
  stateEls.buildResult.textContent = '正在刷新状态...';
  const data = await request('/api/state');
  renderState(data);
  stateEls.buildResult.textContent = '状态已同步';
  stateEls.buildLog.textContent = data.java.output || '';
}

async function saveBranding() {
  const payload = {
    appName: document.getElementById('appName').value,
    appNameZhCN: document.getElementById('appNameZhCN').value,
    appNameZhTW: document.getElementById('appNameZhTW').value,
    applicationId: document.getElementById('applicationId').value,
    updateBaseUrl: document.getElementById('updateBaseUrl').value,
    javaHome: document.getElementById('javaHome').value,
    defaultLiveConfig: document.getElementById('defaultLiveConfig').value,
    defaultWallConfig: document.getElementById('defaultWallConfig').value,
    brandNotice: document.getElementById('brandNotice').value,
    vodJson: document.getElementById('vodJson').value,
    homeLogoDataUrl: await readFileAsDataUrl(document.getElementById('homeLogo')),
    backgroundDataUrl: await readFileAsDataUrl(document.getElementById('backgroundImage')),
    launcherIconDataUrl: await readFileAsDataUrl(document.getElementById('launcherIcon')),
    tvBannerDataUrl: await readFileAsDataUrl(document.getElementById('tvBanner'))
  };

  stateEls.buildResult.textContent = '正在保存品牌配置...';
  const data = await request('/api/save-branding', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  renderState(data);
  stateEls.buildResult.textContent = '品牌配置已保存';
}

async function saveSigning() {
  const payload = {
    storeFile: document.getElementById('storeFile').value,
    keyAlias: document.getElementById('keyAlias').value,
    storePassword: document.getElementById('storePassword').value
  };
  stateEls.buildResult.textContent = '正在保存签名信息...';
  const data = await request('/api/save-signing', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  renderState(data);
  stateEls.buildResult.textContent = '签名信息已保存';
}

async function buildApk() {
  const payload = {
    mode: document.getElementById('buildMode').value,
    abi: document.getElementById('buildAbi').value,
    buildType: document.getElementById('buildType').value,
    javaHome: document.getElementById('javaHome').value
  };
  stateEls.buildResult.textContent = '正在构建 APK，请稍等...';
  stateEls.buildLog.textContent = '';
  const data = await request('/api/build', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  const signingLabel = data.signingMode === 'custom' ? '自定义签名' : '默认调试签名';
  const verifyLabel = data.signature?.ok ? '已通过验签' : '验签未通过';
  stateEls.buildResult.textContent = data.apkPath
    ? `构建完成：${data.apkPath}`
    : '构建完成';
  stateEls.buildLog.textContent = [
    `Task: ${data.task}`,
    `签名模式: ${signingLabel}`,
    `验签结果: ${verifyLabel}`,
    '',
    data.signature?.output || '',
    data.output || ''
  ]
    .filter(Boolean)
    .join('\n\n');
}

document.getElementById('reloadState').addEventListener('click', () => loadState().catch(showError));
document.getElementById('saveBranding').addEventListener('click', () => saveBranding().catch(showError));
document.getElementById('saveSigning').addEventListener('click', () => saveSigning().catch(showError));
document.getElementById('buildApk').addEventListener('click', () => buildApk().catch(showError));

function showError(error) {
  stateEls.buildResult.textContent = '操作失败';
  stateEls.buildLog.textContent = error.message || String(error);
}

loadState().catch(showError);
