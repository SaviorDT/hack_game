import Phaser from 'phaser'
import { ROOM_LAYOUT, WORLD_OBJECT_IDS } from '../content/room1Constants.ts'
import {
  PRESET_BEHAVIOR_TREES,
  BOSS_CYBER_ENFORCER_TREE,
  cloneBehaviorTree,
} from '../ai/behaviorTree/BehaviorTreePresets.ts'
import type {
  BehaviorNodeType,
  BehaviorTreeDef,
  BehaviorTreeNodeDef,
} from '../ai/behaviorTree/BehaviorTreeTypes.ts'
import { getNodeCategory } from '../ai/behaviorTree/BehaviorTreeTypes.ts'
import {
  addChildNode,
  computeTreeLayout,
  createDefaultNode,
  findNodeById,
  findParentNode,
  moveChild,
  removeNode,
  type NodeLayout,
} from '../ai/behaviorTree/BehaviorTreeModel.ts'
import {
  PhaserRoomView,
  WORLD_OBJECT_TEXTURE_URLS,
} from '../presentation/PhaserRoomView.ts'
import { createAiEditorSession, type AiEditorSessionBundle } from './aiEditorSession.ts'
import { ROOM1_OBJECTS } from '../content/room1.ts'
import { generateRoom1Source } from '../content/room1Serializer.ts'
import type { WorldState } from '../domain/WorldState.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import {
  FONT_FAMILY,
  TEXT_COLOR,
  DIM_COLOR,
  ACCENT_COLOR,
  VALUE_COLOR,
  PANEL_BG,
} from './editorTheme.ts'

// Category colors for node cards & buttons
const CATEGORY_COLORS = {
  composite: 0x7e57c2, // Purple
  decorator: 0xff9800, // Orange
  condition: 0x1e88e5, // Blue
  action: 0x43a047,    // Green
}

const STATUS_COLORS = {
  SUCCESS: 0x00e676,
  FAILURE: 0xff1744,
  RUNNING: 0xffea00,
  NONE: 0x444444,
}

// Panel geometry matching LevelEditor and SpeedEditor
const PANEL_X = 96
const PANEL_Y = 720
const PANEL_WIDTH = 1728
const PANEL_HEIGHT = 295

export class BehaviorTreeEditorScene extends Phaser.Scene {
  private sessionBundle!: AiEditorSessionBundle
  private worldState!: WorldState
  private readonly roomView = new PhaserRoomView()
  private currentTree: BehaviorTreeDef = cloneBehaviorTree(BOSS_CYBER_ENFORCER_TREE)
  private selectedNodeId: string | null = null
  private presetButtons: { bg: Phaser.GameObjects.Rectangle; id: string }[] = []

  // Simulation controls
  private isSimRunning = true

  // Bottom panel visibility toggle (P key)
  private isPanelVisible = true
  private panelContainer!: Phaser.GameObjects.Container

  // Tree canvas dragging / panning
  private treeOffsetX = 0
  private treeOffsetY = 0
  private isPanningTree = false
  private panStartPointerX = 0
  private panStartPointerY = 0
  private panStartOffsetX = 0
  private panStartOffsetY = 0

  // Tree visual components inside panel
  private treeGraphics!: Phaser.GameObjects.Graphics
  private treeContainer!: Phaser.GameObjects.Container
  private nodeViews = new Map<
    string,
    {
      container: Phaser.GameObjects.Container
      bg: Phaser.GameObjects.Rectangle
      badge: Phaser.GameObjects.Rectangle
      typeText: Phaser.GameObjects.Text
      titleText: Phaser.GameObjects.Text
      statusDot: Phaser.GameObjects.Arc
    }
  >()

  // Room overlay graphics & overhead labels (in real room space)
  private roomOverlayGraphics!: Phaser.GameObjects.Graphics
  private overheadActionTag!: Phaser.GameObjects.Text

  // Inspector & UI components
  private inspectorTitleText!: Phaser.GameObjects.Text
  private inspectorDetailsText!: Phaser.GameObjects.Text
  private inspectorStatusText!: Phaser.GameObjects.Text
  private inspectorTelemetryText!: Phaser.GameObjects.Text
  private inspectorParamControls: Phaser.GameObjects.GameObject[] = []
  private statusBannerText!: Phaser.GameObjects.Text
  private playPauseButtonText!: Phaser.GameObjects.Text
  private headerText!: Phaser.GameObjects.Text
  private instructionText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'behavior-tree-editor' })
  }

  preload(): void {
    for (const [textureKey, imageUrl] of Object.entries(WORLD_OBJECT_TEXTURE_URLS)) {
      if (!this.textures.exists(textureKey)) {
        this.load.image(textureKey, imageUrl)
      }
    }
  }

  create(): void {
    this.presetButtons = []
    this.selectedNodeId = this.currentTree.root.id
    this.isSimRunning = true
    this.isPanelVisible = true
    this.treeOffsetX = 0
    this.treeOffsetY = 0

    // Initialize AI session reusing room1 environment
    this.sessionBundle = createAiEditorSession({
      tree: this.currentTree,
      objects: ROOM1_OBJECTS,
    })
    this.worldState = this.sessionBundle.worldState

    // Mount Room 1 environment view (identical to gameplay and speed editor)
    this.roomView.mount(this, this.worldState)

    // Room overlay graphics in real room coordinates
    this.roomOverlayGraphics = this.add.graphics().setDepth(5)
    this.overheadActionTag = this.add
      .text(0, 0, '[IDLE]', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: VALUE_COLOR,
        backgroundColor: '#111111',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setDepth(6)

    this.buildTopNavigationBar()
    this.buildBottomPanel()
    this.buildInstructionsBar()

    this.setupInputHandlers()
    this.refreshTreeVisuals()
    this.refreshInspector()
    this.showStatus('Room 1 AI Chamber loaded. Arrows: Move player · Click enemy to preview AI · R: Reset · P: Toggle Panel.')
  }

  update(_time: number, delta: number): void {
    if (this.isSimRunning) {
      this.sessionBundle.step(delta)
    }

    // Update room visuals using main game interpolation
    this.roomView.update(this.worldState, (objectId) =>
      this.sessionBundle.session.getRenderPosition(objectId),
    )

    this.updateRoomOverlayVisuals()
    this.updateNodeStatusHalo()
  }

  // ─────────────────────────────────────────────────────────────
  // 1. TOP NAVIGATION & PRESET TOOLBAR
  // ─────────────────────────────────────────────────────────────

  private buildTopNavigationBar(): void {
    // Row 1: Title (left) & Navigation Hints (right)
    this.headerText = this.add
      .text(40, 14, 'AI BEHAVIOR TREE EDITOR — Room 1 Live Environment', {
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        color: ACCENT_COLOR,
      })
      .setOrigin(0, 0)
      .setDepth(50)

    this.add
      .text(1880, 14, 'R: Reset · P: Panel · F1: Command · F2: Level · F3: Speed · F4 / ESC: Game', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: DIM_COLOR,
      })
      .setOrigin(1, 0)
      .setDepth(50)

    // Row 2: Preset selector buttons (left) & Sim playback controls (right)
    this.add
      .text(40, 48, 'PRESETS:', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0.5)
      .setDepth(50)

    const presetNames: Record<string, string> = {
      'standard-guard': 'STD GUARD',
      'patrol-guard': 'PATROL GUARD',
      'boss-cyber-enforcer': 'CYBER BOSS',
      'hit-and-run': 'HIT & RUN',
      'tank-boss': 'TANK BOSS',
    }

    const presetStartX = 175
    const presetWidth = 125
    PRESET_BEHAVIOR_TREES.forEach((preset, index) => {
      const btnX = presetStartX + index * (presetWidth + 8)
      const isSelected = preset.id === this.currentTree.id

      const btnBg = this.add
        .rectangle(btnX, 48, presetWidth, 26, isSelected ? 0x00838f : 0x263238, 1)
        .setStrokeStyle(1, isSelected ? 0x00e5ff : 0x455a64, 1)
        .setInteractive({ useHandCursor: true })
        .setDepth(50)

      this.presetButtons.push({ bg: btnBg, id: preset.id })

      const displayName = presetNames[preset.id] ?? preset.name.substring(0, 10).toUpperCase()
      this.add
        .text(btnX, 48, displayName, {
          fontFamily: FONT_FAMILY,
          fontSize: 9,
          color: '#ffffff',
        })
        .setOrigin(0.5, 0.5)
        .setDepth(51)

      btnBg.on('pointerdown', () => {
        this.loadPreset(preset)
      })
    })

    // Sim control buttons placed on the right of Row 2
    const simStartX = 1555

    // Play / Pause
    const playPauseBg = this.add
      .rectangle(simStartX, 48, 108, 26, 0x1b5e20, 1)
      .setStrokeStyle(1, 0x00e676, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(50)

    this.playPauseButtonText = this.add
      .text(simStartX, 48, 'PAUSE (SPC)', {
        fontFamily: FONT_FAMILY,
        fontSize: 9,
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(51)

    playPauseBg.on('pointerdown', () => this.toggleSimPlayback())

    // Step button
    const stepBg = this.add
      .rectangle(simStartX + 95, 48, 68, 26, 0x37474f, 1)
      .setStrokeStyle(1, 0x78909c, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(50)

    this.add
      .text(simStartX + 95, 48, 'STEP (T)', {
        fontFamily: FONT_FAMILY,
        fontSize: 9,
        color: '#eceff1',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(51)

    stepBg.on('pointerdown', () => this.stepSimulation())

    // Reset Sim button
    const resetBg = this.add
      .rectangle(simStartX + 175, 48, 78, 26, 0xb71c1c, 1)
      .setStrokeStyle(1, 0xff5252, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(50)

    this.add
      .text(simStartX + 175, 48, 'RESET (R)', {
        fontFamily: FONT_FAMILY,
        fontSize: 9,
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(51)

    resetBg.on('pointerdown', () => this.resetPositions())
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ROOM OVERLAY VISUALS (REAL ROOM COORDINATES)
  // ─────────────────────────────────────────────────────────────

  private updateRoomOverlayVisuals(): void {
    const targetGuard = this.worldState.worldObjects.find((o) => o.id === this.sessionBundle.targetGuardId)
    const player = this.worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)

    this.roomOverlayGraphics.clear()

    if (!targetGuard || !player) return

    const gState = targetGuard.state as {
      x: number
      y: number
      health: number
      maxHealth: number
      speed: number
      alerted?: boolean
      chasing?: boolean
      attacking?: boolean
    }
    const pState = player.state as { x: number; y: number; health: number; maxHealth: number }

    const renderPos = this.sessionBundle.session.getRenderPosition(targetGuard.id) ?? { x: gState.x, y: gState.y }
    const pRenderPos = this.sessionBundle.session.getRenderPosition(player.id) ?? { x: pState.x, y: pState.y }

    // Active preview enemy highlight ring (yellow)
    this.roomOverlayGraphics.lineStyle(2, 0xffea00, 0.75)
    this.roomOverlayGraphics.strokeCircle(renderPos.x, renderPos.y, 48)

    // Other non-target enemies: show subtle clickable preview ring
    for (const obj of this.worldState.worldObjects) {
      if ((obj.metadata.role === 'enemy' || obj.metadata.role === 'guard') && obj.id !== targetGuard.id) {
        const oState = obj.state as Record<string, unknown>
        if (oState.alive !== false) {
          const pos = this.sessionBundle.session.getRenderPosition(obj.id) ?? {
            x: typeof oState.x === 'number' ? oState.x : 0,
            y: typeof oState.y === 'number' ? oState.y : 0,
          }
          this.roomOverlayGraphics.lineStyle(1, 0x78909c, 0.4)
          this.roomOverlayGraphics.strokeCircle(pos.x, pos.y, 36)
        }
      }
    }

    // Detection range ring (cyan)
    this.roomOverlayGraphics.lineStyle(2, 0x00bcd4, 0.35)
    this.roomOverlayGraphics.strokeCircle(renderPos.x, renderPos.y, 380)

    // Attack reach ring (red)
    this.roomOverlayGraphics.lineStyle(2, 0xff1744, 0.6)
    this.roomOverlayGraphics.strokeCircle(renderPos.x, renderPos.y, 60)

    // Distance line
    const dist = Math.round(Math.hypot(renderPos.x - pRenderPos.x, renderPos.y - pRenderPos.y))
    this.roomOverlayGraphics.lineStyle(1, 0x555555, 0.4)
    this.roomOverlayGraphics.lineBetween(renderPos.x, renderPos.y, pRenderPos.x, pRenderPos.y)

    // Overhead action tag
    let actionLabel = '[PATROL]'
    if (gState.attacking) {
      actionLabel = '[MELEE STRIKE!]'
    } else if (gState.chasing) {
      const hpRatio = gState.health / (gState.maxHealth || 100)
      actionLabel = hpRatio < 0.5 ? '[ENRAGED CHASE]' : '[CHASING]'
    } else if (gState.alerted) {
      actionLabel = '[ALERTED]'
    }
    this.overheadActionTag.setText(`[${targetGuard.id.toUpperCase()}] ${actionLabel}`)
    this.overheadActionTag.setPosition(renderPos.x, renderPos.y - 78)

    // Update inspector telemetry text
    const hpFrac = Math.max(0, Math.min(1, gState.health / (gState.maxHealth || 100)))
    const hpPercent = Math.round(hpFrac * 100)
    const phaseText = hpPercent < 50 ? 'PHASE 2 (BERSERK)' : 'PHASE 1 (TACTICAL)'

    this.inspectorTelemetryText?.setText(
      `TARGET: ${targetGuard.id} (${phaseText})\n` +
      `HP: ${gState.health} / ${gState.maxHealth} (${hpPercent}%) · DIST: ${dist}px`,
    )
  }

  // ─────────────────────────────────────────────────────────────
  // 3. BOTTOM EDITOR PANEL (DOCKS BELOW ROOM AT y=720)
  // ─────────────────────────────────────────────────────────────

  private buildBottomPanel(): void {
    const items: Phaser.GameObjects.GameObject[] = []

    // Background rectangle
    const bg = this.add
      .rectangle(PANEL_WIDTH / 2, PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, PANEL_BG, 0.96)
      .setStrokeStyle(2, 0x444444, 1)
    items.push(bg)

    // Vertical column dividers
    const div = this.add.graphics()
    div.lineStyle(2, 0x333333, 1)
    div.lineBetween(630, 16, 630, PANEL_HEIGHT - 16)
    div.lineBetween(1210, 16, 1210, PANEL_HEIGHT - 16)
    items.push(div)

    // ─── Column 1: Behavior Tree Graph Canvas ───
    const col1Title = this.add
      .text(20, 16, 'BEHAVIOR TREE GRAPH (Drag to pan)', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: ACCENT_COLOR,
      })
    items.push(col1Title)

    const resetPan = this.add
      .text(610, 16, '[CENTER]', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: VALUE_COLOR,
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })

    resetPan.on('pointerdown', () => {
      this.treeOffsetX = 0
      this.treeOffsetY = 0
      this.refreshTreeVisuals()
    })
    items.push(resetPan)

    // Container for tree nodes and connectors
    this.treeContainer = this.add.container(20, 42)
    this.treeGraphics = this.add.graphics()
    this.treeContainer.add(this.treeGraphics)
    const treeMaskGraphics = this.make.graphics({})
    treeMaskGraphics.fillRect(PANEL_X + 10, PANEL_Y + 38, 610, PANEL_HEIGHT - 48)
    this.treeContainer.setMask(treeMaskGraphics.createGeometryMask())
    items.push(this.treeContainer)

    // Pan zone for tree graph
    const treePanZone = this.add
      .zone(315, 150, 610, 230)
      .setInteractive()

    treePanZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isPanningTree = true
      this.panStartPointerX = pointer.x
      this.panStartPointerY = pointer.y
      this.panStartOffsetX = this.treeOffsetX
      this.panStartOffsetY = this.treeOffsetY
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPanningTree && pointer.isDown) {
        this.treeOffsetX = this.panStartOffsetX + (pointer.x - this.panStartPointerX)
        this.treeOffsetY = this.panStartOffsetY + (pointer.y - this.panStartPointerY)
        this.refreshTreeVisuals()
      }
    })

    this.input.on('pointerup', () => {
      this.isPanningTree = false
    })
    items.push(treePanZone)

    // ─── Column 2: Tree Editing ───
    const col2Title = this.add
      .text(650, 16, 'TREE EDITING: ADD CHILD / MANIPULATE', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: ACCENT_COLOR,
      })
    items.push(col2Title)

    // Row 1: Composites & Decorators
    const addSeqBtn = this.createButton(
      715,
      56,
      '+ SEQUENCE',
      '#7b1fa2',
      '#ffffff',
      () => this.onAddChild('sequence'),
      125,
      28,
    )
    const addSelBtn = this.createButton(
      850,
      56,
      '+ SELECTOR',
      '#7b1fa2',
      '#ffffff',
      () => this.onAddChild('selector'),
      125,
      28,
    )
    const addCooldownBtn = this.createButton(
      985,
      56,
      '+ COOLDOWN',
      '#ef6c00',
      '#ffffff',
      () => this.onAddChild('cooldown'),
      125,
      28,
    )
    const addInvertBtn = this.createButton(
      1120,
      56,
      '+ INVERTER',
      '#ef6c00',
      '#ffffff',
      () => this.onAddChild('inverter'),
      125,
      28,
    )
    items.push(addSeqBtn, addSelBtn, addCooldownBtn, addInvertBtn)

    // Row 2: Conditions (Blue)
    const addRangeCondBtn = this.createButton(
      745,
      96,
      '+ RANGE',
      '#1565c0',
      '#ffffff',
      () => this.onAddChild('is_player_in_range'),
      160,
      28,
    )
    const addHpCondBtn = this.createButton(
      920,
      96,
      '+ HP < 50%',
      '#1565c0',
      '#ffffff',
      () => this.onAddChild('is_health_below'),
      160,
      28,
    )
    const addZoneCondBtn = this.createButton(
      1095,
      96,
      '+ ZONE',
      '#1565c0',
      '#ffffff',
      () => this.onAddChild('is_player_in_zone'),
      160,
      28,
    )
    items.push(addRangeCondBtn, addHpCondBtn, addZoneCondBtn)

    // Row 3: Actions (Green)
    const addChaseActBtn = this.createButton(
      715,
      136,
      '+ CHASE',
      '#2e7d32',
      '#ffffff',
      () => this.onAddChild('chase_player'),
      125,
      28,
    )
    const addMeleeActBtn = this.createButton(
      850,
      136,
      '+ MELEE',
      '#2e7d32',
      '#ffffff',
      () => this.onAddChild('melee_attack'),
      125,
      28,
    )
    const addChargeActBtn = this.createButton(
      985,
      136,
      '+ CHARGE',
      '#2e7d32',
      '#ffffff',
      () => this.onAddChild('charge_attack'),
      125,
      28,
    )
    const addPatrolActBtn = this.createButton(
      1120,
      136,
      '+ PATROL',
      '#2e7d32',
      '#ffffff',
      () => this.onAddChild('patrol'),
      125,
      28,
    )
    items.push(addChaseActBtn, addMeleeActBtn, addChargeActBtn, addPatrolActBtn)

    // Row 4: Reorder & Delete
    const moveLeftBtn = this.createButton(
      730,
      182,
      '◄ MOVE NODE',
      '#263238',
      '#eceff1',
      () => this.onMoveChild('left'),
      140,
      32,
    )
    const moveRightBtn = this.createButton(
      885,
      182,
      'MOVE NODE ►',
      '#263238',
      '#eceff1',
      () => this.onMoveChild('right'),
      140,
      32,
    )
    const deleteBtn = this.createButton(
      1065,
      182,
      '🗑 DELETE (DEL)',
      '#b71c1c',
      '#ffffff',
      () => this.onDeleteNode(),
      170,
      32,
    )
    items.push(moveLeftBtn, moveRightBtn, deleteBtn)

    // Status banner at bottom of Col 2
    this.statusBannerText = this.add
      .text(650, 240, '', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: VALUE_COLOR,
        wordWrap: { width: 540 },
      })
    items.push(this.statusBannerText)

    // ─── Column 3: Node Inspector & Telemetry & Actions ───
    const col3Title = this.add
      .text(1230, 16, 'NODE INSPECTOR & TELEMETRY', {
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        color: ACCENT_COLOR,
      })
    items.push(col3Title)

    this.inspectorTitleText = this.add
      .text(1230, 38, 'No node selected', {
        fontFamily: FONT_FAMILY,
        fontSize: 11,
        color: VALUE_COLOR,
      })
    items.push(this.inspectorTitleText)

    this.inspectorDetailsText = this.add
      .text(1230, 58, '', {
        fontFamily: FONT_FAMILY,
        fontSize: 9,
        color: DIM_COLOR,
        lineSpacing: 2,
      })
    items.push(this.inspectorDetailsText)

    this.inspectorStatusText = this.add
      .text(1230, 82, '', {
        fontFamily: FONT_FAMILY,
        fontSize: 10,
        color: TEXT_COLOR,
      })
    items.push(this.inspectorStatusText)

    this.inspectorTelemetryText = this.add
      .text(1230, 106, '', {
        fontFamily: FONT_FAMILY,
        fontSize: 9.5,
        color: ACCENT_COLOR,
        lineSpacing: 3,
      })
    items.push(this.inspectorTelemetryText)

    // Testing and action buttons
    const dmgBtn = this.createButton(
      1295,
      196,
      'DMG BOSS (-25)',
      '#c62828',
      '#ffffff',
      () => {
        this.sessionBundle.damageBoss(25)
        this.showStatus('Damaged Boss by 25 HP.')
      },
      125,
      28,
    )
    const healBtn = this.createButton(
      1435,
      196,
      'HEAL BOSS (+25)',
      '#2e7d32',
      '#ffffff',
      () => {
        this.sessionBundle.healBoss(25)
        this.showStatus('Healed Boss by 25 HP.')
      },
      125,
      28,
    )
    const saveBtn = this.createButton(
      1590,
      196,
      '💾 SAVE TO GAME',
      '#00695c',
      '#ffffff',
      () => this.saveToGame(),
      150,
      28,
    )
    const copyJsonBtn = this.createButton(
      1440,
      240,
      '📋 COPY TREE JSON',
      '#37474f',
      '#eceff1',
      () => this.copyJsonToClipboard(),
      200,
      26,
    )

    items.push(dmgBtn, healBtn, saveBtn, copyJsonBtn)

    this.panelContainer = this.add.container(PANEL_X, PANEL_Y, items).setDepth(40)
  }

  private buildInstructionsBar(): void {
    this.instructionText = this.add
      .text(
        960,
        1048,
        'Arrows: Move player · Click enemy: Preview AI · R: Reset · Drag canvas: Pan tree',
        {
          fontFamily: FONT_FAMILY,
          fontSize: 13,
          color: DIM_COLOR,
        },
      )
      .setOrigin(0.5, 0.5)
      .setDepth(50)
  }

  private refreshTreeVisuals(): void {
    for (const view of this.nodeViews.values()) {
      view.container.destroy()
    }
    this.nodeViews.clear()
    this.treeGraphics.clear()

    const layout = computeTreeLayout(this.currentTree.root, {
      nodeWidth: 140,
      nodeHeight: 44,
      horizontalSpacing: 20,
      verticalSpacing: 68,
      startX: 30 + this.treeOffsetX,
      startY: 20 + this.treeOffsetY,
    })

    this.drawTreeConnectors(this.currentTree.root, layout)

    for (const [id, pos] of layout.entries()) {
      const node = findNodeById(this.currentTree.root, id)
      if (!node) continue

      const isSelected = id === this.selectedNodeId
      const category = getNodeCategory(node.type)
      const catColor = CATEGORY_COLORS[category]

      const container = this.add.container(pos.x, pos.y)

      const bg = this.add
        .rectangle(0, 0, pos.width, pos.height, 0x1f1f1f, 1)
        .setStrokeStyle(isSelected ? 2.5 : 1.5, isSelected ? 0x00e5ff : 0x555555, 1)
        .setInteractive({ useHandCursor: true })

      const badge = this.add
        .rectangle(-pos.width / 2 + 4, 0, 6, pos.height, catColor, 1)

      const typeLabel = node.type.toUpperCase().replace(/_/g, ' ')
      const shortType = typeLabel.length > 13 ? typeLabel.substring(0, 12) : typeLabel
      const typeText = this.add
        .text(-pos.width / 2 + 14, -12, shortType, {
          fontFamily: FONT_FAMILY,
          fontSize: 7,
          color: '#' + catColor.toString(16).padStart(6, '0'),
        })

      const cleanName = node.name.length > 13 ? node.name.substring(0, 12) + '…' : node.name
      const titleText = this.add
        .text(-pos.width / 2 + 14, 3, cleanName, {
          fontFamily: FONT_FAMILY,
          fontSize: 8,
          color: TEXT_COLOR,
        })

      const statusDot = this.add.circle(pos.width / 2 - 10, 0, 4, STATUS_COLORS.NONE)

      bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.stopPropagation?.()
        this.selectNode(node.id)
      })

      container.add([bg, badge, typeText, titleText, statusDot])
      this.treeContainer.add(container)

      this.nodeViews.set(id, {
        container,
        bg,
        badge,
        typeText,
        titleText,
        statusDot,
      })
    }
  }

  private drawTreeConnectors(node: BehaviorTreeNodeDef, layout: Map<string, NodeLayout>): void {
    const parentPos = layout.get(node.id)
    if (!parentPos || !node.children) return

    const parentBottomX = parentPos.x
    const parentBottomY = parentPos.y + parentPos.height / 2

    this.treeGraphics.lineStyle(2, 0x616161, 0.8)

    for (const child of node.children) {
      const childPos = layout.get(child.id)
      if (!childPos) continue

      const childTopX = childPos.x
      const childTopY = childPos.y - childPos.height / 2

      const midY = (parentBottomY + childTopY) / 2
      this.treeGraphics.beginPath()
      this.treeGraphics.moveTo(parentBottomX, parentBottomY)
      this.treeGraphics.lineTo(parentBottomX, midY)
      this.treeGraphics.lineTo(childTopX, midY)
      this.treeGraphics.lineTo(childTopX, childTopY)
      this.treeGraphics.strokePath()

      this.drawTreeConnectors(child, layout)
    }
  }

  private updateNodeStatusHalo(): void {
    const statuses = this.sessionBundle.getNodeStatuses()

    for (const [id, view] of this.nodeViews.entries()) {
      const isSelected = id === this.selectedNodeId
      const status = statuses.get(id)

      if (status === 'SUCCESS') {
        view.statusDot.setFillStyle(STATUS_COLORS.SUCCESS)
        view.bg.setStrokeStyle(isSelected ? 2.5 : 2, STATUS_COLORS.SUCCESS, 1)
      } else if (status === 'FAILURE') {
        view.statusDot.setFillStyle(STATUS_COLORS.FAILURE)
        view.bg.setStrokeStyle(isSelected ? 2.5 : 2, STATUS_COLORS.FAILURE, 1)
      } else if (status === 'RUNNING') {
        view.statusDot.setFillStyle(STATUS_COLORS.RUNNING)
        view.bg.setStrokeStyle(isSelected ? 2.5 : 2, STATUS_COLORS.RUNNING, 1)
      } else {
        view.statusDot.setFillStyle(STATUS_COLORS.NONE)
        view.bg.setStrokeStyle(isSelected ? 2.5 : 1.5, isSelected ? 0x00e5ff : 0x555555, 1)
      }
    }
  }

  private refreshInspector(): void {
    for (const ctrl of this.inspectorParamControls) {
      ctrl.destroy()
    }
    this.inspectorParamControls = []

    if (!this.selectedNodeId) {
      this.inspectorTitleText.setText('No node selected')
      this.inspectorDetailsText.setText('Click any node in graph.')
      this.inspectorStatusText.setText('')
      return
    }

    const node = findNodeById(this.currentTree.root, this.selectedNodeId)
    if (!node) {
      this.selectedNodeId = null
      this.refreshInspector()
      return
    }

    const category = getNodeCategory(node.type).toUpperCase()
    this.inspectorTitleText.setText(`[${category}] ${node.name}`)
    this.inspectorDetailsText.setText(`ID: ${node.id} · TYPE: ${node.type} · CHILDREN: ${node.children?.length ?? 0}`)

    const lastStatus = this.sessionBundle.getNodeStatuses().get(node.id) ?? 'NOT VISITED'
    this.inspectorStatusText.setText(`STATUS: ${lastStatus}`)

    this.buildParameterAdjusters(node)
  }

  private buildParameterAdjusters(node: BehaviorTreeNodeDef): void {
    const startX = 1230
    const startY = 152

    if (node.type === 'is_player_in_range') {
      const curRange = node.params?.range ?? 350
      const label = this.add
        .text(startX, startY, `Range: ${curRange}px`, {
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          color: VALUE_COLOR,
        })

      const decBtn = this.createButton(
        startX + 220,
        startY + 4,
        '-50',
        '#263238',
        '#ef9a9a',
        () => {
          node.params = { ...node.params, range: Math.max(50, curRange - 50) }
          this.sessionBundle.setTree(this.currentTree)
          this.refreshInspector()
        },
        48,
        22,
      )

      const incBtn = this.createButton(
        startX + 280,
        startY + 4,
        '+50',
        '#263238',
        '#a5d6a7',
        () => {
          node.params = { ...node.params, range: curRange + 50 }
          this.sessionBundle.setTree(this.currentTree)
          this.refreshInspector()
        },
        48,
        22,
      )

      this.panelContainer.add([label, decBtn, incBtn])
      this.inspectorParamControls.push(label, decBtn, incBtn)
    } else if (node.type === 'is_health_below') {
      const curThresh = node.params?.thresholdPercent ?? 50
      const label = this.add
        .text(startX, startY, `Threshold: ${curThresh}%`, {
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          color: VALUE_COLOR,
        })

      const decBtn = this.createButton(
        startX + 220,
        startY + 4,
        '-10%',
        '#263238',
        '#ef9a9a',
        () => {
          node.params = { ...node.params, thresholdPercent: Math.max(10, curThresh - 10) }
          this.sessionBundle.setTree(this.currentTree)
          this.refreshInspector()
        },
        48,
        22,
      )

      const incBtn = this.createButton(
        startX + 280,
        startY + 4,
        '+10%',
        '#263238',
        '#a5d6a7',
        () => {
          node.params = { ...node.params, thresholdPercent: Math.min(90, curThresh + 10) }
          this.sessionBundle.setTree(this.currentTree)
          this.refreshInspector()
        },
        48,
        22,
      )

      this.panelContainer.add([label, decBtn, incBtn])
      this.inspectorParamControls.push(label, decBtn, incBtn)
    } else if (node.type === 'cooldown') {
      const curCd = node.params?.cooldownMs ?? 2500
      const label = this.add
        .text(startX, startY, `Cooldown: ${(curCd / 1000).toFixed(1)}s`, {
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          color: VALUE_COLOR,
        })

      const decBtn = this.createButton(
        startX + 220,
        startY + 4,
        '-0.5s',
        '#263238',
        '#ef9a9a',
        () => {
          node.params = { ...node.params, cooldownMs: Math.max(500, curCd - 500) }
          this.sessionBundle.setTree(this.currentTree)
          this.refreshInspector()
        },
        50,
        22,
      )

      const incBtn = this.createButton(
        startX + 280,
        startY + 4,
        '+0.5s',
        '#263238',
        '#a5d6a7',
        () => {
          node.params = { ...node.params, cooldownMs: curCd + 500 }
          this.sessionBundle.setTree(this.currentTree)
          this.refreshInspector()
        },
        50,
        22,
      )

      this.panelContainer.add([label, decBtn, incBtn])
      this.inspectorParamControls.push(label, decBtn, incBtn)
    } else if (node.type === 'chase_player') {
      const curSpeedMult = node.params?.speedMultiplier ?? 1.0
      const label = this.add
        .text(startX, startY, `Speed: ${curSpeedMult.toFixed(1)}x`, {
          fontFamily: FONT_FAMILY,
          fontSize: 10,
          color: VALUE_COLOR,
        })

      const decBtn = this.createButton(
        startX + 220,
        startY + 4,
        '-0.2x',
        '#263238',
        '#ef9a9a',
        () => {
          node.params = { ...node.params, speedMultiplier: Math.max(0.4, Number((curSpeedMult - 0.2).toFixed(1))) }
          this.sessionBundle.setTree(this.currentTree)
          this.refreshInspector()
        },
        50,
        22,
      )

      const incBtn = this.createButton(
        startX + 280,
        startY + 4,
        '+0.2x',
        '#263238',
        '#a5d6a7',
        () => {
          node.params = { ...node.params, speedMultiplier: Math.min(2.5, Number((curSpeedMult + 0.2).toFixed(1))) }
          this.sessionBundle.setTree(this.currentTree)
          this.refreshInspector()
        },
        50,
        22,
      )

      this.panelContainer.add([label, decBtn, incBtn])
      this.inspectorParamControls.push(label, decBtn, incBtn)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ACTIONS & TREE MANIPULATION
  // ─────────────────────────────────────────────────────────────

  private selectNode(nodeId: string): void {
    this.selectedNodeId = nodeId
    this.refreshTreeVisuals()
    this.refreshInspector()
  }

  private onAddChild(type: BehaviorNodeType): void {
    if (!this.selectedNodeId) {
      this.showStatus('Please select a parent composite or decorator node first.')
      return
    }

    const newNode = createDefaultNode(type)
    const success = addChildNode(this.currentTree.root, this.selectedNodeId, newNode)

    if (success) {
      this.selectedNodeId = newNode.id
      this.sessionBundle.setTree(this.currentTree)
      this.refreshTreeVisuals()
      this.refreshInspector()
      this.showStatus(`Added ${newNode.name} under selected node.`)
    } else {
      this.showStatus('Cannot add child to leaf or full decorator node.')
    }
  }

  private onDeleteNode(): void {
    if (!this.selectedNodeId) return

    if (this.selectedNodeId === this.currentTree.root.id) {
      this.showStatus('Cannot delete the root node of the tree.')
      return
    }

    const parentInfo = findParentNode(this.currentTree.root, this.selectedNodeId)
    const success = removeNode(this.currentTree.root, this.selectedNodeId)

    if (success) {
      this.selectedNodeId = parentInfo?.parent.id ?? this.currentTree.root.id
      this.sessionBundle.setTree(this.currentTree)
      this.refreshTreeVisuals()
      this.refreshInspector()
      this.showStatus('Node deleted.')
    }
  }

  private onMoveChild(direction: 'left' | 'right'): void {
    if (!this.selectedNodeId) return

    const success = moveChild(this.currentTree.root, this.selectedNodeId, direction)
    if (success) {
      this.sessionBundle.setTree(this.currentTree)
      this.refreshTreeVisuals()
      this.showStatus(`Moved node ${direction}.`)
    }
  }

  private loadPreset(preset: BehaviorTreeDef): void {
    this.currentTree = cloneBehaviorTree(preset)
    this.selectedNodeId = this.currentTree.root.id
    this.sessionBundle.setTree(this.currentTree)
    this.resetPositions()
    this.refreshTreeVisuals()
    this.refreshInspector()
    this.presetButtons.forEach(({ bg, id }) => {
      const isSelected = id === preset.id
      bg.setFillStyle(isSelected ? 0x00838f : 0x263238, 1)
      bg.setStrokeStyle(1, isSelected ? 0x00e5ff : 0x455a64, 1)
    })
    this.showStatus(`Loaded preset: ${preset.name}`)
  }

  private toggleSimPlayback(): void {
    this.isSimRunning = !this.isSimRunning
    this.playPauseButtonText.setText(this.isSimRunning ? 'PAUSE (SPC)' : 'RESUME (SPC)')
    this.showStatus(this.isSimRunning ? 'Simulation running.' : 'Simulation paused.')
  }

  private stepSimulation(): void {
    this.sessionBundle.step(33.333)
    this.showStatus('Stepped simulation +33ms.')
  }

  private resetPositions(): void {
    this.sessionBundle.resetArena()
    this.showStatus('Reset player and guard positions.')
  }

  private togglePanel(): void {
    this.isPanelVisible = !this.isPanelVisible
    this.panelContainer.setVisible(this.isPanelVisible)
  }

  private async saveToGame(): Promise<void> {
    const guard = ROOM1_OBJECTS.find((o) => o.role === 'enemy' || o.role === 'guard' || o.id === this.sessionBundle.targetGuardId)
    if (guard) {
      ;(guard as unknown as Record<string, unknown>).behaviorTree = this.currentTree
    }

    try {
      const source = generateRoom1Source(ROOM1_OBJECTS)
      const res = await fetch('/api/save-room1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: source }),
      })

      if (res.ok) {
        this.showStatus('Saved Behavior Tree to guard in room1.ts!')
      } else {
        this.showStatus('Applied Behavior Tree to active game session.')
      }
    } catch {
      this.showStatus('Applied Behavior Tree to active in-memory session.')
    }
  }

  private copyJsonToClipboard(): void {
    const jsonStr = JSON.stringify(this.currentTree, null, 2)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr)
      this.showStatus('Copied Behavior Tree JSON to clipboard!')
    } else {
      console.log('BEHAVIOR TREE JSON:\n', jsonStr)
      this.showStatus('Printed Behavior Tree JSON to console.')
    }
  }

  private showStatus(msg: string): void {
    this.statusBannerText?.setText(msg)
  }

  // ─────────────────────────────────────────────────────────────
  // 5. INPUT BINDINGS & SCENE NAVIGATION
  // ─────────────────────────────────────────────────────────────

  private setupInputHandlers(): void {
    this.input.keyboard?.on('keydown', this.handleKeyDown)
    this.input.keyboard?.on('keyup', this.handleKeyUp)

    // Click in Room 1 area (y: 80..700, x: 96..1824) to preview AI with the clicked enemy
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (
        pointer.y >= ROOM_LAYOUT.top &&
        pointer.y <= ROOM_LAYOUT.bottom &&
        pointer.x >= ROOM_LAYOUT.left &&
        pointer.x <= ROOM_LAYOUT.right
      ) {
        const clickedEnemy = this.findEnemyAtPointer(pointer.x, pointer.y)
        if (clickedEnemy) {
          this.previewAiWithEnemy(clickedEnemy.id)
        }
      }
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.handleKeyDown)
      this.input.keyboard?.off('keyup', this.handleKeyUp)
      this.roomView.destroy()
      this.roomOverlayGraphics?.destroy()
      this.overheadActionTag?.destroy()
      this.headerText?.destroy()
      this.instructionText?.destroy()
      this.panelContainer?.destroy(true)
      this.nodeViews.clear()
      this.presetButtons = []
    })
  }

  private findEnemyAtPointer(x: number, y: number): WorldObject | undefined {
    let closestEnemy: WorldObject | undefined
    let minDistance = Infinity

    for (const obj of this.worldState.worldObjects) {
      if (obj.metadata.role !== 'enemy' && obj.metadata.role !== 'guard' && !obj.id.startsWith('guard')) {
        continue
      }
      const gState = obj.state as Record<string, unknown>
      if (gState.alive === false) {
        continue
      }
      const renderPos = this.sessionBundle.session.getRenderPosition(obj.id)
      const gx = renderPos?.x ?? (typeof gState.x === 'number' ? gState.x : 0)
      const gy = renderPos?.y ?? (typeof gState.y === 'number' ? gState.y : 0)

      const dw = typeof gState.displayWidth === 'number' ? gState.displayWidth : 176
      const dh = typeof gState.displayHeight === 'number' ? gState.displayHeight : 176
      const halfW = Math.max(35, dw / 2)
      const halfH = Math.max(35, dh / 2)
      const hitPadding = 25

      const isInside =
        x >= gx - halfW - hitPadding &&
        x <= gx + halfW + hitPadding &&
        y >= gy - halfH - hitPadding &&
        y <= gy + halfH + hitPadding

      const dist = Math.hypot(x - gx, y - gy)
      if (isInside || dist <= Math.max(halfW, halfH, 60)) {
        if (dist < minDistance) {
          minDistance = dist
          closestEnemy = obj
        }
      }
    }

    return closestEnemy
  }

  private previewAiWithEnemy(guardId: string): void {
    if (this.sessionBundle.targetGuardId === guardId) {
      this.showStatus(`Already previewing AI with ${guardId}.`)
      return
    }
    const switched = this.sessionBundle.setTargetGuard(guardId)
    if (switched) {
      this.updateRoomOverlayVisuals()
      this.showStatus(`Previewing AI with ${guardId}!`)
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    // Toggle bottom panel with P
    if (event.key === 'p' || event.key === 'P') {
      event.preventDefault()
      this.togglePanel()
      return
    }

    // Space: Play / Pause
    if (event.code === 'Space') {
      event.preventDefault()
      this.toggleSimPlayback()
      return
    }

    // T: Step
    if (event.key === 't' || event.key === 'T') {
      event.preventDefault()
      this.stepSimulation()
      return
    }

    // R: Reset positions
    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault()
      this.resetPositions()
      return
    }

    // Delete / Backspace: Delete selected node
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.selectedNodeId && this.selectedNodeId !== this.currentTree.root.id) {
        event.preventDefault()
        this.onDeleteNode()
        return
      }
    }

    // Forward arrow keys to player movement in session
    const key = event.key.toLowerCase()
    this.sessionBundle.session.keyDown(key)
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.sessionBundle.session.keyUp(event.key.toLowerCase())
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    bgColor: string,
    textColor: string,
    onClick: () => void,
    width = 125,
    height = 28,
  ): Phaser.GameObjects.Container {
    const bg = this.add
      .rectangle(0, 0, width, height, Phaser.Display.Color.HexStringToColor(bgColor).color, 1)
      .setStrokeStyle(1.5, 0x666666, 1)
      .setInteractive({ useHandCursor: true })

    const label = this.add
      .text(0, 0, text, {
        fontFamily: FONT_FAMILY,
        fontSize: 8,
        color: textColor,
      })
      .setOrigin(0.5, 0.5)

    bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.()
      onClick()
    })

    return this.add.container(x, y, [bg, label])
  }
}
