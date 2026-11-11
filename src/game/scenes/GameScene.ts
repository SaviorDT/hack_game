import Phaser from 'phaser'
import { PhaserGameHud } from '../presentation/PhaserGameHud.ts'
import type { GameSession } from '../application/GameSession.ts'
import { createRoom1Session } from '../content/createRoom1Session.ts'
import { ROOM1_OBJECTS } from '../content/room1.ts'
import { createGameWorldState } from '../content/tutorialRooms.ts'
import { INPUT_BINDINGS } from '../presentation/InputBindings.ts'
import { PhaserGameOutcomePanel } from '../presentation/PhaserGameOutcomePanel.ts'
import { PhaserRoomView, WORLD_OBJECT_TEXTURE_URLS } from '../presentation/PhaserRoomView.ts'
import { InlineCommandInputView } from '../presentation/InlineCommandInputView.ts'
import { CommandEditorOverlay } from './CommandEditorOverlay.ts'

export class GameScene extends Phaser.Scene {
    private session!: GameSession
    private inlineCommandInputView: InlineCommandInputView | undefined
    private readonly roomView = new PhaserRoomView()
    private outcomePanel: PhaserGameOutcomePanel | undefined
    private hud: PhaserGameHud | undefined
    private commandEditor: CommandEditorOverlay | undefined

    private resumeFromSave = false
    private startingRoomId?: string
    private initialOpenCommandEditor = false
    private enteredByShift = false
    /** The room the player was in last frame; entering a different one is a Save Point. */
    private lastRoomId: string | null = null

    constructor() {
        super({ key: 'game' })
    }

    init(data?: { resumeFromSave?: boolean; startingRoomId?: string; openCommandEditor?: boolean }): void {
        this.resumeFromSave = data?.resumeFromSave === true
        this.startingRoomId = data?.startingRoomId
        this.initialOpenCommandEditor = data?.openCommandEditor === true
    }

    preload(): void {
        for (const [textureKey, imageUrl] of Object.entries(WORLD_OBJECT_TEXTURE_URLS)) {
            this.load.image(textureKey, imageUrl)
        }
    }

    create(): void {
        this.session = createRoom1Session({
            movementBindings: INPUT_BINDINGS.movement,
            worldState: createGameWorldState(ROOM1_OBJECTS, this.startingRoomId),
        })
        if (this.resumeFromSave) {
            this.session.loadSavedState()
        } else if (this.startingRoomId) {
            this.session.saveCurrentState()
        }
        const worldState = this.session.getWorldState()
        this.lastRoomId = worldState.currentRoomId
        this.cameras.main.setBackgroundColor('#0b141d')
        this.roomView.mount(this, worldState, false)
        this.hud = new PhaserGameHud(this)
        this.hud.update(worldState, this.session.inputMode)
        this.outcomePanel = new PhaserGameOutcomePanel(
            this,
            () => this.session.hasSavedState(),
            (choice) =>
                this.scene.restart({
                    resumeFromSave: choice === 'load-save',
                    startingRoomId: this.startingRoomId,
                }),
        )

        const inlineCommandInputView = new InlineCommandInputView()
        this.inlineCommandInputView = inlineCommandInputView
        inlineCommandInputView.mount(
            this,
            (rawText) => {
                this.session.submitCommand(rawText)
                inlineCommandInputView.setVisible(false)
                this.enteredByShift = false
            },
            (rawText, cursorIndex) =>
                this.session.getCommandCompletionCandidates(rawText, cursorIndex),
            () => this.session.getWorldState().commandHistory,
        )
        inlineCommandInputView.setKeyGate(this.handleKeyDown)

        this.commandEditor = new CommandEditorOverlay(this, this.session)
        this.commandEditor.mount()
        if (this.initialOpenCommandEditor) {
            this.commandEditor.open()
        }

        const keyboard = this.input.keyboard
        keyboard?.on('keyup', this.handleKeyUp)
        this.game.events.on(Phaser.Core.Events.BLUR, this.handleBlur)

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            keyboard?.off('keyup', this.handleKeyUp)
            this.game.events.off(Phaser.Core.Events.BLUR, this.handleBlur)
            this.commandEditor?.destroy()
            this.commandEditor = undefined
            inlineCommandInputView.destroy()
            this.roomView.destroy()
            this.hud?.destroy()
            this.hud = undefined
            this.outcomePanel?.destroy()
            this.outcomePanel = undefined
            if (this.inlineCommandInputView === inlineCommandInputView) {
                this.inlineCommandInputView = undefined
            }
        })
    }

    update(_time: number, delta: number): void {
        this.session.update(delta)
        const worldState = this.session.getWorldState()
        if (worldState.currentRoomId !== this.lastRoomId) {
            this.lastRoomId = worldState.currentRoomId
            // Entering a room is a Save Point, so a defeat there offers LOAD SAVE from the room's start.
            if (worldState.outcome === 'playing') {
                this.session.saveCurrentState()
            }
        }

        const player = worldState.worldObjects.find(
            (object) => object.id === 'player' || object.metadata.role === 'player',
        )
        if (player) {
            const pos = this.session.getRenderPosition(player.id)
            const px = pos?.x ?? (player.state as Record<string, unknown> | undefined)?.x
            const py = pos?.y ?? (player.state as Record<string, unknown> | undefined)?.y
            if (typeof px === 'number' && typeof py === 'number') {
                this.inlineCommandInputView?.setPlayerPosition(px, py)
            }
        }

        this.roomView.update(worldState, (objectId) => this.session.getRenderPosition(objectId), delta)
        this.outcomePanel?.update(worldState)
        this.hud?.update(worldState, this.session.inputMode)
        this.commandEditor?.update(delta)

        if (worldState.outcome === 'game-over' && this.session.inputMode === 'command') {
            this.session.enterMovementMode()
            this.inlineCommandInputView?.clearInput()
            this.inlineCommandInputView?.setVisible(false)
            this.enteredByShift = false
        }
    }

    public isCommandEditorOpen(): boolean {
        return this.commandEditor?.isOpen() ?? false
    }

    public toggleCommandEditor(): void {
        this.commandEditor?.toggle()
    }

    public openCommandEditor(): void {
        this.commandEditor?.open()
    }

    public closeCommandEditor(): void {
        this.commandEditor?.close()
    }

    public getCommandEditor(): CommandEditorOverlay | undefined {
        return this.commandEditor
    }

    // Returns whether the command input should process the key event.
    private readonly handleKeyDown = (event: KeyboardEvent): boolean => {
        if (this.commandEditor?.isModalPromptOpen?.()) {
            return false
        }

        const key = event.key.toLowerCase()

        if (key === 'f1') {
            event.preventDefault()
            this.toggleCommandEditor()
            return false
        }

        if (this.commandEditor?.isOpen()) {
            if (key === 'escape') {
                event.preventDefault()
                this.closeCommandEditor()
                return false
            }
        }

        if (this.outcomePanel?.menuActive) {
            event.preventDefault()
            if (key === 'arrowleft') {
                this.outcomePanel.moveSelection(-1)
            } else if (key === 'arrowright') {
                this.outcomePanel.moveSelection(1)
            } else if (key === 'enter' && !event.repeat) {
                this.outcomePanel.confirmSelection()
            }
            return false
        }

        if (this.session.inputMode === 'movement') {
            if (key === 'shift') {
                event.preventDefault()
                if (!event.repeat) {
                    this.session.enterCommandMode()
                    this.inlineCommandInputView?.setVisible(true)
                    this.enteredByShift = true
                }
                return false
            }

            if (INPUT_BINDINGS.attack.keys.includes(key)) {
                event.preventDefault()
                if (!event.repeat) {
                    this.session.attack()
                }
                return false
            }

            if (key === 'enter') {
                event.preventDefault()
                return false
            }

            this.session.keyDown(key)
            event.preventDefault()
            return false
        }

        if (key === 'shift') {
            return false
        }

        const { typeable } = this.session.keyDown(key)
        return typeable
    }

    private readonly handleKeyUp = (event: KeyboardEvent): void => {
        const key = event.key.toLowerCase()
        this.session.keyUp(key)

        if (key === 'shift' && this.enteredByShift && this.session.inputMode === 'command') {
            this.session.enterMovementMode()
            this.inlineCommandInputView?.clearInput()
            this.inlineCommandInputView?.setVisible(false)
            this.enteredByShift = false
        }
    }

    private readonly handleBlur = (): void => {
        this.session.releaseAllKeys()
        if (this.enteredByShift && this.session.inputMode === 'command') {
            this.session.enterMovementMode()
            this.inlineCommandInputView?.clearInput()
            this.inlineCommandInputView?.setVisible(false)
            this.enteredByShift = false
        }
    }
}
