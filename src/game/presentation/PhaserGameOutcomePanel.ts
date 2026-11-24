import type Phaser from 'phaser'
import type { WorldState } from '../domain/WorldState.ts'
import { GameOverMenu } from './GameOverMenu.ts'
import type { GameOverChoice } from './GameOverMenu.ts'
import {
  COLOR_DIM,
  TEXT_COLOR,
  TERMINAL_FONT,
  COLOR_WHITE,
  PANEL_BG,
  PANEL_BG_ALPHA,
  PANEL_BORDER,
  PANEL_BORDER_WIDTH,
} from './uiTheme.ts'

const MENU_LABELS: Record<GameOverChoice, string> = {
  reset: 'RESET',
  title: 'TITLE',
}
const MENU_Y = 545
const MENU_X: Record<GameOverChoice, number> = { reset: 760, title: 1160 }

interface MenuButton {
  readonly choice: GameOverChoice
  readonly label: Phaser.GameObjects.Text
}

export class PhaserGameOutcomePanel {
  private readonly gameOverPanel: Phaser.GameObjects.Container
  private readonly congratulationsPanel: Phaser.GameObjects.Container
  private readonly buttons: MenuButton[] = []
  private menu: GameOverMenu | undefined
  private readonly onChoice: (choice: GameOverChoice) => void

  constructor(
    scene: Phaser.Scene,
    onChoice: (choice: GameOverChoice) => void,
  ) {
    this.onChoice = onChoice
    this.gameOverPanel = this.createPanel(
      scene,
      'G A M E   O V E R',
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
      this.menu = new GameOverMenu(['reset', 'title'])
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
    for (const choice of ['reset', 'title'] as const) {
      const label = scene.add
        .text(MENU_X[choice], MENU_Y, `  [ ${MENU_LABELS[choice]} ]  `, {
          fontFamily: TERMINAL_FONT,
          fontSize: 22,
          color: COLOR_DIM,
        })
        .setOrigin(0.5)

      label.setInteractive({ useHandCursor: true })
      label.on('pointerover', () => {
        this.menu?.select(choice)
        this.refreshButtons()
      })
      label.on('pointerdown', () => {
        if (this.menu?.isEnabled(choice)) {
          this.menu.select(choice)
          this.onChoice(choice)
        }
      })

      this.gameOverPanel.add(label)
      this.buttons.push({ choice, label })
    }

  }

  private refreshButtons(): void {
    const menu = this.menu
    if (!menu) {
      return
    }
    for (const { choice, label } of this.buttons) {
      const enabled = menu.isEnabled(choice)
      const selected = menu.selected === choice
      label.setText(selected ? `> [ ${MENU_LABELS[choice]} ] <` : `  [ ${MENU_LABELS[choice]} ]  `)
      label.setColor(enabled ? (selected ? COLOR_WHITE : COLOR_DIM) : COLOR_DIM)
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
    const background = scene.add.rectangle(
      960,
      360 + extraHeight / 2,
      1000,
      300 + extraHeight,
      PANEL_BG,
      PANEL_BG_ALPHA,
    )
    background.setStrokeStyle(PANEL_BORDER_WIDTH, PANEL_BORDER, 1)

    const titleRule = scene.add.rectangle(960, 365, 500, 2, 0xffffff, 1)
    const title = scene.add
      .text(960, 315, titleText, {
        fontFamily: TERMINAL_FONT,
        fontSize: 42,
        color: COLOR_WHITE,
        align: 'center',
      })
      .setOrigin(0.5)
    const message = scene.add
      .text(960, 425, messageText, {
        fontFamily: TERMINAL_FONT,
        fontSize: 18,
        color: TEXT_COLOR,
        align: 'center',
        wordWrap: { width: 820 },
      })
      .setOrigin(0.5)

    return scene.add
      .container(0, 0, [background, titleRule, title, message])
      .setDepth(30)
      .setVisible(false)
  }
}
