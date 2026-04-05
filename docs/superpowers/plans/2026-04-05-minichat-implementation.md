# MiniChat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron voice chatbot that uses sherpa-onnx for local STT/TTS/VAD and supports Ollama + cloud AI providers.

**Architecture:** Electron app with electron-vite. Main process handles all sherpa-onnx audio processing and AI API calls. Renderer handles microphone recording via Web Audio API and audio playback. Communication via IPC.

**Tech Stack:** Electron, electron-vite, sherpa-onnx-node, Web Audio API, Ollama/OpenAI/Claude APIs

---

## File Structure

```
MiniChat/
├── package.json
├── electron.vite.config.mjs
├── resources/                    # App icon etc
├── src/
│   ├── main/
│   │   ├── index.js              # Electron main process entry
│   │   ├── audio-engine.js       # sherpa-onnx STT/TTS/VAD wrapper
│   │   ├── ai-provider.js        # AI provider factory + base
│   │   ├── providers/
│   │   │   ├── ollama.js         # Ollama provider
│   │   │   ├── openai-compat.js  # OpenAI-compatible provider
│   │   │   └── claude.js         # Claude provider
│   │   ├── config.js             # Config persistence
│   │   └── ipc-handlers.js       # IPC handler registration
│   ├── preload/
│   │   └── index.js              # Preload script, exposes IPC API
│   └── renderer/
│       ├── index.html            # Main page
│       ├── styles.css            # Styles + animations
│       ├── app.js                # Main page logic + state machine
│       ├── recorder.js           # Web Audio microphone recording
│       ├── settings.html         # Settings page
│       └── settings.js           # Settings page logic
├── scripts/
│   └── download-models.mjs       # Model download script
└── models/                       # sherpa-onnx models (gitignored)
    ├── stt/
    ├── tts/
    └── vad/
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.mjs`
- Create: `.gitignore`

- [ ] **Step 1: Initialize electron-vite project**

```bash
cd /Users/gowork/Desktop/all/mywork/MiniChat
npm init -y
```

- [ ] **Step 2: Install core dependencies**

```bash
npm install electron electron-vite --save-dev
npm install sherpa-onnx-node
```

- [ ] **Step 3: Create electron.vite.config.mjs**

```js
// electron.vite.config.mjs
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['sherpa-onnx-node']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {}
})
```

- [ ] **Step 4: Update package.json scripts and main entry**

```json
{
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "download-models": "node scripts/download-models.mjs"
  },
  "build": {
    "asarUnpack": [
      "node_modules/sherpa-onnx-node/**"
    ]
  }
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
out/
dist/
models/
.DS_Store
```

- [ ] **Step 6: Create directory structure**

```bash
mkdir -p src/main/providers src/preload src/renderer scripts models/{stt,tts,vad}
```

- [ ] **Step 7: Create minimal main process entry to verify Electron launches**

Create `src/main/index.js`:
```js
import { app, BrowserWindow } from 'electron'
import { join } from 'path'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
```

Create `src/preload/index.js`:
```js
// Placeholder - will be filled in Task 7
```

Create `src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>MiniChat</title>
</head>
<body>
  <h1>MiniChat</h1>
</body>
</html>
```

- [ ] **Step 8: Verify Electron launches**

```bash
npm run dev
```

Expected: Electron window opens showing "MiniChat" heading.

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold electron-vite project"
```

---

### Task 2: Model Download Script

**Files:**
- Create: `scripts/download-models.mjs`

- [ ] **Step 1: Create model download script**

Create `scripts/download-models.mjs`:
```js
import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const MODELS_DIR = join(ROOT, 'models')

const MODELS = {
  stt: {
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2',
    dir: 'sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20'
  },
  tts: {
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-zh-hf-theresa.tar.bz2',
    dir: 'vits-zh-hf-theresa'
  },
  vad: {
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx',
    file: 'silero_vad.onnx'
  }
}

function download(name, model) {
  const targetDir = join(MODELS_DIR, name)
  mkdirSync(targetDir, { recursive: true })

  if (model.file) {
    const filePath = join(targetDir, model.file)
    if (existsSync(filePath)) {
      console.log(`[${name}] Already exists, skipping.`)
      return
    }
    console.log(`[${name}] Downloading ${model.file}...`)
    execSync(`curl -SL -o "${filePath}" "${model.url}"`, { stdio: 'inherit' })
  } else {
    const dirPath = join(targetDir, model.dir)
    if (existsSync(dirPath)) {
      console.log(`[${name}] Already exists, skipping.`)
      return
    }
    console.log(`[${name}] Downloading and extracting...`)
    execSync(`curl -SL "${model.url}" | tar xjf - -C "${targetDir}"`, { stdio: 'inherit' })
  }

  console.log(`[${name}] Done.`)
}

console.log('Downloading sherpa-onnx models...\n')
for (const [name, model] of Object.entries(MODELS)) {
  download(name, model)
}
console.log('\nAll models downloaded.')
```

- [ ] **Step 2: Run the download script**

```bash
npm run download-models
```

Expected: Models download into `models/stt/`, `models/tts/`, `models/vad/`. This may take several minutes depending on network speed.

- [ ] **Step 3: Verify model files exist**

```bash
ls models/stt/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/
ls models/tts/vits-zh-hf-theresa/
ls models/vad/silero_vad.onnx
```

Expected: Model files are present.

- [ ] **Step 4: Commit**

```bash
git add scripts/download-models.mjs
git commit -m "feat: add model download script for STT/TTS/VAD"
```

---

### Task 3: Config Management

**Files:**
- Create: `src/main/config.js`

- [ ] **Step 1: Create config module**

Create `src/main/config.js`:
```js
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const CONFIG_FILE = join(app.getPath('userData'), 'config.json')

const DEFAULT_CONFIG = {
  provider: 'ollama',
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5'
  },
  openai: {
    apiKey: '',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4o'
  },
  claude: {
    apiKey: '',
    model: 'claude-sonnet-4-20250514'
  }
}

let config = null

export function loadConfig() {
  if (config) return config
  try {
    if (existsSync(CONFIG_FILE)) {
      config = { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) }
    } else {
      config = { ...DEFAULT_CONFIG }
    }
  } catch {
    config = { ...DEFAULT_CONFIG }
  }
  return config
}

export function saveConfig(newConfig) {
  config = { ...config, ...newConfig }
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  return config
}

export function getConfig() {
  return config || loadConfig()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/config.js
git commit -m "feat: add config persistence module"
```

---

### Task 4: AI Providers

**Files:**
- Create: `src/main/ai-provider.js`
- Create: `src/main/providers/ollama.js`
- Create: `src/main/providers/openai-compat.js`
- Create: `src/main/providers/claude.js`

- [ ] **Step 1: Create AI provider factory**

Create `src/main/ai-provider.js`:
```js
import { OllamaProvider } from './providers/ollama.js'
import { OpenAICompatProvider } from './providers/openai-compat.js'
import { ClaudeProvider } from './providers/claude.js'

export function createProvider(config) {
  switch (config.provider) {
    case 'ollama':
      return new OllamaProvider(config.ollama)
    case 'openai':
      return new OpenAICompatProvider(config.openai)
    case 'claude':
      return new ClaudeProvider(config.claude)
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}
```

- [ ] **Step 2: Create Ollama provider**

Create `src/main/providers/ollama.js`:
```js
export class OllamaProvider {
  constructor({ baseUrl, model }) {
    this.baseUrl = baseUrl
    this.model = model
  }

  async *chat(messages) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: true })
    })

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (!line.trim()) continue
        const data = JSON.parse(line)
        if (data.message?.content) {
          yield data.message.content
        }
      }
    }
  }
}
```

- [ ] **Step 3: Create OpenAI-compatible provider**

Create `src/main/providers/openai-compat.js`:
```js
export class OpenAICompatProvider {
  constructor({ apiKey, baseUrl, model }) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.model = model
  }

  async *chat(messages) {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ model: this.model, messages, stream: true })
    })

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6)
        if (payload === '[DONE]') return
        const data = JSON.parse(payload)
        const content = data.choices?.[0]?.delta?.content
        if (content) yield content
      }
    }
  }
}
```

- [ ] **Step 4: Create Claude provider**

Create `src/main/providers/claude.js`:
```js
export class ClaudeProvider {
  constructor({ apiKey, model }) {
    this.apiKey = apiKey
    this.model = model
  }

  async *chat(messages) {
    const systemMsg = messages.find(m => m.role === 'system')
    const nonSystemMsgs = messages.filter(m => m.role !== 'system')

    const body = {
      model: this.model,
      max_tokens: 1024,
      stream: true,
      messages: nonSystemMsgs
    }
    if (systemMsg) body.system = systemMsg.content

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) throw new Error(`Claude error: ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = JSON.parse(trimmed.slice(6))
        if (data.type === 'content_block_delta' && data.delta?.text) {
          yield data.delta.text
        }
      }
    }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/main/ai-provider.js src/main/providers/
git commit -m "feat: add AI providers (Ollama, OpenAI, Claude)"
```

---

### Task 5: Audio Engine (sherpa-onnx Wrapper)

**Files:**
- Create: `src/main/audio-engine.js`

- [ ] **Step 1: Create audio engine module**

Create `src/main/audio-engine.js`:
```js
import { join } from 'path'
import { app } from 'electron'

let sherpaOnnx

function getSherpaOnnx() {
  if (!sherpaOnnx) sherpaOnnx = require('sherpa-onnx-node')
  return sherpaOnnx
}

function modelsRoot() {
  // In dev: project root models/; in production: resources/models/
  if (app.isPackaged) {
    return join(process.resourcesPath, 'models')
  }
  return join(app.getAppPath(), 'models')
}

let recognizer = null
let stream = null
let tts = null
let vad = null

export function initSTT() {
  if (recognizer) return
  const sherpa = getSherpaOnnx()
  const sttDir = join(modelsRoot(), 'stt', 'sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20')

  recognizer = sherpa.createOnlineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: join(sttDir, 'encoder-epoch-99-avg-1.int8.onnx'),
        decoder: join(sttDir, 'decoder-epoch-99-avg-1.onnx'),
        joiner: join(sttDir, 'joiner-epoch-99-avg-1.int8.onnx'),
      },
      tokens: join(sttDir, 'tokens.txt'),
      numThreads: 2,
      provider: 'cpu',
      modelType: 'zipformer',
    },
    decodingMethod: 'greedy_search',
    enableEndpoint: 1,
    rule1MinTrailingSilence: 2.4,
    rule2MinTrailingSilence: 1.2,
    rule3MinUtteranceLength: 20,
  })

  stream = recognizer.createStream()
}

export function feedAudioToSTT(float32Samples) {
  if (!recognizer || !stream) return
  stream.acceptWaveform(16000, float32Samples)
  while (recognizer.isReady(stream)) {
    recognizer.decode(stream)
  }
}

export function getSTTResult() {
  if (!recognizer || !stream) return ''
  return recognizer.getResult(stream).text
}

export function resetSTT() {
  if (recognizer && stream) {
    recognizer.reset(stream)
  }
}

export function initTTS() {
  if (tts) return
  const sherpa = getSherpaOnnx()
  const ttsDir = join(modelsRoot(), 'tts', 'vits-zh-hf-theresa')

  tts = sherpa.createOfflineTts({
    offlineTtsModelConfig: {
      offlineTtsVitsModelConfig: {
        model: join(ttsDir, 'model.onnx'),
        tokens: join(ttsDir, 'tokens.txt'),
        lexicon: join(ttsDir, 'lexicon.txt'),
        noiseScale: 0.667,
        noiseScaleW: 0.8,
        lengthScale: 1.0,
      },
      numThreads: 2,
      debug: 0,
      provider: 'cpu',
    },
    maxNumSentences: 2,
  })
}

export function synthesize(text) {
  if (!tts) throw new Error('TTS not initialized')
  const audio = tts.generate({ text, sid: 0, speed: 1.0 })
  // audio.samples is Float32Array, audio.sampleRate is number
  return { samples: audio.samples, sampleRate: audio.sampleRate }
}

export function initVAD() {
  if (vad) return
  const sherpa = getSherpaOnnx()
  const vadModel = join(modelsRoot(), 'vad', 'silero_vad.onnx')

  vad = sherpa.createVad({
    sileroVad: {
      model: vadModel,
      threshold: 0.5,
      minSpeechDuration: 0.25,
      minSilenceDuration: 0.5,
      maxSpeechDuration: 30,
      windowSize: 512,
    },
    sampleRate: 16000,
    debug: false,
    numThreads: 1,
    bufferSizeInSeconds: 60,
  })
}

export function feedAudioToVAD(float32Samples) {
  if (!vad) return []
  const segments = []

  for (let i = 0; i < float32Samples.length; i += 512) {
    const chunk = float32Samples.subarray(i, Math.min(i + 512, float32Samples.length))
    if (chunk.length < 512) {
      // Pad last chunk with zeros
      const padded = new Float32Array(512)
      padded.set(chunk)
      vad.acceptWaveform(padded)
    } else {
      vad.acceptWaveform(chunk)
    }

    while (!vad.isEmpty()) {
      const seg = vad.front()
      segments.push({ start: seg.start, samples: seg.samples })
      vad.pop()
    }
  }

  return segments
}

export function flushVAD() {
  if (!vad) return []
  vad.flush()
  const segments = []
  while (!vad.isEmpty()) {
    const seg = vad.front()
    segments.push({ start: seg.start, samples: seg.samples })
    vad.pop()
  }
  return segments
}

export function initAll() {
  initSTT()
  initTTS()
  initVAD()
}

export function destroyAll() {
  if (stream) { stream.free(); stream = null }
  if (recognizer) { recognizer.free(); recognizer = null }
  if (tts) { tts.free(); tts = null }
  if (vad) { vad.free(); vad = null }
}
```

- [ ] **Step 2: Verify sherpa-onnx loads with models**

Add a temporary test at the bottom of `src/main/index.js`:
```js
import { initAll, synthesize, destroyAll } from './audio-engine.js'

app.whenReady().then(() => {
  createWindow()
  try {
    initAll()
    console.log('sherpa-onnx initialized successfully')
    const result = synthesize('你好')
    console.log(`TTS test: generated ${result.samples.length} samples at ${result.sampleRate}Hz`)
  } catch (e) {
    console.error('sherpa-onnx init failed:', e)
  }
})
```

```bash
npm run dev
```

Expected: Console shows "sherpa-onnx initialized successfully" and TTS sample count.

- [ ] **Step 3: Remove test code from main, commit**

Remove the temporary test imports and code from `src/main/index.js`.

```bash
git add src/main/audio-engine.js
git commit -m "feat: add sherpa-onnx audio engine (STT/TTS/VAD)"
```

---

### Task 6: Preload Script & IPC Bridge

**Files:**
- Create: `src/preload/index.js`
- Create: `src/main/ipc-handlers.js`

- [ ] **Step 1: Create preload script**

Create `src/preload/index.js`:
```js
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Audio processing
  sendAudio: (float32Array) => ipcRenderer.invoke('audio:send', float32Array.buffer),
  stopRecording: () => ipcRenderer.invoke('audio:stop'),

  // Session control
  startSession: (mode) => ipcRenderer.invoke('session:start', mode), // 'auto' | 'push'
  endSession: () => ipcRenderer.invoke('session:end'),

  // Events from main process
  onStateChange: (cb) => ipcRenderer.on('state:change', (_, state) => cb(state)),
  onSubtitle: (cb) => ipcRenderer.on('subtitle', (_, data) => cb(data)),
  onPlayAudio: (cb) => ipcRenderer.on('audio:play', (_, buffer) => cb(buffer)),
  onVADSpeechDetected: (cb) => ipcRenderer.on('vad:speech', () => cb()),
  onVADSilence: (cb) => ipcRenderer.on('vad:silence', () => cb()),

  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),

  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('state:change')
    ipcRenderer.removeAllListeners('subtitle')
    ipcRenderer.removeAllListeners('audio:play')
    ipcRenderer.removeAllListeners('vad:speech')
    ipcRenderer.removeAllListeners('vad:silence')
  }
})
```

- [ ] **Step 2: Create IPC handlers**

Create `src/main/ipc-handlers.js`:
```js
import { ipcMain } from 'electron'
import { initAll, destroyAll, feedAudioToSTT, feedAudioToVAD, getSTTResult, resetSTT, synthesize, flushVAD } from './audio-engine.js'
import { createProvider } from './ai-provider.js'
import { getConfig, saveConfig, loadConfig } from './config.js'

let currentState = 'idle' // idle | listening | recording | processing | speaking
let sessionMode = null // 'auto' | 'push'
let messages = []
let mainWindow = null

export function setMainWindow(win) {
  mainWindow = win
}

function setState(state) {
  currentState = state
  mainWindow?.webContents.send('state:change', state)
}

function sendSubtitle(data) {
  mainWindow?.webContents.send('subtitle', data)
}

export function registerIpcHandlers() {
  loadConfig()

  ipcMain.handle('config:get', () => getConfig())
  ipcMain.handle('config:save', (_, config) => saveConfig(config))

  ipcMain.handle('session:start', async (_, mode) => {
    sessionMode = mode
    messages = [{ role: 'system', content: '你是一个友好的语音助手，请用简洁的中文回答。' }]
    try {
      initAll()
      setState('listening')
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('session:end', () => {
    sessionMode = null
    messages = []
    resetSTT()
    setState('idle')
    return { ok: true }
  })

  ipcMain.handle('audio:send', async (_, arrayBuffer) => {
    const float32 = new Float32Array(arrayBuffer)

    if (sessionMode === 'auto') {
      // VAD mode: detect speech segments
      const segments = feedAudioToVAD(float32)
      if (segments.length > 0) {
        if (currentState === 'listening') setState('recording')
        for (const seg of segments) {
          feedAudioToSTT(seg.samples)
        }
      }
      // Also feed to STT for partial results
      const partial = getSTTResult()
      if (partial) {
        sendSubtitle({ role: 'user', text: partial, partial: true })
      }
    } else {
      // Push-to-talk: feed directly to STT
      if (currentState === 'listening') setState('recording')
      feedAudioToSTT(float32)
      const partial = getSTTResult()
      if (partial) {
        sendSubtitle({ role: 'user', text: partial, partial: true })
      }
    }

    return { ok: true }
  })

  ipcMain.handle('audio:stop', async () => {
    // Flush remaining audio
    if (sessionMode === 'auto') {
      const segments = flushVAD()
      for (const seg of segments) {
        feedAudioToSTT(seg.samples)
      }
    }

    const text = getSTTResult()
    resetSTT()

    if (!text || !text.trim()) {
      if (sessionMode === 'auto') setState('listening')
      return { ok: true, text: '' }
    }

    sendSubtitle({ role: 'user', text, partial: false })
    messages.push({ role: 'user', content: text })

    // Get AI response
    setState('processing')
    try {
      const config = getConfig()
      const provider = createProvider(config)
      let fullResponse = ''

      for await (const chunk of provider.chat(messages)) {
        fullResponse += chunk
        sendSubtitle({ role: 'assistant', text: fullResponse, partial: true })
      }

      sendSubtitle({ role: 'assistant', text: fullResponse, partial: false })
      messages.push({ role: 'assistant', content: fullResponse })

      // TTS
      setState('speaking')
      const audio = synthesize(fullResponse)
      mainWindow?.webContents.send('audio:play', {
        samples: Array.from(audio.samples),
        sampleRate: audio.sampleRate
      })

      return { ok: true, text }
    } catch (e) {
      console.error('AI/TTS error:', e)
      if (sessionMode === 'auto') setState('listening')
      else setState('idle')
      return { ok: false, error: e.message }
    }
  })
}
```

- [ ] **Step 3: Wire IPC handlers into main process**

Update `src/main/index.js`:
```js
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpcHandlers, setMainWindow } from './ipc-handlers.js'
import { destroyAll } from './audio-engine.js'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  setMainWindow(mainWindow)

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  destroyAll()
  app.quit()
})
```

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.js src/main/ipc-handlers.js src/main/index.js
git commit -m "feat: add IPC bridge and session management"
```

---

### Task 7: Renderer - Audio Recorder

**Files:**
- Create: `src/renderer/recorder.js`

- [ ] **Step 1: Create Web Audio recorder module**

Create `src/renderer/recorder.js`:
```js
let audioContext = null
let mediaStream = null
let workletNode = null
let isRecording = false

export async function startRecording(onAudioData) {
  audioContext = new AudioContext({ sampleRate: 16000 })

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true
    }
  })

  const source = audioContext.createMediaStreamSource(mediaStream)

  // Use ScriptProcessorNode (simpler, works reliably in Electron)
  const processor = audioContext.createScriptProcessor(4096, 1, 1)
  processor.onaudioprocess = (e) => {
    if (!isRecording) return
    const inputData = e.inputBuffer.getChannelData(0)
    const float32 = new Float32Array(inputData)
    onAudioData(float32)
  }

  source.connect(processor)
  processor.connect(audioContext.destination)

  isRecording = true
}

export function stopRecording() {
  isRecording = false

  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop())
    mediaStream = null
  }

  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
}

export function isActive() {
  return isRecording
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/recorder.js
git commit -m "feat: add Web Audio microphone recorder"
```

---

### Task 8: Renderer - Main UI (HTML + CSS)

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/styles.css`

- [ ] **Step 1: Create main page HTML**

Update `src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MiniChat</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div class="container">
    <!-- Settings button -->
    <button class="settings-btn" id="settingsBtn">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    </button>

    <!-- Main call button -->
    <div class="call-area">
      <div class="ripple-container" id="rippleContainer">
        <div class="ripple r1"></div>
        <div class="ripple r2"></div>
        <div class="ripple r3"></div>
        <button class="call-btn" id="callBtn">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15c1.66 0 2.99-1.34 2.99-3L15 6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17.3 12c0 3-2.54 5.1-5.3 5.1S6.7 15 6.7 12H5c0 3.42 2.72 6.23 6 6.72V22h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
        </button>
      </div>
      <p class="status-text" id="statusText">点击开始语音通话</p>
      <p class="hint-text" id="hintText">按住空格键：按住说话</p>
    </div>

    <!-- Subtitle area -->
    <div class="subtitle-area" id="subtitleArea">
      <div class="subtitle" id="subtitle"></div>
    </div>
  </div>

  <script type="module" src="./app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create styles with animations**

Create `src/renderer/styles.css`:
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0a0a0f;
  color: #fff;
  height: 100vh;
  overflow: hidden;
  user-select: none;
  -webkit-app-region: drag;
}

button, .subtitle-area {
  -webkit-app-region: no-drag;
}

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  position: relative;
}

/* Settings button */
.settings-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: color 0.2s, background 0.2s;
}

.settings-btn:hover {
  color: #fff;
  background: rgba(255,255,255,0.1);
}

/* Call area */
.call-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.ripple-container {
  position: relative;
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ripple {
  position: absolute;
  border-radius: 50%;
  border: 2px solid rgba(100, 100, 255, 0.3);
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
}

.call-btn {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
  z-index: 1;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

.call-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 30px rgba(102, 126, 234, 0.6);
}

.call-btn:active {
  transform: scale(0.95);
}

.call-btn.active {
  background: linear-gradient(135deg, #f5576c 0%, #ff6b6b 100%);
  box-shadow: 0 4px 20px rgba(245, 87, 108, 0.4);
}

.status-text {
  font-size: 16px;
  color: #999;
  text-align: center;
}

.hint-text {
  font-size: 12px;
  color: #555;
  text-align: center;
}

/* State: listening - blue pulse */
.state-listening .ripple {
  border-color: rgba(100, 100, 255, 0.4);
  animation: pulse 2s ease-in-out infinite;
}
.state-listening .r2 { animation-delay: 0.5s; }
.state-listening .r3 { animation-delay: 1s; }

/* State: recording - green expand */
.state-recording .ripple {
  border-color: rgba(80, 220, 100, 0.5);
  animation: expand 1s ease-out infinite;
}
.state-recording .r2 { animation-delay: 0.3s; }
.state-recording .r3 { animation-delay: 0.6s; }

/* State: processing - yellow spin */
.state-processing .ripple {
  border-color: rgba(255, 200, 50, 0.4);
  border-style: dashed;
  animation: spin 2s linear infinite;
}
.state-processing .r2 { animation-delay: 0.3s; width: 120%; height: 120%; }
.state-processing .r3 { animation-delay: 0.6s; width: 140%; height: 140%; }

/* State: speaking - purple ripple */
.state-speaking .ripple {
  border-color: rgba(180, 100, 255, 0.5);
  animation: expand 1.2s ease-out infinite;
}
.state-speaking .r2 { animation-delay: 0.4s; }
.state-speaking .r3 { animation-delay: 0.8s; }

@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.9); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

@keyframes expand {
  0% { opacity: 0.6; transform: scale(0.8); }
  100% { opacity: 0; transform: scale(1.5); }
}

@keyframes spin {
  0% { opacity: 0.5; transform: rotate(0deg); }
  100% { opacity: 0.5; transform: rotate(360deg); }
}

/* Subtitle area */
.subtitle-area {
  position: absolute;
  bottom: 40px;
  left: 20px;
  right: 20px;
  text-align: center;
  max-height: 120px;
  overflow-y: auto;
}

.subtitle {
  font-size: 14px;
  line-height: 1.6;
  color: #ccc;
}

.subtitle .user {
  color: #80cbc4;
}

.subtitle .assistant {
  color: #ce93d8;
}

.subtitle .partial {
  opacity: 0.6;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/index.html src/renderer/styles.css
git commit -m "feat: add main UI with call button and ripple animations"
```

---

### Task 9: Renderer - App Logic (State Machine)

**Files:**
- Create: `src/renderer/app.js`

- [ ] **Step 1: Create main app logic**

Create `src/renderer/app.js`:
```js
import { startRecording, stopRecording, isActive } from './recorder.js'

const callBtn = document.getElementById('callBtn')
const rippleContainer = document.getElementById('rippleContainer')
const statusText = document.getElementById('statusText')
const hintText = document.getElementById('hintText')
const subtitle = document.getElementById('subtitle')
const settingsBtn = document.getElementById('settingsBtn')

let currentState = 'idle'
let sessionActive = false
let spaceHeld = false
let sendInterval = null

const STATUS_MAP = {
  idle: '点击开始语音通话',
  listening: '正在聆听...',
  recording: '正在录音...',
  processing: 'AI 思考中...',
  speaking: 'AI 回答中...'
}

// --- State Management ---

function updateUI(state) {
  currentState = state

  // Update ripple class
  rippleContainer.className = 'ripple-container'
  if (state !== 'idle') {
    rippleContainer.classList.add(`state-${state}`)
  }

  // Update button
  callBtn.classList.toggle('active', state !== 'idle')

  // Update text
  statusText.textContent = STATUS_MAP[state] || state

  // Show/hide hint
  hintText.style.display = sessionActive ? 'block' : 'none'
}

// --- Audio Sending ---

function startSendingAudio() {
  startRecording(async (float32Data) => {
    await window.api.sendAudio(float32Data)
  })
}

function stopSendingAudio() {
  stopRecording()
}

// --- Session Control ---

async function startAutoSession() {
  const result = await window.api.startSession('auto')
  if (!result.ok) {
    statusText.textContent = `错误: ${result.error}`
    return
  }
  sessionActive = true
  startSendingAudio()
}

async function endSession() {
  sessionActive = false
  spaceHeld = false
  stopSendingAudio()
  await window.api.endSession()
  subtitle.innerHTML = ''
  updateUI('idle')
}

// --- Click Handler: Toggle auto session ---

callBtn.addEventListener('click', async () => {
  if (sessionActive) {
    await endSession()
  } else {
    await startAutoSession()
  }
})

// --- Space Key: Push-to-talk ---

document.addEventListener('keydown', async (e) => {
  if (e.code !== 'Space' || e.repeat) return
  e.preventDefault()

  if (currentState === 'processing' || currentState === 'speaking') return

  spaceHeld = true

  if (!sessionActive) {
    const result = await window.api.startSession('push')
    if (!result.ok) return
    sessionActive = true
  }

  startSendingAudio()
  updateUI('recording')
})

document.addEventListener('keyup', async (e) => {
  if (e.code !== 'Space' || !spaceHeld) return
  e.preventDefault()

  spaceHeld = false
  stopSendingAudio()
  await window.api.stopRecording()
})

// --- Events from Main Process ---

window.api.onStateChange((state) => {
  updateUI(state)

  // In auto mode, when AI finishes speaking, resume recording
  if (state === 'listening' && sessionActive && !spaceHeld) {
    startSendingAudio()
  }
})

window.api.onSubtitle(({ role, text, partial }) => {
  const cls = `${role}${partial ? ' partial' : ''}`
  // Replace last subtitle of same role if partial, or append
  const existing = subtitle.querySelector(`.${role}.partial`)
  if (existing) {
    existing.textContent = text
    existing.className = cls
  } else {
    const span = document.createElement('div')
    span.className = cls
    span.textContent = text
    subtitle.appendChild(span)
  }

  // Scroll to bottom
  subtitle.parentElement.scrollTop = subtitle.parentElement.scrollHeight
})

window.api.onPlayAudio(({ samples, sampleRate }) => {
  // Play audio using Web Audio API
  const audioCtx = new AudioContext({ sampleRate })
  const buffer = audioCtx.createBuffer(1, samples.length, sampleRate)
  buffer.getChannelData(0).set(new Float32Array(samples))
  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  source.connect(audioCtx.destination)
  source.start()

  // When playback ends, notify main to continue
  source.onended = async () => {
    audioCtx.close()
    if (sessionActive && currentState === 'speaking') {
      // Auto mode: signal ready for next turn
      updateUI('listening')
    }
  }
})

// --- Settings ---

settingsBtn.addEventListener('click', () => {
  window.location.href = './settings.html'
})

// --- Cleanup ---

window.addEventListener('beforeunload', () => {
  window.api.removeAllListeners()
})
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/app.js
git commit -m "feat: add app state machine and interaction logic"
```

---

### Task 10: Renderer - Settings Page

**Files:**
- Create: `src/renderer/settings.html`
- Create: `src/renderer/settings.js`

- [ ] **Step 1: Create settings HTML**

Create `src/renderer/settings.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>MiniChat - 设置</title>
  <link rel="stylesheet" href="./styles.css">
  <style>
    body { -webkit-app-region: no-drag; }

    .settings-container {
      padding: 24px;
      height: 100vh;
      overflow-y: auto;
    }

    .settings-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .back-btn {
      background: none;
      border: none;
      color: #999;
      cursor: pointer;
      font-size: 20px;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .back-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }

    h2 { font-size: 18px; font-weight: 600; }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-size: 13px;
      color: #999;
      margin-bottom: 6px;
    }

    select, input {
      width: 100%;
      padding: 10px 12px;
      background: #1a1a2e;
      border: 1px solid #333;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      outline: none;
    }

    select:focus, input:focus {
      border-color: #667eea;
    }

    .provider-section {
      display: none;
      padding: 16px;
      background: #111122;
      border-radius: 8px;
      margin-top: 12px;
    }

    .provider-section.active { display: block; }

    .save-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 15px;
      cursor: pointer;
      margin-top: 16px;
    }

    .save-btn:hover { opacity: 0.9; }

    .toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: #fff;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 13px;
      opacity: 0;
      transition: opacity 0.3s;
    }

    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="settings-container">
    <div class="settings-header">
      <button class="back-btn" id="backBtn">&larr;</button>
      <h2>设置</h2>
    </div>

    <div class="form-group">
      <label>AI 后端</label>
      <select id="providerSelect">
        <option value="ollama">Ollama (本地)</option>
        <option value="openai">OpenAI</option>
        <option value="claude">Claude</option>
      </select>
    </div>

    <!-- Ollama config -->
    <div class="provider-section" id="ollamaSection">
      <div class="form-group">
        <label>服务地址</label>
        <input type="text" id="ollamaUrl" placeholder="http://localhost:11434">
      </div>
      <div class="form-group">
        <label>模型</label>
        <input type="text" id="ollamaModel" placeholder="qwen2.5">
      </div>
    </div>

    <!-- OpenAI config -->
    <div class="provider-section" id="openaiSection">
      <div class="form-group">
        <label>API Base URL</label>
        <input type="text" id="openaiUrl" placeholder="https://api.openai.com">
      </div>
      <div class="form-group">
        <label>API Key</label>
        <input type="password" id="openaiKey" placeholder="sk-...">
      </div>
      <div class="form-group">
        <label>模型</label>
        <input type="text" id="openaiModel" placeholder="gpt-4o">
      </div>
    </div>

    <!-- Claude config -->
    <div class="provider-section" id="claudeSection">
      <div class="form-group">
        <label>API Key</label>
        <input type="password" id="claudeKey" placeholder="sk-ant-...">
      </div>
      <div class="form-group">
        <label>模型</label>
        <input type="text" id="claudeModel" placeholder="claude-sonnet-4-20250514">
      </div>
    </div>

    <button class="save-btn" id="saveBtn">保存</button>
  </div>

  <div class="toast" id="toast">已保存</div>

  <script type="module" src="./settings.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create settings logic**

Create `src/renderer/settings.js`:
```js
const providerSelect = document.getElementById('providerSelect')
const ollamaSection = document.getElementById('ollamaSection')
const openaiSection = document.getElementById('openaiSection')
const claudeSection = document.getElementById('claudeSection')
const saveBtn = document.getElementById('saveBtn')
const backBtn = document.getElementById('backBtn')
const toast = document.getElementById('toast')

const sections = { ollama: ollamaSection, openai: openaiSection, claude: claudeSection }

function showProviderSection(provider) {
  Object.values(sections).forEach(s => s.classList.remove('active'))
  if (sections[provider]) sections[provider].classList.add('active')
}

providerSelect.addEventListener('change', () => {
  showProviderSection(providerSelect.value)
})

async function loadConfig() {
  const config = await window.api.getConfig()

  providerSelect.value = config.provider || 'ollama'
  showProviderSection(providerSelect.value)

  document.getElementById('ollamaUrl').value = config.ollama?.baseUrl || ''
  document.getElementById('ollamaModel').value = config.ollama?.model || ''
  document.getElementById('openaiUrl').value = config.openai?.baseUrl || ''
  document.getElementById('openaiKey').value = config.openai?.apiKey || ''
  document.getElementById('openaiModel').value = config.openai?.model || ''
  document.getElementById('claudeKey').value = config.claude?.apiKey || ''
  document.getElementById('claudeModel').value = config.claude?.model || ''
}

saveBtn.addEventListener('click', async () => {
  const config = {
    provider: providerSelect.value,
    ollama: {
      baseUrl: document.getElementById('ollamaUrl').value,
      model: document.getElementById('ollamaModel').value
    },
    openai: {
      apiKey: document.getElementById('openaiKey').value,
      baseUrl: document.getElementById('openaiUrl').value,
      model: document.getElementById('openaiModel').value
    },
    claude: {
      apiKey: document.getElementById('claudeKey').value,
      model: document.getElementById('claudeModel').value
    }
  }

  await window.api.saveConfig(config)

  toast.classList.add('show')
  setTimeout(() => toast.classList.remove('show'), 1500)
})

backBtn.addEventListener('click', () => {
  window.location.href = './index.html'
})

loadConfig()
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/settings.html src/renderer/settings.js
git commit -m "feat: add settings page with provider configuration"
```

---

### Task 11: Integration & Audio Playback Complete

**Files:**
- Modify: `src/main/ipc-handlers.js` — add playback-ended handler
- Modify: `src/preload/index.js` — add playback-ended IPC
- Modify: `src/renderer/app.js` — notify main when playback ends

- [ ] **Step 1: Add playback-ended IPC**

In `src/preload/index.js`, add to the `api` object:
```js
playbackEnded: () => ipcRenderer.invoke('audio:playback-ended'),
```

- [ ] **Step 2: Add handler in ipc-handlers.js**

In `src/main/ipc-handlers.js`, inside `registerIpcHandlers()`, add:
```js
ipcMain.handle('audio:playback-ended', () => {
  if (sessionMode === 'auto') {
    setState('listening')
  } else {
    setState('idle')
  }
  return { ok: true }
})
```

- [ ] **Step 3: Update app.js playback onended**

In `src/renderer/app.js`, update the `source.onended` callback:
```js
source.onended = async () => {
  audioCtx.close()
  await window.api.playbackEnded()
}
```

- [ ] **Step 4: Full integration test**

```bash
npm run dev
```

Manual test steps:
1. Click the call button → should enter listening state (blue pulse)
2. Speak into microphone → should detect speech and show recording (green)
3. Stop speaking → should process and show AI thinking (yellow)
4. AI replies → should play audio (purple pulse) and show subtitle
5. Audio ends → should return to listening (auto mode)
6. Click button again → should end session
7. Hold space → should record, release → should process
8. Open settings → configure provider → save → go back

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc-handlers.js src/preload/index.js src/renderer/app.js
git commit -m "feat: complete integration with playback-ended flow"
```

---

### Task 12: Polish & Edge Cases

**Files:**
- Modify: `src/main/ipc-handlers.js`
- Modify: `src/renderer/app.js`

- [ ] **Step 1: Handle empty STT result in auto mode**

In `src/main/ipc-handlers.js`, in the `audio:stop` handler, after `if (!text || !text.trim())`:
```js
if (!text || !text.trim()) {
  if (sessionMode === 'auto') {
    setState('listening')
  }
  return { ok: true, text: '' }
}
```

- [ ] **Step 2: Add error display in renderer**

In `src/renderer/app.js`, add after the `onPlayAudio` listener:
```js
// Show error in subtitle area
function showError(msg) {
  const div = document.createElement('div')
  div.style.color = '#ff6b6b'
  div.textContent = `错误: ${msg}`
  subtitle.appendChild(div)
}
```

Update the space keyup handler to handle errors:
```js
document.addEventListener('keyup', async (e) => {
  if (e.code !== 'Space' || !spaceHeld) return
  e.preventDefault()

  spaceHeld = false
  stopSendingAudio()
  const result = await window.api.stopRecording()
  if (result && !result.ok) {
    showError(result.error)
  }
})
```

- [ ] **Step 3: Add VAD-triggered stop in auto mode**

In `src/main/ipc-handlers.js`, modify the `audio:send` handler for auto mode. After detecting VAD segments, if no new segments come for a while, trigger `audio:stop` logic automatically.

Replace the VAD segment handling in auto mode:
```js
if (sessionMode === 'auto') {
  const segments = feedAudioToVAD(float32)
  if (segments.length > 0) {
    if (currentState === 'listening') setState('recording')
    for (const seg of segments) {
      // VAD detected a complete speech segment, process it
      feedAudioToSTT(seg.samples)
    }
    // VAD segments are complete utterances - process immediately
    const text = getSTTResult()
    if (text && text.trim()) {
      resetSTT()
      sendSubtitle({ role: 'user', text, partial: false })
      messages.push({ role: 'user', content: text })

      setState('processing')
      try {
        const config = getConfig()
        const provider = createProvider(config)
        let fullResponse = ''
        for await (const chunk of provider.chat(messages)) {
          fullResponse += chunk
          sendSubtitle({ role: 'assistant', text: fullResponse, partial: true })
        }
        sendSubtitle({ role: 'assistant', text: fullResponse, partial: false })
        messages.push({ role: 'assistant', content: fullResponse })

        setState('speaking')
        const audio = synthesize(fullResponse)
        mainWindow?.webContents.send('audio:play', {
          samples: Array.from(audio.samples),
          sampleRate: audio.sampleRate
        })
      } catch (e) {
        console.error('AI/TTS error:', e)
        setState('listening')
      }
    }
  } else {
    // No VAD segment yet, show partial STT
    feedAudioToSTT(float32)
    const partial = getSTTResult()
    if (partial) {
      sendSubtitle({ role: 'user', text: partial, partial: true })
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc-handlers.js src/renderer/app.js
git commit -m "feat: polish VAD auto-mode and error handling"
```
