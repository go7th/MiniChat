const providerSelect = document.getElementById('providerSelect')
const voiceSelect = document.getElementById('voiceSelect')
const previewBtn = document.getElementById('previewBtn')
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

// Voice preview
let previewAudioCtx = null
let previewSource = null

previewBtn.addEventListener('click', async () => {
  // Stop any current preview
  if (previewSource) {
    try { previewSource.stop() } catch {}
    previewSource = null
  }
  if (previewAudioCtx) {
    try { previewAudioCtx.close() } catch {}
    previewAudioCtx = null
  }

  previewBtn.disabled = true
  previewBtn.textContent = '加载中...'

  const result = await window.api.previewVoice(voiceSelect.value)

  if (result.ok) {
    previewAudioCtx = new AudioContext()
    const float32 = new Float32Array(result.samples)
    const buffer = previewAudioCtx.createBuffer(1, float32.length, result.sampleRate)
    buffer.getChannelData(0).set(float32)
    previewSource = previewAudioCtx.createBufferSource()
    previewSource.buffer = buffer
    previewSource.connect(previewAudioCtx.destination)

    previewSource.onended = () => {
      previewBtn.textContent = '试听'
      previewBtn.disabled = false
      previewAudioCtx.close()
      previewAudioCtx = null
      previewSource = null
    }

    previewSource.start()
    previewBtn.textContent = '播放中...'
  } else {
    toast.textContent = `错误: ${result.error}`
    toast.classList.add('show')
    setTimeout(() => { toast.classList.remove('show'); toast.textContent = '已保存' }, 2000)
    previewBtn.textContent = '试听'
    previewBtn.disabled = false
  }
})

async function loadConfig() {
  const config = await window.api.getConfig()

  // Load voices
  const voices = await window.api.listVoices()
  voiceSelect.innerHTML = ''
  for (const v of voices) {
    const opt = document.createElement('option')
    opt.value = v.id
    opt.textContent = v.name + (v.available ? '' : ' (未下载)')
    opt.disabled = !v.available
    voiceSelect.appendChild(opt)
  }
  voiceSelect.value = config.ttsVoice || 'theresa'
  document.getElementById('wakeWordInput').value = config.wakeWord || ''

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
    ttsVoice: voiceSelect.value,
    wakeWord: document.getElementById('wakeWordInput').value,
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
