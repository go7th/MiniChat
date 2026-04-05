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
        try {
          const data = JSON.parse(trimmed.slice(6))
          if (data.type === 'content_block_delta' && data.delta?.text) {
            yield data.delta.text
          }
        } catch { continue }
      }
    }
  }
}
