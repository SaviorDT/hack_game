import type Phaser from 'phaser'

export interface EditorConfig {
  key: string
  hotkey: string
}

export const DEFAULT_EDITORS: EditorConfig[] = [
  { key: 'level-editor', hotkey: 'F2' },
  { key: 'speed-editor', hotkey: 'F3' },
  { key: 'behavior-tree-editor', hotkey: 'F4' },
]

export const DEFAULT_PLAYABLE_SCENE = 'game'

export interface SceneManagerOptions {
  game?: Phaser.Game
  editors?: EditorConfig[]
  defaultPlayableScene?: string
}

export class SceneManager {
  private static readonly instances = new WeakMap<Phaser.Game, SceneManager>()
  private static defaultInstance: SceneManager | undefined

  private readonly game?: Phaser.Game
  private readonly editors: EditorConfig[]
  private activePlayableSceneKey: string
  private currentSceneKey: string
  private keydownListener?: (event: KeyboardEvent) => void
  private isDestroyed = false

  constructor(gameOrOptions?: Phaser.Game | SceneManagerOptions) {
    let game: Phaser.Game | undefined
    let editors = DEFAULT_EDITORS
    let defaultPlayableScene = DEFAULT_PLAYABLE_SCENE

    if (
      gameOrOptions &&
      'scene' in gameOrOptions &&
      typeof (gameOrOptions as Phaser.Game).scene?.getScenes === 'function'
    ) {
      game = gameOrOptions as Phaser.Game
    } else if (gameOrOptions && typeof gameOrOptions === 'object') {
      const opts = gameOrOptions as SceneManagerOptions
      game = opts.game
      if (opts.editors) {
        editors = opts.editors
      }
      if (opts.defaultPlayableScene) {
        defaultPlayableScene = opts.defaultPlayableScene
      }
    }

    this.game = game
    this.editors = [...editors]
    this.activePlayableSceneKey = defaultPlayableScene
    this.currentSceneKey = defaultPlayableScene

    if (game) {
      SceneManager.instances.set(game, this)
      game.registry?.set('sceneManager', this)
      game.events?.once('destroy', () => {
        this.destroy()
      })
    }
    SceneManager.defaultInstance = this

    this.setupGlobalInput()
  }

  public static get(game?: Phaser.Game): SceneManager | undefined {
    if (game && SceneManager.instances.has(game)) {
      return SceneManager.instances.get(game)
    }
    return SceneManager.defaultInstance
  }

  public getEditors(): readonly EditorConfig[] {
    return this.editors
  }

  public isEditorScene(key: string): boolean {
    return key === 'command-editor' || this.editors.some((e) => e.key === key)
  }

  public isPlayableScene(key: string): boolean {
    return !this.isEditorScene(key)
  }

  public getEditorForHotkey(key: string): EditorConfig | undefined {
    const normalized = key.toUpperCase()
    return this.editors.find((e) => e.hotkey.toUpperCase() === normalized)
  }

  public getActivePlayableScene(): string {
    return this.activePlayableSceneKey
  }

  public setActivePlayableScene(key: string): void {
    this.activePlayableSceneKey = key
  }

  public getActiveScene(): Phaser.Scene | undefined {
    if (!this.game) return undefined
    const activeScenes = this.game.scene.getScenes(true)
    return activeScenes[0]
  }

  public getActiveSceneKey(): string {
    const active = this.getActiveScene()
    if (active?.scene?.key) {
      const key = active.scene.key
      this.currentSceneKey = key
      if (this.isPlayableScene(key)) {
        this.activePlayableSceneKey = key
      }
      return key
    }
    return this.currentSceneKey
  }

  public openCommandEditor(): void {
    const activeScene = this.getActiveScene()
    const activeKey = this.getActiveSceneKey()
    if (this.isEditorScene(activeKey) && activeKey !== 'command-editor') {
      this.exitEditor({ openCommandEditor: true })
    } else if (activeScene && typeof (activeScene as any).openCommandEditor === 'function') {
      (activeScene as any).openCommandEditor()
    }
  }

  public closeCommandEditor(): void {
    const activeScene = this.getActiveScene()
    if (activeScene && typeof (activeScene as any).closeCommandEditor === 'function') {
      (activeScene as any).closeCommandEditor()
    }
  }

  public toggleCommandEditor(): void {
    const activeScene = this.getActiveScene()
    const activeKey = this.getActiveSceneKey()
    if (this.isEditorScene(activeKey) && activeKey !== 'command-editor') {
      this.exitEditor({ openCommandEditor: true })
    } else if (activeScene && typeof (activeScene as any).toggleCommandEditor === 'function') {
      (activeScene as any).toggleCommandEditor()
    }
  }

  public isCommandEditorOpen(): boolean {
    const activeScene = this.getActiveScene()
    return typeof (activeScene as any)?.isCommandEditorOpen === 'function'
      ? (activeScene as any).isCommandEditorOpen()
      : false
  }

  public openEditor(editorKey: string, data?: object): void {
    if (editorKey === 'command-editor') {
      this.openCommandEditor()
      return
    }
    const activeScene = this.getActiveScene()
    if (activeScene) {
      if (this.isPlayableScene(activeScene.scene.key)) {
        this.activePlayableSceneKey = activeScene.scene.key
      }
      this.beforeLeave(activeScene)
      this.currentSceneKey = editorKey
      if (data !== undefined) {
        activeScene.scene.start(editorKey, data)
      } else {
        activeScene.scene.start(editorKey)
      }
    } else if (this.game) {
      this.currentSceneKey = editorKey
      if (data !== undefined) {
        this.game.scene.start(editorKey, data)
      } else {
        this.game.scene.start(editorKey)
      }
    } else {
      this.currentSceneKey = editorKey
    }
  }

  public exitEditor(data?: object): void {
    const activeScene = this.getActiveScene()
    const targetKey = this.activePlayableSceneKey

    let transitionData = data
    if (!transitionData && activeScene) {
      if (typeof (activeScene as any).getCurrentRoomId === 'function') {
        const roomId = (activeScene as any).getCurrentRoomId()
        if (roomId) {
          transitionData = { startingRoomId: roomId }
        }
      }
    }

    if (activeScene) {
      this.beforeLeave(activeScene)
      this.currentSceneKey = targetKey
      if (transitionData !== undefined) {
        activeScene.scene.start(targetKey, transitionData)
      } else {
        activeScene.scene.start(targetKey)
      }
    } else if (this.game) {
      this.currentSceneKey = targetKey
      if (transitionData !== undefined) {
        this.game.scene.start(targetKey, transitionData)
      } else {
        this.game.scene.start(targetKey)
      }
    } else {
      this.currentSceneKey = targetKey
    }
  }

  public handleKeyDown = (event: KeyboardEvent): boolean => {
    const key = event.key.toUpperCase()
    const activeKey = this.getActiveSceneKey()

    if (event.ctrlKey && key === 'P') {
      if (activeKey === 'pause') {
        event.preventDefault?.()
        event.stopImmediatePropagation?.()
      } else if (activeKey === 'game') {
        event.preventDefault?.()
        event.stopImmediatePropagation?.()
        const gameScene = this.game?.scene.getScene?.('game') as unknown as { openPause?: () => void }
        gameScene?.openPause?.()
      } else {
        return false
      }
      return true
    }

    // 0. Check if F1 was pressed (Command Editor overlay toggle)
    if (key === 'F1') {
      event.preventDefault?.()
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation()
      }
      this.toggleCommandEditor()
      return true
    }

    // 1. Check if an editor's hotkey was pressed (e.g. F2, F3, F4)
    const editorConfig = this.getEditorForHotkey(key)
    if (editorConfig) {
      event.preventDefault?.()
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation()
      }

      if (activeKey === editorConfig.key) {
        // Pressing an editor's own hotkey exits to active playable scene
        this.exitEditor()
      } else {
        // Pressing another editor's hotkey opens that editor
        let data: object | undefined = undefined
        const activeScene = this.getActiveScene()
        const currentRoomId = (activeScene as any)?.session?.getWorldState?.()?.currentRoomId
        if (currentRoomId && editorConfig.key === 'level-editor') {
          data = { roomId: currentRoomId }
        }
        this.openEditor(editorConfig.key, data)
      }
      return true
    }

    // 2. Check if Escape was pressed
    if (key === 'ESCAPE') {
      const activeScene = this.getActiveScene()
      if (
        activeScene &&
        typeof (activeScene as any).isCommandEditorOpen === 'function' &&
        (activeScene as any).isCommandEditorOpen()
      ) {
        event.preventDefault?.()
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation()
        }
        (activeScene as any).closeCommandEditor()
        return true
      }

      if (this.isEditorScene(activeKey)) {
        // In an editor, Escape exits to active playable scene
        event.preventDefault?.()
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation()
        }
        this.exitEditor()
        return true
      }
      // In playable scene, allow scene to process Escape
      return false
    }

    return false
  }

  public destroy(): void {
    if (this.isDestroyed) return
    this.isDestroyed = true

    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener, { capture: true })
      this.keydownListener = undefined
    }

    if (this.game) {
      SceneManager.instances.delete(this.game)
      this.game.registry?.remove('sceneManager')
    }

    if (SceneManager.defaultInstance === this) {
      SceneManager.defaultInstance = undefined
    }
  }

  private setupGlobalInput(): void {
    if (typeof window === 'undefined') return

    this.keydownListener = (event: KeyboardEvent) => {
      this.handleKeyDown(event)
    }

    window.addEventListener('keydown', this.keydownListener, { capture: true })
  }

  private beforeLeave(scene?: Phaser.Scene): void {
    if (!scene) return
    if ('syncToRoom1Objects' in scene && typeof (scene as any).syncToRoom1Objects === 'function') {
      (scene as any).syncToRoom1Objects()
    }
  }
}
