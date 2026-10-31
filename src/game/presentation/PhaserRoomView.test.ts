import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import { PhaserRoomView, ITEM_LABEL_WIDTH_RATIO } from './PhaserRoomView.ts'
import { createInitialWorldState } from '../content/room1WorldState.ts'

interface MockText {
  text: string
  x: number
  y: number
  width: number
  displayWidth: number
  visible: boolean
  originX: number
  originY: number
  depth: number
  fontSize: number | string
  stroke: string
  strokeThickness: number
  alpha: number
  scaleX: number
  scaleY: number
  setOrigin(x: number, y?: number): MockText
  setDepth(d: number): MockText
  setText(t: string): MockText
  setPosition(x: number, y: number): MockText
  setVisible(v: boolean): MockText
  setFontSize(size: number | string): MockText
  setStroke(color: string, thickness: number): MockText
  setAlpha(alpha: number): MockText
  setScale(x: number, y?: number): MockText
  destroy(): void
}

interface MockImage {
  x: number
  y: number
  displayWidth: number
  displayHeight: number
  visible: boolean
  depth: number
  setDepth(d: number): MockImage
  setDisplaySize(w: number, h: number): MockImage
  setPosition(x: number, y: number): MockImage
  setVisible(v: boolean): MockImage
  destroy(): void
}

interface MockGraphics {
  depth: number
  visible: boolean
  setDepth(d: number): MockGraphics
  lineStyle(): MockGraphics
  strokeRect(): MockGraphics
  lineBetween(): MockGraphics
  fillStyle(): MockGraphics
  fillRect(): MockGraphics
  clear(): MockGraphics
  setVisible(v: boolean): MockGraphics
  destroy(): void
}

function createMockScene() {
  const images: MockImage[] = []
  const texts: MockText[] = []
  const graphics: MockGraphics[] = []

  const mockScene = {
    add: {
      graphics: (): MockGraphics => {
        const g: MockGraphics = {
          depth: 0,
          visible: true,
          setDepth(d: number) { g.depth = d; return g },
          lineStyle() { return g },
          strokeRect() { return g },
          lineBetween() { return g },
          fillStyle() { return g },
          fillRect() { return g },
          clear() { return g },
          setVisible(v: boolean) { g.visible = v; return g },
          destroy() {},
        }
        graphics.push(g)
        return g
      },
      text: (x: number, y: number, text: string): MockText => {
        const t: MockText = {
          x,
          y,
          text,
          visible: true,
          originX: 0,
          originY: 0,
          depth: 0,
          fontSize: 14,
          stroke: '#000000',
          strokeThickness: 3,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          get width() { return Math.max(1, t.text.length * 14) },
          get displayWidth() { return t.width * t.scaleX },
          setOrigin(ox: number, oy: number = ox) { t.originX = ox; t.originY = oy; return t },
          setDepth(d: number) { t.depth = d; return t },
          setText(val: string) { t.text = val; return t },
          setPosition(px: number, py: number) { t.x = px; t.y = py; return t },
          setVisible(v: boolean) { t.visible = v; return t },
          setFontSize(size: number | string) { t.fontSize = size; return t },
          setStroke(color: string, thickness: number) { t.stroke = color; t.strokeThickness = thickness; return t },
          setAlpha(alpha: number) { t.alpha = alpha; return t },
          setScale(sx: number, sy: number = sx) { t.scaleX = sx; t.scaleY = sy; return t },
          destroy() {},
        }
        texts.push(t)
        return t
      },
      image: (x: number, y: number): MockImage => {
        const img: MockImage = {
          x,
          y,
          displayWidth: 0,
          displayHeight: 0,
          visible: true,
          depth: 0,
          setDepth(d: number) { img.depth = d; return img },
          setDisplaySize(w: number, h: number) { img.displayWidth = w; img.displayHeight = h; return img },
          setPosition(px: number, py: number) { img.x = px; img.y = py; return img },
          setVisible(v: boolean) { img.visible = v; return img },
          destroy() {},
        }
        images.push(img)
        return img
      },
    },
  } as unknown as Phaser.Scene

  return { mockScene, images, texts, graphics }
}

describe('PhaserRoomView', () => {
  it('shows sprites by default with ? for undiscovered objects and hacker for player', () => {
    const view = new PhaserRoomView()
    const { mockScene, images, texts } = createMockScene()
    const worldState = createInitialWorldState()

    view.mount(mockScene, worldState)

    // All sprites should be visible by default even if undiscovered
    expect(images.length).toBe(worldState.worldObjects.length)
    for (const img of images) {
      expect(img.visible).toBe(true)
    }

    // Texts should include overhead labels for world objects
    const labels = texts.map((t) => t.text)
    expect(labels).toContain('hacker')
    expect(labels).toContain('?')

    // Verify player label is 'hacker' and not '?'
    const playerText = texts.find((t) => t.text === 'hacker')
    expect(playerText).toBeDefined()
    expect(playerText?.visible).toBe(true)

    // Verify undiscovered items/enemies have '?'
    const questionMarks = texts.filter((t) => t.text === '?')
    expect(questionMarks.length).toBeGreaterThanOrEqual(4) // dagger, guard, guard-2, guard-3
  })

  it('reveals ? to object names when objects become discovered (e.g. after ls)', () => {
    const view = new PhaserRoomView()
    const { mockScene, texts } = createMockScene()
    const worldState = createInitialWorldState()

    view.mount(mockScene, worldState)

    // Initially has '?' labels
    expect(texts.some((t) => t.text === 'guard')).toBe(false)
    expect(texts.some((t) => t.text === 'dagger')).toBe(false)

    // Simulate discovery (as done by `ls`)
    for (const obj of worldState.worldObjects) {
      (obj.state as Record<string, unknown>).discovered = true
    }

    view.update(worldState)

    // All labels are revealed to their names
    expect(texts.some((t) => t.text === '?')).toBe(false)
    expect(texts.some((t) => t.text === 'hacker')).toBe(true)
    expect(texts.some((t) => t.text === 'dagger')).toBe(true)
    expect(texts.some((t) => t.text === 'guard')).toBe(true)
    expect(texts.some((t) => t.text === 'guard-2')).toBe(true)
    expect(texts.some((t) => t.text === 'guard-3')).toBe(true)
  })

  it('keeps item label visible when equipped by a character and shrinks text width to ratio of item sprite', () => {
    const view = new PhaserRoomView()
    const { mockScene, texts } = createMockScene()
    const worldState = createInitialWorldState()

    view.mount(mockScene, worldState)

    const dagger = worldState.worldObjects.find((o) => o.id === 'dagger')!
    ;(dagger.state as Record<string, unknown>).discovered = true
    ;(dagger.state as Record<string, unknown>).equippedBy = 'player'

    view.update(worldState)

    const daggerText = texts.find((t) => t.text === 'dagger')
    expect(daggerText).toBeDefined()
    // Does not hide equipped item's label
    expect(daggerText?.visible).toBe(true)

    // Dagger sprite displayWidth when equipped is Math.round(72 * 0.8) = 58
    // Total text width is ITEM_LABEL_WIDTH_RATIO * sprite.displayWidth
    expect(daggerText?.displayWidth).toBeCloseTo(58 * ITEM_LABEL_WIDTH_RATIO, 1)
  })
})
