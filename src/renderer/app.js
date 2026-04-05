import { startRecording, stopRecording } from './recorder.js'

const callBtn = document.getElementById('callBtn')
const rippleContainer = document.getElementById('rippleContainer')
const statusText = document.getElementById('statusText')
const hintText = document.getElementById('hintText')
const subtitle = document.getElementById('subtitle')
const settingsBtn = document.getElementById('settingsBtn')
const stopBtn = document.getElementById('stopBtn')
const chatPanel = document.getElementById('chatPanel')
const chatToggle = document.getElementById('chatToggle')
const chatPanelClose = document.getElementById('chatPanelClose')
const chatMessages = document.getElementById('chatMessages')

let currentState = 'idle'
let sessionActive = false
let sessionMode = null
let spaceHeld = false
let currentAudioSource = null
let currentAudioCtx = null

const STATUS_MAP = {
  idle: '点击开始语音通话',
  listening: '正在聆听...',
  recording: '正在录音...',
  processing: 'AI 思考中...',
  speaking: 'AI 回答中...'
}

// --- Chat Panel ---

const PANEL_WIDTH = 300

async function toggleChatPanel(open) {
  const isOpen = chatPanel.classList.contains('open')
  const shouldOpen = open !== undefined ? open : !isOpen
  if (shouldOpen === isOpen) return

  const [w, h] = await window.api.getWindowSize()

  if (shouldOpen) {
    chatPanel.classList.add('open')
    await window.api.resizeWindow(w + PANEL_WIDTH, h, 420 + PANEL_WIDTH)
  } else {
    chatPanel.classList.remove('open')
    await window.api.resizeWindow(w - PANEL_WIDTH, h, 420)
  }
}

chatToggle.addEventListener('click', () => toggleChatPanel())
chatPanelClose.addEventListener('click', () => toggleChatPanel(false))

function addChatMessage(role, text) {
  const div = document.createElement('div')
  div.className = `chat-msg ${role}`
  div.textContent = text
  chatMessages.appendChild(div)
  chatMessages.scrollTop = chatMessages.scrollHeight
  chatToggle.classList.add('has-messages')
}

// --- State Management ---

function updateUI(state) {
  currentState = state

  rippleContainer.className = 'ripple-container'
  if (state !== 'idle') {
    rippleContainer.classList.add(`state-${state}`)
  }

  callBtn.classList.toggle('active', state !== 'idle')
  statusText.textContent = STATUS_MAP[state] || state
  hintText.style.display = sessionActive ? 'block' : 'none'
  stopBtn.style.display = (state === 'processing' || state === 'speaking') ? 'block' : 'none'
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

// --- Stop playback ---

function stopCurrentPlayback() {
  if (currentAudioSource) {
    try {
      currentAudioSource.onended = null
      currentAudioSource.stop()
    } catch {}
    currentAudioSource = null
  }
  if (currentAudioCtx) {
    try { currentAudioCtx.close() } catch {}
    currentAudioCtx = null
  }
}

// --- Session Control ---

async function startAutoSession() {
  const result = await window.api.startSession('auto')
  if (!result.ok) {
    statusText.textContent = `错误: ${result.error}`
    return
  }
  sessionActive = true
  sessionMode = 'auto'
  startSendingAudio()
}

async function endSession() {
  sessionActive = false
  sessionMode = null
  spaceHeld = false
  stopSendingAudio()
  stopCurrentPlayback()
  await window.api.endSession()
  subtitle.innerHTML = ''
  updateUI('idle')
}

// --- Click Handler ---

callBtn.addEventListener('click', async () => {
  if (sessionActive) {
    await endSession()
  } else {
    await startAutoSession()
  }
})

// --- Stop Button ---

stopBtn.addEventListener('click', async () => {
  stopCurrentPlayback()
  await window.api.stopAI()
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
    sessionMode = 'push'
  }

  startSendingAudio()
  updateUI('recording')
})

document.addEventListener('keyup', async (e) => {
  if (e.code !== 'Space' || !spaceHeld) return
  e.preventDefault()

  spaceHeld = false
  stopSendingAudio()
  const result = await window.api.stopRecording()
  if (result && !result.ok) {
    subtitle.innerHTML = `<div style="color:#ff6b6b">错误: ${result.error}</div>`
  }
})

// --- Events from Main Process ---

window.api.onStateChange((state) => {
  updateUI(state)

  if (state === 'idle' && sessionActive && sessionMode === 'push') {
    sessionActive = false
  }
})

window.api.onSubtitle(({ role, text, partial }) => {
  if (role === 'error') {
    subtitle.innerHTML = `<div style="color:#ff6b6b">错误: ${text}</div>`
    return
  }

  // Update current subtitle
  const cls = `${role}${partial ? ' partial' : ''}`
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
  subtitle.parentElement.scrollTop = subtitle.parentElement.scrollHeight

  // Add finalized messages to chat history
  if (!partial) {
    addChatMessage(role, text)
    // Clear subtitle after adding to history
    setTimeout(() => {
      const el = subtitle.querySelector(`.${role}:not(.partial)`)
      if (el) el.remove()
    }, 500)
  }
})

window.api.onPlayAudio(({ samples, sampleRate }) => {
  // Stop any previous playback before starting new one
  stopCurrentPlayback()
  try {
    const audioCtx = new AudioContext()
    const float32 = new Float32Array(samples)
    const buffer = audioCtx.createBuffer(1, float32.length, sampleRate)
    buffer.getChannelData(0).set(float32)
    const source = audioCtx.createBufferSource()
    source.buffer = buffer
    source.connect(audioCtx.destination)

    currentAudioSource = source
    currentAudioCtx = audioCtx

    source.onended = async () => {
      currentAudioSource = null
      currentAudioCtx = null
      audioCtx.close()
      await window.api.playbackEnded()
    }

    source.start()
  } catch (e) {
    console.error('[audio:play] error:', e)
  }
})

window.api.onStopPlayback(() => {
  stopCurrentPlayback()
})

// --- Settings ---

settingsBtn.addEventListener('click', () => {
  window.location.href = './settings.html'
})

// --- Cleanup ---

window.addEventListener('beforeunload', () => {
  window.api.removeAllListeners()
})
