import type Phaser from 'phaser'
import type { WorldState } from '../domain/WorldState.ts'
import type { InputMode } from '../application/InputModeController.ts'

/** Main-game chrome. World coordinates and editor layouts remain independent. */
export class PhaserGameHud {
  private readonly root: Phaser.GameObjects.Container
  private readonly roomText: Phaser.GameObjects.Text
  private readonly hintPanel: Phaser.GameObjects.Rectangle
  private readonly hintText: Phaser.GameObjects.Text
  private shownHintRoomId: string | null | undefined

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(8)
    const label = (x: number, y: number, text: string, size = 20, color = '#a1b7c1') =>
      scene.add.text(x, y, text, { fontFamily: 'Consolas, monospace', fontSize: size, color })

    this.roomText = label(96, 38, '', 22, '#b7d9d1')
    const navigation = label(1824, 38, 'F1 Command   F2 Layout   F3 Speed   F4 AI', 18).setOrigin(1, 0)

    // The room's hint sits in a banner along the top of the room, which room layouts keep clear.
    this.hintPanel = scene.add.rectangle(960, 96, 1680, 92, 0x101d26, 0.88)
      .setOrigin(0.5, 0).setStrokeStyle(2, 0x314854)
    this.hintText = label(960, 142, '', 20, '#e7eee4')
      .setOrigin(0.5).setAlign('center').setWordWrapWidth(1620).setLineSpacing(6)

    this.root.add([this.roomText, navigation, this.hintPanel, this.hintText])
  }

  update(state: WorldState, _mode?: InputMode): void {
    this.roomText.setText(`ROOM  /  ${state.currentRoomId ?? 'unknown'}`)

    const room = state.rooms.find((candidate) => candidate.id === state.currentRoomId)
    if (room?.id !== this.shownHintRoomId) {
      this.shownHintRoomId = room?.id
      this.hintText.setText(room?.hint ?? '')
      // The banner grows with the hint so a longer one never spills over its edge.
      const bannerHeight = Math.max(92, this.hintText.height + 30)
      this.hintPanel.setSize(1680, bannerHeight)
      this.hintText.setY(96 + bannerHeight / 2)
      this.hintPanel.setVisible(Boolean(room?.hint))
      this.hintText.setVisible(Boolean(room?.hint))
    }
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
