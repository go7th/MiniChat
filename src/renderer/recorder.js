let audioContext = null
let mediaStream = null
let isRecording = false

export async function startRecording(onAudioData) {
  // If already recording, don't start another one
  if (isRecording) return
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
