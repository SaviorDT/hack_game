import Phaser from 'phaser'
import textboxImageUrl from '../../assets/game/ui/textbox.png'
import {
  ROOM_LAYOUT,
  WORLD_OBJECT_IDS,
} from '../content/room1Constants.ts'
import {
  ROOM1_OBJECTS,
  type PlayerSpeedConfig,
} from '../content/room1.ts'
import { generateRoom1Source } from '../content/room1Serializer.ts'
import { GameSession } from '../application/GameSession.ts'
import {
  PhaserRoomView,
  WORLD_OBJECT_TEXTURE_URLS,
} from '../presentation/PhaserRoomView.ts'
import { COMMAND_INPUT_TEXTURE_KEY } from '../presentation/PhaserCommandInputView.ts'
import type { WorldState } from '../domain/WorldState.ts'
import {
  DEFAULT_SPEED_CONFIG,
  getPlayerSpeedFromObjects,
  createSpeedEditorSession,
} from './speedEditorSession.ts'

const FONT_FAMILY = '"Press Start 2P", monospace'
const TEXT_COLOR = '#d6d6d6'
const DIM_COLOR = '#888888'
const ACCENT_COLOR = '#4fc3f7'
const VALUE_COLOR = '#64ffda'
const PANEL_BG = 0x1a1a1a
const PANEL_X = 96
const PANEL_Y = 720
const PANEL_WIDTH = 1728
const PANEL_HEIGHT = 295

export class SpeedEditorScene extends Phaser.Scene {
  private session!: GameSession
  private worldState!: WorldState
  private readonly roomView = new PhaserRoomView()
  private playerSpeed: PlayerSpeedConfig = { ...DEFAULT_SPEED_CONFIG }

  private panelContainer: Phaser.GameObjects.Container | undefined
  private headerText: Phaser.GameObjects.Text | undefined
  private instructionText: Phaser.GameObjects.Text | undefined
  private saveButton: Phaser.GameObjects.Container | undefined

  private speedFields: Map<keyof PlayerSpeedConfig, Phaser.GameObjects.Text> = new Map()
  private telemetrySpeedText: Phaser.GameObjects.Text | undefined
  private telemetryVelocityText: Phaser.GameObjects.Text | undefined
  private telemetryInputText: Phaser.GameObjects.Text | undefined
  private speedGaugeGraphics: Phaser.GameObjects.Graphics | undefined
  private isPromptOpen = false

  constructor() {
    super({ key: 'speed-editor' })
  }

  preload(): void {
    if (!this.textures.exists(COMMAND_INPUT_TEXTURE_KEY)) {
      this.load.image(COMMAND_INPUT_TEXTURE_KEY, textboxImageUrl)
    }
    for (const [textureKey, imageUrl] of Object.entries(WORLD_OBJECT_TEXTURE_URLS)) {
      if (!this.textures.exists(textureKey)) {
        this.load.image(textureKey, imageUrl)
      }
    }
  }

  create(): void {
    this.speedFields.clear()
    this.isPromptOpen = false

    // Initialize player speed from ROOM1_OBJECTS
    this.playerSpeed = getPlayerSpeedFromObjects(ROOM1_OBJECTS)

    // Create session reusing main game movement code
    const bundle = createSpeedEditorSession({ playerSpeed: this.playerSpeed })
    this.session = bundle.session
    this.worldState = bundle.worldState

    // Mount room visual view (room layout, door, divider, characters)
    this.roomView.mount(this, this.worldState)

    // Header Title
    this.headerText = this.add
      .text(960, 24, 'SPEED EDITOR — Player Movement & Physics Tuning', {
        fontFamily: FONT_FAMILY,
        fontSize: 24,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
      .setDepth(50)

    // Top Right Navigation Hints
    this.add
      .text(1824, 26, 'R: Reset Pos · ESC: Level Editor · F2: Game', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: DIM_COLOR,
      })
      .setOrigin(1, 0)
      .setDepth(50)

    // Build tuning control panel
    this.buildPanel()

    // Bottom Instruction bar
    this.instructionText = this.add
      .text(
        960,
        1048,
        'WASD / Arrows: Move player · Test physics while tuning · Click +/- to adjust · Click number for exact input · R: Reset position',
        {
          fontFamily: FONT_FAMILY,
          fontSize: 13,
          color: DIM_COLOR,
        },
      )
      .setOrigin(0.5, 0.5)
      .setDepth(50)

    // Keyboard handlers
    const keyboard = this.input.keyboard
    keyboard?.on('keydown', this.handleKeyDown)
    keyboard?.on('keyup', this.handleKeyUp)
    this.game.events.on(Phaser.Core.Events.BLUR, this.handleBlur)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.off('keydown', this.handleKeyDown)
      keyboard?.off('keyup', this.handleKeyUp)
      this.game.events.off(Phaser.Core.Events.BLUR, this.handleBlur)
      this.headerText?.destroy()
      this.instructionText?.destroy()
      this.panelContainer?.destroy(true)
      this.saveButton?.destroy(true)
      this.roomView.destroy()
      this.speedFields.clear()
    })
  }

  update(_time: number, delta: number): void {
    // Advance simulation using main game movement code
    this.session.update(delta)

    // Update room visuals with interpolated render position
    this.roomView.update(this.worldState, (objectId) => this.session.getRenderPosition(objectId))

    // Update live telemetry & speedometer
    this.updateTelemetry()
  }

  private buildPanel(): void {
    const bg = this.add
      .rectangle(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, PANEL_BG, 0.95)
      .setStrokeStyle(2, 0x444444, 1)

    const items: Phaser.GameObjects.GameObject[] = [bg]

    // Vertical dividers dividing into: Parameter Tuning (left), Telemetry (middle), Actions (right)
    const dividers = this.add.graphics()
    dividers.lineStyle(2, 0x333333, 1)
    dividers.lineBetween(1060, 16, 1060, PANEL_HEIGHT - 16)
    dividers.lineBetween(1420, 16, 1420, PANEL_HEIGHT - 16)
    items.push(dividers)

    // ─── Column 1: Speed Parameter Controls ───
    const col1Title = this.add
      .text(540, 16, 'PLAYER SPEED PARAMETERS', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(col1Title)

    // Build the 4 rows: maxSpeed, acceleration, frictionAcceleration, turnaroundAcceleration
    this.buildSpeedControlRow(
      'maxSpeed',
      'MAX SPEED (px/s)',
      'Velocity cap in movement mode',
      50,
      [-50, -10, 10, 50],
      items,
    )
    this.buildSpeedControlRow(
      'acceleration',
      'ACCEL (px/s²)',
      'Speed-up rate toward input',
      110,
      [-250, -50, 50, 250],
      items,
    )
    this.buildSpeedControlRow(
      'frictionAcceleration',
      'FRICTION (px/s²)',
      'Braking rate when input ceases',
      170,
      [-250, -50, 50, 250],
      items,
    )
    this.buildSpeedControlRow(
      'turnaroundAcceleration',
      'TURNAROUND (px/s²)',
      'Reverse rate opposing velocity',
      230,
      [-250, -50, 50, 250],
      items,
    )

    // ─── Column 2: Live Telemetry & Speedometer ───
    const col2Title = this.add
      .text(1240, 16, 'LIVE TELEMETRY', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(col2Title)

    this.telemetrySpeedText = this.add
      .text(1080, 54, 'Speed: 0.0 / 300 px/s', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: VALUE_COLOR,
      })
      .setOrigin(0, 0)

    this.telemetryVelocityText = this.add
      .text(1080, 84, 'Vx: +0.0  Vy: +0.0', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0)

    this.telemetryInputText = this.add
      .text(1080, 112, 'Input: (0.0, 0.0)', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    // Visual speedometer gauge bar
    const gaugeBg = this.add
      .rectangle(1080 + 155, 155, 310, 20, 0x111111, 1)
      .setStrokeStyle(2, 0x444444, 1)
    this.speedGaugeGraphics = this.add.graphics()
    items.push(
      this.telemetrySpeedText,
      this.telemetryVelocityText,
      this.telemetryInputText,
      gaugeBg,
      this.speedGaugeGraphics,
    )

    // Reset position button in telemetry column
    const resetPosBtn = this.createButton(
      1240,
      210,
      'RESET POS (R)',
      '#263238',
      '#90a4ae',
      () => this.resetPlayerPosition(),
    )
    items.push(resetPosBtn)

    const posHint = this.add
      .text(1240, 260, 'Press R while moving\nto snap back to start', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
        align: 'center',
      })
      .setOrigin(0.5, 0)
    items.push(posHint)

    // ─── Column 3: Actions & Navigation ───
    const col3Title = this.add
      .text(1574, 16, 'ACTIONS', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(col3Title)

    // Save button
    const saveBtn = this.createSaveButton(1574, 60)
    items.push(saveBtn)

    // Reset defaults button
    const resetDefaultBtn = this.createButton(
      1574,
      124,
      'RESET DEFAULTS',
      '#37474f',
      '#eceff1',
      () => this.resetDefaults(),
      250,
      38,
    )
    items.push(resetDefaultBtn)

    // Back to Level Editor button
    const backToEditorBtn = this.createButton(
      1574,
      180,
      '< LEVEL EDITOR (ESC)',
      '#0d47a1',
      '#ffffff',
      () => this.returnToLevelEditor(),
      250,
      42,
    )
    items.push(backToEditorBtn)

    // Back to Game button
    const backToGameBtn = this.createButton(
      1574,
      236,
      'GAMEPLAY (F2)',
      '#263238',
      '#b0bec5',
      () => this.returnToGame(),
      250,
      38,
    )
    items.push(backToGameBtn)

    this.panelContainer = this.add.container(PANEL_X, PANEL_Y, items).setDepth(40)
    this.refreshSpeedPanelFields()
  }

  private buildSpeedControlRow(
    property: keyof PlayerSpeedConfig,
    title: string,
    subtitle: string,
    y: number,
    steps: number[],
    containerItems: Phaser.GameObjects.GameObject[],
  ): void {
    // Label and description
    const label = this.add
      .text(28, y, title, {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0)

    const desc = this.add
      .text(28, y + 20, subtitle, {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    // Current value display (clickable to input exact number)
    const valText = this.add
      .text(370, y + 8, '--', {
        fontFamily: FONT_FAMILY,
        fontSize: 15,
        color: VALUE_COLOR,
        backgroundColor: '#262626',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true })

    valText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.promptSpeed(property)
    })

    this.speedFields.set(property, valText)
    containerItems.push(label, desc, valText)

    // Quick step buttons (e.g. [-250, -50, +50, +250])
    const buttonPositions = [470, 565, 660, 755]
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const stepLabel = step > 0 ? `+${step}` : `${step}`
      const btnX = buttonPositions[i]
      const isPositive = step > 0

      const btn = this.add
        .text(btnX, y + 8, stepLabel, {
          fontFamily: FONT_FAMILY,
          fontSize: 12,
          color: isPositive ? '#a5d6a7' : '#ef9a9a',
          backgroundColor: '#333333',
          padding: { x: 8, y: 5 },
        })
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true })

      btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.()
        const multiplier = pointer.event?.shiftKey ? 5 : 1
        this.adjustSpeed(property, step * multiplier)
      })

      containerItems.push(btn)
    }
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    bgColor: string,
    textColor: string,
    onClick: () => void,
    width = 230,
    height = 36,
  ): Phaser.GameObjects.Container {
    const bg = this.add
      .rectangle(0, 0, width, height, Phaser.Display.Color.HexStringToColor(bgColor).color, 1)
      .setStrokeStyle(2, 0x555555, 1)

    const label = this.add
      .text(0, 0, text, {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: textColor,
      })
      .setOrigin(0.5, 0.5)

    const container = this.add.container(x, y, [bg, label])
    container.setSize(width, height)
    container.setInteractive({ useHandCursor: true })
    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      onClick()
    })

    return container
  }

  private createSaveButton(x: number, y: number): Phaser.GameObjects.Container {
    const width = 250
    const height = 44
    const bg = this.add
      .rectangle(0, 0, width, height, 0x2e7d32, 1)
      .setStrokeStyle(2, 0x66bb6a, 1)

    const label = this.add
      .text(0, 0, 'SAVE TO ROOM1.TS', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)

    const container = this.add.container(x, y, [bg, label])
    container.setSize(width, height)
    container.setInteractive({ useHandCursor: true })
    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.saveSpeed()
    })

    this.saveButton = container
    return container
  }

  private refreshSpeedPanelFields(): void {
    for (const [key, field] of this.speedFields.entries()) {
      const val = this.playerSpeed[key]
      field.setText(val.toString())
    }
  }

  private updateTelemetry(): void {
    const player = this.worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
    if (!player) return

    const state = player.state as Record<string, unknown>
    const vx = typeof state.vx === 'number' ? state.vx : 0
    const vy = typeof state.vy === 'number' ? state.vy : 0
    const moveX = typeof state.moveX === 'number' ? state.moveX : 0
    const moveY = typeof state.moveY === 'number' ? state.moveY : 0
    const speed = Math.hypot(vx, vy)
    const maxSpd = this.playerSpeed.maxSpeed

    this.telemetrySpeedText?.setText(
      `Speed: ${speed.toFixed(1)} / ${maxSpd} px/s`,
    )
    this.telemetryVelocityText?.setText(
      `Vx: ${vx >= 0 ? '+' : ''}${vx.toFixed(1)}  Vy: ${vy >= 0 ? '+' : ''}${vy.toFixed(1)}`,
    )
    this.telemetryInputText?.setText(
      `Input: (${moveX.toFixed(2)}, ${moveY.toFixed(2)})`,
    )

    // Redraw visual speed gauge
    if (this.speedGaugeGraphics) {
      this.speedGaugeGraphics.clear()
      const ratio = Math.min(1, Math.max(0, speed / Math.max(1, maxSpd)))
      const barWidth = Math.round(ratio * 306)
      if (barWidth > 0) {
        // Dynamic color interpolation between cyan and yellow/red when capped
        const color = ratio > 0.95 ? 0x00e676 : 0x4fc3f7
        this.speedGaugeGraphics.fillStyle(color, 1)
        this.speedGaugeGraphics.fillRect(1080 + 2, 147, barWidth, 16)
      }
    }
  }

  public setPlayerSpeed(newSpeed: Partial<PlayerSpeedConfig>): void {
    Object.assign(this.playerSpeed, newSpeed)

    // Update live world state
    const player = this.worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
    if (player) {
      const state = player.state as Record<string, unknown>
      if (typeof state.speed === 'object' && state.speed !== null) {
        Object.assign(state.speed, newSpeed)
      } else {
        state.speed = { ...this.playerSpeed }
      }
      if (newSpeed.maxSpeed !== undefined) state.maxSpeed = newSpeed.maxSpeed
      if (newSpeed.acceleration !== undefined) state.acceleration = newSpeed.acceleration
      if (newSpeed.frictionAcceleration !== undefined) state.frictionAcceleration = newSpeed.frictionAcceleration
      if (newSpeed.turnaroundAcceleration !== undefined) state.turnaroundAcceleration = newSpeed.turnaroundAcceleration
    }

    // Update in-memory ROOM1_OBJECTS array so other scenes reflect changes
    const room1Player = ROOM1_OBJECTS.find((o) => o.role === 'player' || o.id === WORLD_OBJECT_IDS.player)
    if (room1Player) {
      room1Player.speed = { ...this.playerSpeed }
    }

    this.refreshSpeedPanelFields()
  }

  public adjustSpeed(property: keyof PlayerSpeedConfig, delta: number): void {
    const current = this.playerSpeed[property]
    const min = property === 'maxSpeed' ? 10 : 50
    const next = Math.max(min, Math.round(current + delta))
    if (next !== current) {
      this.setPlayerSpeed({ [property]: next })
    }
  }

  public promptSpeed(property: keyof PlayerSpeedConfig): void {
    this.isPromptOpen = true
    this.session.releaseAllKeys()
    const current = this.playerSpeed[property]
    const input = window.prompt(`Enter new ${property} for player:`, current.toString())
    this.session.releaseAllKeys()
    this.isPromptOpen = false

    if (input === null) return
    const parsed = parseInt(input.trim(), 10)
    const min = property === 'maxSpeed' ? 10 : 50
    if (!isNaN(parsed) && parsed >= min && parsed !== current) {
      this.setPlayerSpeed({ [property]: parsed })
    }
  }

  public resetDefaults(): void {
    this.setPlayerSpeed(DEFAULT_SPEED_CONFIG)
  }

  public resetPlayerPosition(): void {
    const player = this.worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
    if (player) {
      const state = player.state as Record<string, unknown>
      const room1Player = ROOM1_OBJECTS.find((o) => o.role === 'player' || o.id === WORLD_OBJECT_IDS.player)
      state.x = room1Player?.x ?? ROOM_LAYOUT.playerStart.x
      state.y = room1Player?.y ?? ROOM_LAYOUT.playerStart.y
      state.vx = 0
      state.vy = 0
    }
    this.session.releaseAllKeys()
  }

  public async saveSpeed(): Promise<boolean> {
    const player = ROOM1_OBJECTS.find((o) => o.role === 'player' || o.id === WORLD_OBJECT_IDS.player)
    if (player) {
      player.speed = { ...this.playerSpeed }
    }

    const source = generateRoom1Source(ROOM1_OBJECTS)
    const bg = this.saveButton?.getAt(0) as Phaser.GameObjects.Rectangle | undefined
    const label = this.saveButton?.getAt(1) as Phaser.GameObjects.Text | undefined

    try {
      const response = await fetch('/api/save-room1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: source }),
      })

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error ?? 'Unknown save error')
      }

      if (bg && label) {
        bg.setFillStyle(0x66bb6a, 1)
        label.setText('SAVED TO ROOM1.TS!')
        this.time.delayedCall(1500, () => {
          bg.setFillStyle(0x2e7d32, 1)
          label.setText('SAVE TO ROOM1.TS')
        })
      }
      return true
    } catch (err) {
      console.error('Failed to save room1 speed:', err)
      if (bg && label) {
        bg.setFillStyle(0xb71c1c, 1)
        label.setText('SAVE FAILED (CONSOLE)')
        this.time.delayedCall(2000, () => {
          bg.setFillStyle(0x2e7d32, 1)
          label.setText('SAVE TO ROOM1.TS')
        })
      }
      return false
    }
  }

  public returnToLevelEditor(): void {
    this.scene.start('level-editor')
  }

  public returnToGame(): void {
    this.scene.start('game')
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.isPromptOpen) return

    if (event.key === 'Escape' || event.key === 'F3') {
      event.preventDefault()
      this.returnToLevelEditor()
      return
    }

    if (event.key === 'F2') {
      event.preventDefault()
      this.returnToGame()
      return
    }

    const key = event.key.toLowerCase()
    if (key === 'r') {
      event.preventDefault()
      this.resetPlayerPosition()
      return
    }

    // Pass movement keys directly to GameSession to drive movement
    this.session.keyDown(key)
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.session.keyUp(event.key.toLowerCase())
  }

  private readonly handleBlur = (): void => {
    this.session.releaseAllKeys()
  }
}
