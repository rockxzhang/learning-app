# 开发流程（README-DEV）

工作目录即仓库：`C:\Users\rockxzhang\Hydro\learning-app`。

## 依赖
- Node 未入 PATH，复用便携版：`D:\hydro-packager\node-v20.18.0-win-x64`
- 拉依赖：`$env:PATH="D:\hydro-packager\node-v20.18.0-win-x64;$env:PATH"; npm install`
- `.npmrc` 已配 npmmirror 源 + Electron 镜像（国内可用）

## 日常
```powershell
$env:PATH="D:\hydro-packager\node-v20.18.0-win-x64;$env:PATH"
npm start          # 运行
```

## 版本控制
```bash
git status
git add -A
git commit -m "说明"
git log --oneline
git push origin master   # 若有远程
```

## 发布
```bash
npm run release
```
读取 `release/version.json`（初始 1000），+1 后打 `release/V1.0.N/张老师随身讲-V1.0.N.exe`。

## 注意
- `services/config.js` 内嵌模型 API Key；上传公开仓库前请先处理掉，或用私有仓库。
- 首次打包 Electron 依赖已装好（node_modules 不入库）。
