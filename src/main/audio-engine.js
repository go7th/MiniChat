import { join } from 'path'
import { app } from 'electron'
import { existsSync } from 'fs'

let sherpaOnnx

function getSherpaOnnx() {
  if (!sherpaOnnx) sherpaOnnx = require('sherpa-onnx-node')
  return sherpaOnnx
}

function modelsRoot() {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'models')
  }
  return join(app.getAppPath(), 'models')
}

let recognizer = null
let tts = null
let ttsVoice = null
let vad = null

// Available TTS voices
const TTS_VOICES = {
  theresa: {
    name: 'Theresa (女声)',
    dir: 'vits-zh-hf-theresa',
    config: (ttsDir) => ({
      model: { vits: { model: join(ttsDir, 'theresa.onnx'), tokens: join(ttsDir, 'tokens.txt'), lexicon: join(ttsDir, 'lexicon.txt') } },
      numThreads: 2, maxNumSentences: 2,
    })
  },
  melo: {
    name: 'MeloTTS (女声·自然)',
    dir: 'vits-melo-tts-zh_en',
    config: (ttsDir) => ({
      model: { vits: { model: join(ttsDir, 'model.onnx'), tokens: join(ttsDir, 'tokens.txt'), lexicon: join(ttsDir, 'lexicon.txt') } },
      numThreads: 2, maxNumSentences: 2,
    })
  },
}

export function getAvailableVoices() {
  const voices = []
  for (const [id, voice] of Object.entries(TTS_VOICES)) {
    const dir = join(modelsRoot(), 'tts', voice.dir)
    voices.push({ id, name: voice.name, available: existsSync(dir) })
  }
  return voices
}

export function initSTT() {
  if (recognizer) return
  const sherpa = getSherpaOnnx()

  // Try SenseVoice (offline, high accuracy) first, fallback to streaming zipformer
  const senseVoiceDir = join(modelsRoot(), 'stt', 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17')
  console.log('[STT] modelsRoot:', modelsRoot())
  console.log('[STT] SenseVoice dir:', senseVoiceDir, 'exists:', existsSync(senseVoiceDir))
  if (existsSync(senseVoiceDir)) {
    recognizer = new sherpa.OfflineRecognizer({
      modelConfig: {
        senseVoice: {
          model: join(senseVoiceDir, 'model.int8.onnx'),
          language: 'auto',
          useInverseTextNormalization: 1,
        },
        tokens: join(senseVoiceDir, 'tokens.txt'),
        numThreads: 2,
      },
    })
    console.log('[STT] Using SenseVoice (offline)')
    return
  }

  // Fallback to streaming zipformer
  const sttDir = join(modelsRoot(), 'stt', 'sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20')
  recognizer = new sherpa.OnlineRecognizer({
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
  console.log('[STT] Using streaming zipformer (fallback)')
}

// Check if using offline recognizer
function isOfflineSTT() {
  return recognizer && recognizer.constructor.name === 'OfflineRecognizer'
}

// Recognize complete audio (for offline mode)
export function recognizeAudio(float32Samples) {
  if (!recognizer) return ''
  if (isOfflineSTT()) {
    const stream = recognizer.createStream()
    stream.acceptWaveform({ samples: float32Samples, sampleRate: 16000 })
    recognizer.decode(stream)
    return recognizer.getResult(stream).text
  }
  // Streaming fallback: create temp stream, feed all, decode
  const stream = recognizer.createStream()
  stream.acceptWaveform({ samples: float32Samples, sampleRate: 16000 })
  stream.inputFinished()
  while (recognizer.isReady(stream)) {
    recognizer.decode(stream)
  }
  return recognizer.getResult(stream).text
}

export function initTTS(voiceId) {
  if (tts && ttsVoice === voiceId) return
  tts = null

  const sherpa = getSherpaOnnx()
  const voice = TTS_VOICES[voiceId] || TTS_VOICES.theresa
  const ttsDir = join(modelsRoot(), 'tts', voice.dir)

  if (!existsSync(ttsDir)) {
    throw new Error(`TTS 模型未下载: ${voice.name}`)
  }

  tts = new sherpa.OfflineTts(voice.config(ttsDir))
  ttsVoice = voiceId
}

export function synthesize(text) {
  if (!tts) throw new Error('TTS not initialized')
  const audio = tts.generate({ text, sid: 0, speed: 1.0, enableExternalBuffer: false })
  return { samples: audio.samples, sampleRate: tts.sampleRate }
}

export function initVAD() {
  if (vad) return
  const sherpa = getSherpaOnnx()
  const vadModel = join(modelsRoot(), 'vad', 'silero_vad.onnx')

  vad = new sherpa.Vad({
    sileroVad: {
      model: vadModel,
      threshold: 0.5,
      minSpeechDuration: 0.25,
      minSilenceDuration: 0.8,
      maxSpeechDuration: 30,
      windowSize: 512,
    },
    sampleRate: 16000,
    debug: false,
    numThreads: 1,
  }, 60)
}

export function feedAudioToVAD(float32Samples) {
  if (!vad) return []
  const segments = []

  for (let i = 0; i < float32Samples.length; i += 512) {
    const chunk = float32Samples.subarray(i, Math.min(i + 512, float32Samples.length))
    if (chunk.length < 512) {
      const padded = new Float32Array(512)
      padded.set(chunk)
      vad.acceptWaveform(padded)
    } else {
      vad.acceptWaveform(chunk)
    }

    while (!vad.isEmpty()) {
      const seg = vad.front(false)
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
    const seg = vad.front(false)
    segments.push({ start: seg.start, samples: seg.samples })
    vad.pop()
  }
  return segments
}

export function initAll(voiceId) {
  initSTT()
  initTTS(voiceId || 'theresa')
  initVAD()
}

export function destroyAll() {
  recognizer = null
  tts = null
  ttsVoice = null
  vad = null
}
