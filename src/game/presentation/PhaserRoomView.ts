import type Phaser from 'phaser'
import guardImageUrl from '../../assets/game/characters/guard/idle.png'
import playerImageUrl from '../../assets/game/characters/player/idle.png'
import daggerImageUrl from '../../assets/game/items/weapons/dagger.png'
import type { WorldObject } from '../domain/WorldObject.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { WORLD_OBJECT_IDS, ROOM_IDS, ROOM_LAYOUT, ROOM_NAMES } from '../content/room1Constants.ts'
import { WorldObjectViewRegistry } from './WorldObjectViewRegistry.ts'

export const PLAYER_TEXTURE_KEY = 'player-idle'
export const GUARD_TEXTURE_KEY = 'guard-idle'
export const DAGGER_TEXTURE_KEY = 'dagger'

export const WORLD_OBJECT_TEXTURE_URLS = {
  [PLAYER_TEXTURE_KEY]: playerImageUrl,
  [GUARD_TEXTURE_KEY]: guardImageUrl,
  [DAGGER_TEXTURE_KEY]: daggerImageUrl,
} as const

interface DisplayState {
  x?: unknown
  y?: unknown
  discovered?: unknown
  alive?: unknown
  equippedBy?: unknown
  width?: unknown
  height?: unknown
  displayWidth?: unknown
  displayHeight?: unknown
  health?: unknown
  maxHealth?: unknown
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
  private roomTitle: Phaser.GameObjects.Text | undefined
  private roomFrame: Phaser.GameObjects.Graphics | undefined
  private roomDivider: Phaser.GameObjects.Graphics | undefined
  private doorFrame: Phaser.GameObjects.Graphics | undefined
  private doorLabel: Phaser.GameObjects.Text | undefined
  private healthBars: Phaser.GameObjects.Graphics | undefined

  mount(scene: Phaser.Scene, state: WorldState): void {
    this.destroy()

    this.roomFrame = scene.add.graphics().setDepth(0)
    this.healthBars = scene.add.graphics().setDepth(4)
    this.roomFrame.lineStyle(4, 0x595959, 1).strokeRect(
      ROOM_LAYOUT.left,
      ROOM_LAYOUT.top,
      ROOM_LAYOUT.right - ROOM_LAYOUT.left,
      ROOM_LAYOUT.bottom - ROOM_LAYOUT.top,
    )
    this.roomFrame.lineStyle(2, 0x282828, 1)
    for (let y = ROOM_LAYOUT.top + 36; y < ROOM_LAYOUT.bottom; y += 48) {
      this.roomFrame.lineBetween(ROOM_LAYOUT.left + 4, y, ROOM_LAYOUT.right - 4, y)
    }

    this.roomDivider = scene.add.graphics().setDepth(0)
    this.roomDivider.lineStyle(2, 0x3c3c3c, 0.8)
    for (let y = ROOM_LAYOUT.top + 8; y < ROOM_LAYOUT.bottom; y += 24) {
      this.roomDivider.lineBetween(
        ROOM_LAYOUT.rightHalfStartX,
        y,
        ROOM_LAYOUT.rightHalfStartX,
        Math.min(y + 10, ROOM_LAYOUT.bottom),
      )
    }

    this.doorFrame = scene.add.graphics().setDepth(1)
    this.doorFrame.fillStyle(0x101010, 1).fillRect(ROOM_LAYOUT.exit.x - 42, ROOM_LAYOUT.exit.y - 84, 84, 168)
    this.doorFrame.lineStyle(4, 0x9a9a9a, 1).strokeRect(
      ROOM_LAYOUT.exit.x - 42,
      ROOM_LAYOUT.exit.y - 84,
      84,
      168,
    )
    this.doorLabel = scene.add
      .text(ROOM_LAYOUT.exit.x, ROOM_LAYOUT.exit.y + 100, ROOM_NAMES[ROOM_IDS.second], {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 20,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(2)

    this.roomTitle = scene.add
      .text(ROOM_LAYOUT.left + 8, ROOM_LAYOUT.top - 38, '', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 24,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0.5)
      .setDepth(2)

    for (const worldObject of state.worldObjects) {
      const textureKey = this.textureKeyFor(worldObject)
      if (!textureKey) {
        continue
      }

      const sprite = scene.add.image(0, 0, textureKey).setDepth(3)
      const objState = displayState(worldObject)
      const isWeapon = worldObject.metadata.role === 'weapon' || worldObject.id === WORLD_OBJECT_IDS.dagger
      const dw = typeof objState.displayWidth === 'number' ? objState.displayWidth : (isWeapon ? 72 : 176)
      const dh = typeof objState.displayHeight === 'number' ? objState.displayHeight : (isWeapon ? 72 : 176)
      sprite.setDisplaySize(dw, dh)

      this.objectViews.bind(worldObject.id, sprite)
      this.spriteById.set(worldObject.id, sprite)
    }

    this.update(state)
  }

  update(state: WorldState, positionOf: (objectId: string) => { x: number; y: number } | undefined = () => undefined): void {
    const currentRoom = state.rooms.find((room) => room.id === state.currentRoomId)
    this.roomTitle?.setText(currentRoom ? ROOM_NAMES[currentRoom.id] ?? currentRoom.id : 'NO ROOM')
    this.roomDivider?.setVisible(state.currentRoomId === ROOM_IDS.first)
    this.doorFrame?.setVisible(state.currentRoomId === ROOM_IDS.first)
    this.doorLabel?.setVisible(state.currentRoomId === ROOM_IDS.first)

    this.healthBars?.clear()
    for (const worldObject of state.worldObjects) {
      const registeredView = this.objectViews.get(worldObject.id)
      if (!registeredView) {
        continue
      }

      const sprite = registeredView as Phaser.GameObjects.Image

      const objectState = displayState(worldObject)
      const inCurrentRoom = worldObject.roomId === state.currentRoomId
      const isKnown = worldObject.id === WORLD_OBJECT_IDS.player || objectState.discovered === true
      const alive = objectState.alive !== false
      const equipped = objectState.equippedBy !== null && objectState.equippedBy !== undefined
      const rendered = positionOf(worldObject.id)
      const x = rendered?.x ?? (typeof objectState.x === 'number' ? objectState.x : 0)
      const y = rendered?.y ?? (typeof objectState.y === 'number' ? objectState.y : 0)

      sprite.setPosition(x, y)
      const visible = inCurrentRoom && isKnown && alive
      sprite.setVisible(visible)

      const isWeapon = worldObject.metadata.role === 'weapon' || worldObject.id === WORLD_OBJECT_IDS.dagger
      const dw = typeof objectState.displayWidth === 'number' ? objectState.displayWidth : (isWeapon ? 72 : 176)
      const dh = typeof objectState.displayHeight === 'number' ? objectState.displayHeight : (isWeapon ? 72 : 176)

      if (isWeapon && equipped) {
        sprite.setDisplaySize(Math.round(dw * 0.8), Math.round(dh * 0.8))
      } else if (isWeapon) {
        sprite.setDisplaySize(dw, dh)
      }

      if (visible && typeof objectState.maxHealth === 'number' && typeof objectState.health === 'number') {
        this.drawHealthBar(x, y, objectState.health / objectState.maxHealth)
      }
    }
  }

  destroy(): void {
    for (const sprite of this.spriteById.values()) {
      sprite.destroy()
    }

    this.spriteById.clear()
    this.objectViews.clear()
    this.roomTitle?.destroy()
    this.roomFrame?.destroy()
    this.roomDivider?.destroy()
    this.doorFrame?.destroy()
    this.doorLabel?.destroy()
    this.roomTitle = undefined
    this.healthBars?.destroy()
    this.healthBars = undefined
    this.roomFrame = undefined
    this.roomDivider = undefined
    this.doorFrame = undefined
    this.doorLabel = undefined
  }

  private drawHealthBar(x: number, y: number, fraction: number): void {
    const left = x - HEALTH_BAR_WIDTH / 2
    const top = y - HEALTH_BAR_OFFSET_Y
    this.healthBars
      ?.fillStyle(0x333333, 1)
      .fillRect(left, top, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT)
      .fillStyle(0xd6d6d6, 1)
      .fillRect(left, top, HEALTH_BAR_WIDTH * Math.max(0, Math.min(1, fraction)), HEALTH_BAR_HEIGHT)
  }

  private textureKeyFor(worldObject: WorldObject): string | undefined {
    switch (worldObject.metadata.role) {
      case 'player':
        return PLAYER_TEXTURE_KEY
      case 'guard':
        return GUARD_TEXTURE_KEY
      case 'weapon':
        return DAGGER_TEXTURE_KEY
      default:
        return undefined
    }
  }
}
