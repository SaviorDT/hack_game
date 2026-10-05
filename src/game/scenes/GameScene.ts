import Phaser from 'phaser'
import textboxImageUrl from '../../assets/game/ui/textbox.png'
import type { GameSession } from '../application/GameSession.ts'
import { createRoom1Session } from '../content/createRoom1Session.ts'
import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import { ROOM_IDS, ROOM_NAMES, WORLD_OBJECT_IDS } from '../content/room1.ts'
import { PhaserGameOutcomePanel } from '../presentation/PhaserGameOutcomePanel.ts'
import { PhaserRoomView, WORLD_OBJECT_TEXTURE_URLS } from '../presentation/PhaserRoomView.ts'
import { COMMAND_INPUT_TEXTURE_KEY, PhaserCommandInputView } from '../presentation/PhaserCommandInputView.ts'

export class GameScene extends Phaser.Scene {
  private session!: GameSession
  private commandInputView: PhaserCommandInputView | undefined
  private commandExecutionPending = false
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
    this.session = createRoom1Session()
    const worldState = this.session.getWorldState()
    this.roomView.mount(this, worldState)
    this.outcomePanel = new PhaserGameOutcomePanel(this)

    const commandInputView = new PhaserCommandInputView()
    this.commandInputView = commandInputView
    this.commandExecutionPending = false
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

      this.commandExecutionPending =
        result.status === 'success' && result.completion === 'deferred'
      if (!this.commandExecutionPending) {
        commandInputView.setPrompt(
          this.promptForRoom(this.session.getWorldState().currentRoomId),
        )
        commandInputView.finishExecution()
      }
    }, (rawText, cursorIndex) =>
      this.session.getCommandCompletionCandidates(rawText, cursorIndex),
    () => this.session.getWorldState().commandHistory,
    )

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      commandInputView.destroy()
      this.commandExecutionPending = false
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
    if (this.commandExecutionPending && this.isCommandExecutionComplete(worldState)) {
      this.commandExecutionPending = false
      this.commandInputView?.setPrompt(this.promptForRoom(worldState.currentRoomId))
      this.commandInputView?.finishExecution()
    }
    this.roomView.update(worldState)
    this.outcomePanel?.update(worldState)
  }

  private isCommandExecutionComplete(worldState: ReturnType<GameSession['getWorldState']>): boolean {
    if (worldState.outcome !== 'playing') {
      return true
    }

    const player = worldState.worldObjects.find(
      (worldObject) => worldObject.id === WORLD_OBJECT_IDS.player,
    )
    if (!player) {
      throw new Error(`World state is missing player "${WORLD_OBJECT_IDS.player}".`)
    }

    const playerState = getMutableWorldObjectState<{ action: string }>(player)
    return playerState.action === 'idle'
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
