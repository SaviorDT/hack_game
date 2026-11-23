import type Phaser from 'phaser'
import {
  FONT_FAMILY,
  TEXT_COLOR,
  DIM_COLOR,
  ACCENT_COLOR,
  VALUE_COLOR,
  PANEL_BG,
} from './editorTheme.ts'
import {
  getAllPrefabs,
  getPrefab,
  getPrefabInstances,
  propagatePrefabChanges,
  saveActivePrefabs,
  updatePrefab,
} from '../content/prefabRegistry.ts'
import {
  inferPrefabId,
  type PrefabDefinition,
} from '../domain/Prefab.ts'
import { ROOM_LAYOUT } from '../content/roomConstants.ts'
import type { EditorObject } from './LevelEditorScene.ts'

export interface LevelEditorSceneLike {
  add: Phaser.GameObjects.GameObjectFactory
  getEditorObjects(): EditorObject[]
  refreshObjectVisuals(obj: EditorObject): void
  getCurrentRoomId(): string
  updatePropertyPanel(): void
}

const PANEL_X = 96
const PANEL_Y = 720
const PANEL_WIDTH = 1728
const PANEL_HEIGHT = 290

export class PrefabModeController {
  private readonly scene: LevelEditorSceneLike
  public isPrefabModeActive = false
  public currentPrefabId: string | null = null

  private topBannerContainer?: Phaser.GameObjects.Container
  private bannerTitleText?: Phaser.GameObjects.Text
  private bannerSubtitleText?: Phaser.GameObjects.Text
  private applyStatusText?: Phaser.GameObjects.Text
  private saveButton?: Phaser.GameObjects.Text

  private panelContainer?: Phaser.GameObjects.Container
  private prefabTabs: Map<string, Phaser.GameObjects.Text> = new Map()
  private valueLabels: Map<string, Phaser.GameObjects.Text> = new Map()
  private shapeToggleButton?: Phaser.GameObjects.Text

  constructor(scene: LevelEditorSceneLike) {
    this.scene = scene
  }

  public enterPrefabMode(prefabId = 'guard'): void {
    this.isPrefabModeActive = true
    this.currentPrefabId = prefabId

    if (!this.topBannerContainer) {
      this.buildTopBanner()
    }
    if (!this.panelContainer) {
      this.buildPanel()
    }

    this.topBannerContainer?.setVisible(true)
    this.panelContainer?.setVisible(true)

    this.selectPrefab(prefabId)
    this.highlightPrefabInstancesInRoom()
  }

  public exitPrefabMode(): void {
    this.isPrefabModeActive = false
    this.currentPrefabId = null

    this.topBannerContainer?.setVisible(false)
    this.panelContainer?.setVisible(false)

    // Reset alphas and outlines
    for (const obj of this.scene.getEditorObjects()) {
      obj.sprite.setAlpha(1)
      obj.outline.setVisible(false)
    }

    this.scene.updatePropertyPanel()
  }

  public selectPrefab(prefabId: string): void {
    this.currentPrefabId = prefabId
    const prefab = getPrefab(prefabId)
    if (!prefab) return

    // Update Tab styling
    for (const [id, tab] of this.prefabTabs.entries()) {
      const isSelected = id === prefabId
      tab.setColor(isSelected ? '#ffffff' : TEXT_COLOR)
      tab.setBackgroundColor(isSelected ? '#00838f' : '#263238')
    }

    this.updateBannerText(prefab)
    this.refreshInspectorValues(prefab)
    this.highlightPrefabInstancesInRoom()
  }

  /**
   * Called when any handle (scale or collider) is dragged on an object in the level.
   * Updates the active prefab template and propagates in real time to all sibling instances.
   */
  public onHandleDragged(source: EditorObject): void {
    if (!this.isPrefabModeActive || !this.currentPrefabId) return
    if (inferPrefabId(source) !== this.currentPrefabId) return

    const updates: Partial<PrefabDefinition> = {
      displayWidth: Math.round(source.displayWidth),
      displayHeight: Math.round(source.displayHeight),
      scaleX: Number(source.scaleX.toFixed(2)),
      scaleY: Number(source.scaleY.toFixed(2)),
    }

    if (source.colliderWidth !== undefined) {
      updates.colliderWidth = Math.round(source.colliderWidth)
    }
    if (source.colliderHeight !== undefined) {
      updates.colliderHeight = Math.round(source.colliderHeight)
    }

    const updated = updatePrefab(this.currentPrefabId, updates)
    this.syncToRoomInstances(updated, source.id)
    this.refreshInspectorValues(updated)
    this.updateBannerText(updated)
  }

  public modifyProperty(property: keyof PrefabDefinition, delta: number): void {
    if (!this.currentPrefabId) return
    const current = getPrefab(this.currentPrefabId)
    if (!current) return

    const val = current[property]
    if (typeof val !== 'number') return

    const nextVal = Math.max(
      property === 'mass' ? 0.001 : 1,
      Number((val + delta).toFixed(2)),
    )
    const updates: Partial<PrefabDefinition> = { [property]: nextVal }

    if (property === 'displayWidth' && current.scaleX) {
      updates.scaleX = Number((nextVal / current.displayWidth * current.scaleX).toFixed(2))
    }
    if (property === 'displayHeight' && current.scaleY) {
      updates.scaleY = Number((nextVal / current.displayHeight * current.scaleY).toFixed(2))
    }

    const updated = updatePrefab(this.currentPrefabId, updates)
    this.syncToRoomInstances(updated)
    this.refreshInspectorValues(updated)
    this.updateBannerText(updated)
    propagatePrefabChanges(this.currentPrefabId, updated)
  }

  public toggleColliderShape(): void {
    if (!this.currentPrefabId) return
    const current = getPrefab(this.currentPrefabId)
    if (!current) return

    const nextShape = current.colliderShape === 'circle' ? 'box' : 'circle'
    const updated = updatePrefab(this.currentPrefabId, { colliderShape: nextShape })
    this.syncToRoomInstances(updated)
    this.refreshInspectorValues(updated)
    propagatePrefabChanges(this.currentPrefabId, updated)
  }

  public applyToAllRooms(): void {
    if (!this.currentPrefabId) return
    const current = getPrefab(this.currentPrefabId)
    if (!current) return

    const result = propagatePrefabChanges(this.currentPrefabId, current)
    if (this.applyStatusText) {
      this.applyStatusText.setText(
        `SYNCED ${result.affectedInstanceCount} INSTANCES ACROSS ${result.affectedRooms.length} ROOMS!`,
      )
      this.applyStatusText.setColor(VALUE_COLOR)
    }
  }

  public async savePrefabs(fetchFn?: typeof fetch): Promise<boolean> {
    if (this.saveButton) {
      this.saveButton.setText('SAVING...')
    }
    const res = await saveActivePrefabs(fetchFn)
    if (res.success) {
      if (this.saveButton) {
        this.saveButton.setText('SAVED TO PREFAB.TS!')
        this.saveButton.setBackgroundColor('#2e7d32')
        setTimeout(() => {
          this.saveButton?.setText('SAVE PREFABS')
        }, 1500)
      }
      if (this.applyStatusText) {
        this.applyStatusText.setText('PREFABS SAVED TO DISK!')
        this.applyStatusText.setColor(VALUE_COLOR)
      }
      return true
    } else {
      if (this.saveButton) {
        this.saveButton.setText('SAVE FAILED')
        this.saveButton.setBackgroundColor('#b71c1c')
        setTimeout(() => {
          this.saveButton?.setText('SAVE PREFABS')
          this.saveButton?.setBackgroundColor('#2e7d32')
        }, 2000)
      }
      if (this.applyStatusText) {
        this.applyStatusText.setText(`SAVE ERROR: ${res.error}`)
        this.applyStatusText.setColor('#ff5252')
      }
      return false
    }
  }

  private syncToRoomInstances(prefab: PrefabDefinition, skipId?: string): void {
    for (const obj of this.scene.getEditorObjects()) {
      if (inferPrefabId(obj) !== prefab.id) continue
      if (skipId && obj.id === skipId) continue

      obj.displayWidth = prefab.displayWidth
      obj.displayHeight = prefab.displayHeight
      obj.scaleX = prefab.scaleX
      obj.scaleY = prefab.scaleY
      if (prefab.colliderWidth !== undefined) obj.colliderWidth = prefab.colliderWidth
      if (prefab.colliderHeight !== undefined) obj.colliderHeight = prefab.colliderHeight
      if (prefab.colliderShape !== undefined) obj.colliderShape = prefab.colliderShape
      if (prefab.maxHealth !== undefined) obj.maxHealth = prefab.maxHealth
      if (prefab.speed !== undefined) obj.speed = prefab.speed
      if (prefab.mass !== undefined) obj.mass = prefab.mass

      this.scene.refreshObjectVisuals(obj)
    }
  }

  private highlightPrefabInstancesInRoom(): void {
    if (!this.currentPrefabId) return
    for (const obj of this.scene.getEditorObjects()) {
      const matches = inferPrefabId(obj) === this.currentPrefabId
      obj.sprite.setAlpha(matches ? 1 : 0.35)
      obj.outline.setVisible(matches)
      if (matches) {
        obj.outline.setStrokeStyle(3, 0x00e5ff)
      }
    }
  }

  private buildTopBanner(): void {
    const bannerW = 1728
    const bannerH = 40
    const x = ROOM_LAYOUT.left
    const y = 8

    const bg = this.scene.add
      .rectangle(bannerW / 2, bannerH / 2, bannerW, bannerH, 0x0a1922, 0.95)
      .setStrokeStyle(2, 0x00bcd4, 1)

    this.bannerTitleText = this.scene.add
      .text(16, 12, 'PREFAB MODE', {
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        color: '#00e5ff',
      })
      .setOrigin(0, 0)

    this.bannerSubtitleText = this.scene.add
      .text(260, 14, '', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0)

    this.applyStatusText = this.scene.add
      .text(700, 14, '', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: VALUE_COLOR,
      })
      .setOrigin(0, 0)

    const saveBtn = this.createButton(
      1240,
      8,
      'SAVE PREFABS',
      () => {
        void this.savePrefabs()
      },
      '#ffffff',
      '#2e7d32',
    )
    this.saveButton = saveBtn

    const applyBtn = this.createButton(
      1420,
      8,
      'APPLY ALL ROOMS',
      () => this.applyToAllRooms(),
      '#ffffff',
      '#1b5e20',
    )

    const exitBtn = this.createButton(
      1610,
      8,
      'EXIT PREFAB',
      () => this.exitPrefabMode(),
      '#ffffff',
      '#b71c1c',
    )

    this.topBannerContainer = this.scene.add
      .container(x, y, [
        bg,
        this.bannerTitleText,
        this.bannerSubtitleText,
        this.applyStatusText,
        saveBtn,
        applyBtn,
        exitBtn,
      ])
      .setDepth(150)
  }

  private buildPanel(): void {
    const items: Phaser.GameObjects.GameObject[] = []

    // Background panel
    const bg = this.scene.add
      .rectangle(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, PANEL_BG, 1)
      .setStrokeStyle(2, 0x00bcd4, 1)
    items.push(bg)

    // Prefab selector tabs
    const allPrefabs = getAllPrefabs()
    let tabX = 24
    for (const prefab of allPrefabs) {
      const btn = this.scene.add
        .text(tabX, 16, ` ${prefab.name.toUpperCase()} `, {
          fontFamily: FONT_FAMILY,
          fontSize: 11,
          color: TEXT_COLOR,
          backgroundColor: '#263238',
          padding: { x: 8, y: 5 },
        })
        .setInteractive({ useHandCursor: true })
      btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.()
        this.selectPrefab(prefab.id)
      })
      this.prefabTabs.set(prefab.id, btn)
      items.push(btn)
      tabX += btn.width + 12
    }

    // Controls Column 1: Dimensions
    items.push(...this.buildInspectorRow(40, 68, 'Width', 'displayWidth', 10))
    items.push(...this.buildInspectorRow(40, 112, 'Height', 'displayHeight', 10))
    items.push(...this.buildInspectorRow(40, 156, 'ScaleX', 'scaleX', 0.1))
    items.push(...this.buildInspectorRow(40, 200, 'ScaleY', 'scaleY', 0.1))

    // Controls Column 2: Collider
    items.push(...this.buildColliderControls(480, 68))
    items.push(...this.buildInspectorRow(480, 112, 'Col Width', 'colliderWidth', 8))
    items.push(...this.buildInspectorRow(480, 156, 'Col Height', 'colliderHeight', 8))

    // Controls Column 3: Stats & Physics
    items.push(...this.buildInspectorRow(920, 68, 'Max Health', 'maxHealth', 10))
    items.push(...this.buildInspectorRow(920, 112, 'Speed', 'speed', 15))
    items.push(...this.buildInspectorRow(920, 156, 'Mass', 'mass', 5))
    items.push(...this.buildInspectorRow(920, 200, 'Restitution', 'restitution', 0.1))

    // Controls Column 4: Propagation info
    const infoTitle = this.scene.add
      .text(1380, 72, 'PROPAGATION', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: ACCENT_COLOR,
      })
    const infoDesc = this.scene.add
      .text(1380, 102, 'Edits update all instances\nin current level instantly\nand sync across all rooms.', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: DIM_COLOR,
        lineSpacing: 6,
      })
    items.push(infoTitle, infoDesc)

    this.panelContainer = this.scene.add
      .container(PANEL_X, PANEL_Y, items)
      .setDepth(150)
  }

  private buildInspectorRow(
    x: number,
    y: number,
    label: string,
    prop: keyof PrefabDefinition,
    step: number,
  ): Phaser.GameObjects.GameObject[] {
    const lbl = this.scene.add
      .text(x, y + 4, `${label}:`, {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
    const val = this.scene.add
      .text(x + 160, y + 4, '--', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: VALUE_COLOR,
      })
    this.valueLabels.set(prop, val)

    const minusBtn = this.createButton(x + 250, y, ' - ', () => this.modifyProperty(prop, -step))
    const plusBtn = this.createButton(x + 295, y, ' + ', () => this.modifyProperty(prop, step))

    return [lbl, val, minusBtn, plusBtn]
  }

  private buildColliderControls(x: number, y: number): Phaser.GameObjects.GameObject[] {
    const lbl = this.scene.add
      .text(x, y + 4, 'Col Shape:', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: DIM_COLOR,
      })
    this.shapeToggleButton = this.createButton(
      x + 160,
      y,
      'BOX',
      () => this.toggleColliderShape(),
      VALUE_COLOR,
      '#1b3a4b',
    )
    return [lbl, this.shapeToggleButton]
  }

  private updateBannerText(prefab: PrefabDefinition): void {
    const roomInstances = this.scene
      .getEditorObjects()
      .filter((o) => inferPrefabId(o) === prefab.id).length
    const totalInstances = getPrefabInstances(prefab.id).length

    this.bannerTitleText?.setText(`PREFAB MODE: ${prefab.name.toUpperCase()}`)
    this.bannerSubtitleText?.setText(
      `Live updates ${roomInstances} instance(s) in this room • ${totalInstances} total across all rooms`,
    )
    if (this.applyStatusText) {
      this.applyStatusText.setText('')
    }
  }

  private refreshInspectorValues(prefab: PrefabDefinition): void {
    const set = (key: keyof PrefabDefinition, formatted: string) => {
      this.valueLabels.get(key)?.setText(formatted)
    }

    set('displayWidth', Math.round(prefab.displayWidth).toString())
    set('displayHeight', Math.round(prefab.displayHeight).toString())
    set('scaleX', prefab.scaleX.toFixed(2))
    set('scaleY', prefab.scaleY.toFixed(2))
    set('colliderWidth', prefab.colliderWidth !== undefined ? Math.round(prefab.colliderWidth).toString() : '--')
    set('colliderHeight', prefab.colliderHeight !== undefined ? Math.round(prefab.colliderHeight).toString() : '--')
    set('maxHealth', prefab.maxHealth !== undefined ? prefab.maxHealth.toString() : '--')
    const speedVal = typeof prefab.speed === 'number' ? prefab.speed : prefab.speed?.maxSpeed
    set('speed', speedVal !== undefined ? Math.round(speedVal).toString() : '--')
    set('mass', prefab.mass !== undefined ? prefab.mass.toString() : '1')
    set('restitution', prefab.restitution !== undefined ? prefab.restitution.toString() : '0.5')

    const shape = prefab.colliderShape ?? 'box'
    this.shapeToggleButton?.setText(` ${shape.toUpperCase()} `)
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    color = TEXT_COLOR,
    bg = '#37474f',
  ): Phaser.GameObjects.Text {
    const btn = this.scene.add
      .text(x, y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color,
        backgroundColor: bg,
        padding: { x: 8, y: 4 },
      })
      .setInteractive({ useHandCursor: true })
    btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      onClick()
    })
    return btn
  }
}
