import type Phaser from 'phaser'
import type { WorldState } from '../domain/WorldState.ts'
import { GameOverMenu } from './GameOverMenu.ts'
import type { GameOverChoice } from './GameOverMenu.ts'

const MENU_LABELS: Record<GameOverChoice, string> = {
  restart: 'RESTART',
  'load-save': 'RESET ROOM',
}
const MENU_Y = 545
const MENU_X: Record<GameOverChoice, number> = { restart: 760, 'load-save': 1160 }
const COLOR_SELECTED = '#101010'
const COLOR_NORMAL = '#e2e2e2'
const COLOR_DISABLED = '#555555'

interface MenuButton {
  readonly choice: GameOverChoice
  readonly background: Phaser.GameObjects.Rectangle
  readonly label: Phaser.GameObjects.Text
}

export class PhaserGameOutcomePanel {
  private readonly gameOverPanel: Phaser.GameObjects.Container
  private readonly congratulationsPanel: Phaser.GameObjects.Container
  private readonly buttons: MenuButton[] = []
  private menu: GameOverMenu | undefined
  private readonly hasSavedState: () => boolean
  private readonly onChoice: (choice: GameOverChoice) => void

  constructor(
    scene: Phaser.Scene,
    hasSavedState: () => boolean,
    onChoice: (choice: GameOverChoice) => void,
  ) {
    this.hasSavedState = hasSavedState
    this.onChoice = onChoice
    this.gameOverPanel = this.createPanel(
      scene,
      'GAME OVER',
      'The guard caught you before you reached the exit.',
      100,
    )
    this.createMenuButtons(scene)
    this.congratulationsPanel = this.createPanel(
      scene,
      'CONGRATULATIONS',
      'The dummy is defeated. You reached end.',
    )
  }

  update(state: WorldState): void {
    const gameOver = state.outcome === 'game-over'
    this.gameOverPanel.setVisible(gameOver)
    this.congratulationsPanel.setVisible(state.outcome === 'congratulations')

    if (!gameOver) {
      this.menu = undefined
    } else if (!this.menu) {
      this.menu = new GameOverMenu(
        this.hasSavedState() ? ['restart', 'load-save'] : ['restart'],
      )
      this.refreshButtons()
    }
  }

  get menuActive(): boolean {
    return this.menu !== undefined
  }

  moveSelection(direction: -1 | 1): void {
    this.menu?.move(direction)
    this.refreshButtons()
  }

  confirmSelection(): void {
    if (this.menu) {
      this.onChoice(this.menu.confirm())
    }
  }

  private createMenuButtons(scene: Phaser.Scene): void {
    for (const choice of ['restart', 'load-save'] as const) {
      const background = scene.add.rectangle(MENU_X[choice], MENU_Y, 340, 64, 0x101010, 1)
      background.setStrokeStyle(4, 0x777777, 1)
      const label = scene.add
        .text(MENU_X[choice], MENU_Y, MENU_LABELS[choice], {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 22,
          color: COLOR_NORMAL,
        })
        .setOrigin(0.5)

      background.setInteractive({ useHandCursor: true })
      background.on('pointerover', () => {
        this.menu?.select(choice)
        this.refreshButtons()
      })
      background.on('pointerdown', () => {
        if (this.menu?.isEnabled(choice)) {
          this.menu.select(choice)
          this.onChoice(choice)
        }
      })

      this.gameOverPanel.add([background, label])
      this.buttons.push({ choice, background, label })
    }
  }

  private refreshButtons(): void {
    const menu = this.menu
    if (!menu) {
      return
    }
    for (const { choice, background, label } of this.buttons) {
      const enabled = menu.isEnabled(choice)
      const selected = menu.selected === choice
      background.setFillStyle(selected ? 0xe2e2e2 : 0x101010, 1)
      background.setStrokeStyle(4, enabled ? 0x777777 : 0x333333, 1)
      label.setColor(selected ? COLOR_SELECTED : enabled ? COLOR_NORMAL : COLOR_DISABLED)
    }
  }

  destroy(): void {
    this.gameOverPanel.destroy(true)
    this.congratulationsPanel.destroy(true)
  }

  private createPanel(
    scene: Phaser.Scene,
    titleText: string,
    messageText: string,
    extraHeight = 0,
  ): Phaser.GameObjects.Container {
    const background = scene.add.rectangle(960, 360 + extraHeight / 2, 1000, 300 + extraHeight, 0x101010, 0.97)
    background.setStrokeStyle(5, 0x777777, 1)

    const topRule = scene.add.rectangle(960, 253, 880, 3, 0x555555, 1)
    const bottomRule = scene.add.rectangle(960, 467, 880, 3, 0x555555, 1)
    const title = scene.add
      .text(960, 315, titleText, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 48,
        color: '#e2e2e2',
        align: 'center',
      })
      .setOrigin(0.5)
    const message = scene.add
      .text(960, 392, messageText, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 22,
        color: '#bcbcbc',
        align: 'center',
        wordWrap: { width: 820 },
      })
      .setOrigin(0.5)

    return scene.add
      .container(0, 0, [background, topRule, bottomRule, title, message])
      .setDepth(30)
      .setVisible(false)
  }
}
