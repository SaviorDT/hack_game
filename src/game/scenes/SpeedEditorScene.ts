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
import { generateMvConstantsSource } from '../commands/mvSerializer.ts'
import { GameSession } from '../application/GameSession.ts'
import {
  PhaserRoomView,
  WORLD_OBJECT_TEXTURE_URLS,
} from '../presentation/PhaserRoomView.ts'
import { COMMAND_INPUT_TEXTURE_KEY } from '../presentation/PhaserCommandInputView.ts'
import type { WorldState } from '../domain/WorldState.ts'
import {
  DEFAULT_SPEED_CONFIG,
  GAME_MV_CONFIG,
  type MvConfig,
  getPlayerSpeedFromObjects,
  getMvConfig,
  createSpeedEditorSession,
} from './speedEditorSession.ts'
import {
  DEFAULT_MV_DRAG,
  DEFAULT_MV_FORCE,
  DEFAULT_MV_MASS,
  DEFAULT_MV_MAX_VELOCITY,
  MIN_MV_MASS,
} from '../commands/mvConstants.ts'
import { SceneManager } from './SceneManager.ts'

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
  private mvConfig: MvConfig = getMvConfig()

  private panelContainer: Phaser.GameObjects.Container | undefined
  private headerText: Phaser.GameObjects.Text | undefined
  private instructionText: Phaser.GameObjects.Text | undefined
  private saveButton: Phaser.GameObjects.Container | undefined
  private testMvButton: Phaser.GameObjects.Container | undefined

  private speedFields: Map<keyof PlayerSpeedConfig, Phaser.GameObjects.Text> = new Map()
  private mvFields: Map<keyof MvConfig, Phaser.GameObjects.Text> = new Map()
  private telemetrySpeedText: Phaser.GameObjects.Text | undefined
  private telemetryVelocityText: Phaser.GameObjects.Text | undefined
  private telemetryInputText: Phaser.GameObjects.Text | undefined
  private telemetryThrownText: Phaser.GameObjects.Text | undefined
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
    this.mvFields.clear()
    this.isPromptOpen = false

    // Initialize player speed and mv speed
    this.playerSpeed = getPlayerSpeedFromObjects(ROOM1_OBJECTS)
    this.mvConfig = getMvConfig(GAME_MV_CONFIG)

    // Create session reusing main game movement code and dynamic mv speed
    const bundle = createSpeedEditorSession({
      playerSpeed: this.playerSpeed,
      mvConfig: () => this.mvConfig,
    })
    this.session = bundle.session
    this.worldState = bundle.worldState

    // Mount room visual view (room layout, door, divider, characters)
    this.roomView.mount(this, this.worldState)

    // Header Title
    this.headerText = this.add
      .text(ROOM_LAYOUT.left, 24, 'SPEED EDITOR — Player Movement & MV Speed Tuning', {
        fontFamily: FONT_FAMILY,
        fontSize: 18,
        color: ACCENT_COLOR,
      })
      .setOrigin(0, 0)
      .setDepth(50)

    // Top Right Navigation Hints
    this.add
      .text(ROOM_LAYOUT.right, 26, 'F2: Level · F4: AI Editor · F3 / ESC: Game', {
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
        'Arrows: Move · R: Reset · Click +/-: Adjust · Click value: Exact input · TEST MV: Throw dagger',
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
      this.testMvButton?.destroy(true)
      this.roomView.destroy()
      this.speedFields.clear()
      this.mvFields.clear()
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

    // Vertical dividers dividing into:
    // Sub-col 1: Player Speed (0..530)
    // Sub-col 2: MV Throw Speed (530..1060)
    // Col 2: Telemetry (1060..1420)
    // Col 3: Actions (1420..1728)
    const dividers = this.add.graphics()
    dividers.lineStyle(2, 0x333333, 1)
    dividers.lineBetween(530, 16, 530, PANEL_HEIGHT - 16)
    dividers.lineBetween(1060, 16, 1060, PANEL_HEIGHT - 16)
    dividers.lineBetween(1420, 16, 1420, PANEL_HEIGHT - 16)
    dividers.lineBetween(1075, 160, 1405, 160)
    items.push(dividers)

    // ─── Sub-column 1: Player Speed Parameters ───
    const col1Title = this.add
      .text(265, 14, 'PLAYER SPEED PARAMETERS', {
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

    // ─── Sub-column 2: MV Throw Parameters (global defaults) ───
    const mvTitle = this.add
      .text(795, 14, 'MV THROW DEFAULTS', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(mvTitle)

    this.buildMvControlRow('mv_force', 'FORCE (px/s²)', 'Pull toward target (global)', 40, [-250, -50, 50, 250], items)
    this.buildMvControlRow('drag', 'DRAG (1/s)', 'Default velocity loss per second', 92, [-0.5, -0.1, 0.1, 0.5], items)
    this.buildMvControlRow('mass', 'MASS', 'Default mass (force ÷ mass)', 144, [-1, -0.1, 0.1, 1], items)
    this.buildMvControlRow('max_velocity', 'MAX VELOCITY (px/s)', 'Default speed cap', 196, [-100, -50, 50, 100], items)

    const testMvBtn = this.createButton(
      795,
      255,
      'TEST MV (THROW DAGGER)',
      '#004d40',
      '#80cbc4',
      () => this.testMvThrow(),
      330,
      34,
    )
    this.testMvButton = testMvBtn
    items.push(testMvBtn)

    // ─── Column 2: Live Telemetry & Speedometer ───
    const col2Title = this.add
      .text(1240, 14, 'LIVE TELEMETRY', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(col2Title)

    this.telemetrySpeedText = this.add
      .text(1080, 44, 'Player: 0.0 / 300 px/s', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: VALUE_COLOR,
      })
      .setOrigin(0, 0)

    this.telemetryVelocityText = this.add
      .text(1080, 70, 'Vx: +0.0  Vy: +0.0', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0)

    this.telemetryInputText = this.add
      .text(1080, 94, 'Input: (0.0, 0.0)', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    // Visual speedometer gauge bar
    const gaugeBg = this.add
      .rectangle(1080 + 155, 134, 310, 18, 0x111111, 1)
      .setStrokeStyle(2, 0x444444, 1)
    this.speedGaugeGraphics = this.add.graphics()

    this.telemetryThrownText = this.add
      .text(1080, 174, 'MV Thrown: Idle\n(click TEST MV)', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: '#80cbc4',
      })
      .setOrigin(0, 0)

    items.push(
      this.telemetrySpeedText,
      this.telemetryVelocityText,
      this.telemetryInputText,
      gaugeBg,
      this.speedGaugeGraphics,
      this.telemetryThrownText,
    )

    // ─── Column 3: Actions ───
    const col3Title = this.add
      .text(1574, 14, 'ACTIONS', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(col3Title)

    // Save button
    const saveBtn = this.createSaveButton(1574, 68)
    items.push(saveBtn)

    // Reset defaults button
    const resetDefaultBtn = this.createButton(
      1574,
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
      1574,
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
      .text(16, y, title, {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0)

    const desc = this.add
      .text(16, y + 17, subtitle, {
        fontFamily: FONT_FAMILY,
        fontSize: 9,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    const valText = this.add
      .text(205, y + 8, '--', {
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

    const buttonPositions = [262, 320, 378, 436]
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

  private buildMvControlRow(
    property: keyof MvConfig,
    title: string,
    subtitle: string,
    y: number,
    steps: number[],
    containerItems: Phaser.GameObjects.GameObject[],
  ): void {
    const label = this.add
      .text(548, y, title, {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0)

    const desc = this.add
      .text(548, y + 17, subtitle, {
        fontFamily: FONT_FAMILY,
        fontSize: 9,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    const valText = this.add
      .text(745, y + 8, '--', {
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
      this.promptMv(property)
    })

    this.mvFields.set(property, valText)
    containerItems.push(label, desc, valText)

    const buttonPositions = [805, 865, 925, 985]
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
        this.adjustMv(step * multiplier, property)
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
    for (const [key, field] of this.mvFields.entries()) {
      field.setText(String(this.mvConfig[key]))
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
      const barWidth = Math.round(ratio * 306)
      if (barWidth > 0) {
        // Dynamic color interpolation between cyan and green when capped
        const color = ratio > 0.95 ? 0x00e676 : 0x4fc3f7
        this.speedGaugeGraphics.fillStyle(color, 1)
        this.speedGaugeGraphics.fillRect(1080 + 2, 126, barWidth, 16)
      }
    }

    // Telemetry for thrown objects (mv)
    const thrownObj = this.worldState.worldObjects.find(
      (o) => (o.state as Record<string, unknown>).thrown != null,
    )
    if (thrownObj) {
      const tState = thrownObj.state as Record<string, unknown>
      const tvx = typeof tState.vx === 'number' ? tState.vx : 0
      const tvy = typeof tState.vy === 'number' ? tState.vy : 0
      const curSpeed = Math.hypot(tvx, tvy)
      this.telemetryThrownText?.setText(
        `MV: ${thrownObj.id}\n${curSpeed.toFixed(1)} px/s`,
      )
    } else {
      this.telemetryThrownText?.setText(`MV force: ${this.mvConfig.mv_force} px/s²\n(click TEST MV)`)
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

  public setMvConfig(next: Partial<MvConfig>): void {
    Object.assign(this.mvConfig, next)
    this.mvConfig.mass = Math.max(MIN_MV_MASS, this.mvConfig.mass)
    Object.assign(GAME_MV_CONFIG, this.mvConfig)
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

  public adjustMv(delta: number, property: keyof MvConfig): void {
    const current = this.mvConfig[property]
    const next = Math.round((current + delta) * 1000) / 1000
    if (next !== current) {
      this.setMvConfig({ [property]: next })
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

  public promptMv(property: keyof MvConfig): void {
    this.isPromptOpen = true
    this.session.releaseAllKeys()
    const current = this.mvConfig[property]
    const input = window.prompt(`Enter new ${String(property)}:`, current.toString())
    this.session.releaseAllKeys()
    this.isPromptOpen = false

    if (input === null) return
    const parsed = parseFloat(input.trim())
    if (Number.isFinite(parsed) && parsed !== current) {
      this.setMvConfig({ [property]: parsed })
    }
  }

  public testMvThrow(): void {
    const dagger = this.worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)
    if (!dagger) return

    const dState = dagger.state as Record<string, unknown>
    const target = typeof dState.x === 'number' && dState.x > 900 ? 'hacker' : 'guard'
    this.session.submitCommand(`mv dagger ${target}`)
  }

  public resetDefaults(): void {
    this.setPlayerSpeed(DEFAULT_SPEED_CONFIG)
    this.setMvConfig({
      mv_force: DEFAULT_MV_FORCE,
      drag: DEFAULT_MV_DRAG,
      mass: DEFAULT_MV_MASS,
      max_velocity: DEFAULT_MV_MAX_VELOCITY,
    })
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
    }

    this.session.releaseAllKeys()
  }

  public async saveSpeed(): Promise<boolean> {
    const player = ROOM1_OBJECTS.find((o) => o.role === 'player' || o.id === WORLD_OBJECT_IDS.player)
    if (player) {
      player.speed = { ...this.playerSpeed }
    }
    Object.assign(GAME_MV_CONFIG, this.mvConfig)

    const room1Source = generateRoom1Source(ROOM1_OBJECTS)
    const mvSource = generateMvConstantsSource(this.mvConfig)
    const bg = this.saveButton?.getAt(0) as Phaser.GameObjects.Rectangle | undefined
    const label = this.saveButton?.getAt(1) as Phaser.GameObjects.Text | undefined

    try {
      const [room1Response, mvResponse] = await Promise.all([
        fetch('/api/save-room1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: room1Source }),
        }),
        fetch('/api/save-mv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: mvSource }),
        }),
      ])

      if (!room1Response.ok) {
        throw new Error(`Server returned ${room1Response.status} on save-room1: ${room1Response.statusText}`)
      }
      if (!mvResponse.ok) {
        throw new Error(`Server returned ${mvResponse.status} on save-mv: ${mvResponse.statusText}`)
      }

      const room1Result = await room1Response.json()
      if (!room1Result.success) {
        throw new Error(room1Result.error ?? 'Unknown save-room1 error')
      }

      const mvResult = await mvResponse.json()
      if (!mvResult.success) {
        throw new Error(mvResult.error ?? 'Unknown save-mv error')
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
