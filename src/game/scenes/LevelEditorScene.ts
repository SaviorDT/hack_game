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

interface EditorObject extends ScalableMovableObject {
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
      .text(960, 1056, 'Click to select · Drag to move · Yellow handle to scale · Ctrl+Z to undo · Export to console', {
        fontFamily: FONT_FAMILY,
        fontSize: 16,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 1)
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
      .text(1820, 28, 'F2 / ESC: Back to game', {
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
      for (const obj of this.editorObjects) {
        obj.sprite.destroy()
        obj.outline.destroy()
        obj.scaleHandle.destroy()
        obj.label.destroy()
      }
      this.editorObjects = []
      this.panelFields.clear()
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

    const isWeapon = worldObject.metadata.role === 'weapon'
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
    }

    this.editorObjects.push(editorObject)
  }

  private buildPropertyPanel(): void {
    const panelX = 24
    const panelY = 80
    const panelWidth = 340
    const panelHeight = 520

    const bg = this.add
      .rectangle(panelWidth / 2, panelHeight / 2, panelWidth, panelHeight, PANEL_BG, 0.92)
      .setStrokeStyle(2, 0x444444, 1)

    const title = this.add
      .text(panelWidth / 2, 20, 'PROPERTIES', {
        fontFamily: FONT_FAMILY,
        fontSize: 18,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5, 0)

    const items: Phaser.GameObjects.GameObject[] = [bg, title]

    // Object list buttons
    let buttonY = 60
    for (const editorObject of this.editorObjects) {
      const btn = this.add
        .text(panelWidth / 2, buttonY, editorObject.id.toUpperCase(), {
          fontFamily: FONT_FAMILY,
          fontSize: 16,
          color: TEXT_COLOR,
          backgroundColor: '#2a2a2a',
          padding: { x: 12, y: 6 },
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
      btn.on('pointerdown', () => this.selectObject(editorObject.id))
      items.push(btn)
      this.panelFields.set(`btn_${editorObject.id}`, btn)
      buttonY += 40
    }

    // Separator
    const sep = this.add.rectangle(panelWidth / 2, buttonY + 10, panelWidth - 40, 2, 0x444444, 1)
    items.push(sep)

    // Property fields
    const fieldStartY = buttonY + 30
    const fieldLabels = ['x', 'y', 'width', 'height', 'scaleX', 'scaleY']
    for (let i = 0; i < fieldLabels.length; i++) {
      const fieldLabel = fieldLabels[i]
      const fY = fieldStartY + i * 36

      const labelText = this.add
        .text(20, fY, `${fieldLabel}:`, {
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          color: DIM_COLOR,
        })
        .setOrigin(0, 0)
      items.push(labelText)

      const valueText = this.add
        .text(panelWidth - 20, fY, '--', {
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          color: TEXT_COLOR,
        })
        .setOrigin(1, 0)
      items.push(valueText)
      this.panelFields.set(`val_${fieldLabel}`, valueText)
    }

    // Nudge buttons section
    const nudgeY = fieldStartY + fieldLabels.length * 36 + 20
    const nudgeTitle = this.add
      .text(panelWidth / 2, nudgeY, 'NUDGE  (Arrow Keys)', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
    items.push(nudgeTitle)

    // Scale buttons
    const scaleY = nudgeY + 30
    const scalePlusBtn = this.createPanelButton(panelWidth / 2 - 50, scaleY, 'SCALE +', () =>
      this.scaleSelected(1.1),
    )
    const scaleMinusBtn = this.createPanelButton(panelWidth / 2 + 50, scaleY, 'SCALE -', () =>
      this.scaleSelected(1 / 1.1),
    )
    items.push(scalePlusBtn, scaleMinusBtn)

    this.panelContainer = this.add.container(panelX, panelY, items).setDepth(40)
  }

  private createPanelButton(
    x: number,
    y: number,
    text: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: TEXT_COLOR,
        backgroundColor: '#333333',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
    btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation()
      onClick()
    })
    return btn
  }

  private buildExportButton(): void {
    const btnX = 1740
    const btnY = 1020
    const bg = this.add
      .rectangle(0, 0, 280, 48, 0x2e7d32, 1)
      .setStrokeStyle(2, 0x66bb6a, 1)
    const label = this.add
      .text(0, 0, 'EXPORT TO CONSOLE', {
        fontFamily: FONT_FAMILY,
        fontSize: 16,
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)

    this.exportButton = this.add
      .container(btnX, btnY, [bg, label])
      .setDepth(50)
      .setSize(280, 48)
      .setInteractive({ useHandCursor: true })
    this.exportButton.on('pointerdown', () => this.exportLayout())
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
    this.updatePropertyPanel()
  }

  private updatePropertyPanel(): void {
    const selected = this.getSelected()
    if (!selected) return

    const setField = (key: string, value: string) => {
      const text = this.panelFields.get(`val_${key}`)
      if (text) text.setText(value)
    }

    setField('x', Math.round(selected.x).toString())
    setField('y', Math.round(selected.y).toString())
    setField('width', Math.round(selected.displayWidth).toString())
    setField('height', Math.round(selected.displayHeight).toString())
    setField('scaleX', selected.scaleX.toFixed(2))
    setField('scaleY', selected.scaleY.toFixed(2))
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

    // Check if clicking inside the panel area
    if (
      worldX >= 24 &&
      worldX <= 364 &&
      worldY >= 80 &&
      worldY <= 600
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
    const selected = this.getSelected()

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

  private undo(): void {
    const reversed = this.history.undo((id) => this.editorObjects.find((o) => o.id === id))
    if (!reversed) return

    this.selectObject(reversed.objectId)
    const obj = this.getSelected()
    if (obj) {
      this.updateObjectVisuals(obj)
    }
    this.updatePropertyPanel()
  }

  private cycleSelection(direction: number): void {
    const currentIndex = this.editorObjects.findIndex((obj) => obj.id === this.selectedId)
    const nextIndex =
      (currentIndex + direction + this.editorObjects.length) % this.editorObjects.length
    this.selectObject(this.editorObjects[nextIndex].id)
  }

  private exportLayout(): void {
    const output: Record<string, { x: number; y: number; displayWidth: number; displayHeight: number; scaleX: string; scaleY: string }> = {}
    for (const obj of this.editorObjects) {
      output[obj.id] = {
        x: Math.round(obj.x),
        y: Math.round(obj.y),
        displayWidth: Math.round(obj.displayWidth),
        displayHeight: Math.round(obj.displayHeight),
        scaleX: obj.scaleX.toFixed(2),
        scaleY: obj.scaleY.toFixed(2),
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

  private startKeyFor(id: string): string | undefined {
    switch (id) {
      case WORLD_OBJECT_IDS.player:
        return 'playerStart'
      case WORLD_OBJECT_IDS.dagger:
        return 'daggerStart'
      case WORLD_OBJECT_IDS.guard:
        return 'guardStart'
      default:
        return undefined
    }
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

function snap(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP
}
