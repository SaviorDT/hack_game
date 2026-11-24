import type Phaser from 'phaser'
import { VALID_COMMAND_SLOTS, type CommandSlotMap } from '../application/commandSlots.ts'
import {
  COLOR_DIM,
  COLOR_PROMPT,
  TERMINAL_FONT,
} from './pauseSceneHelpers.ts'

export function buildRecordedCommandsBox(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  slots: CommandSlotMap = {},
): Phaser.GameObjects.Container {
  const boxContainer = scene.add.container(0, 0)
  const box = scene.add.graphics()
  box.lineStyle(2, 0x333333, 1)
  box.strokeRect(1260, 380, 520, 290)
  boxContainer.add(box)

  const header = scene.add.text(1280, 405, '── RECORDED COMMANDS ──', {
    fontFamily: TERMINAL_FONT,
    fontSize: '15px',
    color: COLOR_PROMPT,
  })
  boxContainer.add(header)

  VALID_COMMAND_SLOTS.forEach((slot, index) => {
    const cmd = slots[slot]
    const label = cmd
      ? `${slot}: ${cmd.length > 24 ? cmd.slice(0, 21) + '...' : cmd}`
      : `${slot}: (empty)`
    const text = scene.add.text(1280, 455 + index * 45, label, {
      fontFamily: TERMINAL_FONT,
      fontSize: '15px',
      color: cmd ? COLOR_PROMPT : COLOR_DIM,
    })
    boxContainer.add(text)
  })

  container.add(boxContainer)
  return boxContainer
}
