import type Phaser from 'phaser'
import type { WorldState } from '../domain/WorldState.ts'
import type { InputMode } from '../application/InputModeController.ts'
import { COMMAND_MODE_TIME_SCALE } from '../application/InputModeController.ts'
import { isExitOpen } from '../domain/RoomTravel.ts'

/** Main-game chrome. World coordinates and editor layouts remain independent. */
export class PhaserGameHud {
  private readonly root: Phaser.GameObjects.Container
  private readonly health: Phaser.GameObjects.Rectangle
  private readonly healthText: Phaser.GameObjects.Text
  private readonly modeText: Phaser.GameObjects.Text
  private readonly roomText: Phaser.GameObjects.Text
  private readonly goalText: Phaser.GameObjects.Text
  private readonly hintPanel: Phaser.GameObjects.Rectangle
  private readonly hintText: Phaser.GameObjects.Text
  private shownHintRoomId: string | null | undefined

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(8)
    const label = (x: number, y: number, text: string, size = 20, color = '#a1b7c1') =>
      scene.add.text(x, y, text, { fontFamily: 'Consolas, monospace', fontSize: size, color })
    const panel = scene.add.rectangle(32, 760, 1016, 288, 0x101d26, 0.96)
      .setOrigin(0).setStrokeStyle(2, 0x314854)
    this.roomText = label(96, 38, '', 22, '#b7d9d1')
    const navigation = label(1824, 38, 'F1 Command   F2 Layout   F3 Speed   F4 AI', 18).setOrigin(1, 0)
    const name = label(64, 786, 'HACKER', 26, '#e7eee4')
    this.modeText = label(1016, 790, '', 18, '#8fd6c5').setOrigin(1, 0)
    const track = scene.add.rectangle(64, 840, 360, 14, 0x293c44).setOrigin(0)
    this.health = scene.add.rectangle(64, 840, 360, 14, 0xb97869).setOrigin(0)
    this.healthText = label(64, 866, '', 18)
    const divider = scene.add.rectangle(480, 830, 2, 166, 0x314854).setOrigin(0)
    const controls = label(516, 840, 'WASD         Move\nSPACE        Attack\nHOLD SHIFT   Command\nRELEASE SHIFT Execute', 20)
      .setLineSpacing(12)
    this.goalText = label(64, 1004, '', 19, '#d3c49e').setWordWrapWidth(960)
    // The room's hint sits in a banner along the top of the room, which room layouts keep clear.
    this.hintPanel = scene.add.rectangle(960, 96, 1680, 92, 0x101d26, 0.88)
      .setOrigin(0.5, 0).setStrokeStyle(2, 0x314854)
    this.hintText = label(960, 142, '', 20, '#e7eee4')
      .setOrigin(0.5).setAlign('center').setWordWrapWidth(1620).setLineSpacing(6)
    this.root.add([panel, this.roomText, navigation, name, this.modeText, track,
      this.health, this.healthText, divider, controls, this.goalText, this.hintPanel, this.hintText])
  }

  update(state: WorldState, mode: InputMode): void {
    const player = state.worldObjects.find(object => object.metadata.role === 'player')
    const data = player?.state as { health?: number; maxHealth?: number } | undefined
    const current = data?.health ?? 0
    const maximum = data?.maxHealth ?? 100
    this.health.width = 360 * Math.max(0, Math.min(1, maximum > 0 ? current / maximum : 0))
    this.healthText.setText(`HEALTH  ${Math.ceil(current)} / ${maximum}`)
    this.modeText.setText(mode === 'command' ? `CASTING  /  ×${COMMAND_MODE_TIME_SCALE.toFixed(2)}` : 'MOVEMENT  /  ×1.00')
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
    const lockedExit = room?.exits.find((exit) => !isExitOpen(state, room, exit))
    const openExit = room?.exits.find((exit) => isExitOpen(state, room, exit))
    if (!room) {
      this.goalText.setText('')
    } else if (lockedExit || !openExit) {
      this.goalText.setText(`GOAL  ${room.goal ?? 'Discover with ls. Reach the exit.'}`)
    } else if (room.exits.some((exit) => exit.requires)) {
      this.goalText.setText(`DONE  The exit to ${openExit.label} is open: walk in, or stand by it and type cd ${openExit.label}`)
    } else {
      this.goalText.setText(`GOAL  ${room.goal ?? 'Discover with ls. Reach the exit.'}`)
    }
  }

  destroy(): void {
    this.root.destroy(true)
  }
}
