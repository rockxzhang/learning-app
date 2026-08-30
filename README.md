# 张老师随身讲（自主学习讲解）

上传题目（图片 / PDF / Word / Markdown），模型自动生成：
- **左侧**：带逐行中文注释的 C++ 参考代码
- **右上**：详细解题思路（题意、算法、复杂度、样例推演、易错点）
- **右下**：2D 动画数字人教师，用自然中文语音逐句讲解，口型/身形随音量摆动，滚动中文字幕，支持上一句/下一句/播放/暂停/语速

并具备**跨题目记忆**：记录每道题的知识点与你标记的薄弱点，下次讲解会针对性地多讲、复习。

## 运行（开发）
```powershell
$env:PATH = "D:\hydro-packager\node-v20.18.0-win-x64;$env:PATH"
npm install        # 首次
npm start
```

## 打包发布
```bash
npm run release    # 读取版本号+1，打 release/V1.0.N/张老师随身讲-V1.0.N.exe
```

## 技术说明
- Electron + DeepSeek 视觉大模型（`deepseek-v4-flash-vision-exp`，密钥内嵌于 `services/config.js`，制作者预设）
- 纯 Node 实现微软 Edge TTS（`services/tts.js`，带 `Sec-MS-GEC` 签名），无需外部 Python，自然中文男/女声
- WebAudio 振幅驱动 SVG 教师头像动画（`renderer/avatar.js`）
- 记忆与个性化：`services/memory.js` + `services/analyze.js`（把学习档案薄弱点带入 prompt）

> 发布到 GitHub 请确保**私有仓库**或先在 `services/config.js` 中剔除内嵌的模型 API Key。
