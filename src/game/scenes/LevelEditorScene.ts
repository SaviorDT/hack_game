import Phaser from 'phaser'
import {
  ROOM_LAYOUT,
  WORLD_OBJECT_IDS,
  ROOM_NAMES,
  ROOM_IDS,
  CHARACTER_BASE_SIZE,
  BOULDER_BASE_SIZE,
  DAGGER_SIZE,
  GAME_WEAPON_CONFIG,
  computeDaggerAttackTranslation,
} from '../content/room1Constants.ts'
import { createRoomObjects, computeCollisionSize } from '../content/room1WorldState.ts'
import type {
  PhysicsAttrConfig,
  PlayerSpeedConfig,
  RoomObjectConfig,
  WorldObjectRole,
} from '../content/room1.ts'
import {
  EDITOR_ROOM_IDS,
  getRoomDefinition,
  getRoomObjectConfigs,
  setRoomObjectConfigs,
  getNextRoomId,
  getPreviousRoomId,
} from '../content/roomRegistry.ts'
import { TUTORIAL_ROOM_IDS } from '../content/tutorialRooms.ts'
import type { ColliderShape } from '../domain/CollisionWorld.ts'
import { PHYSICS_ATTR_KEYS, readPhysicsAttrOverride } from '../domain/PhysicsAttr.ts'
import { GAME_PHYSICS_CONFIG, MIN_MASS } from '../simulation/physicsConstants.ts'
import { generateRoom1Source } from '../content/room1Serializer.ts'
import {
  WORLD_OBJECT_TEXTURE_URLS,
  PLAYER_TEXTURE_KEY,
  GUARD_TEXTURE_KEY,
  DAGGER_TEXTURE_KEY,
  BOULDER_TEXTURE_KEY,
} from '../presentation/PhaserRoomView.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import {
  EditorHistory,
  computeEditorCollisionBox,
  computeEditorColliderSize,
  wouldOverlapAnyEditorObject,
  generateNextObjectId,
  type ScalableMovableObject,
  type CharacterProperty,
  type PhysicsAttrKey,
  setPhysicsAttrValue,
} from './levelEditorHistory.ts'
import { SceneManager } from './SceneManager.ts'
import {
  FONT_FAMILY,
  TEXT_COLOR,
  DIM_COLOR,
  ACCENT_COLOR,
  PANEL_BG,
} from './editorTheme.ts'

const SELECTED_OUTLINE = 0x4fc3f7
const HANDLE_COLOR = 0xffcc00
const HANDLE_SIZE = 16
const GRID_SNAP = 1
const PANEL_X = 96
const PANEL_Y = 720
const PANEL_WIDTH = 1728
const PANEL_HEIGHT = 290

const KIND_TEXTURES: Readonly<Record<string, string>> = {
  archer: 'archer',
  arrow: 'arrow',
  crate: 'crate',
  plate: 'plate',
}

export interface SpawnObjectConfig extends PhysicsAttrConfig {
  id?: string
  name?: string
  kind?: 'crate' | 'plate' | 'archer'
  passive?: boolean
  x?: number
  y?: number
  displayWidth?: number
  displayHeight?: number
  scaleX?: number
  scaleY?: number
  speed?: number | PlayerSpeedConfig
  maxHealth?: number
  attackDistance?: number
  attackDurationMs?: number
  holdOffsetX?: number
  holdOffsetY?: number
  colliderWidth?: number
  colliderHeight?: number
  colliderShape?: ColliderShape
}

/** The green collider outline: a rectangle for boxes, an ellipse (drawn as a circle) for circles. */
type ColliderOutline = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse

export interface EditorObject extends ScalableMovableObject {
  role: WorldObjectRole
  name?: string
  kind?: 'crate' | 'plate' | 'archer'
  passive?: boolean
  sprite: Phaser.GameObjects.Image
  outline: Phaser.GameObjects.Rectangle
  collisionBox?: ColliderOutline
  colliderHandle?: Phaser.GameObjects.Rectangle
  scaleHandle: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
  colliderWidth?: number
  colliderHeight?: number
}

export class LevelEditorScene extends Phaser.Scene {
  private editorObjects: EditorObject[] = []
  private selectedId: string | null = null
  private roomFrame!: Phaser.GameObjects.Graphics
  private roomDivider!: Phaser.GameObjects.Graphics
  private doorFrame!: Phaser.GameObjects.Graphics
  private doorLabel: Phaser.GameObjects.Text | undefined
  private panelContainer: Phaser.GameObjects.Container | undefined
  private panelFields: Map<string, Phaser.GameObjects.Text> = new Map()
  private objectListButtons: Phaser.GameObjects.Text[] = []
  private objectListTitle: Phaser.GameObjects.Text | undefined
  private deleteButton: Phaser.GameObjects.Text | undefined
  private statsElements: Phaser.GameObjects.Text[] = []
  private guardStatsElements: Phaser.GameObjects.Text[] = []
  private playerStatsElements: Phaser.GameObjects.Text[] = []
  private weaponStatsElements: Phaser.GameObjects.Text[] = []
  private testEquipBtn: Phaser.GameObjects.Text | undefined
  private testAttackBtn: Phaser.GameObjects.Text | undefined
  private testEquippedWeaponId: string | null = null
  private savedWeaponPositions: Map<string, { x: number; y: number }> = new Map()
  private testAttackAnimation: {
    weaponId: string
    elapsedMs: number
    durationMs: number
    attackDistance: number
  } | null = null
  private section3Title: Phaser.GameObjects.Text | undefined
  private naStatsText: Phaser.GameObjects.Text | undefined
  private mvAttrElements: Phaser.GameObjects.Text[] = []
  private mvAttrValues: Map<PhysicsAttrKey, Phaser.GameObjects.Text> = new Map()
  private headerText: Phaser.GameObjects.Text | undefined
  private isDraggingObject = false
  private isDraggingScaleHandle = false
  private isDraggingColliderHandle = false
  private history = new EditorHistory()
  private dragStartX = 0
  private dragStartY = 0
  private dragObjStartX = 0
  private dragObjStartY = 0
  private scaleStartWidth = 0
  private scaleStartHeight = 0
  private scaleStartScaleX = 0
  private scaleStartScaleY = 0
  private scaleStartPointerX = 0
  private scaleStartPointerY = 0
  private colliderStartWidth = 0
  private colliderStartHeight = 0
  private colliderStartPointerX = 0
  private colliderStartPointerY = 0
  private exportButton!: Phaser.GameObjects.Container
  private playButton!: Phaser.GameObjects.Container
  private instructionText: Phaser.GameObjects.Text | undefined
  private currentRoomId: string = ROOM_IDS.first
  private wallGraphics!: Phaser.GameObjects.Graphics
  private roomSelectorButtons: Map<string, Phaser.GameObjects.Text> = new Map()
  private prevRoomBtn: Phaser.GameObjects.Text | undefined
  private nextRoomBtn: Phaser.GameObjects.Text | undefined
  private roomGoalText: Phaser.GameObjects.Text | undefined
  private section5Desc: Phaser.GameObjects.Text | undefined

  constructor() {
    super({ key: 'level-editor' })
  }

  init(data?: { roomId?: string }): void {
    if (data?.roomId && (EDITOR_ROOM_IDS as readonly string[]).includes(data.roomId)) {
      this.currentRoomId = data.roomId
    }
  }

  preload(): void {
    for (const [textureKey, imageUrl] of Object.entries(WORLD_OBJECT_TEXTURE_URLS)) {
      if (!this.textures.exists(textureKey)) {
        this.load.image(textureKey, imageUrl)
      }
    }
  }

  create(): void {
    this.editorObjects = []
    this.selectedId = null
    this.panelFields.clear()
    this.statsElements = []
    this.guardStatsElements = []
    this.playerStatsElements = []
    this.weaponStatsElements = []
    this.testEquipBtn = undefined
    this.testAttackBtn = undefined
    this.testEquippedWeaponId = null
    this.savedWeaponPositions.clear()
    this.testAttackAnimation = null
    this.section3Title = undefined
    this.naStatsText = undefined
    this.mvAttrElements = []
    this.mvAttrValues.clear()
    this.objectListButtons = []
    this.objectListTitle = undefined
    this.deleteButton = undefined
    this.history.clear()

    this.roomSelectorButtons.clear()

    // Title Row (y = 16)
    this.headerText = this.add
      .text(ROOM_LAYOUT.left, 16, 'LEVEL EDITOR — ' + this.currentRoomId, {
        fontFamily: FONT_FAMILY,
        fontSize: 18,
        color: ACCENT_COLOR,
      })
      .setOrigin(0, 0)
      .setDepth(50)

    this.roomGoalText = this.add
      .text(ROOM_LAYOUT.left + 460, 19, '', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)
      .setDepth(50)

    // Back-to-game key hint
    const backHint = this.add
      .text(ROOM_LAYOUT.right, 16, 'PgUp/PgDn: Rooms · P: Panel · F1: Command · F3: Speed · F4: AI · F2/ESC: Game', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
      .setOrigin(1, 0)
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
    backHint.on('pointerdown', () => {
      this.returnToGame()
    })

    // Room Selection Row (y = 44)
    this.add
      .text(ROOM_LAYOUT.left, 47, 'ROOM:', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: ACCENT_COLOR,
      })
      .setOrigin(0, 0)
      .setDepth(50)

    this.prevRoomBtn = this.add
      .text(ROOM_LAYOUT.left + 65, 44, '◄', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: '#ffffff',
        backgroundColor: '#37474f',
        padding: { x: 7, y: 3 },
      })
      .setOrigin(0, 0)
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
    this.prevRoomBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.selectPreviousRoom()
    })

    let currX = ROOM_LAYOUT.left + 95
    for (const roomId of EDITOR_ROOM_IDS) {
      const isSelected = roomId === this.currentRoomId
      const btn = this.add
        .text(currX, 44, roomId, {
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          color: isSelected ? '#ffffff' : '#90a4ae',
          backgroundColor: isSelected ? '#0288d1' : '#263238',
          padding: { x: 7, y: 4 },
        })
        .setOrigin(0, 0)
        .setDepth(50)
        .setInteractive({ useHandCursor: true })
      btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.()
        this.selectRoom(roomId)
      })
      this.roomSelectorButtons.set(roomId, btn)
      currX += btn.width + 6
    }

    this.nextRoomBtn = this.add
      .text(currX, 44, '►', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: '#ffffff',
        backgroundColor: '#37474f',
        padding: { x: 7, y: 3 },
      })
      .setOrigin(0, 0)
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
    this.nextRoomBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.selectNextRoom()
    })

    // Draw room frame (same as PhaserRoomView)
    this.roomFrame = this.add.graphics().setDepth(0)
    this.roomFrame
      .lineStyle(4, 0x595959, 1)
      .strokeRect(
        ROOM_LAYOUT.left,
        ROOM_LAYOUT.top,
        ROOM_LAYOUT.right - ROOM_LAYOUT.left,
        ROOM_LAYOUT.bottom - ROOM_LAYOUT.top,
      )
    this.roomFrame.lineStyle(2, 0x282828, 1)
    for (let y = ROOM_LAYOUT.top + 36; y < ROOM_LAYOUT.bottom; y += 48) {
      this.roomFrame.lineBetween(ROOM_LAYOUT.left + 4, y, ROOM_LAYOUT.right - 4, y)
    }

    // Room divider (dashed midpoint threshold)
    this.roomDivider = this.add.graphics().setDepth(0)
    this.roomDivider.lineStyle(2, 0x3c3c3c, 0.8)
    for (let y = ROOM_LAYOUT.top + 8; y < ROOM_LAYOUT.bottom; y += 24) {
      this.roomDivider.lineBetween(
        ROOM_LAYOUT.rightHalfStartX,
        y,
        ROOM_LAYOUT.rightHalfStartX,
        Math.min(y + 10, ROOM_LAYOUT.bottom),
      )
    }

    // Door
    this.doorFrame = this.add.graphics().setDepth(1)
    this.doorFrame
      .fillStyle(0x101010, 1)
      .fillRect(ROOM_LAYOUT.exit.x - 42, ROOM_LAYOUT.exit.y - 84, 84, 168)
    this.doorFrame
      .lineStyle(4, 0x9a9a9a, 1)
      .strokeRect(ROOM_LAYOUT.exit.x - 42, ROOM_LAYOUT.exit.y - 84, 84, 168)
    this.doorLabel = this.add
      .text(ROOM_LAYOUT.exit.x, ROOM_LAYOUT.exit.y + 100, ROOM_NAMES[ROOM_IDS.second], {
        fontFamily: FONT_FAMILY,
        fontSize: 20,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(2)

    // Walls graphics layer
    this.wallGraphics = this.add.graphics().setDepth(1)

    // Build property panel & export button
    this.buildPropertyPanel()
    this.buildExportButton()

    // Select the current room and load its geometry and objects
    this.selectRoom(this.currentRoomId)

    // Instructions
    this.instructionText = this.add
      .text(960, 1045, 'Click to select · Drag to move · Shift+Drag: Scale · Arrows: Nudge · Ctrl+Z: Undo · Del: Remove · PgUp/PgDn: Rooms', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(50)

    // Input handlers
    this.input.on('pointerdown', this.onPointerDown, this)
    this.input.on('pointermove', this.onPointerMove, this)
    this.input.on('pointerup', this.onPointerUp, this)
    this.input.keyboard?.on('keydown', this.onKeyDown, this)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.onPointerDown, this)
      this.input.off('pointermove', this.onPointerMove, this)
      this.input.off('pointerup', this.onPointerUp, this)
      this.input.keyboard?.off('keydown', this.onKeyDown, this)
      this.headerText?.destroy()
      this.roomGoalText?.destroy()
      this.prevRoomBtn?.destroy()
      this.nextRoomBtn?.destroy()
      this.doorLabel?.destroy()
      this.instructionText?.destroy()
      this.panelContainer?.destroy(true)
      this.exportButton?.destroy(true)
      this.playButton?.destroy(true)
      for (const btn of this.roomSelectorButtons.values()) {
        btn.destroy()
      }
      this.roomSelectorButtons.clear()
      this.wallGraphics?.destroy()
      for (const obj of this.editorObjects) {
        obj.sprite.destroy()
        obj.outline.destroy()
        obj.collisionBox?.destroy()
        obj.colliderHandle?.destroy()
        obj.scaleHandle.destroy()
        obj.label.destroy()
      }
      this.editorObjects = []
      this.panelFields.clear()
      this.statsElements = []
      this.guardStatsElements = []
      this.playerStatsElements = []
      this.weaponStatsElements = []
      if (this.testEquippedWeaponId) {
        this.testUnequip(this.testEquippedWeaponId)
      }
      this.testEquippedWeaponId = null
      this.savedWeaponPositions.clear()
      this.testAttackAnimation = null
      this.testEquipBtn = undefined
      this.testAttackBtn = undefined
      this.section3Title = undefined
      this.naStatsText = undefined
      this.mvAttrElements = []
      this.mvAttrValues.clear()
      this.objectListButtons = []
      this.objectListTitle = undefined
      this.deleteButton = undefined
    })
  }

  update(_time: number, delta: number): void {
    if (this.testAttackAnimation) {
      this.testAttackAnimation.elapsedMs += delta
      const { weaponId, elapsedMs, durationMs, attackDistance } = this.testAttackAnimation
      const weapon = this.editorObjects.find((o) => o.id === weaponId)
      if (weapon) {
        if (elapsedMs >= durationMs) {
          this.testAttackAnimation = null
          if (this.testEquippedWeaponId === weapon.id) {
            this.updateEquippedWeaponPosition(weapon)
          } else {
            this.updateObjectVisuals(weapon)
          }
        } else {
          const translation = computeDaggerAttackTranslation(elapsedMs, durationMs, attackDistance)
          if (this.testEquippedWeaponId === weapon.id) {
            this.updateEquippedWeaponPosition(weapon, undefined, translation)
          } else {
            weapon.sprite.setPosition(weapon.x + translation, weapon.y)
            weapon.outline.setPosition(weapon.x + translation, weapon.y)
            weapon.scaleHandle.setPosition(
              weapon.x + translation + weapon.displayWidth / 2,
              weapon.y + weapon.displayHeight / 2,
            )
            weapon.label.setPosition(weapon.x + translation, weapon.y - weapon.displayHeight / 2 - 20)
          }
        }
      } else {
        this.testAttackAnimation = null
      }
    }
  }

  private createEditorObject(worldObject: WorldObject): void {
    const state = worldObject.state as Record<string, unknown>
    const x = typeof state.x === 'number' ? state.x : 0
    const y = typeof state.y === 'number' ? state.y : 0
    const textureKey = this.textureKeyFor(worldObject)
    if (!textureKey) return

    const rawRole = worldObject.metadata.role
    const role: WorldObjectRole =
      rawRole === 'weapon'
        ? 'weapon'
        : rawRole === 'guard' || rawRole === 'enemy'
          ? 'enemy'
          : rawRole === 'object'
            ? 'object'
            : 'player'

    const isWeapon = role === 'weapon'
    const isCharacter = role === 'player' || role === 'enemy'
    const maxHealth = isCharacter && typeof state.maxHealth === 'number' ? state.maxHealth : (isCharacter ? 100 : undefined)
    const speed = isCharacter
      ? (typeof state.speed === 'number' || (typeof state.speed === 'object' && state.speed !== null))
        ? (state.speed as number | PlayerSpeedConfig)
        : (role === 'player'
            ? { acceleration: 800, frictionAcceleration: 1200, turnaroundAcceleration: 1600, maxSpeed: 240 }
            : 210)
      : undefined
    const speedConfig = typeof speed === 'object' && speed !== null ? speed : undefined
    const maxSpeed = speedConfig?.maxSpeed ?? (typeof speed === 'number' ? speed : undefined)
    const acceleration = speedConfig?.acceleration
    const frictionAcceleration = speedConfig?.frictionAcceleration
    const turnaroundAcceleration = speedConfig?.turnaroundAcceleration
    const roomObjects = getRoomObjectConfigs(this.currentRoomId)
    const roomObj = roomObjects.find((o) => o.id === worldObject.id)
    const name = roomObj?.name ?? (typeof worldObject.metadata.name === 'string' ? worldObject.metadata.name : undefined)
    const kind = (roomObj?.kind ?? worldObject.metadata.kind) as 'crate' | 'plate' | 'archer' | undefined
    const passive = roomObj?.passive

    const attackDistance = isWeapon
      ? typeof state.weaponAttackDistance === 'number'
        ? state.weaponAttackDistance
        : typeof state.attackDistance === 'number'
          ? state.attackDistance
          : (roomObj?.attackDistance ?? GAME_WEAPON_CONFIG.attackDistance)
      : undefined
    const attackDurationMs = isWeapon
      ? typeof state.weaponAttackDurationMs === 'number'
        ? state.weaponAttackDurationMs
        : typeof state.attackDurationMs === 'number'
          ? state.attackDurationMs
          : (roomObj?.attackDurationMs ?? GAME_WEAPON_CONFIG.attackDurationMs)
      : undefined
    const holdOffsetX = isWeapon
      ? typeof state.holdOffsetX === 'number'
        ? state.holdOffsetX
        : (roomObj?.holdOffsetX ?? GAME_WEAPON_CONFIG.holdOffsetX)
      : undefined
    const holdOffsetY = isWeapon
      ? typeof state.holdOffsetY === 'number'
        ? state.holdOffsetY
        : (roomObj?.holdOffsetY ?? GAME_WEAPON_CONFIG.holdOffsetY)
      : undefined

    const isCrate = kind === 'crate'
    const isPlate = kind === 'plate'
    const defaultBaseWidth = isWeapon
      ? DAGGER_SIZE.width
      : isCrate
        ? 88
        : isPlate
          ? 96
          : (role === 'object' ? BOULDER_BASE_SIZE.width : CHARACTER_BASE_SIZE.width)
    const defaultBaseHeight = isWeapon
      ? DAGGER_SIZE.height
      : isCrate
        ? 88
        : isPlate
          ? 96
          : (role === 'object' ? BOULDER_BASE_SIZE.height : CHARACTER_BASE_SIZE.height)

    const displayWidth = typeof state.displayWidth === 'number'
      ? state.displayWidth
      : defaultBaseWidth
    const displayHeight = typeof state.displayHeight === 'number'
      ? state.displayHeight
      : defaultBaseHeight

    const scaleX = typeof state.scaleX === 'number'
      ? state.scaleX
      : displayWidth / defaultBaseWidth
    const scaleY = typeof state.scaleY === 'number'
      ? state.scaleY
      : displayHeight / defaultBaseHeight

    const baseWidth = scaleX !== 0 ? displayWidth / scaleX : defaultBaseWidth
    const baseHeight = scaleY !== 0 ? displayHeight / scaleY : defaultBaseHeight

    const sprite = this.add.image(x, y, textureKey).setDepth(kind === 'plate' ? 2 : 3)
    sprite.setDisplaySize(displayWidth, displayHeight)
    sprite.setAlpha(0.9)

    // Selection outline
    const outline = this.add
      .rectangle(x, y, displayWidth + 8, displayHeight + 8)
      .setStrokeStyle(3, SELECTED_OUTLINE, 1)
      .setFillStyle(SELECTED_OUTLINE, 0.08)
      .setDepth(2)
      .setVisible(false)

    const stateCollBox = state.collisionBox as { width?: number; height?: number } | null | undefined
    const colliderWidth =
      typeof roomObj?.colliderWidth === 'number'
        ? roomObj.colliderWidth
        : typeof stateCollBox?.width === 'number'
          ? stateCollBox.width
          : typeof state.colliderWidth === 'number'
            ? (state.colliderWidth as number)
            : undefined
    const colliderHeight =
      typeof roomObj?.colliderHeight === 'number'
        ? roomObj.colliderHeight
        : typeof stateCollBox?.height === 'number'
          ? stateCollBox.height
          : typeof state.colliderHeight === 'number'
            ? (state.colliderHeight as number)
            : undefined

    const colliderShape: ColliderShape | undefined =
      roomObj?.colliderShape ?? (state.shape === 'circle' ? 'circle' : undefined)

    // Collision box (added for all world objects besides weapon)
    let collisionBox: ColliderOutline | undefined
    let colliderHandle: Phaser.GameObjects.Rectangle | undefined
    if (role !== 'weapon') {
      const collSize = computeEditorColliderSize(role, scaleX, scaleY, colliderWidth, colliderHeight, colliderShape)
      collisionBox = this.createColliderOutline(x, y, collSize.width, collSize.height, colliderShape)

      colliderHandle = this.add
        .rectangle(
          x + collSize.width / 2,
          y + collSize.height / 2,
          HANDLE_SIZE,
          HANDLE_SIZE,
          0x00e676,
          1,
        )
        .setDepth(5)
        .setVisible(false)
    }

    // Scale handle (bottom-right corner)
    const scaleHandle = this.add
      .rectangle(
        x + displayWidth / 2,
        y + displayHeight / 2,
        HANDLE_SIZE,
        HANDLE_SIZE,
        HANDLE_COLOR,
        1,
      )
      .setDepth(5)
      .setVisible(false)

    // Object label
    const label = this.add
      .text(x, y - displayHeight / 2 - 20, worldObject.id, {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5, 1)
      .setDepth(4)

    const editorObject: EditorObject = {
      id: worldObject.id,
      name,
      kind,
      passive,
      role,
      sprite,
      outline,
      collisionBox,
      colliderHandle,
      scaleHandle,
      label,
      colliderWidth: role !== 'weapon' ? (colliderWidth ?? computeCollisionSize(role, scaleX, scaleY).width) : undefined,
      colliderHeight: role !== 'weapon' ? (colliderHeight ?? computeCollisionSize(role, scaleX, scaleY).height) : undefined,
      ...(colliderShape ? { colliderShape } : {}),
      x,
      y,
      displayWidth,
      displayHeight,
      baseWidth,
      baseHeight,
      scaleX,
      scaleY,
      maxHealth,
      speed,
      maxSpeed,
      acceleration,
      frictionAcceleration,
      turnaroundAcceleration,
      attackDistance,
      attackDurationMs,
      holdOffsetX,
      holdOffsetY,
      ...this.physicsAttrFields(readPhysicsAttrOverride(state)),
    }

    this.editorObjects.push(editorObject)
  }

  private physicsAttrFields(attr: PhysicsAttrConfig | undefined): PhysicsAttrConfig {
    const fields: PhysicsAttrConfig = {}
    for (const key of PHYSICS_ATTR_KEYS) {
      const value = attr?.[key]
      if (value !== undefined) {
        fields[key] = value
      }
    }
    return fields
  }

  private buildPropertyPanel(): void {
    const bg = this.add
      .rectangle(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, PANEL_BG, 0.92)
      .setStrokeStyle(2, 0x444444, 1)

    const items: Phaser.GameObjects.GameObject[] = [bg]

    // Vertical dividers between 5 sections
    const dividerGraphics = this.add.graphics()
    dividerGraphics.lineStyle(2, 0x333333, 1)
    dividerGraphics.lineBetween(280, 20, 280, PANEL_HEIGHT - 20)
    dividerGraphics.lineBetween(680, 20, 680, PANEL_HEIGHT - 20)
    dividerGraphics.lineBetween(1100, 20, 1100, PANEL_HEIGHT - 20)
    dividerGraphics.lineBetween(1420, 20, 1420, PANEL_HEIGHT - 20)
    items.push(dividerGraphics)

    // ─── Section 1: Object Selector & Spawning ───
    this.objectListTitle = this.add
      .text(140, 16, 'OBJECTS', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(this.objectListTitle)

    // Spawn buttons (Row 1: Guard & Dagger, Row 2: Crate & Boulder)
    const spawnGuardBtn = this.add
      .text(75, 38, '+ GUARD', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: '#ffffff',
        backgroundColor: '#1b5e20',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    spawnGuardBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.spawnWorldObject('enemy')
    })

    const spawnDaggerBtn = this.add
      .text(205, 38, '+ DAGGER', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: '#ffffff',
        backgroundColor: '#0d47a1',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    spawnDaggerBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.spawnWorldObject('weapon')
    })

    const spawnCrateBtn = this.add
      .text(75, 66, '+ CRATE', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: '#ffffff',
        backgroundColor: '#e65100',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    spawnCrateBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.spawnWorldObject('object', { kind: 'crate', colliderWidth: 80, colliderHeight: 80, mass: 3 })
    })

    const spawnBoulderBtn = this.add
      .text(205, 66, '+ BOULDER', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: '#ffffff',
        backgroundColor: '#4e342e',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    spawnBoulderBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.spawnWorldObject('object', {
        colliderShape: 'circle',
        colliderWidth: 128,
        colliderHeight: 128,
        mass: 100,
        displayWidth: 154,
        displayHeight: 154,
        scaleX: 1.28,
        scaleY: 1.28,
      })
    })

    items.push(spawnGuardBtn, spawnDaggerBtn, spawnCrateBtn, spawnBoulderBtn)

    // Remove selected object button
    this.deleteButton = this.add
      .text(140, 248, 'REMOVE SELECTED', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: '#ffcdd2',
        backgroundColor: '#b71c1c',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)
    this.deleteButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      if (this.selectedId) {
        this.despawnWorldObject(this.selectedId)
      }
    })
    items.push(this.deleteButton)

    // ─── Section 2: Transform Readout ───
    const section2Title = this.add
      .text(480, 24, 'TRANSFORM', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(section2Title)

    const leftFields = ['x', 'y', 'width']
    const rightFields = ['scaleX', 'scaleY', 'height']

    for (let i = 0; i < leftFields.length; i++) {
      const field = leftFields[i]
      const fY = 75 + i * 56

      const label = this.add
        .text(310, fY, `${field}:`, {
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          color: DIM_COLOR,
        })
        .setOrigin(0, 0)

      const val = this.add
        .text(460, fY, '--', {
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          color: TEXT_COLOR,
        })
        .setOrigin(1, 0)

      items.push(label, val)
      this.panelFields.set(`val_${field}`, val)
    }

    for (let i = 0; i < rightFields.length; i++) {
      const field = rightFields[i]
      const fY = 75 + i * 56

      const label = this.add
        .text(490, fY, `${field}:`, {
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          color: DIM_COLOR,
        })
        .setOrigin(0, 0)

      const val = this.add
        .text(650, fY, '--', {
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          color: TEXT_COLOR,
        })
        .setOrigin(1, 0)

      items.push(label, val)
      this.panelFields.set(`val_${field}`, val)
    }

    // Collider box row in Section 2
    const collWLabel = this.add
      .text(310, 242, 'box_w:', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: '#00e676',
      })
      .setOrigin(0, 0)

    const collWVal = this.add
      .text(405, 240, '--', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: '#00e676',
        backgroundColor: '#2a2a2a',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
    collWVal.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.promptColliderSize('colliderWidth')
    })

    const collWMinus = this.createPanelButton(430, 238, '−', (pointer) => {
      this.adjustColliderSize('colliderWidth', pointer.event?.shiftKey ? -50 : -10)
    })
    const collWPlus = this.createPanelButton(462, 238, '+', (pointer) => {
      this.adjustColliderSize('colliderWidth', pointer.event?.shiftKey ? 50 : 10)
    })

    const collHLabel = this.add
      .text(490, 242, 'box_h:', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: '#00e676',
      })
      .setOrigin(0, 0)

    const collHVal = this.add
      .text(585, 240, '--', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: '#00e676',
        backgroundColor: '#2a2a2a',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
    collHVal.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.promptColliderSize('colliderHeight')
    })

    const collHMinus = this.createPanelButton(610, 238, '−', (pointer) => {
      this.adjustColliderSize('colliderHeight', pointer.event?.shiftKey ? -50 : -10)
    })
    const collHPlus = this.createPanelButton(642, 238, '+', (pointer) => {
      this.adjustColliderSize('colliderHeight', pointer.event?.shiftKey ? 50 : 10)
    })

    this.panelFields.set('val_colliderWidth', collWVal)
    this.panelFields.set('val_colliderHeight', collHVal)
    items.push(
      collWLabel,
      collWVal,
      collWMinus,
      collWPlus,
      collHLabel,
      collHVal,
      collHMinus,
      collHPlus,
    )

    // ─── Section 3: Stats (Editable for player, guard & weapon) ───
    this.section3Title = this.add
      .text(890, 24, 'CHARACTER STATS', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(this.section3Title)

    this.naStatsText = this.add
      .text(890, 115, '(No editable stats)', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
      .setVisible(false)
    items.push(this.naStatsText)

    this.statsElements = []
    this.guardStatsElements = []
    this.playerStatsElements = []
    this.weaponStatsElements = []

    const createStatRow = (
      labelName: string,
      fieldKey: string,
      property: CharacterProperty,
      y: number,
      targetArray: Phaser.GameObjects.Text[],
    ) => {
      const label = this.add
        .text(705, y + 2, `${labelName}:`, {
          fontFamily: FONT_FAMILY,
          fontSize: 13,
          color: DIM_COLOR,
        })
        .setOrigin(0, 0)

      const val = this.add
        .text(910, y + 2, '--', {
          fontFamily: FONT_FAMILY,
          fontSize: 13,
          color: ACCENT_COLOR,
          backgroundColor: '#2a2a2a',
          padding: { x: 8, y: 3 },
        })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true })
      val.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.()
        this.promptProperty(property)
      })

      const minusBtn = this.createPanelButton(945, y, '−', (pointer) => {
        this.adjustProperty(property, pointer.event?.shiftKey ? -50 : -10)
      })
      const plusBtn = this.createPanelButton(995, y, '+', (pointer) => {
        this.adjustProperty(property, pointer.event?.shiftKey ? 50 : 10)
      })

      this.panelFields.set(`val_${fieldKey}`, val)
      targetArray.push(label, val, minusBtn, plusBtn)
      items.push(label, val, minusBtn, plusBtn)
    }

    createStatRow('max_health', 'maxHealth', 'maxHealth', 50, this.statsElements)
    createStatRow('speed', 'speed', 'speed', 86, this.guardStatsElements)

    const openAiEditorBtn = this.add
      .text(890, 134, 'AI EDITOR (F4)', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: '#ffffff',
        backgroundColor: '#4a148c',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    openAiEditorBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.openAiEditor()
    })

    const guardAiHint = this.add
      .text(890, 184, 'Edit & simulate behavior tree', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
        align: 'center',
      })
      .setOrigin(0.5, 0)

    this.guardStatsElements.push(openAiEditorBtn, guardAiHint)
    items.push(openAiEditorBtn, guardAiHint)

    // Player speed summary & Speed Editor launcher (speed adjust panel moved to SpeedEditor)
    const playerSpeedLabel = this.add
      .text(705, 90, 'speed:', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    const playerSpeedVal = this.add
      .text(1075, 90, '--', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: ACCENT_COLOR,
      })
      .setOrigin(1, 0)
    this.panelFields.set('val_player_speed_summary', playerSpeedVal)

    const openSpeedEditorBtn = this.add
      .text(890, 134, 'OPEN SPEED EDITOR (F3)', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: '#ffffff',
        backgroundColor: '#00695c',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    openSpeedEditorBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.openSpeedEditor()
    })

    const playerSpeedHint = this.add
      .text(890, 184, 'Tune physics & test live movement', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
        align: 'center',
      })
      .setOrigin(0.5, 0)

    this.playerStatsElements.push(playerSpeedLabel, playerSpeedVal, openSpeedEditorBtn, playerSpeedHint)
    items.push(playerSpeedLabel, playerSpeedVal, openSpeedEditorBtn, playerSpeedHint)

    // Stats hints
    const statHint1 = this.add
      .text(890, 238, 'Click +/- (10) · Shift (50)', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
    const statHint2 = this.add
      .text(890, 260, 'Click number to set exact', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
    this.statsElements.push(statHint1, statHint2)
    items.push(statHint1, statHint2)

    // Weapon stats rows
    createStatRow('attack_dist', 'attackDistance', 'attackDistance', 50, this.weaponStatsElements)
    createStatRow('attack_dur', 'attackDurationMs', 'attackDurationMs', 86, this.weaponStatsElements)
    createStatRow('hold_offset_x', 'holdOffsetX', 'holdOffsetX', 122, this.weaponStatsElements)
    createStatRow('hold_offset_y', 'holdOffsetY', 'holdOffsetY', 158, this.weaponStatsElements)

    this.testEquipBtn = this.add
      .text(795, 196, 'TEST EQUIP', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: '#ffffff',
        backgroundColor: '#00695c',
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    this.testEquipBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.toggleTestEquip()
    })

    this.testAttackBtn = this.add
      .text(985, 196, 'TEST ATTACK', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: '#ffffff',
        backgroundColor: '#c62828',
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    this.testAttackBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.testAttack()
    })

    const weaponHint1 = this.add
      .text(890, 238, 'Click +/- (10) · Shift (50)', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
    const weaponHint2 = this.add
      .text(890, 258, 'Click number to set exact', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)

    this.panelFields.set('btn_test_equip', this.testEquipBtn)
    this.panelFields.set('btn_test_attack', this.testAttackBtn)

    this.weaponStatsElements.push(this.testEquipBtn, this.testAttackBtn, weaponHint1, weaponHint2)
    items.push(this.testEquipBtn, this.testAttackBtn, weaponHint1, weaponHint2)
    this.weaponStatsElements.forEach((el) => el.setVisible(false))

    // ─── Section 4: Scale & Nudge ───
    const section4Title = this.add
      .text(1260, 24, 'SCALE & NUDGE', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(section4Title)

    const scalePlusBtn = this.createPanelButton(1200, 50, 'SCALE +', () =>
      this.scaleSelected(1.1),
    )
    const scaleMinusBtn = this.createPanelButton(1320, 50, 'SCALE -', () =>
      this.scaleSelected(1 / 1.1),
    )
    const collScalePlusBtn = this.createPanelButton(1200, 84, 'BOX +', () =>
      this.scaleSelectedCollider(1.1),
    )
    const collScaleMinusBtn = this.createPanelButton(1320, 84, 'BOX -', () =>
      this.scaleSelectedCollider(1 / 1.1),
    )
    items.push(scalePlusBtn, scaleMinusBtn, collScalePlusBtn, collScaleMinusBtn)

    const hints = [
      'Nudge: Arrows (Shift: 10px)',
      'Scale: +/- (Box: [/])',
      'Drag: Yellow (Scale) / Green (Box)',
    ]
    for (let i = 0; i < hints.length; i++) {
      const hint = this.add
        .text(1260, 120 + i * 16, hints[i], {
          fontFamily: FONT_FAMILY,
          fontSize: 11,
          color: DIM_COLOR,
        })
        .setOrigin(0.5, 0)
      items.push(hint)
    }

    // MV attributes: per-object overrides of the global mv defaults (set in the Speed Editor)
    const mvTitle = this.add
      .text(1260, 152, 'PHYSICS (dim = default)', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(mvTitle)
    this.mvAttrElements = [mvTitle]
    this.mvAttrValues.clear()

    const mvRows: { key: PhysicsAttrKey; label: string; y: number; step: number; shiftStep: number }[] = [
      { key: 'drag', label: 'drag', y: 168, step: 0.1, shiftStep: 0.5 },
      { key: 'friction', label: 'friction', y: 193, step: 0.5, shiftStep: 2 },
      { key: 'mass', label: 'mass', y: 218, step: 0.1, shiftStep: 1 },
      { key: 'max_velocity', label: 'max_vel', y: 243, step: 50, shiftStep: 100 },
      { key: 'restitution', label: 'restit', y: 268, step: 0.1, shiftStep: 0.5 },
    ]
    for (const row of mvRows) {
      const label = this.add
        .text(1112, row.y + 6, `${row.label}:`, {
          fontFamily: FONT_FAMILY,
          fontSize: 12,
          color: DIM_COLOR,
        })
        .setOrigin(0, 0)
      const val = this.add
        .text(1262, row.y + 4, '--', {
          fontFamily: FONT_FAMILY,
          fontSize: 12,
          color: DIM_COLOR,
          backgroundColor: '#2a2a2a',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true })
      val.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.()
        this.promptMvAttr(row.key)
      })
      const minusBtn = this.createPanelButton(1292, row.y, '−', (pointer) => {
        this.adjustMvAttr(row.key, pointer.event?.shiftKey ? -row.shiftStep : -row.step)
      })
      const plusBtn = this.createPanelButton(1337, row.y, '+', (pointer) => {
        this.adjustMvAttr(row.key, pointer.event?.shiftKey ? row.shiftStep : row.step)
      })
      const resetBtn = this.createPanelButton(1388, row.y, 'R', () => this.resetMvAttr(row.key))
      this.mvAttrValues.set(row.key, val)
      this.mvAttrElements.push(label, val, minusBtn, plusBtn, resetBtn)
      items.push(label, val, minusBtn, plusBtn, resetBtn)
    }
    this.mvAttrElements.forEach((el) => el.setVisible(false))

    // ─── Section 5: Save ───
    const section5Title = this.add
      .text(1574, 24, 'SAVE', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    this.section5Desc = this.add
      .text(1574, 75, 'Overwrite room1.ts directly:', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(section5Title, this.section5Desc)

    this.panelContainer = this.add.container(PANEL_X, PANEL_Y, items).setDepth(40)
    this.refreshObjectList()
  }

  private createPanelButton(
    x: number,
    y: number,
    text: string,
    onClick: (pointer: Phaser.Input.Pointer) => void,
  ): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: TEXT_COLOR,
        backgroundColor: '#333333',
        padding: { x: 12, y: 7 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      onClick(pointer)
    })
    return btn
  }

  private buildExportButton(): void {
    const btnX = PANEL_X + 1574
    const btnY = PANEL_Y + 140
    const bg = this.add
      .rectangle(0, 0, 260, 48, 0x2e7d32, 1)
      .setStrokeStyle(2, 0x66bb6a, 1)
    const label = this.add
      .text(0, 0, 'SAVE TO ROOM1.TS', {
        fontFamily: FONT_FAMILY,
        fontSize: 15,
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)

    this.exportButton = this.add
      .container(btnX, btnY, [bg, label])
      .setDepth(50)
      .setSize(260, 48)
      .setInteractive({ useHandCursor: true })
    this.exportButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.saveLayout()
    })

    const playBtnX = PANEL_X + 1574
    const playBtnY = PANEL_Y + 198
    const playBg = this.add
      .rectangle(0, 0, 260, 42, 0x1565c0, 1)
      .setStrokeStyle(2, 0x42a5f5, 1)
    const playLabel = this.add
      .text(0, 0, `PLAY ${this.currentRoomId.toUpperCase()} (F2)`, {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)

    this.playButton = this.add
      .container(playBtnX, playBtnY, [playBg, playLabel])
      .setDepth(50)
      .setSize(260, 42)
      .setInteractive({ useHandCursor: true })
    this.playButton.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.returnToGame()
    })
  }

  private selectObject(id: string): void {
    this.selectedId = id
    for (const obj of this.editorObjects) {
      const isSelected = obj.id === id
      obj.outline.setVisible(isSelected)
      obj.scaleHandle.setVisible(isSelected)
      if (obj.colliderHandle) {
        obj.colliderHandle.setVisible(isSelected && obj.role !== 'weapon')
      }
      obj.sprite.setAlpha(isSelected ? 1 : 0.7)

      // Highlight the panel button
      const btn = this.panelFields.get(`btn_${obj.id}`)
      if (btn) {
        btn.setColor(isSelected ? ACCENT_COLOR : TEXT_COLOR)
      }
    }
    this.updateDeleteButtonVisibility()
    this.updatePropertyPanel()
  }

  private updatePropertyPanel(): void {
    const selected = this.getSelected()
    const setField = (key: string, value: string) => {
      const text = this.panelFields.get(`val_${key}`)
      if (text) text.setText(value)
    }

    if (!selected) {
      for (const field of [
        'x',
        'y',
        'width',
        'height',
        'scaleX',
        'scaleY',
        'colliderWidth',
        'colliderHeight',
        'maxHealth',
        'speed',
        'player_speed_summary',
        'attackDistance',
        'attackDurationMs',
        'holdOffsetX',
        'holdOffsetY',
      ]) {
        setField(field, '--')
      }
      this.section3Title?.setText('CHARACTER STATS')
      this.statsElements.forEach((el) => el.setVisible(false))
      this.guardStatsElements.forEach((el) => el.setVisible(false))
      this.playerStatsElements.forEach((el) => el.setVisible(false))
      this.weaponStatsElements.forEach((el) => el.setVisible(false))
      this.naStatsText?.setVisible(false)
      this.mvAttrElements.forEach((el) => el.setVisible(false))
      return
    }

    this.updateMvAttrFields(selected)

    const savedPos = this.savedWeaponPositions.get(selected.id)
    const displayX = savedPos ? savedPos.x : selected.x
    const displayY = savedPos ? savedPos.y : selected.y
    setField('x', Math.round(displayX).toString())
    setField('y', Math.round(displayY).toString())
    setField('width', Math.round(selected.displayWidth).toString())
    setField('height', Math.round(selected.displayHeight).toString())
    setField('scaleX', selected.scaleX.toFixed(2))
    setField('scaleY', selected.scaleY.toFixed(2))

    if (selected.role === 'weapon') {
      setField('colliderWidth', '--')
      setField('colliderHeight', '--')
    } else {
      const collSize = computeCollisionSize(
        selected.role,
        selected.scaleX,
        selected.scaleY,
        selected.colliderWidth,
        selected.colliderHeight,
      )
      setField('colliderWidth', Math.round(collSize.width).toString())
      setField('colliderHeight', Math.round(collSize.height).toString())
    }

    const isCharacter =
      selected.maxHealth !== undefined &&
      (selected.speed !== undefined || selected.maxSpeed !== undefined)

    if (isCharacter) {
      this.section3Title?.setText('CHARACTER STATS')
      setField('maxHealth', selected.maxHealth!.toString())
      setField('attackDistance', '--')
      setField('attackDurationMs', '--')
      setField('holdOffsetX', '--')
      setField('holdOffsetY', '--')
      this.statsElements.forEach((el) => el.setVisible(true))
      this.weaponStatsElements.forEach((el) => el.setVisible(false))
      this.naStatsText?.setVisible(false)

      if (selected.role === 'player') {
        this.guardStatsElements.forEach((el) => el.setVisible(false))
        this.playerStatsElements.forEach((el) => el.setVisible(true))
        const maxSpd =
          selected.maxSpeed ??
          (typeof selected.speed === 'object' && selected.speed !== null
            ? selected.speed.maxSpeed
            : typeof selected.speed === 'number'
              ? selected.speed
              : 300)
        const accel =
          selected.acceleration ??
          (typeof selected.speed === 'object' && selected.speed !== null
            ? selected.speed.acceleration
            : 2500)
        setField('player_speed_summary', `max:${maxSpd} acc:${accel}`)
      } else {
        this.guardStatsElements.forEach((el) => el.setVisible(true))
        this.playerStatsElements.forEach((el) => el.setVisible(false))
        const spd = typeof selected.speed === 'number' ? selected.speed : (selected.maxSpeed ?? 210)
        setField('speed', spd.toString())
      }
    } else if (selected.role === 'weapon') {
      this.section3Title?.setText('WEAPON STATS')
      setField('maxHealth', '--')
      setField('speed', '--')
      setField('player_speed_summary', '--')
      this.statsElements.forEach((el) => el.setVisible(false))
      this.guardStatsElements.forEach((el) => el.setVisible(false))
      this.playerStatsElements.forEach((el) => el.setVisible(false))
      this.naStatsText?.setVisible(false)
      this.weaponStatsElements.forEach((el) => el.setVisible(true))

      const attackDist = selected.attackDistance ?? GAME_WEAPON_CONFIG.attackDistance
      const attackDur = selected.attackDurationMs ?? GAME_WEAPON_CONFIG.attackDurationMs
      const holdX = selected.holdOffsetX ?? GAME_WEAPON_CONFIG.holdOffsetX
      const holdY = selected.holdOffsetY ?? GAME_WEAPON_CONFIG.holdOffsetY

      setField('attackDistance', attackDist.toString())
      setField('attackDurationMs', attackDur.toString())
      setField('holdOffsetX', holdX.toString())
      setField('holdOffsetY', holdY.toString())
      this.updateTestEquipButtonState()
    } else {
      this.section3Title?.setText('STATS')
      setField('maxHealth', '--')
      setField('speed', '--')
      setField('player_speed_summary', '--')
      setField('attackDistance', '--')
      setField('attackDurationMs', '--')
      setField('holdOffsetX', '--')
      setField('holdOffsetY', '--')
      this.statsElements.forEach((el) => el.setVisible(false))
      this.guardStatsElements.forEach((el) => el.setVisible(false))
      this.playerStatsElements.forEach((el) => el.setVisible(false))
      this.weaponStatsElements.forEach((el) => el.setVisible(false))
      this.naStatsText?.setVisible(true)
    }
  }

  private adjustProperty(property: CharacterProperty, delta: number): void {
    const selected = this.getSelected()
    if (!selected) return

    let prevValue = selected[property] as number | undefined
    if (prevValue === undefined) {
      if (property === 'maxSpeed') {
        prevValue =
          typeof selected.speed === 'number'
            ? selected.speed
            : typeof selected.speed === 'object' && selected.speed !== null
              ? selected.speed.maxSpeed
              : 240
      } else if (property === 'speed') {
        prevValue = typeof selected.speed === 'number' ? selected.speed : 210
      } else if (property === 'acceleration') {
        prevValue =
          typeof selected.speed === 'object' && selected.speed !== null
            ? selected.speed.acceleration
            : 800
      } else if (property === 'frictionAcceleration') {
        prevValue =
          typeof selected.speed === 'object' && selected.speed !== null
            ? (selected.speed.frictionAcceleration ?? 1200)
            : 1200
      } else if (property === 'turnaroundAcceleration') {
        prevValue =
          typeof selected.speed === 'object' && selected.speed !== null
            ? selected.speed.turnaroundAcceleration
            : 1600
      } else if (property === 'attackDistance') {
        prevValue = GAME_WEAPON_CONFIG.attackDistance
      } else if (property === 'attackDurationMs') {
        prevValue = GAME_WEAPON_CONFIG.attackDurationMs
      } else if (property === 'holdOffsetX') {
        prevValue = GAME_WEAPON_CONFIG.holdOffsetX
      } else if (property === 'holdOffsetY') {
        prevValue = GAME_WEAPON_CONFIG.holdOffsetY
      }
    }
    if (prevValue === undefined) return

    let min = 10
    if (property === 'maxHealth') {
      min = 1
    } else if (property === 'attackDistance') {
      min = 0
    } else if (property === 'attackDurationMs') {
      min = 10
    } else if (property === 'holdOffsetX' || property === 'holdOffsetY') {
      min = -200
    }
    const nextValue = Math.max(min, prevValue + delta)
    if (nextValue === prevValue) return

    selected[property] = nextValue
    if (typeof selected.speed === 'object' && selected.speed !== null) {
      if (property === 'maxSpeed') selected.speed.maxSpeed = nextValue
      if (property === 'acceleration') selected.speed.acceleration = nextValue
      if (property === 'frictionAcceleration') selected.speed.frictionAcceleration = nextValue
      if (property === 'turnaroundAcceleration') selected.speed.turnaroundAcceleration = nextValue
    }
    if (property === 'attackDistance') GAME_WEAPON_CONFIG.attackDistance = nextValue
    if (property === 'attackDurationMs') GAME_WEAPON_CONFIG.attackDurationMs = nextValue
    if (property === 'holdOffsetX') GAME_WEAPON_CONFIG.holdOffsetX = nextValue
    if (property === 'holdOffsetY') GAME_WEAPON_CONFIG.holdOffsetY = nextValue

    if (this.testEquippedWeaponId === selected.id) {
      this.updateEquippedWeaponPosition(selected)
    }

    this.history.push({
      type: 'property',
      objectId: selected.id,
      property,
      delta: nextValue - prevValue,
      prevValue,
      nextValue,
    })

    this.updatePropertyPanel()
  }

  private promptProperty(property: CharacterProperty): void {
    const selected = this.getSelected()
    if (!selected) return

    let prevValue = selected[property] as number | undefined
    if (prevValue === undefined) {
      if (property === 'maxSpeed') {
        prevValue =
          typeof selected.speed === 'number'
            ? selected.speed
            : typeof selected.speed === 'object' && selected.speed !== null
              ? selected.speed.maxSpeed
              : 240
      } else if (property === 'speed') {
        prevValue = typeof selected.speed === 'number' ? selected.speed : 210
      } else if (property === 'acceleration') {
        prevValue =
          typeof selected.speed === 'object' && selected.speed !== null
            ? selected.speed.acceleration
            : 800
      } else if (property === 'frictionAcceleration') {
        prevValue =
          typeof selected.speed === 'object' && selected.speed !== null
            ? (selected.speed.frictionAcceleration ?? 1200)
            : 1200
      } else if (property === 'turnaroundAcceleration') {
        prevValue =
          typeof selected.speed === 'object' && selected.speed !== null
            ? selected.speed.turnaroundAcceleration
            : 1600
      } else if (property === 'attackDistance') {
        prevValue = GAME_WEAPON_CONFIG.attackDistance
      } else if (property === 'attackDurationMs') {
        prevValue = GAME_WEAPON_CONFIG.attackDurationMs
      } else if (property === 'holdOffsetX') {
        prevValue = GAME_WEAPON_CONFIG.holdOffsetX
      } else if (property === 'holdOffsetY') {
        prevValue = GAME_WEAPON_CONFIG.holdOffsetY
      }
    }
    if (prevValue === undefined) return

    const label =
      property === 'maxHealth'
        ? 'max_health'
        : property === 'maxSpeed'
          ? 'max_speed'
          : property === 'frictionAcceleration'
            ? 'friction_accel'
            : property === 'turnaroundAcceleration'
              ? 'turnaround_accel'
              : property === 'attackDistance'
                ? 'attack_dist'
                : property === 'attackDurationMs'
                  ? 'attack_dur'
                  : property === 'holdOffsetX'
                    ? 'hold_offset_x'
                    : property === 'holdOffsetY'
                      ? 'hold_offset_y'
                      : property
    const input = window.prompt(`Enter new ${label} for ${selected.id}:`, prevValue.toString())
    if (input === null) return

    const parsed = parseInt(input.trim(), 10)
    let min = 10
    if (property === 'maxHealth') {
      min = 1
    } else if (property === 'attackDistance') {
      min = 0
    } else if (property === 'attackDurationMs') {
      min = 10
    } else if (property === 'holdOffsetX' || property === 'holdOffsetY') {
      min = -200
    }
    if (isNaN(parsed) || parsed < min) return

    const nextValue = parsed
    if (nextValue === prevValue) return

    selected[property] = nextValue
    if (typeof selected.speed === 'object' && selected.speed !== null) {
      if (property === 'maxSpeed') selected.speed.maxSpeed = nextValue
      if (property === 'acceleration') selected.speed.acceleration = nextValue
      if (property === 'frictionAcceleration') selected.speed.frictionAcceleration = nextValue
      if (property === 'turnaroundAcceleration') selected.speed.turnaroundAcceleration = nextValue
    }
    if (property === 'attackDistance') GAME_WEAPON_CONFIG.attackDistance = nextValue
    if (property === 'attackDurationMs') GAME_WEAPON_CONFIG.attackDurationMs = nextValue
    if (property === 'holdOffsetX') GAME_WEAPON_CONFIG.holdOffsetX = nextValue
    if (property === 'holdOffsetY') GAME_WEAPON_CONFIG.holdOffsetY = nextValue

    if (this.testEquippedWeaponId === selected.id) {
      this.updateEquippedWeaponPosition(selected)
    }

    this.history.push({
      type: 'property',
      objectId: selected.id,
      property,
      delta: nextValue - prevValue,
      prevValue,
      nextValue,
    })

    this.updatePropertyPanel()
  }

  private updateMvAttrFields(selected: EditorObject): void {
    this.mvAttrElements.forEach((el) => el.setVisible(true))
    for (const [key, text] of this.mvAttrValues) {
      const override = selected[key]
      text.setText(String(override ?? GAME_PHYSICS_CONFIG[key]))
      text.setColor(override === undefined ? DIM_COLOR : ACCENT_COLOR)
    }
  }

  private commitMvAttr(key: PhysicsAttrKey, next: number | undefined): void {
    const selected = this.getSelected()
    if (!selected) return

    const prev = selected[key]
    if (prev === next) return

    setPhysicsAttrValue(selected, key, next)
    this.history.push({
      type: 'physics_attr',
      objectId: selected.id,
      key,
      prevValue: prev,
      nextValue: next,
    })
    this.updatePropertyPanel()
  }

  private clampMvAttr(key: PhysicsAttrKey, value: number): number {
    const rounded = Math.round(value * 1000) / 1000
    return key === 'mass' ? Math.max(MIN_MASS, rounded) : rounded
  }

  public adjustMvAttr(key: PhysicsAttrKey, delta: number): void {
    const selected = this.getSelected()
    if (!selected) return
    const current = selected[key] ?? GAME_PHYSICS_CONFIG[key]
    this.commitMvAttr(key, this.clampMvAttr(key, current + delta))
  }

  public promptMvAttr(key: PhysicsAttrKey): void {
    const selected = this.getSelected()
    if (!selected) return
    const current = selected[key] ?? GAME_PHYSICS_CONFIG[key]
    const input = window.prompt(`Enter new ${key} for ${selected.id}:`, current.toString())
    if (input === null) return
    const parsed = parseFloat(input.trim())
    if (!Number.isFinite(parsed)) return
    this.commitMvAttr(key, this.clampMvAttr(key, parsed))
  }

  public resetMvAttr(key: PhysicsAttrKey): void {
    this.commitMvAttr(key, undefined)
  }

  private getSelected(): EditorObject | undefined {
    return this.editorObjects.find((obj) => obj.id === this.selectedId)
  }

  public getCollisionBox(
    role: WorldObjectRole,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    colliderWidth?: number,
    colliderHeight?: number,
  ): { x: number; y: number; width: number; height: number } | null {
    return computeEditorCollisionBox(role, x, y, scaleX, scaleY, colliderWidth, colliderHeight)
  }

  public wouldOverlapAny(
    objectId: string,
    x: number,
    y: number,
    scaleX?: number,
    scaleY?: number,
    colliderWidth?: number,
    colliderHeight?: number,
  ): boolean {
    const targetObj = this.editorObjects.find((o) => o.id === objectId)
    const role = targetObj?.role ?? 'enemy'
    const sX = scaleX ?? targetObj?.scaleX ?? 1
    const sY = scaleY ?? targetObj?.scaleY ?? 1
    const cW = colliderWidth ?? targetObj?.colliderWidth
    const cH = colliderHeight ?? targetObj?.colliderHeight
    return wouldOverlapAnyEditorObject(objectId, role, x, y, sX, sY, this.editorObjects, cW, cH, targetObj?.colliderShape)
  }

  public adjustColliderSize(property: 'colliderWidth' | 'colliderHeight', delta: number): void {
    const selected = this.getSelected()
    if (!selected || selected.role === 'weapon') return

    const defaultSize = computeCollisionSize(selected.role, selected.scaleX, selected.scaleY)
    const prevWidth = selected.colliderWidth ?? defaultSize.width
    const prevHeight = selected.colliderHeight ?? defaultSize.height

    let nextWidth = property === 'colliderWidth' ? Math.max(16, prevWidth + delta) : prevWidth
    let nextHeight = property === 'colliderHeight' ? Math.max(16, prevHeight + delta) : prevHeight
    if (selected.colliderShape === 'circle') {
      // A circle has one size, its diameter: either field changes both.
      nextWidth = nextHeight = property === 'colliderWidth' ? nextWidth : nextHeight
    }

    if (nextWidth === prevWidth && nextHeight === prevHeight) return

    if (
      this.wouldOverlapAny(
        selected.id,
        selected.x,
        selected.y,
        selected.scaleX,
        selected.scaleY,
        nextWidth,
        nextHeight,
      )
    ) {
      return
    }

    selected.colliderWidth = nextWidth
    selected.colliderHeight = nextHeight

    this.history.push({
      type: 'collider',
      objectId: selected.id,
      prevWidth,
      prevHeight,
      nextWidth,
      nextHeight,
    })

    this.updateObjectVisuals(selected)
    this.updatePropertyPanel()
  }

  public scaleSelectedCollider(factor: number): void {
    const selected = this.getSelected()
    if (!selected || selected.role === 'weapon') return

    const defaultSize = computeCollisionSize(selected.role, selected.scaleX, selected.scaleY)
    const prevWidth = selected.colliderWidth ?? defaultSize.width
    const prevHeight = selected.colliderHeight ?? defaultSize.height

    const nextWidth = Math.max(16, Math.round(prevWidth * factor))
    const nextHeight = Math.max(16, Math.round(prevHeight * factor))

    if (nextWidth === prevWidth && nextHeight === prevHeight) return

    if (
      this.wouldOverlapAny(
        selected.id,
        selected.x,
        selected.y,
        selected.scaleX,
        selected.scaleY,
        nextWidth,
        nextHeight,
      )
    ) {
      return
    }

    selected.colliderWidth = nextWidth
    selected.colliderHeight = nextHeight

    this.history.push({
      type: 'collider',
      objectId: selected.id,
      prevWidth,
      prevHeight,
      nextWidth,
      nextHeight,
    })

    this.updateObjectVisuals(selected)
    this.updatePropertyPanel()
  }

  public promptColliderSize(property: 'colliderWidth' | 'colliderHeight'): void {
    const selected = this.getSelected()
    if (!selected || selected.role === 'weapon') return

    const defaultSize = computeCollisionSize(selected.role, selected.scaleX, selected.scaleY)
    const prevWidth = selected.colliderWidth ?? defaultSize.width
    const prevHeight = selected.colliderHeight ?? defaultSize.height
    const currentVal = property === 'colliderWidth' ? prevWidth : prevHeight

    const label = property === 'colliderWidth' ? 'collider width' : 'collider height'
    const input = window.prompt(`Enter new ${label} for ${selected.id}:`, currentVal.toString())
    if (input === null) return

    const parsed = parseInt(input.trim(), 10)
    if (isNaN(parsed) || parsed < 16) return

    let nextWidth = property === 'colliderWidth' ? parsed : prevWidth
    let nextHeight = property === 'colliderHeight' ? parsed : prevHeight
    if (selected.colliderShape === 'circle') {
      nextWidth = nextHeight = parsed
    }

    if (nextWidth === prevWidth && nextHeight === prevHeight) return

    if (
      this.wouldOverlapAny(
        selected.id,
        selected.x,
        selected.y,
        selected.scaleX,
        selected.scaleY,
        nextWidth,
        nextHeight,
      )
    ) {
      return
    }

    selected.colliderWidth = nextWidth
    selected.colliderHeight = nextHeight

    this.history.push({
      type: 'collider',
      objectId: selected.id,
      prevWidth,
      prevHeight,
      nextWidth,
      nextHeight,
    })

    this.updateObjectVisuals(selected)
    this.updatePropertyPanel()
  }

  private createColliderOutline(
    x: number,
    y: number,
    width: number,
    height: number,
    shape: ColliderShape | undefined,
  ): ColliderOutline {
    const outline =
      shape === 'circle' ? this.add.ellipse(x, y, width, height) : this.add.rectangle(x, y, width, height)
    return outline.setStrokeStyle(2, 0x00e676, 0.9).setFillStyle(0x00e676, 0.12).setDepth(2)
  }

  private updateObjectVisuals(obj: EditorObject): void {
    obj.sprite.setPosition(obj.x, obj.y)
    obj.sprite.setDisplaySize(obj.displayWidth, obj.displayHeight)
    obj.outline.setPosition(obj.x, obj.y)
    obj.outline.setSize(obj.displayWidth + 8, obj.displayHeight + 8)
    if (obj.collisionBox) {
      const collSize = computeEditorColliderSize(
        obj.role,
        obj.scaleX,
        obj.scaleY,
        obj.colliderWidth,
        obj.colliderHeight,
        obj.colliderShape,
      )
      obj.collisionBox.setPosition(obj.x, obj.y)
      obj.collisionBox.setSize(collSize.width, collSize.height)
      obj.collisionBox.setVisible(obj.sprite.visible)
      if (obj.colliderHandle) {
        obj.colliderHandle.setPosition(obj.x + collSize.width / 2, obj.y + collSize.height / 2)
        obj.colliderHandle.setVisible(obj.id === this.selectedId && obj.role !== 'weapon' && obj.sprite.visible)
      }
    }
    obj.scaleHandle.setPosition(
      obj.x + obj.displayWidth / 2,
      obj.y + obj.displayHeight / 2,
    )
    obj.label.setPosition(obj.x, obj.y - obj.displayHeight / 2 - 20)
  }

  public toggleTestEquip(weaponId?: string): void {
    const id = weaponId ?? this.selectedId
    if (!id) return
    const weapon = this.editorObjects.find((o) => o.id === id && o.role === 'weapon')
    if (!weapon) return

    if (this.testEquippedWeaponId === weapon.id) {
      this.testUnequip(weapon.id)
    } else {
      this.testEquip(weapon.id)
    }
  }

  public testEquip(weaponId: string): void {
    const weapon = this.editorObjects.find((o) => o.id === weaponId && o.role === 'weapon')
    if (!weapon) return
    const player = this.editorObjects.find((o) => o.role === 'player')
    if (!player) return

    if (this.testEquippedWeaponId && this.testEquippedWeaponId !== weapon.id) {
      this.testUnequip(this.testEquippedWeaponId)
    }

    if (!this.savedWeaponPositions.has(weapon.id)) {
      this.savedWeaponPositions.set(weapon.id, { x: weapon.x, y: weapon.y })
    }

    this.testEquippedWeaponId = weapon.id
    this.updateEquippedWeaponPosition(weapon, player)
    this.updateTestEquipButtonState()
    this.updatePropertyPanel()
  }

  public testUnequip(weaponId: string): void {
    this.stopTestAttack()
    const weapon = this.editorObjects.find((o) => o.id === weaponId)
    const saved = this.savedWeaponPositions.get(weaponId)
    if (weapon && saved) {
      weapon.x = saved.x
      weapon.y = saved.y
      this.updateObjectVisuals(weapon)
    }
    this.savedWeaponPositions.delete(weaponId)
    if (this.testEquippedWeaponId === weaponId) {
      this.testEquippedWeaponId = null
    }
    this.updateTestEquipButtonState()
    this.updatePropertyPanel()
  }

  public testAttack(weaponId?: string): void {
    const id = weaponId ?? this.selectedId
    if (!id) return
    const weapon = this.editorObjects.find((o) => o.id === id && o.role === 'weapon')
    if (!weapon) return

    if (this.testEquippedWeaponId !== weapon.id) {
      this.testEquip(weapon.id)
    }

    this.stopTestAttack()

    const durationMs = weapon.attackDurationMs ?? GAME_WEAPON_CONFIG.attackDurationMs
    const attackDistance = weapon.attackDistance ?? GAME_WEAPON_CONFIG.attackDistance

    this.testAttackAnimation = {
      weaponId: weapon.id,
      elapsedMs: 0,
      durationMs,
      attackDistance,
    }
  }

  public stopTestAttack(): void {
    if (this.testAttackAnimation) {
      const weapon = this.editorObjects.find((o) => o.id === this.testAttackAnimation?.weaponId)
      this.testAttackAnimation = null
      if (weapon) {
        if (this.testEquippedWeaponId === weapon.id) {
          this.updateEquippedWeaponPosition(weapon)
        } else {
          this.updateObjectVisuals(weapon)
        }
      }
    }
  }

  public updateEquippedWeaponPosition(
    weapon: EditorObject,
    player?: EditorObject,
    attackTranslation = 0,
  ): void {
    const p = player ?? this.editorObjects.find((o) => o.role === 'player')
    if (!p) return
    const holdX = weapon.holdOffsetX ?? GAME_WEAPON_CONFIG.holdOffsetX
    const holdY = weapon.holdOffsetY ?? GAME_WEAPON_CONFIG.holdOffsetY
    weapon.x = p.x + holdX + attackTranslation
    weapon.y = p.y + holdY
    this.updateObjectVisuals(weapon)
  }

  private updateTestEquipButtonState(): void {
    if (!this.testEquipBtn) return
    const selected = this.getSelected()
    const isEquipped = selected && this.testEquippedWeaponId === selected.id
    this.testEquipBtn.setText(isEquipped ? 'TEST UNEQUIP' : 'TEST EQUIP')
    this.testEquipBtn.setBackgroundColor(isEquipped ? '#d84315' : '#00695c')
  }

  private scaleSelected(factor: number): void {
    const selected = this.getSelected()
    if (!selected) return

    const prevScaleX = selected.scaleX
    const prevScaleY = selected.scaleY
    const prevDisplayWidth = selected.displayWidth
    const prevDisplayHeight = selected.displayHeight

    const nextScaleX = selected.scaleX * factor
    const nextScaleY = selected.scaleY * factor
    const nextDisplayWidth = Math.max(16, Math.round(selected.baseWidth * nextScaleX))
    const nextDisplayHeight = Math.max(16, Math.round(selected.baseHeight * nextScaleY))

    if (this.wouldOverlapAny(selected.id, selected.x, selected.y, nextScaleX, nextScaleY)) {
      return
    }

    selected.scaleX = nextScaleX
    selected.scaleY = nextScaleY
    selected.displayWidth = nextDisplayWidth
    selected.displayHeight = nextDisplayHeight

    this.history.push({
      type: 'scale',
      objectId: selected.id,
      factor,
      prevScaleX,
      prevScaleY,
      prevDisplayWidth,
      prevDisplayHeight,
      nextScaleX: selected.scaleX,
      nextScaleY: selected.scaleY,
      nextDisplayWidth: selected.displayWidth,
      nextDisplayHeight: selected.displayHeight,
    })

    this.updateObjectVisuals(selected)
    this.updatePropertyPanel()
  }

  private nudgeSelected(dx: number, dy: number): void {
    const selected = this.getSelected()
    if (!selected) return

    if (this.testEquippedWeaponId === selected.id) {
      this.testUnequip(selected.id)
    }

    const prevX = selected.x
    const prevY = selected.y
    const nextX = snap(selected.x + dx)
    const nextY = snap(selected.y + dy)
    if (this.wouldOverlapAny(selected.id, nextX, nextY)) {
      return
    }
    const actualDx = nextX - prevX
    const actualDy = nextY - prevY

    if (actualDx === 0 && actualDy === 0) return

    selected.x = nextX
    selected.y = nextY

    this.history.push({
      type: 'move',
      objectId: selected.id,
      dx: actualDx,
      dy: actualDy,
      prevX,
      prevY,
      nextX,
      nextY,
    })

    this.updateObjectVisuals(selected)
    if (selected.role === 'player' && this.testEquippedWeaponId) {
      const weapon = this.editorObjects.find((o) => o.id === this.testEquippedWeaponId)
      if (weapon) {
        this.updateEquippedWeaponPosition(weapon, selected)
      }
    }
    this.updatePropertyPanel()
  }

  // --- Input Handlers ---

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const worldX = pointer.worldX
    const worldY = pointer.worldY

    // Check if clicking inside the bottom control panel
    if (
      this.panelContainer?.visible &&
      worldX >= PANEL_X &&
      worldX <= PANEL_X + PANEL_WIDTH &&
      worldY >= PANEL_Y &&
      worldY <= PANEL_Y + PANEL_HEIGHT
    ) {
      return
    }

    // Check if clicking the scale handle of the selected object
    const selected = this.getSelected()
    if (selected && selected.scaleHandle.visible) {
      const hx = selected.x + selected.displayWidth / 2
      const hy = selected.y + selected.displayHeight / 2
      if (
        Math.abs(worldX - hx) <= HANDLE_SIZE &&
        Math.abs(worldY - hy) <= HANDLE_SIZE
      ) {
        this.isDraggingScaleHandle = true
        this.scaleStartWidth = selected.displayWidth
        this.scaleStartHeight = selected.displayHeight
        this.scaleStartScaleX = selected.scaleX
        this.scaleStartScaleY = selected.scaleY
        this.scaleStartPointerX = worldX
        this.scaleStartPointerY = worldY
        return
      }
    }

    // Check if clicking the collider handle of the selected object
    if (selected && selected.colliderHandle && selected.colliderHandle.visible) {
      const collSize = computeCollisionSize(
        selected.role,
        selected.scaleX,
        selected.scaleY,
        selected.colliderWidth,
        selected.colliderHeight,
      )
      const chx = selected.x + collSize.width / 2
      const chy = selected.y + collSize.height / 2
      if (
        Math.abs(worldX - chx) <= HANDLE_SIZE &&
        Math.abs(worldY - chy) <= HANDLE_SIZE
      ) {
        this.isDraggingColliderHandle = true
        this.colliderStartWidth = collSize.width
        this.colliderStartHeight = collSize.height
        this.colliderStartPointerX = worldX
        this.colliderStartPointerY = worldY
        return
      }
    }

    // Check if clicking on an object sprite
    for (let i = this.editorObjects.length - 1; i >= 0; i--) {
      const obj = this.editorObjects[i]
      const halfW = obj.displayWidth / 2
      const halfH = obj.displayHeight / 2
      if (
        worldX >= obj.x - halfW &&
        worldX <= obj.x + halfW &&
        worldY >= obj.y - halfH &&
        worldY <= obj.y + halfH
      ) {
        this.selectObject(obj.id)
        this.isDraggingObject = true
        this.dragStartX = worldX
        this.dragStartY = worldY
        this.dragObjStartX = obj.x
        this.dragObjStartY = obj.y
        return
      }
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isDraggingObject) {
      const selected = this.getSelected()
      if (!selected) return
      if (this.testEquippedWeaponId === selected.id) {
        this.testUnequip(selected.id)
        this.dragObjStartX = selected.x
        this.dragObjStartY = selected.y
      }
      const dx = pointer.worldX - this.dragStartX
      const dy = pointer.worldY - this.dragStartY
      const targetX = snap(this.dragObjStartX + dx)
      const targetY = snap(this.dragObjStartY + dy)

      if (selected.role === 'weapon') {
        selected.x = targetX
        selected.y = targetY
      } else {
        if (!this.wouldOverlapAny(selected.id, targetX, targetY)) {
          selected.x = targetX
          selected.y = targetY
        } else {
          if (!this.wouldOverlapAny(selected.id, targetX, selected.y)) {
            selected.x = targetX
          }
          if (!this.wouldOverlapAny(selected.id, selected.x, targetY)) {
            selected.y = targetY
          }
        }
      }

      this.updateObjectVisuals(selected)
      if (selected.role === 'player' && this.testEquippedWeaponId) {
        const weapon = this.editorObjects.find((o) => o.id === this.testEquippedWeaponId)
        if (weapon) {
          this.updateEquippedWeaponPosition(weapon, selected)
        }
      }
      this.updatePropertyPanel()
    }

    if (this.isDraggingScaleHandle) {
      const selected = this.getSelected()
      if (!selected) return
      const dx = pointer.worldX - this.scaleStartPointerX
      const dy = pointer.worldY - this.scaleStartPointerY
      // Use the larger axis delta to scale uniformly
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
      const scaleFactor = 1 + delta / 200
      const candDisplayW = Math.max(16, Math.round(this.scaleStartWidth * scaleFactor))
      const candDisplayH = Math.max(16, Math.round(this.scaleStartHeight * scaleFactor))
      const candScaleX = candDisplayW / selected.baseWidth
      const candScaleY = candDisplayH / selected.baseHeight

      if (this.wouldOverlapAny(selected.id, selected.x, selected.y, candScaleX, candScaleY)) {
        return
      }

      selected.displayWidth = candDisplayW
      selected.displayHeight = candDisplayH
      selected.scaleX = candScaleX
      selected.scaleY = candScaleY
      this.updateObjectVisuals(selected)
      this.updatePropertyPanel()
    }

    if (this.isDraggingColliderHandle) {
      const selected = this.getSelected()
      if (!selected) return
      const dx = (pointer.worldX - this.colliderStartPointerX) * 2
      const dy = (pointer.worldY - this.colliderStartPointerY) * 2
      let candW = Math.max(16, snap(this.colliderStartWidth + dx))
      let candH = Math.max(16, snap(this.colliderStartHeight + dy))
      if (selected.colliderShape === 'circle') {
        // Drag the diameter by whichever way the pointer moved further.
        candW = candH = Math.abs(dx) >= Math.abs(dy) ? candW : candH
      }

      if (
        !this.wouldOverlapAny(
          selected.id,
          selected.x,
          selected.y,
          selected.scaleX,
          selected.scaleY,
          candW,
          candH,
        )
      ) {
        selected.colliderWidth = candW
        selected.colliderHeight = candH
        this.updateObjectVisuals(selected)
        this.updatePropertyPanel()
      }
    }
  }

  private onPointerUp(): void {
    if (this.isDraggingObject) {
      const selected = this.getSelected()
      if (selected) {
        const dx = selected.x - this.dragObjStartX
        const dy = selected.y - this.dragObjStartY
        if (dx !== 0 || dy !== 0) {
          this.history.push({
            type: 'move',
            objectId: selected.id,
            dx,
            dy,
            prevX: this.dragObjStartX,
            prevY: this.dragObjStartY,
            nextX: selected.x,
            nextY: selected.y,
          })
        }
      }
      this.isDraggingObject = false
    }

    if (this.isDraggingScaleHandle) {
      const selected = this.getSelected()
      if (
        selected &&
        (selected.displayWidth !== this.scaleStartWidth ||
          selected.displayHeight !== this.scaleStartHeight)
      ) {
        const factor =
          this.scaleStartWidth !== 0 ? selected.displayWidth / this.scaleStartWidth : 1
        this.history.push({
          type: 'scale',
          objectId: selected.id,
          factor,
          prevScaleX: this.scaleStartScaleX,
          prevScaleY: this.scaleStartScaleY,
          prevDisplayWidth: this.scaleStartWidth,
          prevDisplayHeight: this.scaleStartHeight,
          nextScaleX: selected.scaleX,
          nextScaleY: selected.scaleY,
          nextDisplayWidth: selected.displayWidth,
          nextDisplayHeight: selected.displayHeight,
        })
      }
      this.isDraggingScaleHandle = false
    }

    if (this.isDraggingColliderHandle) {
      const selected = this.getSelected()
      if (
        selected &&
        ((selected.colliderWidth ?? this.colliderStartWidth) !== this.colliderStartWidth ||
          (selected.colliderHeight ?? this.colliderStartHeight) !== this.colliderStartHeight)
      ) {
        this.history.push({
          type: 'collider',
          objectId: selected.id,
          prevWidth: this.colliderStartWidth,
          prevHeight: this.colliderStartHeight,
          nextWidth: selected.colliderWidth ?? this.colliderStartWidth,
          nextHeight: selected.colliderHeight ?? this.colliderStartHeight,
        })
      }
      this.isDraggingColliderHandle = false
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      this.undo()
      return
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key === 'PageUp') {
        event.preventDefault()
        this.selectPreviousRoom()
        return
      }
      if (event.key === 'PageDown') {
        event.preventDefault()
        this.selectNextRoom()
        return
      }
      if (event.key === 'p' || event.key === 'P') {
        event.preventDefault()
        this.togglePanel()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (this.selectedId && this.selectedId !== WORLD_OBJECT_IDS.player) {
          event.preventDefault()
          this.despawnWorldObject(this.selectedId)
          return
        }
      }
    }

    const selected = this.getSelected()
    if (!selected) return

    if (event.key === ' ' && selected.role === 'weapon') {
      event.preventDefault()
      this.testAttack()
      return
    }

    const step = event.shiftKey ? 10 : 1

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        this.nudgeSelected(-step, 0)
        return
      case 'ArrowRight':
        event.preventDefault()
        this.nudgeSelected(step, 0)
        return
      case 'ArrowUp':
        event.preventDefault()
        this.nudgeSelected(0, -step)
        return
      case 'ArrowDown':
        event.preventDefault()
        this.nudgeSelected(0, step)
        return
      case '+':
      case '=':
        this.scaleSelected(1.05)
        return
      case '-':
      case '_':
        this.scaleSelected(1 / 1.05)
        return
      case '[':
        this.scaleSelectedCollider(1 / 1.05)
        return
      case ']':
        this.scaleSelectedCollider(1.05)
        return
      case 'Tab':
        event.preventDefault()
        this.cycleSelection(event.shiftKey ? -1 : 1)
        return
      default:
        return
    }
  }

  private togglePanel(): void {
    if (!this.panelContainer || !this.exportButton) return
    const isVisible = !this.panelContainer.visible
    this.panelContainer.setVisible(isVisible)
    this.exportButton.setVisible(isVisible)
    this.playButton?.setVisible(isVisible)
  }

  private undo(): void {
    const reversed = this.history.undo((id) => this.editorObjects.find((o) => o.id === id))
    if (!reversed) return

    if (reversed.type === 'despawn') {
      this.despawnWorldObject(reversed.objectId, false)
      return
    }

    if (reversed.type === 'spawn') {
      this.spawnWorldObject(
        reversed.role,
        {
          id: reversed.objectId,
          name: reversed.snapshot.name,
          kind: reversed.snapshot.kind,
          passive: reversed.snapshot.passive,
          x: reversed.snapshot.x,
          y: reversed.snapshot.y,
          displayWidth: reversed.snapshot.displayWidth,
          displayHeight: reversed.snapshot.displayHeight,
          scaleX: reversed.snapshot.scaleX,
          scaleY: reversed.snapshot.scaleY,
          colliderWidth: reversed.snapshot.colliderWidth,
          colliderHeight: reversed.snapshot.colliderHeight,
          colliderShape: reversed.snapshot.colliderShape,
          speed: reversed.snapshot.speed,
          maxHealth: reversed.snapshot.maxHealth,
          attackDistance: reversed.snapshot.attackDistance,
          attackDurationMs: reversed.snapshot.attackDurationMs,
          holdOffsetX: reversed.snapshot.holdOffsetX,
          holdOffsetY: reversed.snapshot.holdOffsetY,
          ...this.physicsAttrFields(reversed.snapshot),
        },
        false,
      )
      this.selectObject(reversed.objectId)
      return
    }

    this.selectObject(reversed.objectId)
    const obj = this.getSelected()
    if (obj) {
      this.updateObjectVisuals(obj)
    }
    this.updatePropertyPanel()
  }

  private cycleSelection(direction: number): void {
    if (this.editorObjects.length === 0) return
    const currentIndex = this.editorObjects.findIndex((obj) => obj.id === this.selectedId)
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + this.editorObjects.length) % this.editorObjects.length
    this.selectObject(this.editorObjects[nextIndex].id)
  }

  public getCurrentRoomId(): string {
    return this.currentRoomId
  }

  public selectRoom(roomId: string): void {
    const isInitial = this.editorObjects.length === 0
    if (this.currentRoomId === roomId && !isInitial) {
      return
    }

    if (this.editorObjects.length > 0) {
      this.syncCurrentRoomObjects()
    }

    this.currentRoomId = roomId

    if (this.testEquippedWeaponId) {
      this.testUnequip(this.testEquippedWeaponId)
    }
    this.testEquippedWeaponId = null
    this.savedWeaponPositions.clear()
    this.testAttackAnimation = null

    for (const obj of this.editorObjects) {
      obj.sprite.destroy()
      obj.outline.destroy()
      obj.collisionBox?.destroy()
      obj.colliderHandle?.destroy()
      obj.scaleHandle.destroy()
      obj.label.destroy()
    }
    this.editorObjects = []
    this.selectedId = null
    this.history.clear()

    this.updateHeaderAndSelector()
    this.drawRoomGeometry(roomId)
    this.loadRoomObjects(roomId)
    this.refreshObjectList()

    if (this.editorObjects.length > 0) {
      this.selectObject(this.editorObjects[0].id)
    } else {
      this.updatePropertyPanel()
    }

    this.updateSaveButton()
  }

  public selectPreviousRoom(): void {
    this.selectRoom(getPreviousRoomId(this.currentRoomId))
  }

  public selectNextRoom(): void {
    this.selectRoom(getNextRoomId(this.currentRoomId))
  }

  private updateHeaderAndSelector(): void {
    if (this.headerText) {
      this.headerText.setText('LEVEL EDITOR — ' + this.currentRoomId)
    }
    const def = getRoomDefinition(this.currentRoomId)
    if (this.roomGoalText) {
      const goal = def?.goal ?? ''
      this.roomGoalText.setText(goal ? 'GOAL: ' + goal : '')
    }
    for (const [id, btn] of this.roomSelectorButtons.entries()) {
      const isSelected = id === this.currentRoomId
      btn.setBackgroundColor(isSelected ? '#0288d1' : '#263238')
      btn.setColor(isSelected ? '#ffffff' : '#90a4ae')
    }
  }

  private drawRoomGeometry(roomId: string): void {
    const def = getRoomDefinition(roomId)

    // Divider: visible only in room1 and tutorial4
    const showDivider = roomId === ROOM_IDS.first || roomId === TUTORIAL_ROOM_IDS.slowTime
    this.roomDivider?.setVisible(showDivider)

    // Walls
    if (this.wallGraphics) {
      this.wallGraphics.clear()
      if (def?.walls && def.walls.length > 0) {
        for (const wall of def.walls) {
          const left = wall.x - wall.width / 2
          const top = wall.y - wall.height / 2
          this.wallGraphics.fillStyle(0x1b2529, 1).fillRect(left - 3, top - 3, wall.width + 6, wall.height + 6)
          this.wallGraphics.fillStyle(0x3a4c53, 1).fillRect(left, top, wall.width, wall.height)
          this.wallGraphics.fillStyle(0x56707a, 1).fillRect(left, top, wall.width, Math.min(8, wall.height))
          this.wallGraphics.fillStyle(0x2b3a40, 1)
          for (let row = top + 24; row < top + wall.height - 4; row += 24) {
            this.wallGraphics.fillRect(left, row, wall.width, 3)
            const offset = ((row - top) / 24) % 2 === 0 ? 0 : 24
            for (let column = left + 24 + offset; column < left + wall.width - 4; column += 48) {
              this.wallGraphics.fillRect(column, row - 21, 3, 21)
            }
          }
        }
      }
    }

    // Door Label
    const exit = def?.exit
    const doorLabelText = exit?.label || exit?.targetRoomId || 'exit'
    this.doorLabel?.setText(doorLabelText)
  }

  private loadRoomObjects(roomId: string): void {
    const configs = getRoomObjectConfigs(roomId)
    const worldObjects = createRoomObjects(configs, roomId)
    for (const worldObject of worldObjects) {
      if (worldObject.metadata.hidden || worldObject.metadata.kind === 'arrow') {
        continue
      }
      this.createEditorObject(worldObject)
    }
  }

  private updateSaveButton(): void {
    if (!this.exportButton) return
    const label = this.exportButton.getAt(1) as Phaser.GameObjects.Text | undefined
    if (this.currentRoomId === ROOM_IDS.first) {
      this.section5Desc?.setText('Overwrite room1.ts directly:')
      label?.setText('SAVE TO ROOM1.TS')
    } else {
      this.section5Desc?.setText(`Apply edits to ${this.currentRoomId}:`)
      label?.setText(`SAVE ${this.currentRoomId.toUpperCase()}`)
    }
    const playLabel = this.playButton?.getAt(1) as Phaser.GameObjects.Text | undefined
    playLabel?.setText(`PLAY ${this.currentRoomId.toUpperCase()} (F2)`)
  }

  public syncCurrentRoomObjects(): RoomObjectConfig[] {
    const objects: RoomObjectConfig[] = this.editorObjects.map((obj) => {
      let speed: number | PlayerSpeedConfig | undefined = undefined
      if (obj.role === 'player') {
        const maxSpeed =
          obj.maxSpeed ??
          (typeof obj.speed === 'object' && obj.speed !== null
            ? obj.speed.maxSpeed
            : typeof obj.speed === 'number'
              ? obj.speed
              : 300)
        const acceleration =
          obj.acceleration ??
          (typeof obj.speed === 'object' && obj.speed !== null
            ? obj.speed.acceleration
            : 2500)
        const frictionAcceleration =
          obj.frictionAcceleration ??
          (typeof obj.speed === 'object' && obj.speed !== null
            ? obj.speed.frictionAcceleration
            : 3000)
        const turnaroundAcceleration =
          obj.turnaroundAcceleration ??
          (typeof obj.speed === 'object' && obj.speed !== null
            ? obj.speed.turnaroundAcceleration
            : 1600)
        speed = {
          acceleration,
          frictionAcceleration,
          turnaroundAcceleration,
          maxSpeed,
        }
      } else if (obj.role === 'guard' || obj.role === 'enemy') {
        speed = typeof obj.speed === 'number' ? obj.speed : (obj.maxSpeed ?? 210)
      }

      const savedPos = this.savedWeaponPositions.get(obj.id)
      const posX = savedPos ? savedPos.x : obj.x
      const posY = savedPos ? savedPos.y : obj.y

      return {
        id: obj.id,
        role: obj.role,
        ...(obj.name ? { name: obj.name } : {}),
        ...(obj.kind ? { kind: obj.kind } : {}),
        ...(obj.passive !== undefined ? { passive: obj.passive } : {}),
        x: Math.round(posX),
        y: Math.round(posY),
        displayWidth: Math.round(obj.displayWidth),
        displayHeight: Math.round(obj.displayHeight),
        scaleX: Number(obj.scaleX.toFixed(2)),
        scaleY: Number(obj.scaleY.toFixed(2)),
        ...(speed !== undefined ? { speed } : {}),
        ...(obj.maxHealth !== undefined ? { maxHealth: obj.maxHealth } : {}),
        ...(obj.attackDistance !== undefined ? { attackDistance: obj.attackDistance } : {}),
        ...(obj.attackDurationMs !== undefined ? { attackDurationMs: obj.attackDurationMs } : {}),
        ...(obj.holdOffsetX !== undefined ? { holdOffsetX: obj.holdOffsetX } : {}),
        ...(obj.holdOffsetY !== undefined ? { holdOffsetY: obj.holdOffsetY } : {}),
        ...(obj.colliderWidth !== undefined ? { colliderWidth: Math.round(obj.colliderWidth) } : {}),
        ...(obj.colliderHeight !== undefined ? { colliderHeight: Math.round(obj.colliderHeight) } : {}),
        ...(obj.colliderShape === 'circle' ? { colliderShape: obj.colliderShape } : {}),
        ...this.physicsAttrFields(obj),
      }
    })

    setRoomObjectConfigs(this.currentRoomId, objects)
    return objects
  }

  public syncToRoom1Objects(): RoomObjectConfig[] {
    return this.syncCurrentRoomObjects()
  }

  public returnToGame(): void {
    this.syncCurrentRoomObjects()
    const sceneManager = SceneManager.get(this.game)
    if (sceneManager) {
      sceneManager.exitEditor({ startingRoomId: this.currentRoomId })
    } else {
      this.scene.start('game', { startingRoomId: this.currentRoomId })
    }
  }

  public openSpeedEditor(): void {
    const sceneManager = SceneManager.get(this.game)
    if (sceneManager) {
      sceneManager.openEditor('speed-editor')
    } else {
      this.syncToRoom1Objects()
      this.scene.start('speed-editor')
    }
  }

  public openAiEditor(): void {
    const sceneManager = SceneManager.get(this.game)
    if (sceneManager) {
      sceneManager.openEditor('behavior-tree-editor')
    } else {
      this.syncToRoom1Objects()
      this.scene.start('behavior-tree-editor')
    }
  }

  public async saveLayout(): Promise<boolean> {
    const objects = this.syncCurrentRoomObjects()
    const roomId = this.currentRoomId
    const bg = this.exportButton?.getAt(0) as Phaser.GameObjects.Rectangle | undefined
    const label = this.exportButton?.getAt(1) as Phaser.GameObjects.Text | undefined

    if (roomId === ROOM_IDS.first) {
      const source = generateRoom1Source(objects)
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
          throw new Error(result.error ?? 'Unknown error writing file')
        }

        console.log(
          '%c Overwrote room1.ts directly ',
          'background: #2e7d32; color: #fff; font-size: 14px; padding: 4px 8px; border-radius: 4px',
        )
        console.log(source)

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
        console.error('Failed to overwrite room1.ts directly:', err)
        console.log('Generated room1.ts source fallback:\n' + source)

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
    } else {
      console.log(`Saved ${roomId} layout to memory:`, objects)
      if (bg && label) {
        bg.setFillStyle(0x66bb6a, 1)
        label.setText(`SAVED ${roomId.toUpperCase()}!`)
        this.time.delayedCall(1500, () => {
          bg.setFillStyle(0x2e7d32, 1)
          label.setText(`SAVE ${roomId.toUpperCase()}`)
        })
      }
      return true
    }
  }

  public exportLayout(): Promise<boolean> {
    return this.saveLayout()
  }

  public spawnWorldObject(
    role: WorldObjectRole = 'enemy',
    config: SpawnObjectConfig = {},
    recordHistory = true,
  ): EditorObject {
    const id = config.id ?? this.generateNextId(role, config.kind ?? (role === 'object' && config.colliderShape === 'circle' ? 'boulder' : undefined))

    const existingIndex = this.editorObjects.findIndex((o) => o.id === id)
    if (existingIndex !== -1) {
      const existing = this.editorObjects[existingIndex]
      if (config.name !== undefined) existing.name = config.name
      if (config.kind !== undefined) existing.kind = config.kind
      if (config.passive !== undefined) existing.passive = config.passive
      if (config.x !== undefined) existing.x = config.x
      if (config.y !== undefined) existing.y = config.y
      if (config.displayWidth !== undefined) existing.displayWidth = config.displayWidth
      if (config.displayHeight !== undefined) existing.displayHeight = config.displayHeight
      if (config.scaleX !== undefined) {
        existing.scaleX = config.scaleX
        existing.baseWidth = existing.scaleX !== 0 ? existing.displayWidth / existing.scaleX : existing.baseWidth
      } else if (config.displayWidth !== undefined) {
        existing.scaleX = existing.displayWidth / existing.baseWidth
      }
      if (config.scaleY !== undefined) {
        existing.scaleY = config.scaleY
        existing.baseHeight = existing.scaleY !== 0 ? existing.displayHeight / existing.scaleY : existing.baseHeight
      } else if (config.displayHeight !== undefined) {
        existing.scaleY = existing.displayHeight / existing.baseHeight
      }
      if (config.colliderWidth !== undefined) existing.colliderWidth = config.colliderWidth
      if (config.colliderHeight !== undefined) existing.colliderHeight = config.colliderHeight
      if (config.maxHealth !== undefined) existing.maxHealth = config.maxHealth
      if (config.speed !== undefined) existing.speed = config.speed
      Object.assign(existing, this.physicsAttrFields(config))
      if (config.attackDistance !== undefined) existing.attackDistance = config.attackDistance
      if (config.attackDurationMs !== undefined) existing.attackDurationMs = config.attackDurationMs
      if (config.holdOffsetX !== undefined) existing.holdOffsetX = config.holdOffsetX
      if (config.holdOffsetY !== undefined) existing.holdOffsetY = config.holdOffsetY
      this.updateObjectVisuals(existing)
      this.selectObject(id)
      return existing
    }

    const isCrate = config.kind === 'crate'
    const isPlate = config.kind === 'plate'
    const isBoulder = role === 'object' && !isCrate && !isPlate
    const textureKey =
      config.kind && (KIND_TEXTURES as any)[config.kind]
        ? (KIND_TEXTURES as any)[config.kind]
        : this.textureKeyForRole(role)
    const isWeapon = role === 'weapon'
    const isCharacter = role === 'player' || role === 'guard' || role === 'enemy'
    const defaultBaseWidth = isWeapon
      ? DAGGER_SIZE.width
      : isCrate
        ? 88
        : isPlate
          ? 96
          : isBoulder
            ? BOULDER_BASE_SIZE.width
            : CHARACTER_BASE_SIZE.width
    const defaultBaseHeight = isWeapon
      ? DAGGER_SIZE.height
      : isCrate
        ? 88
        : isPlate
          ? 96
          : isBoulder
            ? BOULDER_BASE_SIZE.height
            : CHARACTER_BASE_SIZE.height

    const displayWidth = config.displayWidth ?? (isBoulder ? 154 : defaultBaseWidth)
    const displayHeight = config.displayHeight ?? (isBoulder ? 154 : defaultBaseHeight)

    const scaleX = config.scaleX ?? (displayWidth / defaultBaseWidth)
    const scaleY = config.scaleY ?? (displayHeight / defaultBaseHeight)

    const baseWidth = scaleX !== 0 ? displayWidth / scaleX : defaultBaseWidth
    const baseHeight = scaleY !== 0 ? displayHeight / scaleY : defaultBaseHeight
    const maxHealth =
      config.maxHealth !== undefined
        ? config.maxHealth
        : isCharacter
          ? 100
          : undefined
    const speed =
      config.speed !== undefined
        ? config.speed
        : isCharacter
          ? (role === 'guard' || role === 'enemy'
              ? 120
              : { acceleration: 800, frictionAcceleration: 1200, turnaroundAcceleration: 1600, maxSpeed: 240 })
          : undefined
    const speedConfig = typeof speed === 'object' && speed !== null ? speed : undefined
    const maxSpeed = speedConfig?.maxSpeed ?? (typeof speed === 'number' ? speed : undefined)
    const acceleration = speedConfig?.acceleration
    const frictionAcceleration = speedConfig?.frictionAcceleration
    const turnaroundAcceleration = speedConfig?.turnaroundAcceleration
    const spawnAttackDistance = config.attackDistance ?? (isWeapon ? GAME_WEAPON_CONFIG.attackDistance : undefined)
    const spawnAttackDurationMs = config.attackDurationMs ?? (isWeapon ? GAME_WEAPON_CONFIG.attackDurationMs : undefined)
    const spawnHoldOffsetX = config.holdOffsetX ?? (isWeapon ? GAME_WEAPON_CONFIG.holdOffsetX : undefined)
    const spawnHoldOffsetY = config.holdOffsetY ?? (isWeapon ? GAME_WEAPON_CONFIG.holdOffsetY : undefined)

    const defaultX = 960 + (this.editorObjects.length % 5) * 40 - 80
    const defaultY = 380 + (this.editorObjects.length % 5) * 30 - 60
    let x = config.x !== undefined ? config.x : defaultX
    let y = config.y !== undefined ? config.y : defaultY

    const colliderShape = config.colliderShape ?? (isBoulder ? 'circle' : 'box')
    const colliderWidth = config.colliderWidth ?? (isCrate ? 80 : isPlate ? 80 : isBoulder ? 128 : undefined)
    const colliderHeight = config.colliderHeight ?? (isCrate ? 80 : isPlate ? 80 : isBoulder ? 128 : undefined)

    {
      let offset = 0
      while (offset < 800) {
        const collides = wouldOverlapAnyEditorObject(
          '',
          role,
          x,
          y,
          scaleX,
          scaleY,
          this.editorObjects,
          colliderWidth,
          colliderHeight,
          colliderShape,
          config.kind,
        )
        if (!collides) break
        offset += 60
        x = (config.x !== undefined ? config.x : defaultX) + offset
        y = (config.y !== undefined ? config.y : defaultY) + (offset % 120)
      }
    }

    const sprite = this.add.image(x, y, textureKey).setDepth(config.kind === 'plate' ? 2 : 3)
    sprite.setDisplaySize(displayWidth, displayHeight)
    sprite.setAlpha(0.9)

    // Selection outline
    const outline = this.add
      .rectangle(x, y, displayWidth + 8, displayHeight + 8)
      .setStrokeStyle(3, SELECTED_OUTLINE, 1)
      .setFillStyle(SELECTED_OUTLINE, 0.08)
      .setDepth(2)
      .setVisible(false)

    // Collision box (added for all world objects besides weapon)
    let collisionBox: ColliderOutline | undefined
    let colliderHandle: Phaser.GameObjects.Rectangle | undefined
    if (role !== 'weapon') {
      const collSize = computeEditorColliderSize(role, scaleX, scaleY, colliderWidth, colliderHeight, colliderShape)
      collisionBox = this.createColliderOutline(x, y, collSize.width, collSize.height, colliderShape)

      colliderHandle = this.add
        .rectangle(
          x + collSize.width / 2,
          y + collSize.height / 2,
          HANDLE_SIZE,
          HANDLE_SIZE,
          0x00e676,
          1,
        )
        .setDepth(5)
        .setVisible(false)
    }

    // Scale handle (bottom-right corner)
    const scaleHandle = this.add
      .rectangle(
        x + displayWidth / 2,
        y + displayHeight / 2,
        HANDLE_SIZE,
        HANDLE_SIZE,
        HANDLE_COLOR,
        1,
      )
      .setDepth(5)
      .setVisible(false)

    // Object label
    const label = this.add
      .text(x, y - displayHeight / 2 - 20, id, {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5, 1)
      .setDepth(4)

    const editorObject: EditorObject = {
      id,
      name: config.name,
      kind: config.kind,
      passive: config.passive,
      role,
      sprite,
      outline,
      collisionBox,
      colliderHandle,
      scaleHandle,
      label,
      x,
      y,
      displayWidth,
      displayHeight,
      baseWidth,
      baseHeight,
      scaleX,
      scaleY,
      colliderWidth: role !== 'weapon' ? (colliderWidth ?? computeCollisionSize(role, scaleX, scaleY).width) : undefined,
      colliderHeight: role !== 'weapon' ? (colliderHeight ?? computeCollisionSize(role, scaleX, scaleY).height) : undefined,
      ...(colliderShape ? { colliderShape } : {}),
      maxHealth,
      speed,
      maxSpeed,
      acceleration,
      frictionAcceleration,
      turnaroundAcceleration,
      attackDistance: spawnAttackDistance,
      attackDurationMs: spawnAttackDurationMs,
      holdOffsetX: spawnHoldOffsetX,
      holdOffsetY: spawnHoldOffsetY,
      ...this.physicsAttrFields(config),
    }

    this.editorObjects.push(editorObject)

    if (recordHistory) {
      this.history.push({
        type: 'spawn',
        objectId: id,
        role,
        snapshot: this.createSnapshot(editorObject),
      })
    }

    this.refreshObjectList()
    this.selectObject(id)
    return editorObject
  }

  public despawnWorldObject(id: string, recordHistory = true): boolean {
    if (id === WORLD_OBJECT_IDS.player) {
      return false
    }

    if (this.testEquippedWeaponId === id) {
      this.testUnequip(id)
    }

    const index = this.editorObjects.findIndex((obj) => obj.id === id)
    if (index === -1) return false

    const obj = this.editorObjects[index]
    if (recordHistory) {
      this.history.push({
        type: 'despawn',
        objectId: obj.id,
        role: obj.role,
        snapshot: this.createSnapshot(obj),
      })
    }

    obj.sprite.destroy()
    obj.outline.destroy()
    obj.collisionBox?.destroy()
    obj.colliderHandle?.destroy()
    obj.scaleHandle.destroy()
    obj.label.destroy()

    this.editorObjects.splice(index, 1)

    if (this.selectedId === id) {
      const nextObj = this.editorObjects[Math.max(0, index - 1)]
      if (nextObj) {
        this.selectObject(nextObj.id)
      } else {
        this.selectedId = null
        this.updatePropertyPanel()
      }
    }

    this.refreshObjectList()
    return true
  }

  private refreshObjectList(): void {
    if (!this.panelContainer) return

    for (const btn of this.objectListButtons) {
      this.panelContainer.remove(btn)
      btn.destroy()
    }
    this.objectListButtons = []

    const count = this.editorObjects.length
    const twoColumns = count > 4
    const startY = 74
    const rowHeight = twoColumns ? 26 : 28

    for (let i = 0; i < count; i++) {
      const obj = this.editorObjects[i]
      const col = twoColumns ? i % 2 : 0
      const row = twoColumns ? Math.floor(i / 2) : i
      const x = twoColumns ? (col === 0 ? 75 : 205) : 140
      const y = startY + row * rowHeight

      const displayLabel = obj.id.length > 10 ? obj.id.substring(0, 9) + '…' : obj.id.toUpperCase()
      const isSelected = obj.id === this.selectedId

      const btn = this.add
        .text(x, y, displayLabel, {
          fontFamily: FONT_FAMILY,
          fontSize: twoColumns ? 10 : 12,
          color: isSelected ? ACCENT_COLOR : TEXT_COLOR,
          backgroundColor: '#2a2a2a',
          padding: { x: twoColumns ? 6 : 10, y: 3 },
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })

      btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.()
        this.selectObject(obj.id)
      })

      this.panelContainer.add(btn)
      this.objectListButtons.push(btn)
      this.panelFields.set(`btn_${obj.id}`, btn)
    }

    this.updateDeleteButtonVisibility()
  }

  private updateDeleteButtonVisibility(): void {
    if (!this.deleteButton) return
    const canDelete = this.selectedId !== null && this.selectedId !== WORLD_OBJECT_IDS.player
    this.deleteButton.setVisible(canDelete)
  }

  private createSnapshot(obj: EditorObject): ScalableMovableObject {
    const savedPos = this.savedWeaponPositions.get(obj.id)
    return {
      id: obj.id,
      name: obj.name,
      kind: obj.kind,
      passive: obj.passive,
      x: savedPos ? savedPos.x : obj.x,
      y: savedPos ? savedPos.y : obj.y,
      displayWidth: obj.displayWidth,
      displayHeight: obj.displayHeight,
      baseWidth: obj.baseWidth,
      baseHeight: obj.baseHeight,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      colliderWidth: obj.colliderWidth,
      colliderHeight: obj.colliderHeight,
      colliderShape: obj.colliderShape,
      speed: obj.speed,
      maxHealth: obj.maxHealth,
      attackDistance: obj.attackDistance,
      attackDurationMs: obj.attackDurationMs,
      holdOffsetX: obj.holdOffsetX,
      holdOffsetY: obj.holdOffsetY,
      ...this.physicsAttrFields(obj),
    }
  }

  public generateNextId(role: WorldObjectRole, customPrefix?: string): string {
    return generateNextObjectId(role, this.editorObjects, customPrefix)
  }

  private textureKeyForRole(role: WorldObjectRole): string {
    switch (role) {
      case 'player':
        return PLAYER_TEXTURE_KEY
      case 'enemy':
      case 'guard':
        return GUARD_TEXTURE_KEY
      case 'weapon':
        return DAGGER_TEXTURE_KEY
      case 'object':
        return BOULDER_TEXTURE_KEY
    }
  }

  private textureKeyFor(worldObject: WorldObject): string | undefined {
    const kind = worldObject.metadata.kind
    if (typeof kind === 'string' && (this.textures.exists(kind) || KIND_TEXTURES[kind])) {
      return KIND_TEXTURES[kind] ?? kind
    }
    if (worldObject.id === WORLD_OBJECT_IDS.boulder || worldObject.id === 'boulder' || worldObject.id.includes('boulder')) {
      return BOULDER_TEXTURE_KEY
    }
    const rawRole = worldObject.metadata.role
    const role: WorldObjectRole | undefined =
      rawRole === 'weapon'
        ? 'weapon'
        : rawRole === 'enemy' || rawRole === 'guard'
          ? 'enemy'
          : rawRole === 'object'
            ? 'object'
            : rawRole === 'player'
              ? 'player'
              : undefined
    return role ? this.textureKeyForRole(role) : undefined
  }
}

function snap(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP
}
