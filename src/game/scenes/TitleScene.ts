import Phaser from 'phaser'

export const TITLE_MENU_ITEMS = ['START', 'SETTING', 'HELP'] as const
export type TitleMenuItem = (typeof TITLE_MENU_ITEMS)[number]

const TERMINAL_FONT = '"Press Start 2P", monospace'
const COLOR_WHITE = '#ffffff'
const COLOR_DIM = '#555555'
const COLOR_MUTED = '#333333'
const COLOR_PROMPT = '#888888'

export class TitleScene extends Phaser.Scene {
  private selectedIndex = 0
  private menuTexts: Phaser.GameObjects.Text[] = []

  constructor() {
    super({ key: 'title' })
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000')

    this.buildDecorations()
    this.buildTitle()
    this.buildMenu()
    this.buildPrompt()
    this.setupInput()
    this.updateSelection()
  }

  public getSelectedIndex(): number {
    return this.selectedIndex
  }

  public getSelectedChoice(): TitleMenuItem {
    return TITLE_MENU_ITEMS[this.selectedIndex]
  }

  public confirmSelection(): TitleMenuItem {
    const choice = this.getSelectedChoice()
    console.log(`[TitleScene] selected: ${choice}`)
    if (choice === 'START') {
      this.scene.start('game')
    }
    return choice
  }

  private buildDecorations(): void {
    const graphics = this.add.graphics()
    graphics.lineStyle(2, 0x333333, 1)
    graphics.strokeRect(40, 40, 1840, 1000)

    graphics.lineStyle(1, 0x222222, 1)
    graphics.strokeRect(48, 48, 1824, 984)

    this.add.text(80, 70, [
      '> SYS.KERNEL: V1.0.4-LTS',
      '> TERMINAL DISPLAY 1920x1080 [MONOCHROME]',
      '> READY FOR INPUT',
    ], {
      fontFamily: TERMINAL_FONT,
      fontSize: '14px',
      color: COLOR_DIM,
      lineSpacing: 8,
    })

    this.add.text(1840, 70, 'MODE: TTY-0\nBAUD: 115200', {
      fontFamily: TERMINAL_FONT,
      fontSize: '12px',
      color: COLOR_MUTED,
      align: 'right',
      lineSpacing: 6,
    }).setOrigin(1, 0)
  }

  private buildTitle(): void {
    this.add.text(960, 240, 'H A C K _ G A M E', {
      fontFamily: TERMINAL_FONT,
      fontSize: '52px',
      color: COLOR_WHITE,
      align: 'center',
    }).setOrigin(0.5, 0.5)

    const line = this.add.graphics()
    line.lineStyle(2, 0xffffff, 1)
    line.lineBetween(660, 290, 1260, 290)

    this.add.text(960, 330, 'A COMMAND-DRIVEN RTS ADVENTURE', {
      fontFamily: TERMINAL_FONT,
      fontSize: '18px',
      color: COLOR_PROMPT,
      align: 'center',
    }).setOrigin(0.5, 0.5)
  }

  private buildMenu(): void {
    const box = this.add.graphics()
    box.lineStyle(2, 0x333333, 1)
    box.strokeRect(710, 430, 500, 270)

    const baseY = 510
    const gapY = 55
    this.menuTexts = TITLE_MENU_ITEMS.map((item, index) => {
      return this.add.text(960, baseY + index * gapY, `[ ${item} ]`, {
        fontFamily: TERMINAL_FONT,
        fontSize: '22px',
        color: COLOR_DIM,
        align: 'center',
      }).setOrigin(0.5, 0.5)
    })
  }

  private buildPrompt(): void {
    this.add.text(80, 920, 'guest@hack-terminal:~$ ', {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_PROMPT,
    })

    this.add.text(960, 980, '[W / UP] [S / DOWN] SELECT    [ENTER] CONFIRM', {
      fontFamily: TERMINAL_FONT,
      fontSize: '14px',
      color: COLOR_DIM,
      align: 'center',
    }).setOrigin(0.5, 0.5)
  }

  private updateSelection(): void {
    this.menuTexts.forEach((textObj, index) => {
      const isSelected = index === this.selectedIndex
      const label = TITLE_MENU_ITEMS[index]
      if (isSelected) {
        textObj.setText(`> [ ${label} ] <`)
        textObj.setColor(COLOR_WHITE)
      } else {
        textObj.setText(`  [ ${label} ]  `)
        textObj.setColor(COLOR_DIM)
      }
    })
  }

  private moveSelection(delta: -1 | 1): void {
    const count = TITLE_MENU_ITEMS.length
    this.selectedIndex = (this.selectedIndex + delta + count) % count
    this.updateSelection()
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toUpperCase()
    if (key === 'ARROWUP' || key === 'W') {
      event.preventDefault()
      this.moveSelection(-1)
    } else if (key === 'ARROWDOWN' || key === 'S') {
      event.preventDefault()
      this.moveSelection(1)
    } else if (key === 'ENTER') {
      event.preventDefault()
      this.confirmSelection()
    }
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard
    keyboard?.on('keydown', this.handleKeyDown)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.off('keydown', this.handleKeyDown)
      this.menuTexts = []
    })
  }
}
