import Phaser from 'phaser'
import { PhaserGameHud } from '../presentation/PhaserGameHud.ts'
import type { MousePoint } from '../commands/CommandContext.ts'
import type { GameSession } from '../application/GameSession.ts'
import { createRoomSession } from '../content/createRoomSession.ts'
import { ROOM_OBJECTS } from '../content/room.ts'
import { createGameWorldState, getTutorialFeatureUnlocks } from '../content/tutorialRooms.ts'
import { INPUT_BINDINGS } from '../presentation/InputBindings.ts'
import { PhaserGameOutcomePanel } from '../presentation/PhaserGameOutcomePanel.ts'
import { PhaserRoomView, WORLD_OBJECT_TEXTURE_URLS } from '../presentation/PhaserRoomView.ts'
import { InlineCommandInputView } from '../presentation/InlineCommandInputView.ts'
import { TimeDilationGlitchView } from '../presentation/TimeDilationGlitchView.ts'
import { MacroIndicatorView } from '../presentation/MacroIndicatorView.ts'
import type { TutorialHudContext } from '../presentation/StagedTutorialPrompts.ts'
import {
    isValidCommandSlot,
    RECORD_HOLD_DURATION_MS,
    RECORD_HOLD_SHOW_DELAY_MS,
    type CommandSlot,
} from '../application/commandSlots.ts'
import { CommandEditorOverlay } from './CommandEditorOverlay.ts'
import {
    enterOpensCommandInput,
    loadCommandTypingMode,
    shiftOpensCommandInput,
    type CommandTypingMode,
  DEFAULT_COMMAND_TYPING_MODE,
} from '../application/gameSettings.ts'

export class GameScene extends Phaser.Scene {
    private session!: GameSession
    private inlineCommandInputView: InlineCommandInputView | undefined
    private readonly roomView = new PhaserRoomView()
    private outcomePanel: PhaserGameOutcomePanel | undefined
    private hud: PhaserGameHud | undefined
    private commandEditor: CommandEditorOverlay | undefined
    private readonly glitchView = new TimeDilationGlitchView()

    private resumeFromSave = false
    private startingRoomId?: string
    private initialOpenCommandEditor = false
    private commandTypingMode: CommandTypingMode = DEFAULT_COMMAND_TYPING_MODE
    private customCommandTypingMode?: CommandTypingMode
    private enteredByShift = false
    private slotHoldTimer?: Phaser.Time.TimerEvent
    private heldSlotKey?: string
    private slotHoldStartedRoomId?: string
    private slotHoldRecorded = false
    private tutorial3RecordedSlot?: CommandSlot
    private tutorial3ExecutedSlot?: CommandSlot
    private savedTutorialRoomId: string | null = null
    private readonly macroIndicatorView = new MacroIndicatorView()
    /** The cursor in Room coordinates, once it has been over the game; the source of the Mouse Target. */
    private mousePoint: MousePoint | undefined
    /** The room the player was in last frame; entering a different one is a Save Point. */
    private lastRoomId: string | null = null

    constructor() {
        super({ key: 'game' })
    }

    init(data?: {
        resumeFromSave?: boolean
        startingRoomId?: string
        openCommandEditor?: boolean
        commandTypingMode?: CommandTypingMode
    }): void {
        this.resumeFromSave = data?.resumeFromSave === true
        this.startingRoomId = data?.startingRoomId
        this.initialOpenCommandEditor = data?.openCommandEditor === true
        this.customCommandTypingMode = data?.commandTypingMode
    }

    preload(): void {
        for (const [textureKey, imageUrl] of Object.entries(WORLD_OBJECT_TEXTURE_URLS)) {
            this.load.image(textureKey, imageUrl)
        }
    }

    create(): void {
        this.commandTypingMode = this.customCommandTypingMode ?? loadCommandTypingMode()
        this.tutorial3RecordedSlot = undefined
        this.tutorial3ExecutedSlot = undefined
        this.session = createRoomSession({
            movementBindings: INPUT_BINDINGS.movement,
            worldState: createGameWorldState(ROOM_OBJECTS, this.startingRoomId),
        })
        const previouslySavedTutorialRoomId = this.session.getSavedCurrentRoomId()
        if (!this.resumeFromSave || !this.session.loadSavedState()) {
            this.session.saveCurrentState()
        }
        const worldState = this.session.getWorldState()
        this.savedTutorialRoomId = previouslySavedTutorialRoomId ?? this.session.getSavedCurrentRoomId()
        this.lastRoomId = worldState.currentRoomId
        this.cameras.main.setBackgroundColor('#0b141d')
        this.roomView.mount(this, worldState, false)
        this.hud = new PhaserGameHud(this)
        this.hud.update(
            worldState,
            this.session.inputMode,
            this.commandTypingMode,
            this.getTutorialHudContext(),
        )
        this.outcomePanel = new PhaserGameOutcomePanel(
            this,
            (choice) => {
                if (choice === 'reset') {
                    this.scene.restart({
                        resumeFromSave: true,
                        startingRoomId: this.startingRoomId,
                    })
                } else {
                    this.scene.start('title')
                }
            },
        )

        this.mousePoint = undefined
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            this.mousePoint = { x: pointer.worldX, y: pointer.worldY }
        })

        const inlineCommandInputView = new InlineCommandInputView()
        this.inlineCommandInputView = inlineCommandInputView
        inlineCommandInputView.mount(
            this,
            (rawText) => {
                if (rawText.trim().length === 0) {
                    this.session.enterMovementMode()
                    inlineCommandInputView.setVisible(false)
                    this.enteredByShift = false
                    return
                }
                this.session.submitCommand(rawText, { mouse: this.mousePoint })
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
        this.macroIndicatorView.mount(this)
        this.glitchView.mount(this)
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
            this.slotHoldTimer?.remove()
            this.slotHoldTimer = undefined
            this.macroIndicatorView.destroy()
            this.glitchView.destroy()
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
        this.glitchView.setMode(this.session.inputMode)
        this.glitchView.update(delta)
        const worldState = this.session.getWorldState()
        if (worldState.currentRoomId !== this.lastRoomId) {
            this.lastRoomId = worldState.currentRoomId
            this.savedTutorialRoomId = this.session.getSavedCurrentRoomId()
            if (worldState.currentRoomId === 'tutorial3') {
                this.tutorial3RecordedSlot = undefined
                this.tutorial3ExecutedSlot = undefined
            }
            // Entering a room is a Save Point, so RESET reloads from the room's entrance state.
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
                this.macroIndicatorView.setPlayerPosition(px, py)
            }
        }

        this.roomView.update(worldState, (objectId) => this.session.getRenderPosition(objectId), delta)
        this.outcomePanel?.update(worldState)
        this.hud?.update(
            worldState,
            this.session.inputMode,
            this.commandTypingMode,
            this.getTutorialHudContext(),
        )
        this.commandEditor?.update(delta)

        if (worldState.outcome === 'game-over') {
            this.slotHoldTimer?.remove()
            this.slotHoldTimer = undefined
            this.heldSlotKey = undefined
            this.slotHoldStartedRoomId = undefined
            this.slotHoldRecorded = false
            this.macroIndicatorView.cancelHoldProgress()
            if (this.session.inputMode === 'command') {
                this.session.enterMovementMode()
                this.inlineCommandInputView?.clearInput()
                this.inlineCommandInputView?.setVisible(false)
                this.enteredByShift = false
            }
        }
    }

    public isCommandEditorOpen(): boolean {
        return this.commandEditor?.isOpen() ?? false
    }

    public getCommandTypingMode(): CommandTypingMode {
        return this.commandTypingMode
    }

    public setCommandTypingMode(mode: CommandTypingMode): void {
        this.commandTypingMode = mode
        this.customCommandTypingMode = mode
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

    public getGlitchView(): TimeDilationGlitchView {
        return this.glitchView
    }

    public openPause(): void {
        if (this.scene.isActive('pause')) return
        this.session.releaseAllKeys()
        // Shift is no longer tracked while paused, so a Shift-opened prompt stays open until Enter.
        this.enteredByShift = false
        this.slotHoldTimer?.remove()
        this.slotHoldTimer = undefined
        this.heldSlotKey = undefined
        this.slotHoldStartedRoomId = undefined
        this.slotHoldRecorded = false
        this.macroIndicatorView.cancelHoldProgress()
        ;(this.session as unknown as {
            dependencies: { simulationClock: { setTimeScale: (scale: number) => void } }
        }).dependencies.simulationClock.setTimeScale(0)
        this.scene.launch('pause')
        this.scene.pause()
    }

    public resumeFromPause(): void {
        this.scene.resume()
        this.session.syncTimeScale()
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

        if (this.outcomePanel?.menuActive) {
            event.preventDefault()
            if (key === 'arrowleft' || key === 'a' || key === 'arrowup' || key === 'w') {
                this.outcomePanel.moveSelection(-1)
            } else if (key === 'arrowright' || key === 'd' || key === 'arrowdown' || key === 's') {
                this.outcomePanel.moveSelection(1)
            } else if (key === 'enter' && !event.repeat) {
                this.outcomePanel.confirmSelection()
            }
            return false
        }

        if (this.session.inputMode === 'movement') {
            const unlocks = getTutorialFeatureUnlocks(
                this.session.getWorldState().currentRoomId,
                this.savedTutorialRoomId,
            )

            if ((key === ' ' || key === 'space' || key === 'p') && !this.outcomePanel?.menuActive) {
                event.preventDefault()
                if (!event.repeat) {
                    this.openPause()
                }
                return false
            }

            if (key === 'r' && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault()
                if (!event.repeat && this.canResetRoom()) {
                    this.resetRoom()
                }
                return false
            }

            if (key === 'shift') {
                event.preventDefault()
                if (unlocks.commandInput && shiftOpensCommandInput(this.commandTypingMode) && !event.repeat) {
                    this.openCommandInput(true)
                }
                return false
            }

            if (key === 'enter') {
                event.preventDefault()
                if (unlocks.commandInput && enterOpensCommandInput(this.commandTypingMode) && !event.repeat) {
                    this.openCommandInput(false)
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

            if (isValidCommandSlot(key) && unlocks.recordedCommands) {
                event.preventDefault()
                if (event.repeat || this.heldSlotKey !== undefined) {
                    return false
                }
                const slot = Number(key) as CommandSlot
                this.heldSlotKey = key
                this.slotHoldStartedRoomId = this.session.getWorldState().currentRoomId ?? undefined
                this.slotHoldRecorded = false
                const slotHoldStartedRoomId = this.slotHoldStartedRoomId
                this.macroIndicatorView.startHoldProgress(
                    slot,
                    RECORD_HOLD_DURATION_MS,
                    RECORD_HOLD_SHOW_DELAY_MS,
                )
                this.slotHoldTimer?.remove()
                this.slotHoldTimer = this.time.delayedCall(RECORD_HOLD_DURATION_MS, () => {
                    this.slotHoldRecorded = true
                    const result = this.session.recordLastCommandToSlot(slot)
                    if (result.success && result.command) {
                        if (
                            slotHoldStartedRoomId === 'tutorial3' &&
                            this.session.getWorldState().currentRoomId === 'tutorial3'
                        ) {
                            this.tutorial3RecordedSlot = slot
                        }
                        this.macroIndicatorView.showRecordSuccess(slot, result.command)
                    } else {
                        this.macroIndicatorView.showRecordEmpty()
                    }
                })
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

    /** Room Reset requested from the pause menu; same guard and effect as pressing R. */
    public resetRoomFromMenu(): void {
        if (this.canResetRoom()) this.resetRoom()
    }

    private canResetRoom(): boolean {
        return this.session.getWorldState().outcome === 'playing' && !this.isCommandEditorOpen()
    }

    // Room Reset: back to the Save Slot's record (written on entering the room), without
    // rewriting it. With no record yet, this is a fresh start like the RESET choice.
    private resetRoom(): void {
        if (!this.session.loadSavedState()) {
            this.scene.restart({ resumeFromSave: false, startingRoomId: this.startingRoomId })
            return
        }
        this.slotHoldTimer?.remove()
        this.slotHoldTimer = undefined
        this.heldSlotKey = undefined
        this.slotHoldStartedRoomId = undefined
        this.slotHoldRecorded = false
        this.macroIndicatorView.cancelHoldProgress()
        this.glitchView.setMode(this.session.inputMode)
        this.inlineCommandInputView?.clearInput()
        this.inlineCommandInputView?.setVisible(false)
        this.enteredByShift = false

        const worldState = this.session.getWorldState()
        this.savedTutorialRoomId = this.session.getSavedCurrentRoomId()
        if (worldState.currentRoomId === 'tutorial3') {
            this.tutorial3RecordedSlot = undefined
            this.tutorial3ExecutedSlot = undefined
        }
        this.lastRoomId = worldState.currentRoomId
        this.roomView.mount(this, worldState, false)
        this.hud?.destroy()
        this.hud = new PhaserGameHud(this)
        this.hud.update(
            worldState,
            this.session.inputMode,
            this.commandTypingMode,
            this.getTutorialHudContext(),
        )
    }

    private getTutorialHudContext(): TutorialHudContext {
        return {
            commandDraft: this.inlineCommandInputView?.getValue(),
            commandOpenedByShift: this.enteredByShift,
            recordedSlot: this.tutorial3RecordedSlot,
            executedSlot: this.tutorial3ExecutedSlot,
        }
    }

    private openCommandInput(byShift: boolean): void {
        this.session.enterCommandMode()
        this.glitchView.setMode('command')
        this.inlineCommandInputView?.setVisible(true)
        this.enteredByShift = byShift
    }

    private readonly handleKeyUp = (event: KeyboardEvent): void => {
        const key = event.key.toLowerCase()
        this.session.keyUp(key)

        if (key === 'shift' && this.enteredByShift && this.session.inputMode === 'command') {
            if (this.inlineCommandInputView && this.inlineCommandInputView.getValue().trim().length > 0) {
                this.inlineCommandInputView.submit()
            } else {
                this.session.enterMovementMode()
                this.inlineCommandInputView?.clearInput()
                this.inlineCommandInputView?.setVisible(false)
            }
        }
        if (key === 'shift') this.enteredByShift = false

        if (this.heldSlotKey && key === this.heldSlotKey) {
            this.slotHoldTimer?.remove()
            this.slotHoldTimer = undefined
            const slotHoldStartedRoomId = this.slotHoldStartedRoomId
            if (!this.slotHoldRecorded) {
                this.macroIndicatorView.cancelHoldProgress()
                if (this.session.inputMode === 'movement') {
                    const slot = Number(key) as CommandSlot
                    const command = this.session.getCommandSlot(slot)
                    if (command) {
                        this.session.submitCommand(command, { mouse: this.mousePoint })
                        if (
                            slotHoldStartedRoomId === 'tutorial3' &&
                            this.session.getWorldState().currentRoomId === 'tutorial3' &&
                            this.tutorial3RecordedSlot !== undefined
                        ) {
                            this.tutorial3ExecutedSlot = slot
                        }
                        this.macroIndicatorView.showExecutedCommand(slot, command)
                    } else {
                        this.macroIndicatorView.showSlotEmpty(slot)
                    }
                }
            }
            this.heldSlotKey = undefined
            this.slotHoldStartedRoomId = undefined
            this.slotHoldRecorded = false
        }
    }

    private readonly handleBlur = (): void => {
        this.session.releaseAllKeys()
        this.slotHoldTimer?.remove()
        this.slotHoldTimer = undefined
        this.heldSlotKey = undefined
        this.slotHoldStartedRoomId = undefined
        this.slotHoldRecorded = false
        this.macroIndicatorView.cancelHoldProgress()
        if (this.enteredByShift && this.session.inputMode === 'command') {
            this.session.enterMovementMode()
            this.inlineCommandInputView?.clearInput()
            this.inlineCommandInputView?.setVisible(false)
            this.enteredByShift = false
        }
    }
}
