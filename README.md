# TV 项目品牌化说明

BRANDING_GUIDE

一个基于fongmiTV开源项目的TV版影视APP，包含一个web网页版管理系统，可以自定义“名字+logo + 内置接口 + 打包 APK”

官方主页：https://10000yun.com/

教程及配置：https://10000yun.com/300.html

关注公众号：玩云匣

灵感来自：https://github.com/FongMi/TV

**玩云盒子TV-完整源码：**

https://github.com/cheerqjy/10000yun-box-tv-app



这个项目现在已经补了一层品牌化入口，你可以手改源码，也可以直接用 `tv-admin` 网页后台来做。

## 推荐入口

- 网页后台目录：`TV-release/tv-admin`
- 启动命令：`node .\tv-admin\server.js`
- 打开地址：[http://127.0.0.1:8787](http://127.0.0.1:8787)

## 以后最常改的地方

### 1. 应用名称

- 默认语言：[app/src/main/res/values/strings.xml](C:/Users/EDY/Desktop/TV-release/app/src/main/res/values/strings.xml)
- 简中：[app/src/main/res/values-zh-rCN/strings.xml](C:/Users/EDY/Desktop/TV-release/app/src/main/res/values-zh-rCN/strings.xml)
- 繁中：[app/src/main/res/values-zh-rTW/strings.xml](C:/Users/EDY/Desktop/TV-release/app/src/main/res/values-zh-rTW/strings.xml)
- 对应字段：`<string name="app_name">...</string>`

### 2. APK 包名 / 应用 ID

- 文件：[branding/brand.properties](C:/Users/EDY/Desktop/TV-release/branding/brand.properties)
- 对应字段：`applicationId=...`
- 当前已经改成从这个文件注入 `app/build.gradle`，不需要手动全局改 Java 包路径。

### 3. 内置接口

- 内置 VOD 配置文件：[app/src/main/assets/brand/default_vod.json](C:/Users/EDY/Desktop/TV-release/app/src/main/assets/brand/default_vod.json)
- 默认入口配置：[branding/brand.properties](C:/Users/EDY/Desktop/TV-release/branding/brand.properties)
- 对应字段：
  - `defaultVodConfig=assets://brand/default_vod.json`
  - `defaultLiveConfig=...`
  - `defaultWallConfig=...`

说明：

- `assets://` 代表直接把文件打进 APK
- 这套默认配置现在已经接入 `Config.vod()/live()/wall()`，首次安装时就能生效

### 4. 首页 logo

- 推荐方式：在 `tv-admin` 上传“首页 logo”
- 原理：后台会把图片写到 `app/src/main/assets/brand/`，并自动写进内置 VOD JSON 的 `logo` 字段
- 代码入口：[app/src/main/java/com/fongmi/android/tv/utils/ImgUtil.java](C:/Users/EDY/Desktop/TV-release/app/src/main/java/com/fongmi/android/tv/utils/ImgUtil.java)

### 5. 默认背景

- 推荐方式：在 `tv-admin` 上传“默认背景”
- 背景加载代码：[app/src/main/java/com/fongmi/android/tv/ui/custom/CustomWallView.java](C:/Users/EDY/Desktop/TV-release/app/src/main/java/com/fongmi/android/tv/ui/custom/CustomWallView.java)
- 内置背景入口：`defaultWallConfig`

### 6. 桌面图标 / TV banner

- 桌面图标主资源目录：
  - [app/src/main/res/mipmap-mdpi](C:/Users/EDY/Desktop/TV-release/app/src/main/res/mipmap-mdpi)
  - [app/src/main/res/mipmap-hdpi](C:/Users/EDY/Desktop/TV-release/app/src/main/res/mipmap-hdpi)
  - [app/src/main/res/mipmap-xhdpi](C:/Users/EDY/Desktop/TV-release/app/src/main/res/mipmap-xhdpi)
  - [app/src/main/res/mipmap-xxhdpi](C:/Users/EDY/Desktop/TV-release/app/src/main/res/mipmap-xxhdpi)
  - [app/src/main/res/mipmap-xxxhdpi](C:/Users/EDY/Desktop/TV-release/app/src/main/res/mipmap-xxxhdpi)
- 自适应前景图入口：[app/src/main/res/drawable/ic_launcher_foreground.xml](C:/Users/EDY/Desktop/TV-release/app/src/main/res/drawable/ic_launcher_foreground.xml)
- TV banner 图片：[app/src/leanback/res/drawable/ic_banner.png](C:/Users/EDY/Desktop/TV-release/app/src/leanback/res/drawable/ic_banner.png)

说明：

- `tv-admin` 已经支持直接上传桌面图标和 TV banner
- `roundIcon` 已经改成和普通 `ic_launcher` 共用，减少一套资源维护

### 7. 更新源

- 文件：[branding/brand.properties](C:/Users/EDY/Desktop/TV-release/branding/brand.properties)
- 字段：`updateBaseUrl=...`
- 代码入口：[app/src/main/java/com/fongmi/android/tv/utils/Github.java](C:/Users/EDY/Desktop/TV-release/app/src/main/java/com/fongmi/android/tv/utils/Github.java)

### 8. 打包签名

- 文件：[local.properties](C:/Users/EDY/Desktop/TV-release/local.properties)
- 字段：
  - `storeFile=...`
  - `keyAlias=...`
  - `storePassword=...`

说明：

- 现在 `app/build.gradle` 已经改成“有签名就签名，没有就继续构建未签名 release”
- 所以不会再因为缺少 `local.properties` 在配置阶段直接失败

## 构建命令

### TV 正式包

```powershell
.\gradlew.bat assembleLeanbackArm64_v8aRelease
```

### TV 调试包

```powershell
.\gradlew.bat assembleLeanbackArm64_v8aDebug
```

### 输出目录

- Release 汇总目录：[Release/apk](C:/Users/EDY/Desktop/TV-release/Release/apk)
- Gradle 原始输出目录：[app/build/outputs/apk](C:/Users/EDY/Desktop/TV-release/app/build/outputs/apk)

## 当前环境里要注意的事

- 这台机器当前 `node` 已经可用
- 这台机器当前命令行里还没有可用 `java`
- 所以要想真正“一键打包”，还需要在后台里填上有效的 `JAVA_HOME`，或者先把 JDK 配到系统环境变量里
