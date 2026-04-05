import { ipcMain } from 'electron'
import { initAll, destroyAll, feedAudioToVAD, recognizeAudio, synthesize, flushVAD, initTTS, getAvailableVoices } from './audio-engine.js'
import { createProvider } from './ai-provider.js'
import { getConfig, saveConfig, loadConfig } from './config.js'

let currentState = 'idle'
let sessionMode = null
let messages = []
let mainWindow = null
let abortController = null
let audioBuffer = [] // collect audio chunks for push-to-talk

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

async function processAIResponse(text) {
  sendSubtitle({ role: 'user', text, partial: false })
  messages.push({ role: 'user', content: text })

  setState('processing')
  const ac = new AbortController()
  abortController = ac

  try {
    const config = getConfig()
    const provider = createProvider(config)
    let fullResponse = ''

    for await (const chunk of provider.chat(messages)) {
      if (ac.signal.aborted) break
      fullResponse += chunk
      sendSubtitle({ role: 'assistant', text: fullResponse, partial: true })
    }

    if (ac.signal.aborted) {
      if (fullResponse) {
        sendSubtitle({ role: 'assistant', text: fullResponse + ' [已停止]', partial: false })
        messages.push({ role: 'assistant', content: fullResponse })
      }
      if (sessionMode === 'auto') setState('listening')
      else setState('idle')
      return
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
    if (ac.signal.aborted) {
      if (sessionMode === 'auto') setState('listening')
      else setState('idle')
      return
    }
    console.error('AI/TTS error:', e)
    sendSubtitle({ role: 'error', text: e.message, partial: false })
    if (sessionMode === 'auto') setState('listening')
    else setState('idle')
  } finally {
    abortController = null
  }
}

export function registerIpcHandlers() {
  loadConfig()

  ipcMain.handle('config:get', () => getConfig())
  ipcMain.handle('config:save', (_, config) => saveConfig(config))

  // Window resize
  ipcMain.handle('window:resize', (_, width, height, minWidth) => {
    if (mainWindow) {
      if (minWidth) {
        // Temporarily lower min to allow shrinking, then set new min
        mainWindow.setMinimumSize(420, 500)
        mainWindow.setSize(Math.round(width), Math.round(height), true)
        mainWindow.setMinimumSize(Math.round(minWidth), 500)
      } else {
        mainWindow.setSize(Math.round(width), Math.round(height), true)
      }
    }
  })
  ipcMain.handle('window:getSize', () => {
    if (mainWindow) return mainWindow.getSize()
    return [420, 600]
  })

  // Voice management
  ipcMain.handle('voices:list', () => getAvailableVoices())
  ipcMain.handle('voices:preview', (_, voiceId) => {
    try {
      initTTS(voiceId)
      const audio = synthesize('你好，我是你的语音助手。')
      return { ok: true, samples: Array.from(audio.samples), sampleRate: audio.sampleRate }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  // Stop AI response
  ipcMain.handle('ai:stop', () => {
    if (abortController) {
      abortController.abort()
    }
    mainWindow?.webContents.send('audio:stop-playback')
    // Transition state back (abort doesn't fire if we're already in 'speaking')
    if (sessionMode === 'auto') setState('listening')
    else setState('idle')
    return { ok: true }
  })

  ipcMain.handle('session:start', async (_, mode) => {
    sessionMode = mode
    audioBuffer = []
    messages = [{ role: 'system', content: '你是一个友好的语音助手，请用简洁的中文回答。' }]
    try {
      const config = getConfig()
      initAll(config.ttsVoice)
      setState('listening')
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('session:end', () => {
    if (abortController) abortController.abort()
    sessionMode = null
    messages = []
    audioBuffer = []
    setState('idle')
    return { ok: true }
  })

  ipcMain.handle('audio:send', async (_, arrayBuffer) => {
    const float32 = new Float32Array(arrayBuffer)

    // During AI processing/speaking, only listen for interrupt keywords
    if (currentState === 'processing' || currentState === 'speaking') {
      if (sessionMode === 'auto') {
        const wakeWord = (getConfig().wakeWord || '').trim()
        const stopKeywords = ['停止', '住嘴', '闭嘴', '别说了', '停下', '安静']
        const segments = feedAudioToVAD(float32)
        for (const seg of segments) {
          // Only check short segments (interrupt words are brief)
          if (seg.samples.length > 16000 * 3) continue
          const text = recognizeAudio(seg.samples)
          if (!text) continue

          const hasWake = wakeWord && text.includes(wakeWord)
          const hasStop = stopKeywords.some(kw => text.includes(kw))

          if (hasWake || hasStop) {
            console.log('[Interrupt] triggered by:', text)
            if (abortController) abortController.abort()
            mainWindow?.webContents.send('audio:stop-playback')
            const label = hasStop ? '停止' : '唤醒'
            sendSubtitle({ role: 'user', text: `[${label}] ${text}`, partial: false })
            setState('listening')
            break
          }
        }
      }
      return { ok: true }
    }

    if (sessionMode === 'auto') {
      // VAD mode: detect complete speech segments, then recognize offline
      const segments = feedAudioToVAD(float32)
      if (segments.length > 0) {
        if (currentState === 'listening') setState('recording')
        for (const seg of segments) {
          const text = recognizeAudio(seg.samples)
          if (text && text.trim()) {
            await processAIResponse(text.trim())
          }
        }
      }
    } else {
      // Push-to-talk: collect audio chunks
      if (currentState === 'listening') setState('recording')
      audioBuffer.push(float32)
    }

    return { ok: true }
  })

  ipcMain.handle('audio:stop', async () => {
    if (sessionMode === 'auto') {
      // Flush remaining VAD segments
      const segments = flushVAD()
      for (const seg of segments) {
        const text = recognizeAudio(seg.samples)
        if (text && text.trim()) {
          await processAIResponse(text.trim())
        }
      }
      return { ok: true, text: '' }
    }

    // Push-to-talk: merge all collected audio and recognize
    if (audioBuffer.length === 0) {
      setState('idle')
      return { ok: true, text: '' }
    }

    const totalLen = audioBuffer.reduce((sum, buf) => sum + buf.length, 0)
    const merged = new Float32Array(totalLen)
    let offset = 0
    for (const buf of audioBuffer) {
      merged.set(buf, offset)
      offset += buf.length
    }
    audioBuffer = []

    sendSubtitle({ role: 'user', text: '识别中...', partial: true })
    const text = recognizeAudio(merged)

    if (!text || !text.trim()) {
      setState('idle')
      return { ok: true, text: '' }
    }

    await processAIResponse(text.trim())
    return { ok: true, text }
  })

  ipcMain.handle('audio:playback-ended', () => {
    if (sessionMode === 'auto') {
      setState('listening')
    } else {
      setState('idle')
    }
    return { ok: true }
  })
}
