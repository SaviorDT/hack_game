import Phaser from 'phaser'
import { GAME_MV_CONFIG, DEFAULT_MV_ACCELERATION, type MvConfig } from '../commands/mvConstants.ts'
import {
  GAME_PHYSICS_CONFIG,
  DEFAULT_DRAG,
  DEFAULT_FRICTION,
  DEFAULT_MASS,
  DEFAULT_MAX_VELOCITY,
  DEFAULT_RESTITUTION,
  DEFAULT_MIN_VELOCITY,
  DEFAULT_MIN_COLLIDE_MOVE_VELOCITY,
  MIN_MASS,
  type PhysicsConfig,
} from '../simulation/physicsConstants.ts'
import {
  COMMAND_MODE_TIME_SCALE,
  DEFAULT_COMMAND_MODE_TIME_SCALE,
  setCommandModeTimeScale,
  resetCommandModeTimeScale,
} from '../application/InputModeController.ts'
import { GAME_COMMAND_MODE_CONFIG } from '../commands/commandModeConstants.ts'
import { generateCommandModeConstantsSource } from '../commands/commandModeSerializer.ts'
import { generateMvConstantsSource } from '../commands/mvSerializer.ts'
import { generatePhysicsConstantsSource } from '../simulation/physicsSerializer.ts'
import { WORLD_OBJECT_IDS } from '../content/room1Constants.ts'
import type { GameSession } from '../application/GameSession.ts'
import type { CommandResult } from '../commands/CommandResult.ts'

export type TuningConfig = MvConfig &
  PhysicsConfig & {
    commandTimeScale: number
  }

export function getTuningConfig(config?: Partial<TuningConfig>): TuningConfig {
  return {
    commandTimeScale: config?.commandTimeScale ?? COMMAND_MODE_TIME_SCALE,
    mv_acceleration: config?.mv_acceleration ?? GAME_MV_CONFIG.mv_acceleration,
    drag: config?.drag ?? GAME_PHYSICS_CONFIG.drag,
    mass: config?.mass ?? GAME_PHYSICS_CONFIG.mass,
    max_velocity: config?.max_velocity ?? GAME_PHYSICS_CONFIG.max_velocity,
    restitution: config?.restitution ?? GAME_PHYSICS_CONFIG.restitution,
    friction: config?.friction ?? GAME_PHYSICS_CONFIG.friction,
    min_velocity: config?.min_velocity ?? GAME_PHYSICS_CONFIG.min_velocity,
    min_collide_move_velocity:
      config?.min_collide_move_velocity ?? GAME_PHYSICS_CONFIG.min_collide_move_velocity,
  }
}

export function applyTuningConfig(config: TuningConfig): void {
  GAME_MV_CONFIG.mv_acceleration = config.mv_acceleration
  for (const key of Object.keys(GAME_PHYSICS_CONFIG) as (keyof PhysicsConfig)[]) {
    GAME_PHYSICS_CONFIG[key] = config[key]
  }
  GAME_COMMAND_MODE_CONFIG.commandTimeScale = config.commandTimeScale
  setCommandModeTimeScale(config.commandTimeScale)
}

import {
  FONT_FAMILY,
  TEXT_COLOR,
  DIM_COLOR,
  ACCENT_COLOR,
  VALUE_COLOR,
  PANEL_BG,
} from './editorTheme.ts'

const PANEL_X = 96
const PANEL_Y = 670
const PANEL_WIDTH = 1728
const PANEL_HEIGHT = 370
const OVERLAY_DEPTH = 100

export interface CommandEditorOverlayOptions {
  onCommandResult?: (command: string, result: CommandResult) => void
}

export class CommandEditorOverlay {
  private readonly scene: Phaser.Scene
  private readonly session: GameSession
  private readonly options?: CommandEditorOverlayOptions

  private mvConfig: TuningConfig = getTuningConfig()
  private isEditorOpen = false
  private isPromptOpen = false

  private container: Phaser.GameObjects.Container | undefined
  private roomText: Phaser.GameObjects.Text | undefined
  private mvFields: Map<keyof TuningConfig, Phaser.GameObjects.Text> = new Map()

  private telemetryStatusText: Phaser.GameObjects.Text | undefined
  private telemetrySpeedText: Phaser.GameObjects.Text | undefined
  private telemetryVelocityText: Phaser.GameObjects.Text | undefined
  private telemetryTargetText: Phaser.GameObjects.Text | undefined

  private commandTimeScaleText: Phaser.GameObjects.Text | undefined
  private commandModeRatioText: Phaser.GameObjects.Text | undefined

  private saveButton: Phaser.GameObjects.Container | undefined

  constructor(scene: Phaser.Scene, session: GameSession, options?: CommandEditorOverlayOptions) {
    this.scene = scene
    this.session = session
    this.options = options
  }

  public mount(): void {
    if (this.container) return

    this.mvFields.clear()
    this.mvConfig = getTuningConfig()

    const bg = this.scene.add
      .rectangle(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, PANEL_BG, 0.96)
      .setStrokeStyle(2, 0x4fc3f7, 0.9)
      .setInteractive()

    const items: Phaser.GameObjects.GameObject[] = [bg]

    // Dividers
    const dividers = this.scene.add.graphics()
    dividers.lineStyle(2, 0x334454, 1)
    dividers.lineBetween(920, 16, 920, PANEL_HEIGHT - 16)
    dividers.lineBetween(1380, 16, 1380, PANEL_HEIGHT - 16)
    dividers.lineBetween(930, 186, 1370, 186)
    items.push(dividers)

    // Header: Title & Active Room
    const headerTitle = this.scene.add
      .text(24, 14, 'COMMAND EDITOR — MV & COMMAND MODE TUNING', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0, 0)
    items.push(headerTitle)

    const worldState = this.session.getWorldState()
    this.roomText = this.scene.add
      .text(620, 14, `ROOM: ${worldState.currentRoomId ?? 'room1'}`, {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: '#b7d9d1',
      })
      .setOrigin(0, 0)
    items.push(this.roomText)

    // ─── Column 1: MV Throw & Physics Parameters (2 sub-columns of 4 rows) ───
    // Sub-col A: mv_acceleration, drag, friction, mass
    this.buildMvControlRow(
      20,
      44,
      'mv_acceleration',
      'ACCEL (px/s²)',
      'mv pull toward target',
      [-250, -50, 50, 250],
      items,
    )
    this.buildMvControlRow(
      20,
      114,
      'drag',
      'DRAG (1/s)',
      'Default air velocity loss',
      [-0.5, -0.1, 0.1, 0.5],
      items,
    )
    this.buildMvControlRow(
      20,
      184,
      'friction',
      'FRICTION (1/s)',
      'Ground loss, off while Thrown',
      [-1, -0.5, 0.5, 1],
      items,
    )
    this.buildMvControlRow(
      20,
      254,
      'mass',
      'MASS',
      'Default mass (collisions only)',
      [-1, -0.1, 0.1, 1],
      items,
    )

    // Sub-col B: max_velocity, restitution, min_velocity, min_collide_move_velocity
    this.buildMvControlRow(
      470,
      44,
      'max_velocity',
      'MAX VELOCITY (px/s)',
      'Speed cap on force added',
      [-100, -50, 50, 100],
      items,
    )
    this.buildMvControlRow(
      470,
      114,
      'restitution',
      'RESTITUTION',
      'Bounce (pair = product)',
      [-0.25, -0.05, 0.05, 0.25],
      items,
    )
    this.buildMvControlRow(
      470,
      184,
      'min_velocity',
      'MIN VELOCITY (px/s)',
      'Rest threshold if unpushed',
      [-5, -1, 1, 5],
      items,
    )
    this.buildMvControlRow(
      470,
      254,
      'min_collide_move_velocity',
      'MIN MOVE (px/s)',
      'Threshold to budge at rest',
      [-50, -10, 10, 50],
      items,
    )

    // ─── Column 2 Upper: Live MV Telemetry ───
    const col2Title = this.scene.add
      .text(1150, 14, 'LIVE MV TELEMETRY', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(col2Title)

    this.telemetryStatusText = this.scene.add
      .text(945, 44, 'Active: None (idle)', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: VALUE_COLOR,
      })
      .setOrigin(0, 0)

    this.telemetrySpeedText = this.scene.add
      .text(945, 72, `Accel: ${this.mvConfig.mv_acceleration} px/s²`, {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0)

    this.telemetryVelocityText = this.scene.add
      .text(945, 100, 'Vx: +0.0  Vy: +0.0', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    this.telemetryTargetText = this.scene.add
      .text(945, 128, 'Target: -', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: '#80cbc4',
      })
      .setOrigin(0, 0)

    const telemetryTip = this.scene.add
      .text(945, 156, 'Terminal test: $ mv <source> <target>', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    items.push(
      this.telemetryStatusText,
      this.telemetrySpeedText,
      this.telemetryVelocityText,
      this.telemetryTargetText,
      telemetryTip,
    )

    // ─── Column 2 Lower: Command Mode Slow Down Speed Edit Section ───
    const cmdModeTitle = this.scene.add
      .text(1150, 196, 'COMMAND MODE SLOW DOWN SPEED', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)

    const cmdModeDesc = this.scene.add
      .text(945, 220, 'Time scale during command mode (default 0.25)', {
        fontFamily: FONT_FAMILY,
        fontSize: 9,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    const cmdLabel = this.scene.add
      .text(945, 246, 'SLOW DOWN (×)', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0)

    const cmdSub = this.scene.add
      .text(945, 262, 'Command time scale', {
        fontFamily: FONT_FAMILY,
        fontSize: 8,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    this.commandTimeScaleText = this.scene.add
      .text(1135, 254, this.mvConfig.commandTimeScale.toFixed(2), {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: VALUE_COLOR,
        backgroundColor: '#262626',
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true })

    this.commandTimeScaleText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.promptCommandTimeScale()
    })

    const scaleButtonOffsets = [1195, 1245, 1295, 1345]
    const scaleSteps = [-0.1, -0.05, 0.05, 0.1]
    const scaleButtons: Phaser.GameObjects.Text[] = []

    for (let i = 0; i < scaleSteps.length; i++) {
      const step = scaleSteps[i]
      const stepLabel = step > 0 ? `+${step}` : `${step}`
      const btnX = scaleButtonOffsets[i]
      const isPositive = step > 0

      const btn = this.scene.add
        .text(btnX, 254, stepLabel, {
          fontFamily: FONT_FAMILY,
          fontSize: 8,
          color: isPositive ? '#a5d6a7' : '#ef9a9a',
          backgroundColor: '#333333',
          padding: { x: 3, y: 3 },
        })
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true })

      btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.()
        const multiplier = pointer.event?.shiftKey ? 5 : 1
        this.adjustCommandTimeScale(step * multiplier)
      })

      scaleButtons.push(btn)
    }

    this.commandModeRatioText = this.scene.add
      .text(
        945,
        286,
        `Moving: ×1.00  ·  Command: ×${this.mvConfig.commandTimeScale.toFixed(2)} (${Math.round(this.mvConfig.commandTimeScale * 100)}% speed)`,
        {
          fontFamily: FONT_FAMILY,
          fontSize: 9,
          color: '#8fd6c5',
        },
      )
      .setOrigin(0, 0)

    const cmdTip = this.scene.add
      .text(
        945,
        314,
        'Enter / a-z switches to command mode with this time scale.\nEscape returns to full speed (×1.00).',
        {
          fontFamily: FONT_FAMILY,
          fontSize: 8,
          color: DIM_COLOR,
          lineSpacing: 4,
        },
      )
      .setOrigin(0, 0)

    items.push(
      cmdModeTitle,
      cmdModeDesc,
      cmdLabel,
      cmdSub,
      this.commandTimeScaleText,
      ...scaleButtons,
      this.commandModeRatioText,
      cmdTip,
    )

    // ─── Column 3: Actions ───
    const col3Title = this.scene.add
      .text(1554, 14, 'ACTIONS', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(col3Title)

    this.saveButton = this.createButton(
      1554,
      68,
      'SAVE CHANGES',
      '#2e7d32',
      '#ffffff',
      () => this.saveChanges(),
      270,
      44,
      0x66bb6a,
    )
    items.push(this.saveButton)

    const resetDefaultsBtn = this.createButton(
      1554,
      136,
      'RESET DEFAULTS',
      '#37474f',
      '#eceff1',
      () => this.resetDefaults(),
      270,
      38,
    )
    items.push(resetDefaultsBtn)

    const closeBtn = this.createButton(
      1554,
      200,
      'CLOSE (F1 / ESC)',
      '#263238',
      '#cfd8dc',
      () => this.close(),
      270,
      38,
    )
    items.push(closeBtn)

    const hotkeyHint = this.scene.add
      .text(1554, 275, 'F1: Toggle Editor\nESC: Close Overlay', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: DIM_COLOR,
        align: 'center',
      })
      .setOrigin(0.5, 0)
    items.push(hotkeyHint)

    this.container = this.scene.add
      .container(PANEL_X, PANEL_Y, items)
      .setDepth(OVERLAY_DEPTH)
      .setVisible(this.isEditorOpen)

    this.refreshFields()
  }

  public open(): void {
    if (!this.container) {
      this.mount()
    }
    this.isEditorOpen = true
    this.container?.setVisible(true)
    this.refreshFields()
    if (this.container) {
      this.scene.children.bringToTop(this.container)
    }
  }

  public close(): void {
    this.isEditorOpen = false
    this.container?.setVisible(false)
  }

  public toggle(): void {
    if (this.isEditorOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  public isModalPromptOpen(): boolean {
    return this.isPromptOpen
  }

  public isOpen(): boolean {
    return this.isEditorOpen
  }

  public update(_delta: number): void {
    if (!this.isEditorOpen) return

    const worldState = this.session.getWorldState()
    if (this.roomText && worldState.currentRoomId) {
      this.roomText.setText(`ROOM: ${worldState.currentRoomId}`)
    }

    const thrownObj = worldState.worldObjects.find(
      (o) =>
        o.roomId === worldState.currentRoomId &&
        (o.state as Record<string, unknown>).thrown != null,
    )

    if (thrownObj) {
      const tState = thrownObj.state as Record<string, unknown>
      const tvx = typeof tState.vx === 'number' ? tState.vx : 0
      const tvy = typeof tState.vy === 'number' ? tState.vy : 0
      const curSpeed = Math.hypot(tvx, tvy)
      const thrownData = tState.thrown as
        | { targetObjectId?: string; targetX?: number; targetY?: number }
        | undefined
      const targetStr =
        thrownData?.targetObjectId ??
        (thrownData?.targetX !== undefined
          ? `(${Math.round(thrownData.targetX)}, ${Math.round(thrownData.targetY ?? 0)})`
          : '-')

      this.telemetryStatusText?.setText(`Active: ${thrownObj.id}`)
      this.telemetrySpeedText?.setText(`Speed: ${curSpeed.toFixed(1)} px/s`)
      this.telemetryVelocityText?.setText(
        `Vx: ${tvx >= 0 ? '+' : ''}${tvx.toFixed(1)}  Vy: ${tvy >= 0 ? '+' : ''}${tvy.toFixed(1)}`,
      )
      this.telemetryTargetText?.setText(`Target: ${targetStr}`)
    } else {
      this.telemetryStatusText?.setText('Active: None (idle)')
      this.telemetrySpeedText?.setText(`Accel: ${this.mvConfig.mv_acceleration} px/s²`)
      this.telemetryVelocityText?.setText('Vx: +0.0  Vy: +0.0')
      this.telemetryTargetText?.setText('Target: -')
    }
  }

  public getMvConfig(): Readonly<TuningConfig> {
    return this.mvConfig
  }

  public setMvConfig(next: Partial<TuningConfig>): void {
    Object.assign(this.mvConfig, next)
    this.mvConfig.mass = Math.max(MIN_MASS, this.mvConfig.mass)
    if (next.commandTimeScale !== undefined) {
      this.mvConfig.commandTimeScale = Math.max(0.01, Math.min(2.0, Math.round(next.commandTimeScale * 1000) / 1000))
    }
    applyTuningConfig(this.mvConfig)
    this.session.setCommandTimeScale?.(this.mvConfig.commandTimeScale)
    this.refreshFields()
  }

  public adjustMv(delta: number, property: keyof TuningConfig): void {
    if (property === 'commandTimeScale') {
      this.adjustCommandTimeScale(delta)
      return
    }
    const current = this.mvConfig[property]
    const next = Math.round((current + delta) * 1000) / 1000
    if (next !== current) {
      this.setMvConfig({ [property]: next })
    }
  }

  public promptMv(property: keyof TuningConfig): void {
    if (property === 'commandTimeScale') {
      this.promptCommandTimeScale()
      return
    }
    this.isPromptOpen = true
    this.session.releaseAllKeys()
    const current = this.mvConfig[property]
    const promptFn = typeof window !== 'undefined' && typeof window.prompt === 'function' ? window.prompt : undefined
    const input = promptFn ? promptFn(`Enter new ${String(property)}:`, current.toString()) : null
    this.session.releaseAllKeys()
    this.isPromptOpen = false

    if (input === null) return
    const parsed = parseFloat(input.trim())
    if (Number.isFinite(parsed) && parsed !== current) {
      this.setMvConfig({ [property]: parsed })
    }
  }

  public adjustCommandTimeScale(delta: number): void {
    const next = Math.max(0.01, Math.min(2.0, Math.round((this.mvConfig.commandTimeScale + delta) * 1000) / 1000))
    if (next !== this.mvConfig.commandTimeScale) {
      this.setCommandTimeScale(next)
    }
  }

  public promptCommandTimeScale(): void {
    this.isPromptOpen = true
    this.session.releaseAllKeys()
    const current = this.mvConfig.commandTimeScale
    const promptFn = typeof window !== 'undefined' && typeof window.prompt === 'function' ? window.prompt : undefined
    const input = promptFn ? promptFn('Enter new command mode time scale (e.g. 0.25):', current.toString()) : null
    this.session.releaseAllKeys()
    this.isPromptOpen = false

    if (input === null) return
    const parsed = parseFloat(input.trim())
    if (Number.isFinite(parsed) && parsed !== current) {
      this.setCommandTimeScale(parsed)
    }
  }

  public setCommandTimeScale(scale: number): void {
    const clamped = Math.max(0.01, Math.min(2.0, Math.round(scale * 1000) / 1000))
    this.mvConfig.commandTimeScale = clamped
    applyTuningConfig(this.mvConfig)
    this.session.setCommandTimeScale?.(clamped)
    this.refreshFields()
  }

  public testMvThrow(): void {
    const worldState = this.session.getWorldState()
    const currentRoomId = worldState.currentRoomId
    const roomObjects = worldState.worldObjects.filter((o) => o.roomId === currentRoomId)

    let throwObj = roomObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)
    if (!throwObj) {
      throwObj = roomObjects.find((o) => o.metadata.role === 'weapon')
    }
    if (!throwObj) {
      throwObj = roomObjects.find(
        (o) =>
          o.id === WORLD_OBJECT_IDS.boulder ||
          o.id.startsWith('crate') ||
          o.metadata.role === 'object',
      )
    }
    if (!throwObj) return

    const player = roomObjects.find((o) => o.metadata.role === 'player')
    const enemy = roomObjects.find((o) => o.metadata.role === 'enemy')
    const oState = throwObj.state as Record<string, unknown>
    const objX = typeof oState.x === 'number' ? oState.x : 0

    let target = 'guard'
    if (enemy && objX < 900) {
      target = enemy.id
    } else if (player) {
      target = player.id
    }

    const command = `mv ${throwObj.id} ${target}`
    const result = this.session.submitCommand(command)
    this.options?.onCommandResult?.(command, result)
  }

  public resetDefaults(): void {
    resetCommandModeTimeScale()
    this.setMvConfig({
      mv_acceleration: DEFAULT_MV_ACCELERATION,
      drag: DEFAULT_DRAG,
      friction: DEFAULT_FRICTION,
      mass: DEFAULT_MASS,
      max_velocity: DEFAULT_MAX_VELOCITY,
      restitution: DEFAULT_RESTITUTION,
      min_velocity: DEFAULT_MIN_VELOCITY,
      min_collide_move_velocity: DEFAULT_MIN_COLLIDE_MOVE_VELOCITY,
      commandTimeScale: DEFAULT_COMMAND_MODE_TIME_SCALE,
    })
  }

  public async saveChanges(): Promise<boolean> {
    applyTuningConfig(this.mvConfig)

    const mvSource = generateMvConstantsSource(this.mvConfig)
    const physicsSource = generatePhysicsConstantsSource(this.mvConfig)
    const commandModeSource = generateCommandModeConstantsSource({
      commandTimeScale: this.mvConfig.commandTimeScale,
    })

    const bg = this.saveButton?.getAt(0) as Phaser.GameObjects.Rectangle | undefined
    const label = this.saveButton?.getAt(1) as Phaser.GameObjects.Text | undefined

    try {
      const [mvResponse, physicsResponse, commandModeResponse] = await Promise.all([
        fetch('/api/save-mv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: mvSource }),
        }),
        fetch('/api/save-physics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: physicsSource }),
        }),
        fetch('/api/save-command-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: commandModeSource }),
        }),
      ])

      if (!mvResponse.ok) {
        throw new Error(`Server returned ${mvResponse.status} on save-mv: ${mvResponse.statusText}`)
      }
      if (!physicsResponse.ok) {
        throw new Error(
          `Server returned ${physicsResponse.status} on save-physics: ${physicsResponse.statusText}`,
        )
      }
      if (!commandModeResponse.ok) {
        throw new Error(
          `Server returned ${commandModeResponse.status} on save-command-mode: ${commandModeResponse.statusText}`,
        )
      }

      const mvResult = await mvResponse.json()
      const physicsResult = await physicsResponse.json()
      const commandModeResult = await commandModeResponse.json()

      if (!mvResult.success) {
        throw new Error(mvResult.error ?? 'Unknown save-mv error')
      }
      if (!physicsResult.success) {
        throw new Error(physicsResult.error ?? 'Unknown save-physics error')
      }
      if (!commandModeResult.success) {
        throw new Error(commandModeResult.error ?? 'Unknown save-command-mode error')
      }

      bg?.setFillStyle(0x1b5e20, 1)
      label?.setText('SAVED!')
      this.scene.time.delayedCall(1500, () => {
        bg?.setFillStyle(0x2e7d32, 1)
        label?.setText('SAVE CHANGES')
      })

      return true
    } catch (err: unknown) {
      bg?.setFillStyle(0xb71c1c, 1)
      label?.setText('SAVE FAILED')
      this.scene.time.delayedCall(2500, () => {
        bg?.setFillStyle(0x2e7d32, 1)
        label?.setText('SAVE CHANGES')
      })
      return false
    }
  }

  public destroy(): void {
    this.container?.destroy(true)
    this.container = undefined
    this.mvFields.clear()
    this.roomText = undefined
    this.telemetryStatusText = undefined
    this.telemetrySpeedText = undefined
    this.telemetryVelocityText = undefined
    this.telemetryTargetText = undefined
    this.commandTimeScaleText = undefined
    this.commandModeRatioText = undefined
    this.saveButton = undefined
  }

  private buildMvControlRow(
    startX: number,
    y: number,
    property: keyof TuningConfig,
    title: string,
    subtitle: string,
    steps: number[],
    containerItems: Phaser.GameObjects.GameObject[],
  ): void {
    const label = this.scene.add
      .text(startX, y, title, {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0)

    const desc = this.scene.add
      .text(startX, y + 16, subtitle, {
        fontFamily: FONT_FAMILY,
        fontSize: 8,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    const valText = this.scene.add
      .text(startX + 185, y + 8, '--', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: VALUE_COLOR,
        backgroundColor: '#262626',
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true })

    valText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.promptMv(property)
    })

    this.mvFields.set(property, valText)
    containerItems.push(label, desc, valText)

    const buttonOffsets = [245, 295, 345, 395]
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const stepLabel = step > 0 ? `+${step}` : `${step}`
      const btnX = startX + buttonOffsets[i]
      const isPositive = step > 0

      const btn = this.scene.add
        .text(btnX, y + 8, stepLabel, {
          fontFamily: FONT_FAMILY,
          fontSize: 9,
          color: isPositive ? '#a5d6a7' : '#ef9a9a',
          backgroundColor: '#333333',
          padding: { x: 4, y: 3 },
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
    strokeColor = 0x555555,
  ): Phaser.GameObjects.Container {
    const colorInt = Phaser.Display?.Color?.HexStringToColor
      ? Phaser.Display.Color.HexStringToColor(bgColor).color
      : 0x333333
    const bg = this.scene.add
      .rectangle(0, 0, width, height, colorInt, 1)
      .setStrokeStyle(2, strokeColor, 1)

    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: textColor,
      })
      .setOrigin(0.5, 0.5)

    const container = this.scene.add.container(x, y, [bg, label])
    container.setSize(width, height)
    container.setInteractive({ useHandCursor: true })
    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      onClick()
    })

    return container
  }

  private refreshFields(): void {
    for (const [key, field] of this.mvFields.entries()) {
      field.setText(String(this.mvConfig[key]))
    }
    this.commandTimeScaleText?.setText(this.mvConfig.commandTimeScale.toFixed(2))
    this.commandModeRatioText?.setText(
      `Moving: ×1.00  ·  Command: ×${this.mvConfig.commandTimeScale.toFixed(2)} (${Math.round(this.mvConfig.commandTimeScale * 100)}% speed)`,
    )
  }
}
