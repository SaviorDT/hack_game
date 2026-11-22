import { describe, expect, it, vi } from 'vitest'
import { buildRecordedCommandsBox } from './recordedCommandsBox.ts'

describe('recordedCommandsBox', () => {
  it('builds recorded commands box with active and empty slots', () => {
    const texts: { text: string; color?: string }[] = []
    const mockScene = {
      add: {
        container: vi.fn(() => ({
          add: vi.fn(),
        })),
        graphics: vi.fn(() => ({
          lineStyle: vi.fn().mockReturnThis(),
          strokeRect: vi.fn().mockReturnThis(),
        })),
        text: vi.fn((_x: number, _y: number, text: string, style?: { color?: string }) => {
          texts.push({ text, color: style?.color })
          return { setOrigin: vi.fn().mockReturnThis() }
        }),
      },
    } as any

    const container = { add: vi.fn() } as any
    buildRecordedCommandsBox(mockScene, container, { 8: 'acc dagger $mouse' })

    expect(texts.some((t) => t.text.includes('RECORDED COMMANDS'))).toBe(true)
    expect(texts.some((t) => t.text === '8: acc dagger $mouse')).toBe(true)
    expect(texts.some((t) => t.text === '9: (empty)')).toBe(true)
    expect(texts.some((t) => t.text === '0: (empty)')).toBe(true)
    expect(texts.some((t) => t.text.includes('8,9,0: EXEC'))).toBe(true)
    expect(texts.find((t) => t.text === '8: acc dagger $mouse')?.color).toBe('#9f9f9f')
    expect(texts.find((t) => t.text === '9: (empty)')?.color).toBe('#606060')
    expect(texts.filter((t) => t.text.match(/^[890]:/)).every((t) => t.color !== '#ffffff')).toBe(true)
  })
})
