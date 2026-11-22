import { describe, expect, it } from 'vitest'
import type Phaser from 'phaser'
import {
  PhaserRoomView,
  DAGGER_ATTACK_DISTANCE,
  DAGGER_ATTACK_DURATION_MS,
  computeDaggerAttackTranslation,
} from './PhaserRoomView.ts'
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
  color: string
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
  setColor(color: string): MockText
  destroy(): void
}

interface MockImage {
  originX: number
  originY: number
  setOrigin(x: number, y: number): MockImage
  angle: number
  setAngle(angle: number): MockImage
  texture: { key: string }
  setTexture(key: string): MockImage
  x: number
  y: number
  displayWidth: number
  displayHeight: number
  visible: boolean
  flipX: boolean
  depth: number
  setDepth(d: number): MockImage
  setDisplaySize(w: number, h: number): MockImage
  setPosition(x: number, y: number): MockImage
  setVisible(v: boolean): MockImage
  setFlipX(flip: boolean): MockImage
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
          destroy() { },
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
          color: '#d6d6d6',
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
          setColor(color: string) { t.color = color; return t },
          destroy() { },
        }
        texts.push(t)
        return t
      },
      image: (x: number, y: number, key: string): MockImage => {
        const img: MockImage = {
          originX: 0.5, originY: 0.5,
          setOrigin(x: number, y: number) { img.originX = x; img.originY = y; return img },
          angle: 0,
          setAngle(angle: number) { img.angle = angle; return img },
          texture: { key },
          setTexture(key: string) { img.texture.key = key; return img },
          x,
          y,
          displayWidth: 0,
          displayHeight: 0,
          visible: true,
          flipX: false,
          depth: 0,
          setDepth(d: number) { img.depth = d; return img },
          setDisplaySize(w: number, h: number) { img.displayWidth = w; img.displayHeight = h; return img },
          setPosition(px: number, py: number) { img.x = px; img.y = py; return img },
          setVisible(v: boolean) { img.visible = v; return img },
          setFlipX(flip: boolean) { img.flipX = flip; return img },
          destroy() { },
        }
        images.push(img)
        return img
      },
    },
  } as unknown as Phaser.Scene

  return { mockScene, images, texts, graphics }
}

describe('PhaserRoomView', () => {
  it('shows a guard strike and recovery before returning to idle', () => {
    const view = new PhaserRoomView()
    const { mockScene, images } = createMockScene()
    const state = createInitialWorldState()
    view.mount(mockScene, state)
    const guard = state.worldObjects.find(o => o.id === 'guard')!
    const data = guard.state as { attackSequence?: number }
    const image = images[state.worldObjects.indexOf(guard)]
    const size = [image.displayWidth, image.displayHeight]
    data.attackSequence = 1
    view.update(state)
    expect(image.texture.key).toBe('guard-attack')
    state.simulationTick += 8
    view.update(state)
    expect(image.texture.key).toBe('guard-recover')
    state.simulationTick += 8
    view.update(state)
    expect(image.texture.key).toBe('guard-idle')
    expect([image.displayWidth, image.displayHeight]).toEqual(size)
  })

  it('cycles walking poses during movement and restores idle when stationary without resizing', () => {
    const view = new PhaserRoomView()
    const { mockScene, images } = createMockScene()
    const state = createInitialWorldState()
    view.mount(mockScene, state)
    const player = state.worldObjects.find(o => o.metadata.role === 'player')!
    const image = images[state.worldObjects.indexOf(player)]
    const dimensions = [image.displayWidth, image.displayHeight]
    const data = player.state as { x: number }
    state.simulationTick = 7
    data.x += 5
    view.update(state)
    expect(image.texture.key).toBe('player-step-a')
    state.simulationTick = 21
    data.x += 5
    view.update(state)
    expect(image.texture.key).toBe('player-step-b')
    expect([image.displayWidth, image.displayHeight]).toEqual(dimensions)
    view.update(state)
    expect(image.texture.key).toBe('player-idle')
    view.destroy()
    view.mount(mockScene, state)
    expect(images.at(-state.worldObjects.length)?.texture.key).toBe('player-idle')
  })

  it('shows sprites and displays object labels by default', () => {
    const view = new PhaserRoomView()
    const { mockScene, images, texts } = createMockScene()
    const worldState = createInitialWorldState()

    view.mount(mockScene, worldState)

    // All sprites should be visible by default
    expect(images.length).toBe(worldState.worldObjects.length)
    for (const img of images) {
      expect(img.visible).toBe(true)
    }

    // Texts should include overhead labels with object names by default
    const labels = texts.map((t) => t.text)
    expect(labels).toContain('hacker')
    expect(labels).toContain('dagger')
    expect(labels).toContain('guard')
    expect(labels).toContain('guard2')
    expect(labels).toContain('guard3')
    expect(labels).not.toContain('?')
  })

  it('updates overhead label when an object is renamed', () => {
    const view = new PhaserRoomView()
    const { mockScene, texts } = createMockScene()
    const worldState = createInitialWorldState()

    view.mount(mockScene, worldState)

    expect(texts.some((t) => t.text === 'dagger')).toBe(true)
    expect(texts.some((t) => t.text === 'sword')).toBe(false)

    const dagger = worldState.worldObjects.find((o) => o.id === 'dagger')!
    dagger.rename('sword')

    view.update(worldState)

    expect(texts.some((t) => t.text === 'dagger')).toBe(false)
    expect(texts.some((t) => t.text === 'sword')).toBe(true)
  })

  it('appends an equipped weapon label to the holder name at full scale', () => {
    const view = new PhaserRoomView()
    const { mockScene, texts } = createMockScene()
    const worldState = createInitialWorldState()

    view.mount(mockScene, worldState)

    const player = worldState.worldObjects.find((o) => o.id === 'player')!
    const dagger = worldState.worldObjects.find((o) => o.id === 'dagger')!
      ; (dagger.state as Record<string, unknown>).discovered = true
      ; (dagger.state as Record<string, unknown>).equippedBy = 'player'

    view.update(worldState)

    const playerText = texts.find((t) => t.text === 'hacker')!
    const daggerText = texts.find((t) => t.text === ',dagger')!
    expect(daggerText).toBeDefined()
    expect(daggerText?.visible).toBe(true)
    expect(playerText?.text).toBe('hacker')
    expect(playerText?.x).toBe((player.state as Record<string, unknown>).x)
    expect(daggerText?.x).toBe(playerText.x + playerText.width / 2)
    expect(daggerText?.y).toBe(playerText.y)
    expect(daggerText?.scaleX).toBe(1)
  })

  it('renders an unequipped item with its bare name at full scale', () => {
    const view = new PhaserRoomView()
    const { mockScene, texts } = createMockScene()
    const worldState = createInitialWorldState()

    view.mount(mockScene, worldState)

    const daggerText = texts.find((t) => t.text === 'dagger')!
    expect(daggerText).toBeDefined()
    expect(daggerText.text).toBe('dagger')
    expect(daggerText.scaleX).toBe(1)
    expect(daggerText.originX).toBe(0.5)
  })

  it('updates overhead label when object is renamed', () => {
    const view = new PhaserRoomView()
    const { mockScene, texts } = createMockScene()
    const worldState = createInitialWorldState()

    view.mount(mockScene, worldState)

    const dagger = worldState.worldObjects.find((o) => o.id === 'dagger')!
    dagger.rename('sword')
      ; (dagger.state as Record<string, unknown>).discovered = true

    view.update(worldState)

    expect(texts.some((t) => t.text === 'sword')).toBe(true)
    expect(texts.some((t) => t.text === 'dagger')).toBe(false)
  })

  it('sets sprite flipX according to facing direction', () => {
    const view = new PhaserRoomView()
    const { mockScene, images } = createMockScene()
    const worldState = createInitialWorldState()

    view.mount(mockScene, worldState)

    const player = worldState.worldObjects.find((o) => o.id === 'player')!
    const playerIndex = worldState.worldObjects.indexOf(player)
    const playerImage = images[playerIndex]

    // Default player facing is 'right' -> flipX is false
    expect(playerImage.flipX).toBe(false)

      // When facing is 'left' -> flipX is true
      ; (player.state as Record<string, unknown>).facing = 'left'
    view.update(worldState)
    expect(playerImage.flipX).toBe(true)

      // When facing is 'right' -> flipX is false
      ; (player.state as Record<string, unknown>).facing = 'right'
    view.update(worldState)
    expect(playerImage.flipX).toBe(false)
  })

  it('renders equipped weapon in local coordinates of holder and flips with holder', () => {
    const view = new PhaserRoomView()
    const { mockScene, images } = createMockScene()
    const worldState = createInitialWorldState()

    view.mount(mockScene, worldState)

    const player = worldState.worldObjects.find((o) => o.id === 'player')!
    const dagger = worldState.worldObjects.find((o) => o.id === 'dagger')!
    const daggerIndex = worldState.worldObjects.indexOf(dagger)
    const daggerImage = images[daggerIndex]

    const playerState = player.state as Record<string, unknown>
    const daggerState = dagger.state as Record<string, unknown>
    playerState.x = 400
    playerState.y = 300
    playerState.facing = 'right'

    daggerState.equippedBy = 'player'
    daggerState.x = 400
    daggerState.y = 300
    daggerState.holdOffsetX = 44
    daggerState.holdOffsetY = 38

    // When holder faces right: local offset (+44, +38), flipX is false
    view.update(worldState)
    expect(daggerImage.angle).toBe(0)
    expect(daggerImage.originX).toBe(0.25)
    expect(daggerImage.x).toBe(444)
    expect(daggerImage.y).toBe(338)
    expect(daggerImage.flipX).toBe(false)

    // When holder faces left: mirrored local offset (-44, +38), flipX is true
    playerState.facing = 'left'
    view.update(worldState)
    expect(daggerImage.angle).toBe(0)
    expect(daggerImage.originX).toBe(0.75)
    expect(daggerImage.x).toBe(356)
    expect(daggerImage.y).toBe(338)
    expect(daggerImage.flipX).toBe(true)
  })

  it('translates dagger position during attack animation based on facing direction', () => {
    const view = new PhaserRoomView()
    const { mockScene, images } = createMockScene()
    const worldState = createInitialWorldState()

    view.mount(mockScene, worldState)

    const player = worldState.worldObjects.find((o) => o.id === 'player')!
    const dagger = worldState.worldObjects.find((o) => o.id === 'dagger')!
    const daggerIndex = worldState.worldObjects.indexOf(dagger)
    const daggerImage = images[daggerIndex]

    const playerState = player.state as Record<string, unknown>
    const daggerState = dagger.state as Record<string, unknown>
    playerState.x = 400
    playerState.y = 300
    playerState.facing = 'right'

    daggerState.equippedBy = 'player'
    daggerState.x = 400
    daggerState.y = 300
    daggerState.holdOffsetX = 44
    daggerState.holdOffsetY = 38

    // Explicit attack translation when facing right: +30px thrust
    daggerState.attackOffsetX = 30
    view.update(worldState)
    expect(daggerImage.x).toBe(474) // 400 + 44 + 30
    expect(daggerImage.y).toBe(338)

    // Explicit attack translation when facing left: -30px thrust
    playerState.facing = 'left'
    daggerState.attackOffsetX = -30
    view.update(worldState)
    expect(daggerImage.x).toBe(326) // 400 - 44 - 30
    expect(daggerImage.y).toBe(338)

    // Dynamic computation from attackElapsedMs at peak (100ms / 200ms)
    delete daggerState.attackOffsetX
    daggerState.attackDurationMs = DAGGER_ATTACK_DURATION_MS
    daggerState.attackElapsedMs = DAGGER_ATTACK_DURATION_MS / 2 // peak: +30px translation

    playerState.facing = 'right'
    view.update(worldState)
    expect(daggerImage.x).toBe(474)

    playerState.facing = 'left'
    view.update(worldState)
    expect(daggerImage.x).toBe(326)

    // After animation completes, returns to resting position
    daggerState.attackElapsedMs = DAGGER_ATTACK_DURATION_MS
    view.update(worldState)
    expect(daggerImage.angle).toBe(0)
    expect(daggerImage.originX).toBe(0.75)
    expect(daggerImage.x).toBe(356) // 400 - 44 + 0
  })

  it('computes dagger attack translation using sine-wave easing', () => {
    expect(computeDaggerAttackTranslation(0, DAGGER_ATTACK_DURATION_MS, DAGGER_ATTACK_DISTANCE)).toBe(0)
    expect(computeDaggerAttackTranslation(100, DAGGER_ATTACK_DURATION_MS, DAGGER_ATTACK_DISTANCE)).toBe(DAGGER_ATTACK_DISTANCE)
    expect(computeDaggerAttackTranslation(200, DAGGER_ATTACK_DURATION_MS, DAGGER_ATTACK_DISTANCE)).toBe(0)
    expect(computeDaggerAttackTranslation(-10, DAGGER_ATTACK_DURATION_MS, DAGGER_ATTACK_DISTANCE)).toBe(0)
    expect(computeDaggerAttackTranslation(250, DAGGER_ATTACK_DURATION_MS, DAGGER_ATTACK_DISTANCE)).toBe(0)
    expect(computeDaggerAttackTranslation(50, DAGGER_ATTACK_DURATION_MS, DAGGER_ATTACK_DISTANCE)).toBe(21)
    expect(computeDaggerAttackTranslation(150, DAGGER_ATTACK_DURATION_MS, DAGGER_ATTACK_DISTANCE)).toBe(21)
  })
})
