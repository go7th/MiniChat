# MiniChat - 本地语音聊天机器人设计文档

## 概述

一个基于 Electron 的本地语音聊天机器人，通过语音与 AI 大模型实时对话。支持本地 Ollama 和云端模型切换。全部语音处理（STT/TTS/VAD）在本地离线完成。

## 核心需求

- 语音通话：语音 → STT → 大模型 → TTS → 播放
- 本地离线：STT、TTS、VAD 全部使用 sherpa-onnx 本地模型
- AI 后端可切换：Ollama（本地）/ OpenAI / Claude（云端）
- 云端模型支持 API Key 授权配置
- 两种交互模式：单击按钮自动对话 + 空格键按住说话

## 架构

```
┌─────────────────────────────────────┐
│         Renderer (UI)               │
│  ┌───────────────────────────────┐  │
│  │   通话按钮 + 状态波纹动画      │  │
│  │   麦克风录音 (Web Audio API)   │  │
│  │   实时字幕显示                 │  │
│  └───────────┬───────────────────┘  │
│              │ IPC                   │
├──────────────┼──────────────────────┤
│         Main Process                │
│  ┌───────────▼───────────────────┐  │
│  │  sherpa-onnx-node             │  │
│  │  ├─ VAD (Silero VAD)          │  │
│  │  ├─ STT (Zipformer 中英双语)  │  │
│  │  └─ TTS (VITS 中文语音合成)   │  │
│  ├───────────────────────────────┤  │
│  │  AI Provider (统一接口)        │  │
│  │  ├─ OllamaProvider            │  │
│  │  ├─ OpenAIProvider            │  │
│  │  └─ ClaudeProvider            │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 数据流

1. 渲染进程通过 Web Audio API 录音，采集 PCM 音频数据
2. 通过 IPC 发送音频数据到主进程
3. 主进程用 sherpa-onnx VAD 检测语音段（自动模式）或直接接收完整音频（空格模式）
4. sherpa-onnx STT 将音频转文字
5. 文字发给 AI Provider，流式获取回复
6. sherpa-onnx TTS 将回复转语音 PCM 数据
7. 音频数据通过 IPC 返回渲染进程播放

## 技术栈

- **Electron + Vite** — 桌面应用框架与构建工具
- **原生 HTML/CSS/JS** — 渲染进程 UI（项目简单，无需前端框架）
- **sherpa-onnx-node** — STT + TTS + VAD 全家桶
- **原生 fetch** — 调用 Ollama / 云端 API

## sherpa-onnx 模型

| 功能 | 模型 | 说明 |
|------|------|------|
| STT | sherpa-onnx-streaming-zipformer-bilingual-zh-en | 中英双语流式识别 |
| TTS | vits-zh-hf-theresa | 中文语音合成 |
| VAD | Silero VAD | 语音活动检测 |

## AI Provider 统一接口

```typescript
interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AIProvider {
  chat(messages: Message[]): AsyncGenerator<string>  // 流式返回文本片段
}
```

### 实现

- **OllamaProvider**: 调用 `http://localhost:11434/api/chat`，流式响应
- **OpenAIProvider**: 调用 OpenAI 兼容 API（`/v1/chat/completions`），流式 SSE
- **ClaudeProvider**: 调用 Anthropic Messages API，流式 SSE

Ollama 和 OpenAI 都兼容 OpenAI 格式，实际只需两个实现：OpenAI 兼容 + Claude。

## UI 设计

### 主页面（通话页）

- 中央大圆形按钮，单击切换自动对话模式
- 按钮周围动态波纹，反映当前状态：
  - 空闲 — 静止
  - 监听中 — 蓝色缓慢脉动
  - 用户说话中 — 绿色波纹扩散
  - AI 思考中 — 黄色旋转
  - AI 说话中 — 紫色波纹
- 底部实时字幕（用户语音 + AI 回复）
- 右上角设置图标

### 设置页

- AI 后端选择：Ollama / OpenAI / Claude / 自定义
- Ollama 配置：模型名称、服务地址
- 云端配置：API Key、模型选择
- STT/TTS 模型路径配置

## 状态机

```
         ┌──────┐
         │ IDLE │ ◄──────────────────┐
         └──┬───┘                    │
    点击按钮 │                        │
         ┌──▼───────┐               │
         │ LISTENING │ ◄─────┐       │
         └──┬───────┘       │       │
   检测到语音│(VAD/空格)     │       │
         ┌──▼───────┐       │       │
         │ RECORDING │       │       │
         └──┬───────┘       │       │
   语音结束 │               │       │
         ┌──▼──────┐        │       │
         │ STT转文字│        │       │
         └──┬──────┘        │       │
         ┌──▼──────────┐    │       │
         │ AI生成回复    │    │       │
         └──┬──────────┘    │       │
         ┌──▼──────┐        │       │
         │ TTS播放  │        │       │
         └──┬──────┘        │       │
            │ 自动模式       │       │
            └───────────────┘       │
            │ 再次点击按钮结束        │
            └───────────────────────┘
```

### 交互模式

- **单击按钮** → 进入自动对话模式，VAD 自动检测语音，循环对话直到再次点击结束
- **空格键按住** → 按住说话，松开后发送，不进入循环

### 会话管理

- 维护 messages 数组保持上下文连续
- 点击结束通话时清空会话

## 项目结构

```
MiniChat/
├── package.json
├── vite.config.js
├── electron/
│   ├── main.js              # Electron 主进程入口
│   ├── preload.js           # preload 脚本，暴露 IPC API
│   ├── audio-engine.js      # sherpa-onnx STT/TTS/VAD 封装
│   ├── ai-provider.js       # AI Provider 统一接口
│   ├── providers/
│   │   ├── ollama.js        # Ollama 实现
│   │   ├── openai.js        # OpenAI 兼容实现
│   │   └── claude.js        # Claude 实现
│   └── config.js            # 配置管理（持久化到 JSON）
├── src/
│   ├── index.html           # 主页面
│   ├── styles.css           # 样式（波纹动画等）
│   ├── app.js               # 主页面逻辑
│   ├── recorder.js          # Web Audio 录音
│   └── settings.html        # 设置页
└── models/                  # sherpa-onnx 模型文件（gitignore）
    ├── stt/
    ├── tts/
    └── vad/
```

## 配置持久化

使用 JSON 文件存储在 Electron `userData` 目录：

```json
{
  "provider": "ollama",
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "qwen2.5"
  },
  "openai": {
    "apiKey": "",
    "baseUrl": "https://api.openai.com",
    "model": "gpt-4o"
  },
  "claude": {
    "apiKey": "",
    "model": "claude-sonnet-4-20250514"
  },
  "sttModelPath": "models/stt",
  "ttsModelPath": "models/tts"
}
```
