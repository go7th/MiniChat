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
        try {
          const data = JSON.parse(payload)
          const content = data.choices?.[0]?.delta?.content
          if (content) yield content
        } catch { continue }
      }
    }
  }
}
