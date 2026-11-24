import type Phaser from 'phaser'
import {
  FONT_FAMILY,
  TEXT_COLOR,
  DIM_COLOR,
  ACCENT_COLOR,
} from './editorTheme.ts'
import {
  createDefaultRoomDefinition,
  getActiveRoomIds,
  getUnusedRoomIds,
  insertNewRoom,
  insertRoomFromUnused,
  isActiveRoom,
  removeRoomToUnused,
  getRoomContentSnapshot,
} from '../content/roomRegistry.ts'
import { generateRoomSequenceSource } from '../content/roomSequenceSerializer.ts'

export interface LevelEditorRoomBarScene {
  add: Phaser.GameObjects.GameObjectFactory
  getCurrentRoomId(): string
  syncCurrentRoomObjects(): unknown[]
  selectRoom(roomId: string): void
  selectPreviousRoom(): void
  selectNextRoom(): void
  enterPrefabMode(): void
}

export class LevelEditorRoomBar {
  private readonly scene: LevelEditorRoomBarScene
  private objects: Phaser.GameObjects.GameObject[] = []
  private modalObjects: Phaser.GameObjects.GameObject[] = []

  constructor(scene: LevelEditorRoomBarScene) {
    this.scene = scene
  }

  public build(): void {
    this.destroy()
    let x = 96
    this.objects.push(this.text(x, 47, 'ROOM:', ACCENT_COLOR, 12))
    x += 65
    this.objects.push(this.button(x, '◄', '#37474f', '#d6d6d6', () => this.scene.selectPreviousRoom()))
    x += 42

    for (const roomId of getActiveRoomIds()) {
      const selected = roomId === this.scene.getCurrentRoomId()
      const pill = this.button(
        x,
        roomId,
        selected ? '#0288d1' : '#263238',
        selected ? '#ffffff' : '#90a4ae',
        () => this.scene.selectRoom(roomId),
        10,
      )
      if (pill instanceof Object && 'width' in pill) x += pill.width + 6
      this.objects.push(pill)
    }

    this.objects.push(this.button(x, '►', '#37474f', '#d6d6d6', () => this.scene.selectNextRoom()))
    x += 42
    this.objects.push(this.button(x, '+ INSERT', '#00695c', TEXT_COLOR, () => this.openInsertModal()))
    x += 118

    if (isActiveRoom(this.scene.getCurrentRoomId())) {
      this.objects.push(this.button(
        x,
        '- REMOVE',
        getActiveRoomIds().length <= 1 ? '#37474f' : '#b71c1c',
        getActiveRoomIds().length <= 1 ? DIM_COLOR : TEXT_COLOR,
        () => this.removeCurrent(),
        10,
      ))
      x += 118
    } else {
      this.objects.push(this.button(
        x,
        '+ INSERT TO GAME',
        '#2e7d32',
        TEXT_COLOR,
        () => this.insertCurrent(),
        10,
      ))
      x += 188
    }

    this.objects.push(this.text(x, 47, 'UNUSED:', ACCENT_COLOR, 12))
    x += 78
    const unused = getUnusedRoomIds()
    if (unused.length === 0) {
      this.objects.push(this.text(x, 47, '(none)', DIM_COLOR, 10))
      x += 74
    } else {
      for (const roomId of unused) {
        const selected = roomId === this.scene.getCurrentRoomId()
        const pill = this.button(
          x,
          roomId,
          selected ? '#e65100' : '#37474f',
          selected ? '#ffffff' : '#ffb74d',
          () => this.scene.selectRoom(roomId),
          10,
        )
        if ('width' in pill) x += pill.width + 6
        this.objects.push(pill)
      }
    }

    this.objects.push(this.button(x + 12, 'SAVE SEQUENCE', '#2e7d32', TEXT_COLOR, () => void this.saveSequence(), 10))
    x += 150
    this.objects.push(this.button(x + 12, 'PREFABS', '#00838f', '#d6d6d6', () => this.scene.enterPrefabMode(), 10))
  }

  public refresh(): void {
    this.build()
  }

  public destroy(): void {
    for (const object of [...this.objects, ...this.modalObjects]) object.destroy()
    this.objects = []
    this.modalObjects = []
  }

  private removeCurrent(): void {
    const roomId = this.scene.getCurrentRoomId()
    const active = [...getActiveRoomIds()]
    const removedIndex = active.indexOf(roomId)
    const adjacent = removedIndex >= 0
      ? active[removedIndex + 1] ?? active[removedIndex - 1]
      : active[0]
    if (!removeRoomToUnused(roomId)) return
    this.scene.selectRoom(adjacent)
    this.build()
  }

  private insertCurrent(): void {
    const roomId = this.scene.getCurrentRoomId()
    this.openPositionModal(roomId, (anchor) => {
      if (!insertRoomFromUnused(roomId, anchor)) return
      this.closeInsertModal()
      this.scene.selectRoom(roomId)
      this.build()
    })
  }

  private openInsertModal(): void {
    this.closeInsertModal()
    const overlay = this.scene.add.rectangle(960, 540, 1920, 1080, 0x000000, 0.72)
      .setDepth(90)
      .setInteractive()
    this.modalObjects.push(overlay)

    const panel = this.scene.add.rectangle(960, 540, 760, 420, 0x181818, 1)
      .setStrokeStyle(2, 0x4fc3f7, 1)
      .setDepth(91)
    this.modalObjects.push(panel)
    this.modalObjects.push(this.modalText(960, 378, 'INSERT LEVEL', ACCENT_COLOR, 18, 91))

    let y = 455
    for (const roomId of getUnusedRoomIds()) {
      const pill = this.modalButton(960, y, roomId, '#37474f', '#ffb74d', () => {
        this.openPositionModal(roomId, (anchor) => {
          if (!insertRoomFromUnused(roomId, anchor)) return
          this.closeInsertModal()
          this.scene.selectRoom(roomId)
          this.build()
        })
      })
      this.modalObjects.push(pill)
      y += 55
    }

    this.modalObjects.push(this.modalButton(960, y, '+ NEW EMPTY LEVEL', '#2e7d32', TEXT_COLOR, () => {
      const id = `custom_room_${Date.now().toString(36)}`
      const definition = createDefaultRoomDefinition(id)
      this.openPositionModal(id, (anchor) => {
        if (!insertNewRoom(definition, anchor)) return
        this.closeInsertModal()
        this.scene.selectRoom(id)
        this.build()
      })
    }))
    y += 55
    this.modalObjects.push(this.modalButton(960, y, 'CANCEL', '#37474f', TEXT_COLOR, () => this.closeInsertModal()))
  }

  private closeInsertModal(): void {
    for (const object of this.modalObjects) object.destroy()
    this.modalObjects = []
  }

  private async saveSequence(): Promise<void> {
    this.scene.syncCurrentRoomObjects()
    const source = generateRoomSequenceSource(
      getActiveRoomIds(),
      getUnusedRoomIds(),
      getRoomContentSnapshot(),
    )
    try {
      const response = await fetch('/api/save-room-sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: source }),
      })
      if (!response.ok) throw new Error(`Server returned ${response.status}: ${response.statusText}`)
      const result = await response.json()
      if (!result.success) throw new Error(result.error ?? 'Unknown save sequence error')
      this.showSaveStatus('SEQUENCE SAVED', '#2e7d32')
    } catch (error) {
      console.error('Failed to save room sequence:', error)
      this.showSaveStatus('SAVE FAILED', '#b71c1c')
    }
  }

  private showSaveStatus(label: string, background: string): void {
    const status = this.button(1700, label, background, TEXT_COLOR, () => undefined, 10)
    this.objects.push(status)
  }

  private openPositionModal(roomId: string, onInsert: (anchor: string | undefined) => void): void {
    this.closeInsertModal()

    const active = [...getActiveRoomIds()]
    const panelHeight = 260 + active.length * 55
    const panelTop = 540 - panelHeight / 2
    this.modalObjects.push(
      this.scene.add.rectangle(960, 540, 760, panelHeight, 0x000000, 0.72)
        .setDepth(90)
        .setInteractive(),
    )
    this.modalObjects.push(
      this.scene.add.rectangle(960, 540, 760, panelHeight, 0x181818, 1)
        .setStrokeStyle(2, 0x4fc3f7, 1)
        .setDepth(91),
    )
    this.modalObjects.push(this.modalText(960, panelTop + 30, `INSERT ${roomId} AFTER`, ACCENT_COLOR, 16, 91))

    let y = panelTop + 100
    for (const anchor of active) {
      this.modalObjects.push(this.modalButton(
        960,
        y,
        anchor,
        '#263238',
        '#90a4ae',
        () => onInsert(anchor),
      ))
      y += 55
    }

    this.modalObjects.push(this.modalButton(
      960,
      y,
      'CANCEL',
      '#37474f',
      TEXT_COLOR,
      () => this.closeInsertModal(),
    ))
  }

  private text(
    x: number,
    y: number,
    label: string,
    color: string,
    size: number,
  ): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, label, {
      fontFamily: FONT_FAMILY,
      fontSize: size,
      color,
    }).setOrigin(0, 0).setDepth(50)
  }

  private button(
    x: number,
    label: string,
    background: string,
    color: string,
    onClick: () => void,
    size = 12,
  ): Phaser.GameObjects.Text {
    const object = this.scene.add.text(x, 44, label, {
      fontFamily: FONT_FAMILY,
      fontSize: size,
      color,
      backgroundColor: background,
      padding: { x: 7, y: 4 },
    }).setOrigin(0, 0).setDepth(50).setInteractive({ useHandCursor: true })
    object.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      onClick()
    })
    return object
  }

  private modalText(
    x: number,
    y: number,
    label: string,
    color: string,
    size: number,
    depth: number,
  ): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, label, {
      fontFamily: FONT_FAMILY,
      fontSize: size,
      color,
    }).setOrigin(0.5, 0).setDepth(depth)
  }

  private modalButton(
    x: number,
    y: number,
    label: string,
    background: string,
    color: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const object = this.scene.add.text(x, y, label, {
      fontFamily: FONT_FAMILY,
      fontSize: 12,
      color,
      backgroundColor: background,
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5, 0).setDepth(92).setInteractive({ useHandCursor: true })
    object.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      onClick()
    })
    return object
  }
}
