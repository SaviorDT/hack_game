import Phaser from 'phaser'
import textboxImageUrl from '../../assets/game/ui/textbox.png'
import type { GameSession } from '../application/GameSession.ts'
import { createRoom1Session } from '../content/createRoom1Session.ts'
import { ROOM_IDS, ROOM_NAMES } from '../content/room1.ts'
import { INPUT_BINDINGS } from '../presentation/InputBindings.ts'
import { PhaserGameOutcomePanel } from '../presentation/PhaserGameOutcomePanel.ts'
import { PhaserRoomView, WORLD_OBJECT_TEXTURE_URLS } from '../presentation/PhaserRoomView.ts'
import { COMMAND_INPUT_TEXTURE_KEY, PhaserCommandInputView } from '../presentation/PhaserCommandInputView.ts'

export class GameScene extends Phaser.Scene {
  private session!: GameSession
  private commandInputView: PhaserCommandInputView | undefined
  private readonly roomView = new PhaserRoomView()
  private outcomePanel: PhaserGameOutcomePanel | undefined

  constructor() {
    super({ key: 'game' })
  }

  preload(): void {
    this.load.image(COMMAND_INPUT_TEXTURE_KEY, textboxImageUrl)
    for (const [textureKey, imageUrl] of Object.entries(WORLD_OBJECT_TEXTURE_URLS)) {
      this.load.image(textureKey, imageUrl)
    }
  }

  create(): void {
    this.session = createRoom1Session({ movementBindings: INPUT_BINDINGS.movement })
    const worldState = this.session.getWorldState()
    this.roomView.mount(this, worldState)
    this.outcomePanel = new PhaserGameOutcomePanel(this)

    const commandInputView = new PhaserCommandInputView()
    this.commandInputView = commandInputView
    commandInputView.setPrompt(this.promptForRoom(worldState.currentRoomId))
    commandInputView.mount(this, (rawText) => {
      const result = this.session.submitCommand(rawText)
      const feedbackList = result.status === 'success'
        ? result.feedback
        : [result.feedback]

      for (const feedback of feedbackList) {
        commandInputView.appendOutput(
          feedback.text,
          'reverseColorLines' in feedback ? feedback.reverseColorLines : undefined,
        )
      }

      commandInputView.setPrompt(
        this.promptForRoom(this.session.getWorldState().currentRoomId),
      )
      commandInputView.setInputEnabled(this.session.inputMode === 'command')
    }, (rawText, cursorIndex) =>
      this.session.getCommandCompletionCandidates(rawText, cursorIndex),
    () => this.session.getWorldState().commandHistory,
    )
    commandInputView.setKeyGate(this.handleKeyDown)

    const keyboard = this.input.keyboard
    keyboard?.on('keyup', this.handleKeyUp)
    this.input.mouse?.disableContextMenu()
    this.input.on('pointerdown', this.handlePointerDown)
    this.game.events.on(Phaser.Core.Events.BLUR, this.handleBlur)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.off('keyup', this.handleKeyUp)
      this.input.off('pointerdown', this.handlePointerDown)
      this.game.events.off(Phaser.Core.Events.BLUR, this.handleBlur)
      commandInputView.destroy()
      this.roomView.destroy()
      this.outcomePanel?.destroy()
      this.outcomePanel = undefined
      if (this.commandInputView === commandInputView) {
        this.commandInputView = undefined
      }
    })
  }

  update(_time: number, delta: number): void {
    this.session.update(delta)
    const worldState = this.session.getWorldState()
    this.commandInputView?.setPrompt(this.promptForRoom(worldState.currentRoomId))
    this.roomView.update(worldState, (objectId) => this.session.getRenderPosition(objectId))
    this.outcomePanel?.update(worldState)
  }

  // Returns whether the command input should process the key event.
  private readonly handleKeyDown = (event: KeyboardEvent): boolean => {
    if (event.key === 'F2') {
      event.preventDefault()
      this.scene.start('level-editor')
      return false
    }

    const key = event.key.toLowerCase()
    const { typeable } = this.session.keyDown(key)

    if (this.session.inputMode === 'command') {
      return typeable
    }

    event.preventDefault()
    if (event.repeat) {
      return false
    }

    if (INPUT_BINDINGS.toggleMode.includes(key)) {
      this.session.toggleInputMode()
      this.commandInputView?.setInputEnabled(true)
    } else if (INPUT_BINDINGS.attack.keys.includes(key)) {
      this.session.attack()
    } else if (INPUT_BINDINGS.pickUp.keys.includes(key)) {
      this.session.pickUp()
    }

    return false
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.session.keyUp(event.key.toLowerCase())
  }

  private readonly handlePointerDown = (
    pointer: Phaser.Input.Pointer,
    currentlyOver: Phaser.GameObjects.GameObject[],
  ): void => {
    if (currentlyOver.length > 0) {
      return
    }

    if (INPUT_BINDINGS.pickUp.mouseButtons.includes('right') && pointer.rightButtonDown()) {
      this.session.pickUp()
    } else if (INPUT_BINDINGS.attack.mouseButtons.includes('left') && pointer.leftButtonDown()) {
      this.session.attack()
    }
  }

  private readonly handleBlur = (): void => {
    this.session.releaseAllKeys()
  }

  private promptForRoom(roomId: string | null): string {
    if (!roomId) {
      return '~$ '
    }

    const rootRoomName = ROOM_NAMES[ROOM_IDS.first]
    const roomName = ROOM_NAMES[roomId] ?? roomId
    const path = roomId === ROOM_IDS.first
      ? `~/${rootRoomName}`
      : `~/${rootRoomName}/${roomName}`

    return `${path}$ `
  }
}
