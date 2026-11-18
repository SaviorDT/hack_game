import Phaser from 'phaser'
import {
  loadCommandTypingMode,
  saveCommandTypingMode,
  type CommandTypingMode,
} from '../application/gameSettings.ts'
import {
  buildHelpScreen,
  buildSettingScreen,
  getHelpLines,
  scrollTransition,
  typeCommand,
  updateSettingDisplay,
  EXECUTION_PAUSE_MS,
  TERMINAL_FONT,
  COLOR_WHITE,
  COLOR_DIM,
  COLOR_MUTED,
  COLOR_PROMPT,
} from './pauseSceneHelpers.ts'

export {
  TYPING_SPEED_MS,
  SCROLL_SPEED_MS,
  PAUSE_DURATION_MS,
  EXECUTION_PAUSE_MS,
} from './pauseSceneHelpers.ts'

export const TITLE_MENU_ITEMS = ['START', 'SETTING', 'HELP'] as const
export type TitleMenuItem = (typeof TITLE_MENU_ITEMS)[number]

export const TYPING_MODES: readonly CommandTypingMode[] = ['hold-shift', 'enter-sticky']


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
    typeCommand(this, textObj, command, onComplete)
  }

  private scrollTransition(
    fromContainer: Phaser.GameObjects.Container,
    toContainer: Phaser.GameObjects.Container,
    onComplete: () => void,
  ): void {
    scrollTransition(this, fromContainer, toContainer, onComplete)
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

  private getHelpLines(mode: CommandTypingMode): string[] {
    return getHelpLines(mode)
  }

  private updateHelpText(): void {
    this.helpManualText?.setText(this.getHelpLines(this.currentTypingMode))
  }

  private buildHelpScreen(): void {
    const refs = buildHelpScreen(this, this.helpScreenContainer, this.currentTypingMode)
    this.helpPromptCommand = refs.promptCommand
    this.helpManualText = refs.manualText
    this.helpDescText = refs.descText
  }

  private buildSettingScreen(): void {
    const refs = buildSettingScreen(this, this.settingsScreenContainer, this.currentTypingMode)
    this.settingsPromptCommand = refs.promptCommand
    this.settingsReturnBtn = refs.returnBtn
    this.settingShiftText = refs.shiftText
    this.settingSeparatorText = refs.separatorText
    this.settingStickyText = refs.stickyText
    this.settingDescText = refs.descText
    this.updateSettingDisplay()
  }

  private updateSettingDisplay(): void {
    if (!this.settingsReturnBtn || !this.settingShiftText || !this.settingStickyText || !this.settingDescText) return
    updateSettingDisplay({
      typingMode: this.currentTypingMode,
      focusIndex: this.settingFocusIndex,
      returnBtn: this.settingsReturnBtn,
      shiftText: this.settingShiftText,
      stickyText: this.settingStickyText,
      descText: this.settingDescText,
    })
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
      this.settingSeparatorText?.destroy?.()
      this.settingSeparatorText = undefined
      this.settingStickyText = undefined
      this.settingDescText = undefined
      this.helpManualText = undefined
      this.helpDescText?.destroy?.()
      this.helpDescText = undefined
    })
  }
}
