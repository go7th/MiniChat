import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const MODELS_DIR = join(ROOT, 'models')

const MODELS = {
  'stt-sensevoice': {
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2',
    dir: 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17',
    targetDir: 'stt'
  },
  'stt-zipformer': {
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20.tar.bz2',
    dir: 'sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20',
    targetDir: 'stt'
  },
  'tts-theresa': {
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-zh-hf-theresa.tar.bz2',
    dir: 'vits-zh-hf-theresa',
    targetDir: 'tts'
  },
  'tts-melo': {
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-melo-tts-zh_en.tar.bz2',
    dir: 'vits-melo-tts-zh_en',
    targetDir: 'tts'
  },
  vad: {
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx',
    file: 'silero_vad.onnx'
  }
}

function download(name, model) {
  const targetDir = join(MODELS_DIR, model.targetDir || name)
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
