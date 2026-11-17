import Phaser from 'phaser'

export const TITLE_MENU_ITEMS = ['START', 'SETTING', 'HELP'] as const
export type TitleMenuItem = (typeof TITLE_MENU_ITEMS)[number]

export const TYPING_SPEED_MS = 15
export const SCROLL_SPEED_MS = 27
export const PAUSE_DURATION_MS = 150
export const EXECUTION_PAUSE_MS = PAUSE_DURATION_MS

const TERMINAL_FONT = '"Press Start 2P", monospace'
const COLOR_WHITE = '#ffffff'
const COLOR_DIM = '#555555'
const COLOR_MUTED = '#333333'
const COLOR_PROMPT = '#888888'

export class TitleScene extends Phaser.Scene {
  private selectedIndex = 0
  private menuTexts: Phaser.GameObjects.Text[] = []
  private mainMenuContainer!: Phaser.GameObjects.Container
  private helpScreenContainer!: Phaser.GameObjects.Container
  private mainPromptCommand!: Phaser.GameObjects.Text
  private helpPromptCommand!: Phaser.GameObjects.Text
  private inHelp = false
  private isTransitioning = false

  constructor() {
    super({ key: 'title' })
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000')

    this.mainMenuContainer = this.add.container(0, 0)
    this.helpScreenContainer = this.add.container(0, 0).setVisible(false)

    this.buildDecorations()
    this.buildTitle()
    this.buildMenu()
    this.buildPrompt()
    this.buildHelpScreen()
    this.setupInput()
    this.updateSelection()
  }

  public getSelectedIndex(): number {
    return this.selectedIndex
  }

  public getSelectedChoice(): TitleMenuItem {
    return TITLE_MENU_ITEMS[this.selectedIndex]
  }

  public isInHelp(): boolean {
    return this.inHelp
  }

  public isMenuTransitioning(): boolean {
    return this.isTransitioning
  }

  public showHelp(animated = true): void {
    if (this.isTransitioning) return
    this.inHelp = true

    if (!animated) {
      this.mainMenuContainer.setVisible(false).setY(0)
      this.helpScreenContainer.setVisible(true).setY(0)
      this.mainPromptCommand?.setText('')
      return
    }

    this.isTransitioning = true
    this.typeCommand(this.mainPromptCommand, 'help', () => {
      this.time.delayedCall(EXECUTION_PAUSE_MS, () => {
        this.scrollTransition(this.mainMenuContainer, this.helpScreenContainer, () => {
          this.mainMenuContainer.setVisible(false).setY(0)
          this.mainPromptCommand?.setText('')
          this.isTransitioning = false
        })
      })
    })
  }

  public exitHelp(animated = true): void {
    if (this.isTransitioning) return
    this.inHelp = false

    if (!animated) {
      this.helpScreenContainer.setVisible(false).setY(0)
      this.mainMenuContainer.setVisible(true).setY(0)
      this.helpPromptCommand?.setText('')
      this.updateSelection()
      return
    }

    this.isTransitioning = true
    this.typeCommand(this.helpPromptCommand, './main', () => {
      this.time.delayedCall(EXECUTION_PAUSE_MS, () => {
        this.scrollTransition(this.helpScreenContainer, this.mainMenuContainer, () => {
          this.helpScreenContainer.setVisible(false).setY(0)
          this.helpPromptCommand?.setText('')
          this.isTransitioning = false
          this.updateSelection()
        })
      })
    })
  }

  public confirmSelection(): TitleMenuItem {
    const choice = this.getSelectedChoice()
    console.log(`[TitleScene] selected: ${choice}`)
    if (choice === 'START') {
      this.scene.start('game')
    } else if (choice === 'HELP') {
      this.showHelp()
    }
    return choice
  }

  private typeCommand(
    textObj: Phaser.GameObjects.Text,
    command: string,
    onComplete: () => void,
  ): void {
    if (!textObj) {
      onComplete()
      return
    }
    textObj.setText('')
    const charDelay = TYPING_SPEED_MS
    // Type character 1
    this.time.delayedCall(charDelay, () => {
      textObj.setText(command.slice(0, 1))
      // Type character 2
      this.time.delayedCall(charDelay, () => {
        textObj.setText(command.slice(0, 2))
        // Tab complete the rest of the command
        this.time.delayedCall(charDelay, () => {
          textObj.setText(command)
          onComplete()
        })
      })
    })
  }

  private scrollTransition(
    fromContainer: Phaser.GameObjects.Container,
    toContainer: Phaser.GameObjects.Container,
    onComplete: () => void,
  ): void {
    toContainer.setY(850).setVisible(true)
    if (this.tweens?.add) {
      this.tweens.add({
        targets: [fromContainer, toContainer],
        y: '-=850',
        duration: SCROLL_SPEED_MS,
        ease: 'Linear',
        onComplete: () => {
          onComplete()
        },
      })
    } else {
      toContainer.setY(0)
      fromContainer.setY(-850)
      onComplete()
    }
  }

  private buildDecorations(): void {
    const graphics = this.add.graphics()
    graphics.lineStyle(2, 0x333333, 1)
    graphics.strokeRect(40, 40, 1840, 1000)

    graphics.lineStyle(1, 0x222222, 1)
    graphics.strokeRect(48, 48, 1824, 984)

    const kernelText = this.add.text(80, 70, [
      '> SYS.KERNEL: V1.0.4-LTS',
      '> TERMINAL DISPLAY 1920x1080 [MONOCHROME]',
      '> READY FOR INPUT',
    ], {
      fontFamily: TERMINAL_FONT,
      fontSize: '14px',
      color: COLOR_DIM,
      lineSpacing: 8,
    })

    const modeText = this.add.text(1840, 70, 'MODE: TTY-0\nBAUD: 115200', {
      fontFamily: TERMINAL_FONT,
      fontSize: '12px',
      color: COLOR_MUTED,
      align: 'right',
      lineSpacing: 6,
    }).setOrigin(1, 0)

    this.mainMenuContainer.add([kernelText, modeText])
  }

  private buildTitle(): void {
    const titleText = this.add.text(960, 240, 'H A C K _ G A M E', {
      fontFamily: TERMINAL_FONT,
      fontSize: '52px',
      color: COLOR_WHITE,
      align: 'center',
    }).setOrigin(0.5, 0.5)

    const line = this.add.graphics()
    line.lineStyle(2, 0xffffff, 1)
    line.lineBetween(660, 290, 1260, 290)

    const subtitleText = this.add.text(960, 330, 'A COMMAND-DRIVEN RTS ADVENTURE', {
      fontFamily: TERMINAL_FONT,
      fontSize: '18px',
      color: COLOR_PROMPT,
      align: 'center',
    }).setOrigin(0.5, 0.5)

    this.mainMenuContainer.add([titleText, line, subtitleText])
  }

  private buildMenu(): void {
    const box = this.add.graphics()
    box.lineStyle(2, 0x333333, 1)
    box.strokeRect(710, 430, 500, 270)
    this.mainMenuContainer.add(box)

    const baseY = 510
    const gapY = 55
    this.menuTexts = TITLE_MENU_ITEMS.map((item, index) => {
      const text = this.add.text(960, baseY + index * gapY, `[ ${item} ]`, {
        fontFamily: TERMINAL_FONT,
        fontSize: '22px',
        color: COLOR_DIM,
        align: 'center',
      }).setOrigin(0.5, 0.5)

      this.mainMenuContainer.add(text)
      return text
    })
  }

  private buildPrompt(): void {
    const promptText = this.add.text(80, 920, 'guest_terminal:~$ ', {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_PROMPT,
    })

    const prefixWidth = promptText.width || 304
    this.mainPromptCommand = this.add.text(80 + prefixWidth, 920, '', {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_WHITE,
    })

    const navText = this.add.text(960, 980, '[W / UP] [S / DOWN] SELECT    [ENTER] CONFIRM', {
      fontFamily: TERMINAL_FONT,
      fontSize: '14px',
      color: COLOR_DIM,
      align: 'center',
    }).setOrigin(0.5, 0.5)

    this.mainMenuContainer.add([promptText, this.mainPromptCommand, navText])
  }

  private buildHelpScreen(): void {
    const promptPrefix = this.add.text(80, 70, 'guest_terminal:~$ ', {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_PROMPT,
    })

    const prefixWidth = promptPrefix.width || 304
    const promptCommand = this.add.text(80 + prefixWidth, 70, 'help', {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_WHITE,
    })

    const topLine = this.add.graphics()
    topLine.lineStyle(1, 0x333333, 1)
    topLine.lineBetween(80, 105, 1840, 105)

    const helpLines = [
      '[ MOVEMENT & COMBAT ]',
      '  WASD / ARROW KEYS    Move hacker',
      '  SPACE                Attack with equipped weapon (auto-pickup on touch)',
      '',
      '[ COMMAND LINE ]',
      '  HOLD SHIFT           Open command prompt beneath hacker (slows time to 0.25x)',
      '  RELEASE SHIFT        Execute typed command (empty input cancels & closes)',
      '',
      '[ VIRTUAL COMMANDS ]',
      '  help                 Print available commands and current room objective',
      '  ls                   Discover and reveal hidden objects in current room',
      '  mv <src> <target>    Throw object towards target, or rename object',
      '  cd <room>            Pass through exit doorway into adjacent room',
      '',
      '[ SHORTCUTS & EDITING ]',
      '  TAB                  Auto-complete command name or discovered object label',
      '  CTRL+BACKSPACE       Delete previous word in prompt',
      '  UP / DOWN            Browse command history',
      '  F1                   Toggle live Command Editor overlay',
    ]

    const manualText = this.add.text(80, 125, helpLines, {
      fontFamily: TERMINAL_FONT,
      fontSize: '15px',
      color: COLOR_WHITE,
      lineSpacing: 10,
    })

    const bottomLine = this.add.graphics()
    bottomLine.lineStyle(1, 0x333333, 1)
    bottomLine.lineBetween(80, 750, 1840, 750)

    const returnBtn = this.add.text(960, 810, '> [ RETURN ] <', {
      fontFamily: TERMINAL_FONT,
      fontSize: '22px',
      color: COLOR_WHITE,
      align: 'center',
    }).setOrigin(0.5, 0.5)

    const bottomPrompt = this.add.text(80, 920, 'guest_terminal:~$ ', {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_PROMPT,
    })

    const bottomPrefixWidth = bottomPrompt.width || 304
    this.helpPromptCommand = this.add.text(80 + bottomPrefixWidth, 920, '', {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_WHITE,
    })

    const navHelpText = this.add.text(960, 980, '[ENTER] RETURN TO MAIN MENU', {
      fontFamily: TERMINAL_FONT,
      fontSize: '14px',
      color: COLOR_DIM,
      align: 'center',
    }).setOrigin(0.5, 0.5)

    this.helpScreenContainer.add([
      promptPrefix,
      promptCommand,
      topLine,
      manualText,
      bottomLine,
      returnBtn,
      bottomPrompt,
      this.helpPromptCommand,
      navHelpText,
    ])
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
    if (this.inHelp || this.isTransitioning) return
    const count = TITLE_MENU_ITEMS.length
    this.selectedIndex = (this.selectedIndex + delta + count) % count
    this.updateSelection()
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.isTransitioning) {
      event.preventDefault()
      return
    }

    const key = event.key.toUpperCase()

    if (this.inHelp) {
      if (key === 'ENTER') {
        event.preventDefault()
        this.exitHelp()
      }
      return
    }

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
