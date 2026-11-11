/**
 * Returns a Storage implementation: the provided one, window.localStorage when available,
 * or an in-memory fallback for test environments.
 */
export function getEditorStorage(storage?: Storage): Storage {
  if (storage) return storage
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  const memory = new Map<string, string>()
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    clear: () => {
      memory.clear()
    },
    key: (index: number) => Array.from(memory.keys())[index] ?? null,
    get length() {
      return memory.size
    },
  }
}

