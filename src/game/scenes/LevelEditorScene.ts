import Phaser from 'phaser'
import textboxImageUrl from '../../assets/game/ui/textbox.png'
import {
  ROOM_LAYOUT,
  WORLD_OBJECT_IDS,
  ROOM_NAMES,
  ROOM_IDS,
  CHARACTER_SIZE,
  DAGGER_SIZE,
  createInitialWorldState,
} from '../content/room1.ts'
import {
  WORLD_OBJECT_TEXTURE_URLS,
  PLAYER_TEXTURE_KEY,
  GUARD_TEXTURE_KEY,
  DAGGER_TEXTURE_KEY,
} from '../presentation/PhaserRoomView.ts'
import { COMMAND_INPUT_TEXTURE_KEY } from '../presentation/PhaserCommandInputView.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import {
  EditorHistory,
  type ScalableMovableObject,
} from './levelEditorHistory.ts'

const FONT_FAMILY = '"Press Start 2P", monospace'
const TEXT_COLOR = '#d6d6d6'
const DIM_COLOR = '#777777'
const ACCENT_COLOR = '#4fc3f7'
const PANEL_BG = 0x1a1a1a
const SELECTED_OUTLINE = 0x4fc3f7
const HANDLE_COLOR = 0xffcc00
const HANDLE_SIZE = 16
const GRID_SNAP = 1
const PANEL_X = 96
const PANEL_Y = 720
const PANEL_WIDTH = 1728
const PANEL_HEIGHT = 290

export interface SpawnObjectConfig {
  id?: string
  x?: number
  y?: number
  displayWidth?: number
  displayHeight?: number
  speed?: number
  maxHealth?: number
}

export interface EditorObject extends ScalableMovableObject {
  role: 'player' | 'guard' | 'weapon'
  sprite: Phaser.GameObjects.Image
  outline: Phaser.GameObjects.Rectangle
  scaleHandle: Phaser.GameObjects.Rectangle
  label: Phaser.GameObjects.Text
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
  private naStatsText: Phaser.GameObjects.Text | undefined
  private headerText: Phaser.GameObjects.Text | undefined
  private coordsText!: Phaser.GameObjects.Text
  private isDraggingObject = false
  private isDraggingScaleHandle = false
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
  private exportButton!: Phaser.GameObjects.Container
  private instructionText: Phaser.GameObjects.Text | undefined

  constructor() {
    super({ key: 'level-editor' })
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
    this.editorObjects = []
    this.selectedId = null
    this.panelFields.clear()
    this.statsElements = []
    this.naStatsText = undefined
    this.objectListButtons = []
    this.objectListTitle = undefined
    this.deleteButton = undefined
    this.history.clear()

    // Title
    this.headerText = this.add
      .text(960, 28, 'LEVEL EDITOR — room1', {
        fontFamily: FONT_FAMILY,
        fontSize: 28,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
      .setDepth(50)

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

    // Room divider
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

    // Create world objects from initial state
    const worldState = createInitialWorldState()
    for (const worldObject of worldState.worldObjects) {
      this.createEditorObject(worldObject)
    }

    // Build property panel
    this.buildPropertyPanel()

    // Build export button
    this.buildExportButton()

    // Instructions
    this.instructionText = this.add
      .text(960, 1045, 'Click to select · Drag to move · Yellow handle to scale · Ctrl+Z: Undo · Del: Remove · P: Panel', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(50)

    // Coordinates display
    this.coordsText = this.add
      .text(ROOM_LAYOUT.right, ROOM_LAYOUT.top - 10, '', {
        fontFamily: FONT_FAMILY,
        fontSize: 16,
        color: DIM_COLOR,
      })
      .setOrigin(1, 1)
      .setDepth(50)

    // Input handlers
    this.input.on('pointerdown', this.onPointerDown, this)
    this.input.on('pointermove', this.onPointerMove, this)
    this.input.on('pointerup', this.onPointerUp, this)
    this.input.keyboard?.on('keydown', this.onKeyDown, this)

    // Back-to-game key hint
    this.add
      .text(1820, 28, 'P: Toggle panel · F2 / ESC: Back to game', {
        fontFamily: FONT_FAMILY,
        fontSize: 16,
        color: DIM_COLOR,
      })
      .setOrigin(1, 0)
      .setDepth(50)

    // Select the first object by default
    if (this.editorObjects.length > 0) {
      this.selectObject(this.editorObjects[0].id)
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.onPointerDown, this)
      this.input.off('pointermove', this.onPointerMove, this)
      this.input.off('pointerup', this.onPointerUp, this)
      this.input.keyboard?.off('keydown', this.onKeyDown, this)
      this.headerText?.destroy()
      this.doorLabel?.destroy()
      this.instructionText?.destroy()
      this.panelContainer?.destroy(true)
      this.exportButton?.destroy(true)
      for (const obj of this.editorObjects) {
        obj.sprite.destroy()
        obj.outline.destroy()
        obj.scaleHandle.destroy()
        obj.label.destroy()
      }
      this.editorObjects = []
      this.panelFields.clear()
      this.statsElements = []
      this.naStatsText = undefined
      this.objectListButtons = []
      this.objectListTitle = undefined
      this.deleteButton = undefined
    })
  }

  update(): void {
    // Update the coordinate readout for the selected object
    const selected = this.getSelected()
    if (selected) {
      this.coordsText.setText(
        `x:${Math.round(selected.x)} y:${Math.round(selected.y)} ` +
        `w:${Math.round(selected.displayWidth)} h:${Math.round(selected.displayHeight)}`,
      )
    } else {
      this.coordsText.setText('')
    }
  }

  private createEditorObject(worldObject: WorldObject): void {
    const state = worldObject.state as Record<string, unknown>
    const x = typeof state.x === 'number' ? state.x : 0
    const y = typeof state.y === 'number' ? state.y : 0
    const textureKey = this.textureKeyFor(worldObject)
    if (!textureKey) return

    const role: 'player' | 'guard' | 'weapon' =
      worldObject.metadata.role === 'weapon'
        ? 'weapon'
        : worldObject.metadata.role === 'guard'
          ? 'guard'
          : 'player'

    const isWeapon = role === 'weapon'
    const isCharacter = role === 'player' || role === 'guard'
    const maxHealth = isCharacter && typeof state.maxHealth === 'number' ? state.maxHealth : (isCharacter ? 100 : undefined)
    const speed = isCharacter && typeof state.speed === 'number' ? state.speed : undefined
    const baseWidth = isWeapon ? DAGGER_SIZE.width : CHARACTER_SIZE.width
    const baseHeight = isWeapon ? DAGGER_SIZE.height : CHARACTER_SIZE.height
    const displayWidth = isWeapon ? 72 : 176
    const displayHeight = isWeapon ? 72 : 176

    const sprite = this.add.image(x, y, textureKey).setDepth(3)
    sprite.setDisplaySize(displayWidth, displayHeight)
    sprite.setAlpha(0.9)

    // Selection outline
    const outline = this.add
      .rectangle(x, y, displayWidth + 8, displayHeight + 8)
      .setStrokeStyle(3, SELECTED_OUTLINE, 1)
      .setFillStyle(SELECTED_OUTLINE, 0.08)
      .setDepth(2)
      .setVisible(false)

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
      role,
      sprite,
      outline,
      scaleHandle,
      label,
      x,
      y,
      displayWidth,
      displayHeight,
      baseWidth,
      baseHeight,
      scaleX: displayWidth / baseWidth,
      scaleY: displayHeight / baseHeight,
      maxHealth,
      speed,
    }

    this.editorObjects.push(editorObject)
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

    // Spawn buttons
    const spawnGuardBtn = this.add
      .text(75, 42, '+ GUARD', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: '#ffffff',
        backgroundColor: '#1b5e20',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    spawnGuardBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.spawnWorldObject('guard')
    })
    items.push(spawnGuardBtn)

    const spawnDaggerBtn = this.add
      .text(205, 42, '+ DAGGER', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
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
    items.push(spawnDaggerBtn)

    // Remove selected object button
    this.deleteButton = this.add
      .text(140, 252, 'REMOVE SELECTED', {
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

    // ─── Section 3: Character Stats (Editable for player & guard) ───
    const section3Title = this.add
      .text(890, 24, 'CHARACTER STATS', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(section3Title)

    this.naStatsText = this.add
      .text(890, 115, '(Weapon — no stats)', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
      .setVisible(false)
    items.push(this.naStatsText)

    this.statsElements = []

    // max_health row
    const healthLabel = this.add
      .text(705, 72, 'max_health:', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    const healthVal = this.add
      .text(910, 72, '--', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
        backgroundColor: '#2a2a2a',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
    healthVal.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.promptProperty('maxHealth')
    })

    const healthMinusBtn = this.createPanelButton(945, 69, '−', (pointer) => {
      this.adjustProperty('maxHealth', pointer.event?.shiftKey ? -50 : -10)
    })
    const healthPlusBtn = this.createPanelButton(995, 69, '+', (pointer) => {
      this.adjustProperty('maxHealth', pointer.event?.shiftKey ? 50 : 10)
    })

    this.panelFields.set('val_maxHealth', healthVal)
    this.statsElements.push(healthLabel, healthVal, healthMinusBtn, healthPlusBtn)
    items.push(healthLabel, healthVal, healthMinusBtn, healthPlusBtn)

    // speed row
    const speedLabel = this.add
      .text(705, 128, 'speed:', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0)

    const speedVal = this.add
      .text(910, 128, '--', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
        backgroundColor: '#2a2a2a',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
    speedVal.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      this.promptProperty('speed')
    })

    const speedMinusBtn = this.createPanelButton(945, 125, '−', (pointer) => {
      this.adjustProperty('speed', pointer.event?.shiftKey ? -50 : -10)
    })
    const speedPlusBtn = this.createPanelButton(995, 125, '+', (pointer) => {
      this.adjustProperty('speed', pointer.event?.shiftKey ? 50 : 10)
    })

    this.panelFields.set('val_speed', speedVal)
    this.statsElements.push(speedLabel, speedVal, speedMinusBtn, speedPlusBtn)
    items.push(speedLabel, speedVal, speedMinusBtn, speedPlusBtn)

    // Stats hints
    const statHint1 = this.add
      .text(890, 180, 'Click +/- (10) · Shift (50)', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
    const statHint2 = this.add
      .text(890, 208, 'Click number to set exact', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
    this.statsElements.push(statHint1, statHint2)
    items.push(statHint1, statHint2)

    // ─── Section 4: Scale & Nudge ───
    const section4Title = this.add
      .text(1260, 24, 'SCALE & NUDGE', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(section4Title)

    const scalePlusBtn = this.createPanelButton(1200, 72, 'SCALE +', () =>
      this.scaleSelected(1.1),
    )
    const scaleMinusBtn = this.createPanelButton(1320, 72, 'SCALE -', () =>
      this.scaleSelected(1 / 1.1),
    )
    items.push(scalePlusBtn, scaleMinusBtn)

    const hints = [
      'Nudge: Arrow keys',
      'Shift: 10px step',
      'Undo: Ctrl+Z',
    ]
    for (let i = 0; i < hints.length; i++) {
      const hint = this.add
        .text(1260, 138 + i * 34, hints[i], {
          fontFamily: FONT_FAMILY,
          fontSize: 13,
          color: DIM_COLOR,
        })
        .setOrigin(0.5, 0)
      items.push(hint)
    }

    // ─── Section 5: Export ───
    const section5Title = this.add
      .text(1574, 24, 'EXPORT', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)
    const exportDesc = this.add
      .text(1574, 75, 'Print code to console:', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(section5Title, exportDesc)

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
      .text(0, 0, 'EXPORT TO CONSOLE', {
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
      this.exportLayout()
    })
  }

  private selectObject(id: string): void {
    this.selectedId = id
    for (const obj of this.editorObjects) {
      const isSelected = obj.id === id
      obj.outline.setVisible(isSelected)
      obj.scaleHandle.setVisible(isSelected)
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
      for (const field of ['x', 'y', 'width', 'height', 'scaleX', 'scaleY', 'maxHealth', 'speed']) {
        setField(field, '--')
      }
      this.statsElements.forEach((el) => el.setVisible(false))
      this.naStatsText?.setVisible(false)
      return
    }

    setField('x', Math.round(selected.x).toString())
    setField('y', Math.round(selected.y).toString())
    setField('width', Math.round(selected.displayWidth).toString())
    setField('height', Math.round(selected.displayHeight).toString())
    setField('scaleX', selected.scaleX.toFixed(2))
    setField('scaleY', selected.scaleY.toFixed(2))

    const isCharacter = selected.maxHealth !== undefined && selected.speed !== undefined
    if (isCharacter) {
      setField('maxHealth', selected.maxHealth!.toString())
      setField('speed', selected.speed!.toString())
      this.statsElements.forEach((el) => el.setVisible(true))
      this.naStatsText?.setVisible(false)
    } else {
      setField('maxHealth', '--')
      setField('speed', '--')
      this.statsElements.forEach((el) => el.setVisible(false))
      this.naStatsText?.setVisible(true)
    }
  }

  private adjustProperty(property: 'maxHealth' | 'speed', delta: number): void {
    const selected = this.getSelected()
    if (!selected || selected[property] === undefined) return

    const prevValue = selected[property]!
    const min = property === 'maxHealth' ? 1 : 10
    const nextValue = Math.max(min, prevValue + delta)
    if (nextValue === prevValue) return

    selected[property] = nextValue
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

  private promptProperty(property: 'maxHealth' | 'speed'): void {
    const selected = this.getSelected()
    if (!selected || selected[property] === undefined) return

    const prevValue = selected[property]!
    const label = property === 'maxHealth' ? 'max_health' : 'speed'
    const input = window.prompt(`Enter new ${label} for ${selected.id}:`, prevValue.toString())
    if (input === null) return

    const parsed = parseInt(input.trim(), 10)
    const min = property === 'maxHealth' ? 1 : 10
    if (isNaN(parsed) || parsed < min) return

    const nextValue = parsed
    if (nextValue === prevValue) return

    selected[property] = nextValue
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

  private getSelected(): EditorObject | undefined {
    return this.editorObjects.find((obj) => obj.id === this.selectedId)
  }

  private updateObjectVisuals(obj: EditorObject): void {
    obj.sprite.setPosition(obj.x, obj.y)
    obj.sprite.setDisplaySize(obj.displayWidth, obj.displayHeight)
    obj.outline.setPosition(obj.x, obj.y)
    obj.outline.setSize(obj.displayWidth + 8, obj.displayHeight + 8)
    obj.scaleHandle.setPosition(
      obj.x + obj.displayWidth / 2,
      obj.y + obj.displayHeight / 2,
    )
    obj.label.setPosition(obj.x, obj.y - obj.displayHeight / 2 - 20)
  }

  private scaleSelected(factor: number): void {
    const selected = this.getSelected()
    if (!selected) return

    const prevScaleX = selected.scaleX
    const prevScaleY = selected.scaleY
    const prevDisplayWidth = selected.displayWidth
    const prevDisplayHeight = selected.displayHeight

    selected.scaleX *= factor
    selected.scaleY *= factor
    selected.displayWidth = Math.max(16, Math.round(selected.baseWidth * selected.scaleX))
    selected.displayHeight = Math.max(16, Math.round(selected.baseHeight * selected.scaleY))

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

    const prevX = selected.x
    const prevY = selected.y
    const nextX = snap(selected.x + dx)
    const nextY = snap(selected.y + dy)
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
      const dx = pointer.worldX - this.dragStartX
      const dy = pointer.worldY - this.dragStartY
      selected.x = snap(this.dragObjStartX + dx)
      selected.y = snap(this.dragObjStartY + dy)
      this.updateObjectVisuals(selected)
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
      selected.displayWidth = Math.max(16, Math.round(this.scaleStartWidth * scaleFactor))
      selected.displayHeight = Math.max(16, Math.round(this.scaleStartHeight * scaleFactor))
      selected.scaleX = selected.displayWidth / selected.baseWidth
      selected.scaleY = selected.displayHeight / selected.baseHeight
      this.updateObjectVisuals(selected)
      this.updatePropertyPanel()
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
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'F2') {
      event.preventDefault()
      this.scene.start('game')
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      this.undo()
      return
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
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
          x: reversed.snapshot.x,
          y: reversed.snapshot.y,
          displayWidth: reversed.snapshot.displayWidth,
          displayHeight: reversed.snapshot.displayHeight,
          speed: reversed.snapshot.speed,
          maxHealth: reversed.snapshot.maxHealth,
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

  private exportLayout(): void {
    const output: Record<string, unknown> = {}
    for (const obj of this.editorObjects) {
      output[obj.id] = {
        x: Math.round(obj.x),
        y: Math.round(obj.y),
        displayWidth: Math.round(obj.displayWidth),
        displayHeight: Math.round(obj.displayHeight),
        scaleX: obj.scaleX.toFixed(2),
        scaleY: obj.scaleY.toFixed(2),
        ...(obj.maxHealth !== undefined ? { maxHealth: obj.maxHealth } : {}),
        ...(obj.speed !== undefined ? { speed: obj.speed } : {}),
      }
    }

    // Generate code snippet for room1.ts
    const lines: string[] = [
      '// ─── Exported from Level Editor ───',
      '// Paste into room1.ts ROOM_LAYOUT to update start positions,',
      '// and update CHARACTER_SIZE / DAGGER_SIZE if sizes changed.',
      '',
    ]

    for (const obj of this.editorObjects) {
      const startKey = this.startKeyFor(obj.id)
      if (startKey) {
        lines.push(`  ${startKey}: { x: ${Math.round(obj.x)}, y: ${Math.round(obj.y)} },`)
      }
    }

    lines.push('')
    lines.push('// Display sizes (as used in PhaserRoomView):')

    for (const obj of this.editorObjects) {
      lines.push(
        `//   ${obj.id}: setDisplaySize(${Math.round(obj.displayWidth)}, ${Math.round(obj.displayHeight)})` +
        `  [scale: ${obj.scaleX.toFixed(2)}x${obj.scaleY.toFixed(2)}]`,
      )
    }

    lines.push('')
    lines.push('// Character attributes (speed, maxHealth):')

    for (const obj of this.editorObjects) {
      if (obj.maxHealth !== undefined || obj.speed !== undefined) {
        lines.push(
          `//   ${obj.id}: speed=${obj.speed}, maxHealth=${obj.maxHealth}`,
        )
      }
    }

    console.log(
      '%c Level Editor Export ',
      'background: #2e7d32; color: #fff; font-size: 14px; padding: 4px 8px; border-radius: 4px',
    )
    console.log(lines.join('\n'))
    console.log('Raw data:', output)

    // Flash the export button to confirm
    const bg = this.exportButton.getAt(0) as Phaser.GameObjects.Rectangle
    const originalColor = 0x2e7d32
    bg.setFillStyle(0x66bb6a, 1)
    this.time.delayedCall(200, () => bg.setFillStyle(originalColor, 1))
  }

  public spawnWorldObject(
    role: 'guard' | 'weapon' | 'player' = 'guard',
    config: SpawnObjectConfig = {},
    recordHistory = true,
  ): EditorObject {
    const id = config.id ?? this.generateNextId(role)

    const existingIndex = this.editorObjects.findIndex((o) => o.id === id)
    if (existingIndex !== -1) {
      const existing = this.editorObjects[existingIndex]
      if (config.x !== undefined) existing.x = config.x
      if (config.y !== undefined) existing.y = config.y
      if (config.displayWidth !== undefined) existing.displayWidth = config.displayWidth
      if (config.displayHeight !== undefined) existing.displayHeight = config.displayHeight
      existing.scaleX = existing.displayWidth / existing.baseWidth
      existing.scaleY = existing.displayHeight / existing.baseHeight
      if (config.maxHealth !== undefined) existing.maxHealth = config.maxHealth
      if (config.speed !== undefined) existing.speed = config.speed
      this.updateObjectVisuals(existing)
      this.selectObject(id)
      return existing
    }

    const textureKey = this.textureKeyForRole(role)
    const isWeapon = role === 'weapon'
    const isCharacter = role === 'player' || role === 'guard'
    const baseWidth = isWeapon ? DAGGER_SIZE.width : CHARACTER_SIZE.width
    const baseHeight = isWeapon ? DAGGER_SIZE.height : CHARACTER_SIZE.height
    const displayWidth = config.displayWidth ?? (isWeapon ? 72 : 176)
    const displayHeight = config.displayHeight ?? (isWeapon ? 72 : 176)
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
          ? (role === 'guard' ? 120 : 200)
          : undefined

    const defaultX = 960 + (this.editorObjects.length % 5) * 40 - 80
    const defaultY = 380 + (this.editorObjects.length % 5) * 30 - 60
    const x = config.x !== undefined ? config.x : defaultX
    const y = config.y !== undefined ? config.y : defaultY

    const sprite = this.add.image(x, y, textureKey).setDepth(3)
    sprite.setDisplaySize(displayWidth, displayHeight)
    sprite.setAlpha(0.9)

    // Selection outline
    const outline = this.add
      .rectangle(x, y, displayWidth + 8, displayHeight + 8)
      .setStrokeStyle(3, SELECTED_OUTLINE, 1)
      .setFillStyle(SELECTED_OUTLINE, 0.08)
      .setDepth(2)
      .setVisible(false)

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
      role,
      sprite,
      outline,
      scaleHandle,
      label,
      x,
      y,
      displayWidth,
      displayHeight,
      baseWidth,
      baseHeight,
      scaleX: displayWidth / baseWidth,
      scaleY: displayHeight / baseHeight,
      maxHealth,
      speed,
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
    const twoColumns = count > 5
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
    return {
      id: obj.id,
      x: obj.x,
      y: obj.y,
      displayWidth: obj.displayWidth,
      displayHeight: obj.displayHeight,
      baseWidth: obj.baseWidth,
      baseHeight: obj.baseHeight,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      speed: obj.speed,
      maxHealth: obj.maxHealth,
    }
  }

  private generateNextId(role: 'guard' | 'weapon' | 'player'): string {
    const prefix = role === 'weapon' ? 'dagger' : role
    let counter = 2
    while (this.editorObjects.some((o) => o.id === `${prefix}-${counter}`)) {
      counter++
    }
    return `${prefix}-${counter}`
  }

  private startKeyFor(id: string): string {
    switch (id) {
      case WORLD_OBJECT_IDS.player:
        return 'playerStart'
      case WORLD_OBJECT_IDS.dagger:
        return 'daggerStart'
      case WORLD_OBJECT_IDS.guard:
        return 'guardStart'
      default: {
        const camel = id.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase())
        return `${camel}Start`
      }
    }
  }

  private textureKeyForRole(role: 'player' | 'guard' | 'weapon'): string {
    switch (role) {
      case 'player':
        return PLAYER_TEXTURE_KEY
      case 'guard':
        return GUARD_TEXTURE_KEY
      case 'weapon':
        return DAGGER_TEXTURE_KEY
    }
  }

  private textureKeyFor(worldObject: WorldObject): string | undefined {
    const role =
      worldObject.metadata.role === 'weapon'
        ? 'weapon'
        : worldObject.metadata.role === 'guard'
          ? 'guard'
          : worldObject.metadata.role === 'player'
            ? 'player'
            : undefined
    return role ? this.textureKeyForRole(role) : undefined
  }
}

function snap(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP
}
