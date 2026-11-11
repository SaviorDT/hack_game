import Phaser from 'phaser'
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
import type { WorldState } from '../domain/WorldState.ts'
import {
  DEFAULT_SPEED_CONFIG,
  getPlayerSpeedFromObjects,
  createSpeedEditorSession,
} from './speedEditorSession.ts'
import { SceneManager } from './SceneManager.ts'
import {
  FONT_FAMILY,
  TEXT_COLOR,
  DIM_COLOR,
  ACCENT_COLOR,
  VALUE_COLOR,
  PANEL_BG,
} from './editorTheme.ts'

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
    for (const [textureKey, imageUrl] of Object.entries(WORLD_OBJECT_TEXTURE_URLS)) {
      if (!this.textures.exists(textureKey)) {
        this.load.image(textureKey, imageUrl)
      }
    }
  }

  create(): void {
    this.speedFields.clear()
    this.isPromptOpen = false

    // Initialize player speed
    this.playerSpeed = getPlayerSpeedFromObjects(ROOM1_OBJECTS)

    // Create session reusing main game movement code
    const bundle = createSpeedEditorSession({
      playerSpeed: this.playerSpeed,
    })
    this.session = bundle.session
    this.worldState = bundle.worldState

    // Mount room visual view (room layout, door, divider, characters)
    this.roomView.mount(this, this.worldState)

    // Header Title
    this.headerText = this.add
      .text(ROOM_LAYOUT.left, 24, 'SPEED EDITOR — Player Movement & Speed Tuning', {
        fontFamily: FONT_FAMILY,
        fontSize: 18,
        color: ACCENT_COLOR,
      })
      .setOrigin(0, 0)
      .setDepth(50)

    // Top Right Navigation Hints
    this.add
      .text(ROOM_LAYOUT.right, 26, 'F1: Command · F2: Level · F4: AI Editor · F3 / ESC: Game', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
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
        'Arrows: Move · R: Reset · Click +/-: Adjust · Click value: Exact input',
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

    // Dividers: Column 1 (0..720), Column 2 (720..1300), Column 3 (1300..1728)
    const dividers = this.add.graphics()
    dividers.lineStyle(2, 0x333333, 1)
    dividers.lineBetween(720, 16, 720, PANEL_HEIGHT - 16)
    dividers.lineBetween(1300, 16, 1300, PANEL_HEIGHT - 16)
    items.push(dividers)

    // ─── Column 1: Player Speed Parameters ───
    const col1Title = this.add
      .text(360, 14, 'PLAYER SPEED PARAMETERS', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(col1Title)

    this.buildSpeedControlRow(
      'maxSpeed',
      'MAX SPEED (px/s)',
      'Velocity cap in movement mode',
      46,
      [-50, -10, 10, 50],
      items,
    )
    this.buildSpeedControlRow(
      'acceleration',
      'ACCEL (px/s²)',
      'Speed-up rate toward input',
      104,
      [-250, -50, 50, 250],
      items,
    )
    this.buildSpeedControlRow(
      'frictionAcceleration',
      'FRICTION (px/s²)',
      'Braking rate when input ceases',
      162,
      [-250, -50, 50, 250],
      items,
    )
    this.buildSpeedControlRow(
      'turnaroundAcceleration',
      'TURNAROUND (px/s²)',
      'Reverse rate opposing velocity',
      220,
      [-250, -50, 50, 250],
      items,
    )

    // ─── Column 2: Live Telemetry & Speedometer ───
    const col2Title = this.add
      .text(1010, 14, 'LIVE TELEMETRY & SPEEDOMETER', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(col2Title)

    this.telemetrySpeedText = this.add
      .text(780, 50, 'Player: 0.0 / 300 px/s', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: VALUE_COLOR,
      })
      .setOrigin(0, 0)

    this.telemetryVelocityText = this.add
      .text(780, 84, 'Vx: +0.0  Vy: +0.0', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0)

    this.telemetryInputText = this.add
      .text(780, 116, 'Input: (0.0, 0.0)', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    // Visual speedometer gauge bar
    const gaugeLabel = this.add
      .text(780, 160, 'SPEEDOMETER', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    const gaugeBg = this.add
      .rectangle(780 + 225, 200, 450, 24, 0x111111, 1)
      .setStrokeStyle(2, 0x444444, 1)
    this.speedGaugeGraphics = this.add.graphics()

    items.push(
      this.telemetrySpeedText,
      this.telemetryVelocityText,
      this.telemetryInputText,
      gaugeLabel,
      gaugeBg,
      this.speedGaugeGraphics,
    )

    // ─── Column 3: Actions ───
    const col3Title = this.add
      .text(1514, 14, 'ACTIONS', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(col3Title)

    // Save button
    const saveBtn = this.createSaveButton(1514, 68)
    items.push(saveBtn)

    // Reset defaults button
    const resetDefaultBtn = this.createButton(
      1514,
      132,
      'RESET DEFAULTS',
      '#37474f',
      '#eceff1',
      () => this.resetDefaults(),
      250,
      36,
    )
    items.push(resetDefaultBtn)

    // Reset positions button
    const resetPosBtn = this.createButton(
      1514,
      196,
      'RESET POSITIONS (R)',
      '#263238',
      '#cfd8dc',
      () => this.resetPlayerPosition(),
      250,
      36,
    )
    items.push(resetPosBtn)

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
    const label = this.add
      .text(24, y, title, {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0)

    const desc = this.add
      .text(24, y + 17, subtitle, {
        fontFamily: FONT_FAMILY,
        fontSize: 9,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    const valText = this.add
      .text(280, y + 8, '--', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: VALUE_COLOR,
        backgroundColor: '#262626',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true })

    valText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.promptSpeed(property)
    })

    this.speedFields.set(property, valText)
    containerItems.push(label, desc, valText)

    const buttonPositions = [360, 440, 520, 600]
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const stepLabel = step > 0 ? `+${step}` : `${step}`
      const btnX = buttonPositions[i]
      const isPositive = step > 0

      const btn = this.add
        .text(btnX, y + 8, stepLabel, {
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          color: isPositive ? '#a5d6a7' : '#ef9a9a',
          backgroundColor: '#333333',
          padding: { x: 5, y: 4 },
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
      .text(0, 0, 'SAVE CHANGES', {
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
      `Player: ${speed.toFixed(1)} / ${maxSpd} px/s`,
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
      const barWidth = Math.round(ratio * 446)
      if (barWidth > 0) {
        // Dynamic color interpolation between cyan and green when capped
        const color = ratio > 0.95 ? 0x00e676 : 0x4fc3f7
        this.speedGaugeGraphics.fillStyle(color, 1)
        this.speedGaugeGraphics.fillRect(780 + 2, 189, barWidth, 22)
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
      state.facing = 'right'
      state.thrown = null
    }

    const dagger = this.worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)
    if (dagger) {
      const state = dagger.state as Record<string, unknown>
      const room1Dagger = ROOM1_OBJECTS.find((o) => o.role === 'weapon' || o.id === WORLD_OBJECT_IDS.dagger)
      state.x = room1Dagger?.x ?? ROOM_LAYOUT.daggerStart.x
      state.y = room1Dagger?.y ?? ROOM_LAYOUT.daggerStart.y
      state.vx = 0
      state.vy = 0
      state.thrown = null
      state.equippedBy = null
      state.flipX = false
    }

    this.session.releaseAllKeys()
  }

  public async saveSpeed(): Promise<boolean> {
    const player = ROOM1_OBJECTS.find((o) => o.role === 'player' || o.id === WORLD_OBJECT_IDS.player)
    if (player) {
      player.speed = { ...this.playerSpeed }
    }

    const room1Source = generateRoom1Source(ROOM1_OBJECTS)
    const bg = this.saveButton?.getAt(0) as Phaser.GameObjects.Rectangle | undefined
    const label = this.saveButton?.getAt(1) as Phaser.GameObjects.Text | undefined

    try {
      const room1Response = await fetch('/api/save-room1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: room1Source }),
      })

      if (!room1Response.ok) {
        throw new Error(`Server returned ${room1Response.status} on save-room1: ${room1Response.statusText}`)
      }

      const room1Result = await room1Response.json()
      if (!room1Result.success) {
        throw new Error(room1Result.error ?? 'Unknown save-room1 error')
      }

      if (bg && label) {
        bg.setFillStyle(0x66bb6a, 1)
        label.setText('SAVED CHANGES!')
        this.time.delayedCall(1500, () => {
          bg.setFillStyle(0x2e7d32, 1)
          label.setText('SAVE CHANGES')
        })
      }
      return true
    } catch (err) {
      console.error('Failed to save changes:', err)
      if (bg && label) {
        bg.setFillStyle(0xb71c1c, 1)
        label.setText('SAVE FAILED (CONSOLE)')
        this.time.delayedCall(2000, () => {
          bg.setFillStyle(0x2e7d32, 1)
          label.setText('SAVE CHANGES')
        })
      }
      return false
    }
  }

  public returnToLevelEditor(): void {
    const sceneManager = SceneManager.get(this.game)
    if (sceneManager) {
      sceneManager.openEditor('level-editor')
    } else {
      this.scene.start('level-editor')
    }
  }

  public returnToGame(): void {
    const sceneManager = SceneManager.get(this.game)
    if (sceneManager) {
      sceneManager.exitEditor()
    } else {
      this.scene.start('game')
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.isPromptOpen) return

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
