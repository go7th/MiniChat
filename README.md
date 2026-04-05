# MiniChat

> A local voice chatbot with offline STT/TTS and pluggable AI backends.
> 本地语音聊天机器人，离线语音识别和合成，可切换 AI 后端。
> オフライン音声認識・合成機能を備えたローカル音声チャットボット。

**[English](#english)** · **[中文](#中文)** · **[日本語](#日本語)**

---

## English

A voice-first chatbot that runs locally on your machine. Speech recognition, speech synthesis, and voice activity detection all run offline via [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx). Chat with local Ollama models or cloud providers (OpenAI, Claude).

### Features

- **Fully offline voice I/O** — STT, TTS, and VAD run locally, no cloud required
- **Pluggable AI backends** — Ollama (local), OpenAI-compatible APIs, Claude
- **Two interaction modes** — auto-conversation with VAD, or push-to-talk (hold space)
- **Wake word interrupt** — say the wake word to cut off AI mid-response
- **Stop keywords** — say "停止" / "住嘴" / "闭嘴" etc. to stop AI
- **Multiple voices** — Theresa (default) or MeloTTS (more natural)
- **Chat history** — collapsible side panel with full conversation

### Requirements

- Node.js 20.19+ or 22.12+
- macOS / Windows / Linux
- (Optional) Ollama running locally for the default backend

### Quick Start

```bash
# Install dependencies
npm install

# Download sherpa-onnx models (STT/TTS/VAD, ~1GB total)
npm run download-models

# Start the app
npm run dev
```

### Configuration

Click the gear icon to open settings:
- **Voice**: Theresa or MeloTTS (click 试听 to preview)
- **Wake Word**: default `小助手`, say it to interrupt
- **AI Backend**: Ollama / OpenAI / Claude
  - Ollama: set base URL and model name
  - OpenAI: API key, base URL (for compatible services), model
  - Claude: API key and model

### Tech Stack

- Electron + electron-vite
- sherpa-onnx-node (STT: SenseVoice / TTS: VITS / VAD: Silero)
- Native fetch for streaming AI APIs

---

## 中文

一个运行在本地的语音优先聊天机器人。语音识别、语音合成和语音活动检测全部使用 [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) 离线运行。支持本地 Ollama 模型或云端服务（OpenAI、Claude）。

### 特性

- **完全离线的语音 I/O** — STT、TTS、VAD 本地运行，无需联网
- **可切换 AI 后端** — Ollama（本地）、OpenAI 兼容 API、Claude
- **两种交互模式** — VAD 自动对话，或空格键按住说话
- **唤醒词打断** — 说出唤醒词可中断 AI 回答
- **停止关键词** — 说"停止"、"住嘴"、"闭嘴"等可停止 AI
- **多种声音** — Theresa（默认）或 MeloTTS（更自然）
- **聊天记录** — 可折叠侧边栏显示完整对话

### 环境要求

- Node.js 20.19+ 或 22.12+
- macOS / Windows / Linux
- （可选）本地运行的 Ollama，用于默认后端

### 快速开始

```bash
# 安装依赖
npm install

# 下载 sherpa-onnx 模型（STT/TTS/VAD，约 1GB）
npm run download-models

# 启动应用
npm run dev
```

### 配置

点击齿轮图标打开设置：
- **语音**：Theresa 或 MeloTTS（点击"试听"预览）
- **唤醒词**：默认 `小助手`，说出可打断回答
- **AI 后端**：Ollama / OpenAI / Claude
  - Ollama：设置服务地址和模型名
  - OpenAI：API Key、Base URL（兼容服务）、模型
  - Claude：API Key 和模型

### 技术栈

- Electron + electron-vite
- sherpa-onnx-node（STT: SenseVoice / TTS: VITS / VAD: Silero）
- 原生 fetch 流式调用 AI API

---

## 日本語

ローカル環境で動作する音声優先のチャットボットです。音声認識、音声合成、音声活動検出はすべて [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) によりオフラインで実行されます。ローカルの Ollama モデルまたはクラウドプロバイダー（OpenAI、Claude）と連携できます。

### 特徴

- **完全オフライン音声 I/O** — STT、TTS、VAD はローカル実行、クラウド不要
- **切り替え可能な AI バックエンド** — Ollama（ローカル）、OpenAI 互換 API、Claude
- **2 つのインタラクションモード** — VAD による自動会話、またはスペースキー押下で発話
- **ウェイクワードによる中断** — ウェイクワードを発声すると AI の応答を中断
- **停止キーワード** — "停止"、"住嘴"、"闭嘴"などで AI を停止
- **複数の音声** — Theresa（デフォルト）または MeloTTS（より自然）
- **チャット履歴** — 折りたたみ可能なサイドパネルで全会話を表示

### 必要環境

- Node.js 20.19+ または 22.12+
- macOS / Windows / Linux
- （オプション）デフォルトバックエンド用のローカル Ollama

### クイックスタート

```bash
# 依存関係をインストール
npm install

# sherpa-onnx モデルをダウンロード（STT/TTS/VAD、約 1GB）
npm run download-models

# アプリを起動
npm run dev
```

### 設定

歯車アイコンをクリックして設定を開きます：
- **音声**: Theresa または MeloTTS（"试听"をクリックしてプレビュー）
- **ウェイクワード**: デフォルトは `小助手`、発声すると中断
- **AI バックエンド**: Ollama / OpenAI / Claude
  - Ollama: ベース URL とモデル名を設定
  - OpenAI: API キー、ベース URL（互換サービス用）、モデル
  - Claude: API キーとモデル

### 技術スタック

- Electron + electron-vite
- sherpa-onnx-node（STT: SenseVoice / TTS: VITS / VAD: Silero）
- ネイティブ fetch によるストリーミング AI API

---

## License

MIT
