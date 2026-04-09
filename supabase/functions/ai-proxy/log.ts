/** Structured logging with request ID generation */

export function createRequestLogger(requestId?: string) {
  const id = requestId || crypto.randomUUID()

  return {
    info(action: string, provider: string, details: Record<string, unknown>): void {
      console.log(JSON.stringify({ level: 'info', requestId: id, action, provider, timestamp: new Date().toISOString(), ...details }))
    },

    error(action: string, provider: string, error: unknown): void {
      console.error(JSON.stringify({ level: 'error', requestId: id, action, provider, timestamp: new Date().toISOString(), error: String(error) }))
    },

    getRequestId(): string {
      return id
    },
  }
}
