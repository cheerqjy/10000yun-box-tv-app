# TV Admin

`tv-admin` 是这个项目的独立网页管理后台，目标是把“品牌化 + 内置接口 + 打包 APK”收口到一个页面里。

## 启动

```powershell
node .\tv-admin\server.js
```

默认地址：

```text
http://127.0.0.1:8787
```

## 当前能力

- 修改应用显示名（默认、简中、繁中）
- 修改 `applicationId`
- 写入内置 VOD 配置到 `app/src/main/assets/brand/default_vod.json`
- 上传首页 logo、默认背景、桌面图标、TV banner
- 保存签名信息到 `local.properties`
- 调用 `gradlew.bat` 一键构建 APK

## 构建前提

- 机器上要有可用的 JDK
- 在页面里填好 `JAVA_HOME`，或者系统环境变量里已经有 `JAVA_HOME`
- 如果要正式签名包，先在页面里填写 keystore 信息

## 说明

- 没有签名信息时，`release` 仍然会尝试构建未签名包
- `defaultWallConfig` 在上传默认背景图后会自动写成 `assets://brand/...`
- 桌面图标目前会直接覆盖现有 `ic_launcher.png`，建议上传高清正方形 PNG
