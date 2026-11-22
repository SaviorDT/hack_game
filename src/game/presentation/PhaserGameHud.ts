import type Phaser from 'phaser'
import type { WorldState } from '../domain/WorldState.ts'
import type { InputMode } from '../application/InputModeController.ts'
import {
  COLOR_DIM,
  COLOR_PROMPT,
  PANEL_BG,
  PANEL_BG_ALPHA,
  PANEL_BORDER,
  PANEL_BORDER_WIDTH,
  TERMINAL_FONT,
  TYPING_SPEED_MS,
} from './uiTheme.ts'

const BANNER_LEFT = 120
const BANNER_PADDING_X = 30
const HINT_TEXT_X = BANNER_LEFT + BANNER_PADDING_X

/** Main-game chrome. World coordinates and editor layouts remain independent. */
export class PhaserGameHud {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private readonly roomText: Phaser.GameObjects.Text
  private readonly hintPanel: Phaser.GameObjects.Rectangle
  private readonly hintText: Phaser.GameObjects.Text
  private shownHintRoomId: string | null | undefined
  private typingTimer?: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setDepth(8)
    const label = (x: number, y: number, text: string, size = 15, color = COLOR_PROMPT) =>
      scene.add.text(x, y, text, { fontFamily: TERMINAL_FONT, fontSize: `${size}px`, color })

    this.roomText = label(96, 38, '', 16, COLOR_PROMPT)
    const navigation = label(1824, 38, 'F1 Command   F2 Layout   F3 Speed   F4 AI', 13, COLOR_DIM).setOrigin(1, 0)

    // The room's hint sits in a banner along the top of the room, which room layouts keep clear.
    this.hintPanel = scene.add.rectangle(960, 96, 1680, 92, PANEL_BG, PANEL_BG_ALPHA)
      .setOrigin(0.5, 0).setStrokeStyle(PANEL_BORDER_WIDTH, PANEL_BORDER)
    this.hintText = label(HINT_TEXT_X, 142, '', 15, COLOR_PROMPT)
      .setOrigin(0, 0.5).setAlign('left').setWordWrapWidth(1680 - BANNER_PADDING_X * 2).setLineSpacing(10)

    this.root.add([this.roomText, navigation, this.hintPanel, this.hintText])
  }

  update(state: WorldState, _mode?: InputMode): void {
    this.roomText.setText(`ROOM  /  ${state.currentRoomId ?? 'unknown'}`)

    const room = state.rooms.find((candidate) => candidate.id === state.currentRoomId)
    if (room?.id !== this.shownHintRoomId) {
      this.shownHintRoomId = room?.id
      this.typingTimer?.remove()
      this.typingTimer = undefined

      if (room?.hint) {
        // Sizing the banner to the target full text immediately prevents banner height jitter.
        this.hintText.setText(room.hint)
        const bannerHeight = Math.max(92, this.hintText.height + 30)
        this.hintPanel.setSize(1680, bannerHeight)
        this.hintText.setPosition(HINT_TEXT_X, 96 + bannerHeight / 2)
        this.hintPanel.setVisible(true)
        this.hintText.setVisible(true)

        const targetHint = room.hint
        let charIndex = 0
        this.hintText.setText('')
        if (this.scene.time?.addEvent) {
          this.typingTimer = this.scene.time.addEvent({
            delay: TYPING_SPEED_MS,
            repeat: targetHint.length - 1,
            callback: () => {
              charIndex++
              this.hintText.setText(targetHint.slice(0, charIndex))
            },
          })
        } else {
          this.hintText.setText(targetHint)
        }
      } else {
        this.hintText.setText('')
        this.hintPanel.setVisible(false)
        this.hintText.setVisible(false)
      }
    }
  }

  destroy(): void {
    this.typingTimer?.remove()
    this.typingTimer = undefined
    this.root.destroy(true)
  }
}
