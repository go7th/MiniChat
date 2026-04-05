import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Audio processing
  sendAudio: (float32Array) => {
    const copy = new ArrayBuffer(float32Array.byteLength)
    new Float32Array(copy).set(float32Array)
    return ipcRenderer.invoke('audio:send', copy)
  },
  stopRecording: () => ipcRenderer.invoke('audio:stop'),

  // Session control
  startSession: (mode) => ipcRenderer.invoke('session:start', mode),
  endSession: () => ipcRenderer.invoke('session:end'),

  // AI control
  stopAI: () => ipcRenderer.invoke('ai:stop'),

  // Events from main process
  onStateChange: (cb) => ipcRenderer.on('state:change', (_, state) => cb(state)),
  onSubtitle: (cb) => ipcRenderer.on('subtitle', (_, data) => cb(data)),
  onPlayAudio: (cb) => ipcRenderer.on('audio:play', (_, buffer) => cb(buffer)),
  onStopPlayback: (cb) => ipcRenderer.on('audio:stop-playback', () => cb()),

  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),

  // Voice
  listVoices: () => ipcRenderer.invoke('voices:list'),
  previewVoice: (voiceId) => ipcRenderer.invoke('voices:preview', voiceId),

  // Window control
  resizeWindow: (width, height, minWidth) => ipcRenderer.invoke('window:resize', width, height, minWidth),
  getWindowSize: () => ipcRenderer.invoke('window:getSize'),

  // Playback control
  playbackEnded: () => ipcRenderer.invoke('audio:playback-ended'),

  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('state:change')
    ipcRenderer.removeAllListeners('subtitle')
    ipcRenderer.removeAllListeners('audio:play')
    ipcRenderer.removeAllListeners('audio:stop-playback')
  }
})
