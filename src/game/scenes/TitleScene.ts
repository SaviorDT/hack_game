import Phaser from 'phaser'
import {
  loadCommandTypingMode,
  saveCommandTypingMode,
  type CommandTypingMode,
} from '../application/gameSettings.ts'

export const TITLE_MENU_ITEMS = ['START', 'SETTING', 'HELP'] as const
export type TitleMenuItem = (typeof TITLE_MENU_ITEMS)[number]

export const TYPING_MODES: readonly CommandTypingMode[] = ['hold-shift', 'enter-sticky']

export const TYPING_SPEED_MS = 15
export const SCROLL_SPEED_MS = 27
export const PAUSE_DURATION_MS = 150
export const EXECUTION_PAUSE_MS = PAUSE_DURATION_MS

const TERMINAL_FONT = '"Press Start 2P", monospace'
const COLOR_WHITE = '#ffffff'
const COLOR_DIM = '#555555'
const COLOR_MUTED = '#333333'
const COLOR_PROMPT = '#888888'

interface SubscreenChrome {
  bottomCommandText: Phaser.GameObjects.Text
  returnBtn: Phaser.GameObjects.Text
}

export class TitleScene extends Phaser.Scene {
  private selectedIndex = 0
  private menuTexts: Phaser.GameObjects.Text[] = []
  private mainMenuContainer!: Phaser.GameObjects.Container
  private helpScreenContainer!: Phaser.GameObjects.Container
  private settingsScreenContainer!: Phaser.GameObjects.Container
  private mainPromptCommand!: Phaser.GameObjects.Text
  private helpPromptCommand!: Phaser.GameObjects.Text
  private settingsPromptCommand!: Phaser.GameObjects.Text
  private settingsReturnBtn?: Phaser.GameObjects.Text
  private settingShiftText?: Phaser.GameObjects.Text
  private settingSeparatorText?: Phaser.GameObjects.Text
  private settingStickyText?: Phaser.GameObjects.Text
  private settingDescText?: Phaser.GameObjects.Text
  private helpManualText?: Phaser.GameObjects.Text
  private helpDescText?: Phaser.GameObjects.Text
  private currentTypingMode: CommandTypingMode = 'hold-shift'
  private settingFocusIndex: 0 | 1 | 2 = 0
  private inHelp = false
  private inSettings = false
  private isTransitioning = false

  constructor() {
    super({ key: 'title' })
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000')

    this.currentTypingMode = loadCommandTypingMode()
    this.settingFocusIndex = this.currentTypingMode === 'hold-shift' ? 0 : 1

    this.mainMenuContainer = this.add.container(0, 0)
    this.helpScreenContainer = this.add.container(0, 0).setVisible(false)
    this.settingsScreenContainer = this.add.container(0, 0).setVisible(false)

    this.buildDecorations()
    this.buildTitle()
    this.buildMenu()
    this.buildPrompt()
    this.buildHelpScreen()
    this.buildSettingScreen()
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

  public isInSettings(): boolean {
    return this.inSettings
  }

  public getCurrentTypingMode(): CommandTypingMode {
    return this.currentTypingMode
  }

  public getSettingSelectedIndex(): number {
    return this.currentTypingMode === 'hold-shift' ? 0 : 1
  }

  public getSettingFocusRow(): number {
    return this.settingFocusIndex === 2 ? 1 : 0
  }

  public getSettingFocusIndex(): number {
    return this.settingFocusIndex
  }

  public isMenuTransitioning(): boolean {
    return this.isTransitioning
  }

  public showHelp(animated = true): void {
    this.transitionToSubscreen(this.helpScreenContainer, 'help', () => {
      this.inHelp = true
    }, animated)
  }

  public exitHelp(animated = true): void {
    this.transitionFromSubscreen(this.helpScreenContainer, this.helpPromptCommand, () => {
      this.inHelp = false
    }, animated)
  }

  public showSettings(animated = true): void {
    this.settingFocusIndex = this.currentTypingMode === 'hold-shift' ? 0 : 1
    this.updateSettingDisplay()
    this.transitionToSubscreen(this.settingsScreenContainer, 'settings', () => {
      this.inSettings = true
    }, animated)
  }

  public exitSettings(animated = true): void {
    this.transitionFromSubscreen(this.settingsScreenContainer, this.settingsPromptCommand, () => {
      this.inSettings = false
    }, animated)
  }

  public confirmSelection(): TitleMenuItem {
    const choice = this.getSelectedChoice()
    console.log(`[TitleScene] selected: ${choice}`)
    if (choice === 'START') {
      this.scene.start('game')
    } else if (choice === 'HELP') {
      this.showHelp()
    } else if (choice === 'SETTING') {
      this.showSettings()
    }
    return choice
  }

  private transitionToSubscreen(
    targetContainer: Phaser.GameObjects.Container,
    commandText: string,
    onEntered: () => void,
    animated: boolean,
  ): void {
    if (this.isTransitioning) return
    onEntered()

    if (!animated) {
      this.mainMenuContainer.setVisible(false).setY(0)
      targetContainer.setVisible(true).setY(0)
      this.mainPromptCommand?.setText('')
      return
    }

    this.isTransitioning = true
    this.typeCommand(this.mainPromptCommand, commandText, () => {
      this.time.delayedCall(EXECUTION_PAUSE_MS, () => {
        this.scrollTransition(this.mainMenuContainer, targetContainer, () => {
          this.mainMenuContainer.setVisible(false).setY(0)
          this.mainPromptCommand?.setText('')
          this.isTransitioning = false
        })
      })
    })
  }

  private transitionFromSubscreen(
    sourceContainer: Phaser.GameObjects.Container,
    promptText: Phaser.GameObjects.Text | undefined,
    onExited: () => void,
    animated: boolean,
  ): void {
    if (this.isTransitioning) return
    onExited()

    if (!animated) {
      sourceContainer.setVisible(false).setY(0)
      this.mainMenuContainer.setVisible(true).setY(0)
      promptText?.setText('')
      this.updateSelection()
      return
    }

    this.isTransitioning = true
    this.typeCommand(promptText!, './main', () => {
      this.time.delayedCall(EXECUTION_PAUSE_MS, () => {
        this.scrollTransition(sourceContainer, this.mainMenuContainer, () => {
          sourceContainer.setVisible(false).setY(0)
          promptText?.setText('')
          this.isTransitioning = false
          this.updateSelection()
        })
      })
    })
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
    this.time.delayedCall(charDelay, () => {
      textObj.setText(command.slice(0, 1))
      this.time.delayedCall(charDelay, () => {
        textObj.setText(command.slice(0, 2))
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
      '> TERMINAL DISPLAY 1920x1080 (MONOCHROME)',
      '> READY FOR INPUT',
    ], {
      fontFamily: TERMINAL_FONT,
      fontSize: '14px',
      color: COLOR_MUTED,
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
    const navText = this.add.text(960, 860, '<W A S D> <ARROWS> SELECT    <ENTER> CONFIRM', {
      fontFamily: TERMINAL_FONT,
      fontSize: '14px',
      color: COLOR_MUTED,
      align: 'center',
    }).setOrigin(0.5, 0.5)

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

    this.mainMenuContainer.add([navText, promptText, this.mainPromptCommand])
  }

  private buildSubscreenChrome(
    container: Phaser.GameObjects.Container,
    command: string,
    navHint: string,
  ): SubscreenChrome {
    const promptPrefix = this.add.text(80, 70, 'guest_terminal:~$ ', {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_PROMPT,
    })
    const prefixWidth = promptPrefix.width || 304
    const promptCommand = this.add.text(80 + prefixWidth, 70, command, {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_WHITE,
    })

    const topLine = this.add.graphics()
    topLine.lineStyle(1, 0x333333, 1)
    topLine.lineBetween(80, 105, 1840, 105)

    const bottomLine = this.add.graphics()
    bottomLine.lineStyle(1, 0x333333, 1)
    bottomLine.lineBetween(80, 750, 1840, 750)

    const returnBtn = this.add.text(960, 810, '> [ RETURN ] <', {
      fontFamily: TERMINAL_FONT,
      fontSize: '22px',
      color: COLOR_WHITE,
      align: 'center',
    }).setOrigin(0.5, 0.5)

    const navText = this.add.text(960, 860, navHint, {
      fontFamily: TERMINAL_FONT,
      fontSize: '14px',
      color: COLOR_MUTED,
      align: 'center',
    }).setOrigin(0.5, 0.5)

    const bottomPrompt = this.add.text(80, 920, 'guest_terminal:~$ ', {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_PROMPT,
    })
    const bottomPrefixWidth = bottomPrompt.width || 304
    const bottomCommandText = this.add.text(80 + bottomPrefixWidth, 920, '', {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_WHITE,
    })

    container.add([
      promptPrefix,
      promptCommand,
      topLine,
      bottomLine,
      returnBtn,
      navText,
      bottomPrompt,
      bottomCommandText,
    ])

    return { bottomCommandText, returnBtn }
  }

  private getHelpLines(mode: CommandTypingMode): string[] {
    const commandLineBindings =
      mode === 'hold-shift'
        ? [
          '  HOLD SHIFT           Open command prompt beneath hacker (slows time to 0.25x)',
          '  RELEASE SHIFT        Execute typed command (empty input cancels & closes)',
        ]
        : [
          '  ENTER                Open command prompt (slows time to 0.25x)',
          '  ENTER on empty bar   Close command prompt without executing',
        ]

    return [
      '── MOVEMENT & COMBAT ──',
      '  WASD / ARROW KEYS    Move hacker',
      '  SPACE                Attack with equipped weapon (auto-pickup on touch)',
      '',
      '── COMMAND LINE ──',
      ...commandLineBindings,
      '',
      '── VIRTUAL COMMANDS ──',
      '  help                 Print available commands and current room objective',
      '  ls                   Discover and reveal hidden objects in current room',
      '  mv <src> <target>    Throw object towards target, or rename object',
      '  cd <room>            Pass through exit doorway into adjacent room',
      '',
      '── SHORTCUTS ──',
      '  TAB                  Auto-complete command name or discovered object label',
      '  CTRL+BACKSPACE       Delete previous word in prompt',
      '  UP / DOWN            Browse command history',
    ]
  }

  private updateHelpText(): void {
    this.helpManualText?.setText(this.getHelpLines(this.currentTypingMode))
  }

  private buildHelpScreen(): void {
    const chrome = this.buildSubscreenChrome(
      this.helpScreenContainer,
      'help',
      '<ENTER> CONFIRM',
    )
    this.helpPromptCommand = chrome.bottomCommandText

    this.helpManualText = this.add.text(80, 125, '', {
      fontFamily: TERMINAL_FONT,
      fontSize: '15px',
      color: COLOR_PROMPT,
      lineSpacing: 10,
    })

    this.helpDescText = this.add.text(80, 125, '', {
      fontFamily: TERMINAL_FONT,
      fontSize: '15px',
      color: COLOR_DIM,
      lineSpacing: 10,
    })

    const originalSetText = this.helpManualText.setText.bind(this.helpManualText)
    this.helpManualText.setText = ((value: string | string[]) => {
      const lines = Array.isArray(value) ? value : [value]
      const titleLines = lines.map(line =>
        line.startsWith('──') ? line : '',
      )
      const bodyLines = lines.map(line =>
        line.startsWith('──') ? '' : line,
      )
      this.helpDescText?.setText(bodyLines)
      return originalSetText(titleLines)
    }) as typeof this.helpManualText.setText

    this.helpManualText.setText(this.getHelpLines(this.currentTypingMode))

    this.helpScreenContainer.add([this.helpManualText, this.helpDescText])
  }

  private buildSettingScreen(): void {
    const chrome = this.buildSubscreenChrome(
      this.settingsScreenContainer,
      'settings',
      '<W A S D> <ARROWS> SELECT    <ENTER> CONFIRM',
    )
    this.settingsPromptCommand = chrome.bottomCommandText
    this.settingsReturnBtn = chrome.returnBtn

    const header = this.add.text(80, 125, '── IN-GAME COMMAND TYPING MODE ──', {
      fontFamily: TERMINAL_FONT,
      fontSize: '15px',
      color: COLOR_PROMPT,
    })

    this.settingShiftText = this.add.text(110, 165, '', {
      fontFamily: TERMINAL_FONT,
      fontSize: '15px',
      color: COLOR_WHITE,
    })

    this.settingSeparatorText = this.add.text(435, 165, '-', {
      fontFamily: TERMINAL_FONT,
      fontSize: '15px',
      color: COLOR_DIM,
    })

    this.settingStickyText = this.add.text(475, 165, '', {
      fontFamily: TERMINAL_FONT,
      fontSize: '15px',
      color: COLOR_DIM,
    })

    this.settingDescText = this.add.text(110, 210, '', {
      fontFamily: TERMINAL_FONT,
      fontSize: '14px',
      color: COLOR_DIM,
    })

    this.settingsScreenContainer.add([
      header,
      this.settingShiftText,
      this.settingSeparatorText,
      this.settingStickyText,
      this.settingDescText,
    ])

    this.updateSettingDisplay()
  }

  private updateSettingDisplay(): void {
    const isShiftSelected = this.currentTypingMode === 'hold-shift'

    if (this.settingShiftText && this.settingStickyText) {
      const isShiftFocused = this.settingFocusIndex === 0
      const isStickyFocused = this.settingFocusIndex === 1

      const shiftTag = isShiftSelected ? '* HOLD SHIFT *' : '  HOLD SHIFT  '
      const shiftTextStr = isShiftFocused ? `> [${shiftTag}] <` : `  [${shiftTag}]  `
      this.settingShiftText.setText(shiftTextStr)
      this.settingShiftText.setColor(isShiftFocused ? COLOR_WHITE : COLOR_DIM)

      const stickyTag = !isShiftSelected ? '* ENTER + STICKY *' : '  ENTER + STICKY  '
      const stickyTextStr = isStickyFocused ? `> [${stickyTag}] <` : `  [${stickyTag}]  `
      this.settingStickyText.setText(stickyTextStr)
      this.settingStickyText.setColor(isStickyFocused ? COLOR_WHITE : COLOR_DIM)
    }

    if (this.settingDescText) {
      const activeForDesc =
        this.settingFocusIndex === 0
          ? 'hold-shift'
          : this.settingFocusIndex === 1
            ? 'enter-sticky'
            : this.currentTypingMode
      const desc =
        activeForDesc === 'hold-shift'
          ? 'Hold Shift to type commands; release Shift to submit or cancel.'
          : 'Press Enter to open/submit; Enter on empty bar closes; Shift disabled.'
      this.settingDescText.setText(desc)
    }

    if (this.settingsReturnBtn) {
      const isReturnFocused = this.settingFocusIndex === 2
      this.settingsReturnBtn.setText(isReturnFocused ? '> [ RETURN ] <' : '  [ RETURN ]  ')
      this.settingsReturnBtn.setColor(isReturnFocused ? COLOR_WHITE : COLOR_DIM)
    }
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
    if (this.inHelp || this.inSettings || this.isTransitioning) return
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

    if (this.inSettings) {
      if (key === 'ARROWLEFT' || key === 'A') {
        event.preventDefault()
        if (this.settingFocusIndex !== 0) {
          this.settingFocusIndex = 0
          this.updateSettingDisplay()
        }
        return
      }

      if (key === 'ARROWRIGHT' || key === 'D') {
        event.preventDefault()
        if (this.settingFocusIndex !== 1) {
          this.settingFocusIndex = 1
          this.updateSettingDisplay()
        }
        return
      }

      if (key === 'ARROWDOWN' || key === 'S') {
        event.preventDefault()
        if (this.settingFocusIndex === 0 || this.settingFocusIndex === 1) {
          this.settingFocusIndex = 2
        } else {
          this.settingFocusIndex = this.currentTypingMode === 'hold-shift' ? 0 : 1
        }
        this.updateSettingDisplay()
        return
      }

      if (key === 'ARROWUP' || key === 'W') {
        event.preventDefault()
        if (this.settingFocusIndex === 2) {
          this.settingFocusIndex = this.currentTypingMode === 'hold-shift' ? 0 : 1
        } else {
          this.settingFocusIndex = 2
        }
        this.updateSettingDisplay()
        return
      }

      if (key === 'ENTER') {
        event.preventDefault()
        if (this.settingFocusIndex === 0) {
          this.currentTypingMode = 'hold-shift'
          saveCommandTypingMode(this.currentTypingMode)
          this.updateSettingDisplay()
          this.updateHelpText()
        } else if (this.settingFocusIndex === 1) {
          this.currentTypingMode = 'enter-sticky'
          saveCommandTypingMode(this.currentTypingMode)
          this.updateSettingDisplay()
          this.updateHelpText()
        } else if (this.settingFocusIndex === 2) {
          this.exitSettings()
        }
        return
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
      this.settingsReturnBtn = undefined
      this.settingShiftText = undefined
      this.settingSeparatorText = undefined
      this.settingStickyText = undefined
      this.settingDescText = undefined
      this.helpManualText = undefined
      this.helpDescText = undefined
    })
  }
}
