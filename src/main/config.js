import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const CONFIG_FILE = join(app.getPath('userData'), 'config.json')

const DEFAULT_CONFIG = {
  ttsVoice: 'theresa',
  wakeWord: '小助手',
  provider: 'ollama',
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'Qwen3.5-27B-Claude'
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

function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
        && target[key] && typeof target[key] === 'object') {
      result[key] = deepMerge(target[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

export function loadConfig() {
  if (config) return config
  try {
    if (existsSync(CONFIG_FILE)) {
      config = deepMerge(DEFAULT_CONFIG, JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')))
    } else {
      config = { ...DEFAULT_CONFIG }
    }
  } catch {
    config = { ...DEFAULT_CONFIG }
  }
  return config
}

export function saveConfig(newConfig) {
  config = deepMerge(config, newConfig)
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  return config
}

export function getConfig() {
  return config || loadConfig()
}
