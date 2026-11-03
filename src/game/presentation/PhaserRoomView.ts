import guardAttack from '../../assets/game/characters/guard/attack.png'
import guardRecover from '../../assets/game/characters/guard/recover.png'
import { CombatFeedback } from './CombatFeedback.ts'
import playerStepA from '../../assets/game/characters/player/step-a.png'
import playerStepB from '../../assets/game/characters/player/step-b.png'
import guardStepA from '../../assets/game/characters/guard/step-a.png'
import guardStepB from '../../assets/game/characters/guard/step-b.png'
import { drawRoomBackdrop } from './drawRoomBackdrop.ts'
import type Phaser from 'phaser'
import guardImageUrl from '../../assets/game/characters/guard/idle-retro.png'
import archerImageUrl from '../../assets/game/characters/archer/idle.png'
import arrowImageUrl from '../../assets/game/items/arrow.png'
import crateImageUrl from '../../assets/game/objects/crate.png'
import plateImageUrl from '../../assets/game/objects/plate.png'
import platePressedImageUrl from '../../assets/game/objects/plate-pressed.png'
import playerImageUrl from '../../assets/game/characters/player/idle-retro.png'
import daggerImageUrl from '../../assets/game/items/weapons/dagger-horizontal.png'
import boulderImageUrl from '../../assets/game/objects/boulder-retro.png'
import type { WorldObject } from '../domain/WorldObject.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { WORLD_OBJECT_IDS, ROOM_LAYOUT, ROOM_NAMES } from '../content/room1Constants.ts'
import { isExitOpen } from '../domain/RoomTravel.ts'
import { isPlatePressed } from '../domain/PressurePlate.ts'
import { WorldObjectViewRegistry } from './WorldObjectViewRegistry.ts'

export const PLAYER_TEXTURE_KEY = 'player-idle'
export const GUARD_TEXTURE_KEY = 'guard-idle'
export const DAGGER_TEXTURE_KEY = 'dagger'
export const BOULDER_TEXTURE_KEY = 'boulder'
export const ITEM_LABEL_WIDTH_RATIO = 0.75

export {
  WEAPON_HOLD_OFFSET,
  DAGGER_ATTACK_DISTANCE,
  DAGGER_ATTACK_DURATION_MS,
  computeDaggerAttackTranslation,
  GAME_WEAPON_CONFIG,
} from '../content/weaponConstants.ts'
import {
  computeDaggerAttackTranslation,
  GAME_WEAPON_CONFIG,
} from '../content/weaponConstants.ts'

export const WORLD_OBJECT_TEXTURE_URLS = {
  'guard-attack': guardAttack,
  'guard-recover': guardRecover,
  'player-step-a': playerStepA,
  'player-step-b': playerStepB,
  'guard-step-a': guardStepA,
  'guard-step-b': guardStepB,
  [PLAYER_TEXTURE_KEY]: playerImageUrl,
  [GUARD_TEXTURE_KEY]: guardImageUrl,
  [DAGGER_TEXTURE_KEY]: daggerImageUrl,
  [BOULDER_TEXTURE_KEY]: boulderImageUrl,
  archer: archerImageUrl,
  arrow: arrowImageUrl,
  crate: crateImageUrl,
  plate: plateImageUrl,
  'plate-pressed': platePressedImageUrl,
} as const

/** Objects with a `kind` draw with its own texture and no walking animation. */
const KIND_TEXTURES: Readonly<Record<string, string>> = { archer: 'archer', arrow: 'arrow', crate: 'crate', plate: 'plate' }

interface DisplayState {
  x?: unknown
  y?: unknown
  discovered?: unknown
  alive?: unknown
  equippedBy?: unknown
  thrown?: unknown
  width?: unknown
  height?: unknown
  displayWidth?: unknown
  displayHeight?: unknown
  health?: unknown
  maxHealth?: unknown
  facing?: unknown
  flipX?: unknown
  attackOffsetX?: unknown
  attackElapsedMs?: unknown
  attackDurationMs?: unknown
  holdOffsetX?: unknown
  holdOffsetY?: unknown
  weaponAttackDistance?: unknown
  angle?: unknown
}

const TEXT_COLOR = '#d6d6d6'
const HEALTH_BAR_WIDTH = 110
const HEALTH_BAR_HEIGHT = 12
const HEALTH_BAR_OFFSET_Y = 100

function displayState(worldObject: WorldObject): DisplayState {
  const state = worldObject.state
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    return {}
  }

  return state
}

export class PhaserRoomView {
  private readonly objectViews = new WorldObjectViewRegistry()
  private readonly spriteById = new Map<string, Phaser.GameObjects.Image>()
  private readonly labelById = new Map<string, Phaser.GameObjects.Text>()
  private readonly lastPositionById = new Map<string, { x: number; y: number }>()
  private roomTitle: Phaser.GameObjects.Text | undefined
  private roomFrame: Phaser.GameObjects.Graphics | undefined
  private doorFrame: Phaser.GameObjects.Graphics | undefined
  private readonly doorLabels: Phaser.GameObjects.Text[] = []
  /** What the doors were last drawn for: the room, its exits and whether each is open. */
  private doorKey = ''
  private wallGraphics: Phaser.GameObjects.Graphics | undefined
  /** The room whose walls are drawn. */
  private wallRoomId: string | null | undefined
  private scene: Phaser.Scene | undefined
  private readonly combatFeedback = new CombatFeedback()
  private combatParticles: Phaser.GameObjects.Graphics | undefined
  private healthBars: Phaser.GameObjects.Graphics | undefined

  mount(scene: Phaser.Scene, state: WorldState, showRoomTitle = (scene.scene?.key === 'game')): void {
    this.destroy()

    this.roomFrame = scene.add.graphics().setDepth(0)
    this.healthBars = scene.add.graphics().setDepth(4)
    this.combatParticles = scene.add.graphics().setDepth(5)
    drawRoomBackdrop(this.roomFrame)

    this.scene = scene
    this.doorFrame = scene.add.graphics().setDepth(1)
    this.doorKey = ''
    this.wallGraphics = scene.add.graphics().setDepth(1)
    this.wallRoomId = undefined

    if (showRoomTitle) {
      this.roomTitle = scene.add
        .text(ROOM_LAYOUT.left + 8, ROOM_LAYOUT.top - 38, '', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 24,
          color: TEXT_COLOR,
        })
        .setOrigin(0, 0.5)
        .setDepth(2)
    }

    for (const worldObject of state.worldObjects) {
      const textureKey = this.textureKeyFor(worldObject)
      if (!textureKey) {
        continue
      }

      // Pressure plates lie on the floor, under everything that stands on them.
      const sprite = scene.add.image(0, 0, textureKey).setDepth(worldObject.metadata.kind === 'plate' ? 2 : 3)
      const objState = displayState(worldObject)
      const isWeapon = worldObject.metadata.role === 'weapon' || worldObject.id === WORLD_OBJECT_IDS.dagger
      const dw = typeof objState.displayWidth === 'number' ? objState.displayWidth : (isWeapon ? 72 : 176)
      const dh = typeof objState.displayHeight === 'number' ? objState.displayHeight : (isWeapon ? 72 : 176)
      sprite.setDisplaySize(dw, dh)

      this.objectViews.bind(worldObject.id, sprite)
      this.spriteById.set(worldObject.id, sprite)

      const label = scene.add
        .text(0, 0, '', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '14px',
          color: TEXT_COLOR,
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(4)
      this.labelById.set(worldObject.id, label)
    }

    this.update(state)
  }

  update(state: WorldState, positionOf: (objectId: string) => { x: number; y: number } | undefined = () => undefined, endedDeltaMs = 0): void {
    this.combatFeedback.update(state, endedDeltaMs)
    this.combatParticles?.clear()
    for (const burst of this.combatFeedback.bursts) {
      if (burst.roomId !== state.currentRoomId) continue
      const t = burst.ageMs / 360
      for (let i = 0; i < 9; i++) {
        const vx = burst.direction * (20 + (i * 17) % 65)
        const vy = -45 + (i * 19) % 60
        const x = Math.round((burst.x + vx * t) / 3) * 3
        const y = Math.round((burst.y + vy * t + 55 * t * t) / 3) * 3
        this.combatParticles?.fillStyle(i % 2 ? 0xa82f40 : 0xe3595b, 1 - t)
          .fillRect(x, y, i % 3 === 0 ? 6 : 3, i % 3 === 0 ? 6 : 3)
      }
    }
    const currentRoom = state.rooms.find((room) => room.id === state.currentRoomId)
    this.roomTitle?.setText(currentRoom ? ROOM_NAMES[currentRoom.id] ?? currentRoom.id : 'NO ROOM')
    this.drawDoors(state)
    this.drawWalls(state)

    this.healthBars?.clear()
    for (const worldObject of state.worldObjects) {
      const registeredView = this.objectViews.get(worldObject.id)
      if (!registeredView) {
        continue
      }

      const sprite = registeredView as Phaser.GameObjects.Image
      const label = this.labelById.get(worldObject.id)

      const objectState = displayState(worldObject)
      const inCurrentRoom = worldObject.roomId === state.currentRoomId
      const alive = objectState.alive !== false
      const equipped =
        objectState.equippedBy !== null &&
        objectState.equippedBy !== undefined &&
        !objectState.thrown
      const rendered = positionOf(worldObject.id)
      const x = rendered?.x ?? (typeof objectState.x === 'number' ? objectState.x : 0)
      const y = rendered?.y ?? (typeof objectState.y === 'number' ? objectState.y : 0)

      let renderX = x
      let renderY = y
      let shouldFlip = objectState.flipX === true || objectState.facing === 'left'

      if (equipped && typeof objectState.equippedBy === 'string') {
        const holderObj = state.worldObjects.find((o) => o.id === objectState.equippedBy)
        if (holderObj) {
          const holderState = displayState(holderObj)
          const holderRendered = positionOf(holderObj.id)
          const holderX = holderRendered?.x ?? (typeof holderState.x === 'number' ? holderState.x : x)
          const holderY = holderRendered?.y ?? (typeof holderState.y === 'number' ? holderState.y : y)
          const isHolderFacingLeft = holderState.facing === 'left'

          let attackOffsetX = 0
          if (typeof objectState.attackOffsetX === 'number') {
            attackOffsetX = objectState.attackOffsetX
          } else if (
            typeof objectState.attackElapsedMs === 'number' &&
            typeof objectState.attackDurationMs === 'number' &&
            objectState.attackDurationMs > 0
          ) {
            const maxDist =
              typeof objectState.weaponAttackDistance === 'number'
                ? objectState.weaponAttackDistance
                : GAME_WEAPON_CONFIG.attackDistance
            const translation = computeDaggerAttackTranslation(
              objectState.attackElapsedMs,
              objectState.attackDurationMs,
              maxDist,
            )
            attackOffsetX = isHolderFacingLeft ? -translation : translation
          }

          const holdX = typeof objectState.holdOffsetX === 'number' ? objectState.holdOffsetX : GAME_WEAPON_CONFIG.holdOffsetX
          const holdY = typeof objectState.holdOffsetY === 'number' ? objectState.holdOffsetY : GAME_WEAPON_CONFIG.holdOffsetY

          renderX = holderX + (isHolderFacingLeft ? -holdX : holdX) + attackOffsetX
          renderY = holderY + holdY
          shouldFlip = isHolderFacingLeft
        }
      }

      const role = worldObject.metadata.role === 'enemy' ? 'guard' : worldObject.metadata.role
      const kind = typeof worldObject.metadata.kind === 'string' ? worldObject.metadata.kind : undefined
      if (kind === 'plate') {
        this.setTexturePreservingSize(sprite, isPlatePressed(state, worldObject) ? 'plate-pressed' : 'plate')
      }
      if (kind === 'arrow' && typeof sprite.setAngle === 'function') {
        sprite.setAngle(typeof objectState.angle === 'number' ? objectState.angle : 0)
      }
      if ((role === 'player' || role === 'guard') && kind === undefined) {
        const previous = this.lastPositionById.get(worldObject.id)
        const moving = previous !== undefined && Math.hypot(x - previous.x, y - previous.y) > 0.01
        const step = moving ? [0, 1, 0, 2][Math.floor(state.simulationTick / 7) % 4] : 0
        const attackAge = this.combatFeedback.attacks.get(worldObject.id)
        const texture = role === 'guard' && attackAge !== undefined
          ? (attackAge < 110 ? 'guard-attack' : 'guard-recover')
          : step === 0 ? (role === 'player' ? PLAYER_TEXTURE_KEY : GUARD_TEXTURE_KEY)
          : `${role}-step-${step === 1 ? 'a' : 'b'}`
        if (typeof sprite.setTexture === 'function' && sprite.texture.key !== texture) {
          const w = sprite.displayWidth
          const h = sprite.displayHeight
          sprite.setTexture(texture).setDisplaySize(w, h)
        }
        this.lastPositionById.set(worldObject.id, { x, y })
      }
      // Anchor the horizontal texture at its grip, mirroring the grip with facing.
      if (typeof sprite.setAngle === 'function' && worldObject.metadata.role === 'weapon') {
        sprite.setAngle(0)
        sprite.setOrigin(equipped ? (shouldFlip ? 0.75 : 0.25) : 0.5, 0.5)
      }
      sprite.setPosition(renderX, renderY)
      const visible = inCurrentRoom && alive
      sprite.setVisible(visible)

      if (typeof sprite.setFlipX === 'function') {
        sprite.setFlipX(kind === 'arrow' ? false : shouldFlip)
      }

      const isWeapon = worldObject.metadata.role === 'weapon' || worldObject.id === WORLD_OBJECT_IDS.dagger
      const dw = typeof objectState.displayWidth === 'number' ? objectState.displayWidth : (isWeapon ? 72 : 176)
      const dh = typeof objectState.displayHeight === 'number' ? objectState.displayHeight : (isWeapon ? 72 : 176)
      const effectiveDh = isWeapon && equipped ? Math.round(dh * 0.8) : dh

      if (isWeapon && equipped) {
        sprite.setDisplaySize(Math.round(dw * 0.8), effectiveDh)
      } else if (isWeapon) {
        sprite.setDisplaySize(dw, dh)
      }

      const hasHealthBar = visible && typeof objectState.maxHealth === 'number' && typeof objectState.health === 'number'
      let labelOffsetY: number

      if (hasHealthBar) {
        const barWidth = typeof objectState.width === 'number' ? objectState.width : HEALTH_BAR_WIDTH
        const offsetY = typeof objectState.height === 'number' ? objectState.height / 2 + 20 : HEALTH_BAR_OFFSET_Y
        this.drawHealthBar(renderX, renderY, (objectState.health as number) / (objectState.maxHealth as number), barWidth, offsetY)
        labelOffsetY = offsetY + 4
      } else {
        labelOffsetY = effectiveDh / 2 + 4
      }

      if (label) {
        const isDiscovered = worldObject.id === WORLD_OBJECT_IDS.player || worldObject.metadata.discoverable === false || objectState.discovered === true
        const objectName = typeof worldObject.metadata.name === 'string'
          ? worldObject.metadata.name
          : worldObject.id
        const labelText = isDiscovered ? objectName : '?'

        label.setText(labelText)
        const isItem = isWeapon || worldObject.metadata.role === 'item'

        if (isItem && equipped) {
          const targetWidth = sprite.displayWidth * ITEM_LABEL_WIDTH_RATIO
          const scale = label.width > 0 ? targetWidth / label.width : 1
          label.setScale(scale)
          label.setAlpha(0.9)
        } else if (isItem && label.width > sprite.displayWidth * ITEM_LABEL_WIDTH_RATIO) {
          const targetWidth = sprite.displayWidth * ITEM_LABEL_WIDTH_RATIO
          const scale = label.width > 0 ? targetWidth / label.width : 1
          label.setScale(scale)
          label.setAlpha(1)
        } else {
          label.setScale(1)
          label.setAlpha(1)
        }
        label.setPosition(renderX, renderY - labelOffsetY)
        label.setVisible(visible && worldObject.metadata.hidden !== true)
      }
    }
  }

  destroy(): void {
    for (const sprite of this.spriteById.values()) {
      sprite.destroy()
    }
    for (const label of this.labelById.values()) {
      label.destroy()
    }

    this.combatFeedback.clear()
    this.combatParticles?.destroy()
    this.combatParticles = undefined
    this.lastPositionById.clear()
    this.spriteById.clear()
    this.labelById.clear()
    this.objectViews.clear()
    this.roomTitle?.destroy()
    this.roomFrame?.destroy()
    this.doorFrame?.destroy()
    for (const label of this.doorLabels) {
      label.destroy()
    }
    this.doorLabels.length = 0
    this.doorKey = ''
    this.wallGraphics?.destroy()
    this.wallGraphics = undefined
    this.wallRoomId = undefined
    this.scene = undefined
    this.roomTitle = undefined
    this.healthBars?.destroy()
    this.healthBars = undefined
    this.roomFrame = undefined
    this.doorFrame = undefined
  }

  private setTexturePreservingSize(sprite: Phaser.GameObjects.Image, texture: string): void {
    if (typeof sprite.setTexture === 'function' && sprite.texture.key !== texture) {
      const w = sprite.displayWidth
      const h = sprite.displayHeight
      sprite.setTexture(texture).setDisplaySize(w, h)
    }
  }

  /** Draws the current room's walls as stone blocks with a lit top edge and mortar lines, once per room. */
  private drawWalls(state: WorldState): void {
    if (!this.wallGraphics || this.wallRoomId === state.currentRoomId) {
      return
    }
    this.wallRoomId = state.currentRoomId
    const graphics = this.wallGraphics.clear()
    const room = state.rooms.find((candidate) => candidate.id === state.currentRoomId)
    for (const wall of room?.walls ?? []) {
      const left = wall.x - wall.width / 2
      const top = wall.y - wall.height / 2
      graphics.fillStyle(0x1b2529, 1).fillRect(left - 3, top - 3, wall.width + 6, wall.height + 6)
      graphics.fillStyle(0x3a4c53, 1).fillRect(left, top, wall.width, wall.height)
      graphics.fillStyle(0x56707a, 1).fillRect(left, top, wall.width, Math.min(8, wall.height))
      graphics.fillStyle(0x2b3a40, 1)
      for (let row = top + 24; row < top + wall.height - 4; row += 24) {
        graphics.fillRect(left, row, wall.width, 3)
        const offset = ((row - top) / 24) % 2 === 0 ? 0 : 24
        for (let column = left + 24 + offset; column < left + wall.width - 4; column += 48) {
          graphics.fillRect(column, row - 21, 3, 21)
        }
      }
    }
  }

  /** Draws a door for each Exit of the current room: teal with an arrow when open, red and barred when locked. */
  private drawDoors(state: WorldState): void {
    const room = state.rooms.find((candidate) => candidate.id === state.currentRoomId)
    const exits = room?.exits ?? []
    const open = exits.map((exit) => (room ? isExitOpen(state, room, exit) : true))
    const key = `${room?.id}|${exits.map((exit, i) => `${exit.label}@${exit.x},${exit.y}:${open[i]}`).join(';')}`
    if (key === this.doorKey || !this.doorFrame) {
      return
    }
    this.doorKey = key

    const frame = this.doorFrame.clear()
    exits.forEach((exit, index) => {
      const { x, y } = exit
      const isOpen = open[index]
      const edge = isOpen ? 0x799594 : 0xa0484c
      const accent = isOpen ? 0xa7dcc5 : 0xe07a72
      frame.fillStyle(0x0b1620, 1).fillRect(x - 42, y - 84, 84, 168)
      frame.lineStyle(6, edge, 1).strokeRect(x - 42, y - 84, 84, 168)
      frame.fillStyle(isOpen ? 0x7fc5b3 : 0xc0504d, 0.12).fillRect(x - 34, y - 76, 68, 152)
      if (isOpen) {
        frame.fillStyle(accent, 1).fillRect(x - 20, y - 3, 40, 6)
        frame.lineStyle(3, accent, 1)
          .lineBetween(x + 20, y, x + 8, y - 12)
          .lineBetween(x + 20, y, x + 8, y + 12)
      } else {
        for (const barX of [x - 20, x - 4, x + 12]) {
          frame.fillStyle(accent, 1).fillRect(barX, y - 70, 8, 140)
        }
      }

      let label = this.doorLabels[index]
      if (!label && this.scene) {
        label = this.scene.add
          .text(x, y + 100, '', { fontFamily: '"Press Start 2P", monospace', fontSize: 16, color: TEXT_COLOR, align: 'center' })
          .setOrigin(0.5, 0)
          .setDepth(2)
        this.doorLabels[index] = label
      }
      if (label) {
        label.setText(isOpen ? exit.label : `${exit.label}\nLOCKED`).setVisible(true)
        // Keep long room names inside the room's right wall.
        const centreX = Math.min(x, ROOM_LAYOUT.right - label.width / 2)
        label.setPosition(centreX, y + 92)
      }
    })
    for (const label of this.doorLabels.slice(exits.length)) {
      label.setVisible(false)
    }
  }

  private drawHealthBar(
    x: number,
    y: number,
    fraction: number,
    width: number = HEALTH_BAR_WIDTH,
    offsetY: number = HEALTH_BAR_OFFSET_Y,
  ): void {
    const left = x - width / 2
    const top = y - offsetY
    this.healthBars
      ?.fillStyle(0x333333, 1)
      .fillRect(left, top, width, HEALTH_BAR_HEIGHT)
      .fillStyle(0xd6d6d6, 1)
      .fillRect(left, top, width * Math.max(0, Math.min(1, fraction)), HEALTH_BAR_HEIGHT)
  }

  private textureKeyFor(worldObject: WorldObject): string | undefined {
    const kind = worldObject.metadata.kind
    if (typeof kind === 'string' && KIND_TEXTURES[kind]) {
      return KIND_TEXTURES[kind]
    }
    if (worldObject.id === WORLD_OBJECT_IDS.boulder || worldObject.id === 'boulder') {
      return BOULDER_TEXTURE_KEY
    }
    switch (worldObject.metadata.role) {
      case 'player':
        return PLAYER_TEXTURE_KEY
      case 'enemy':
      case 'guard':
        return GUARD_TEXTURE_KEY
      case 'weapon':
        return DAGGER_TEXTURE_KEY
      case 'object':
        return BOULDER_TEXTURE_KEY
      default:
        return undefined
    }
  }
}
