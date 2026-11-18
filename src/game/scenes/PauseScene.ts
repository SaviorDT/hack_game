import Phaser from 'phaser'
import {
  loadCommandTypingMode,
  saveCommandTypingMode,
  type CommandTypingMode,
} from '../application/gameSettings.ts'
import {
  buildHelpScreen,
  buildSettingScreen,
  COLOR_DIM,
  COLOR_MUTED,
  COLOR_PROMPT,
  COLOR_WHITE,
  EXECUTION_PAUSE_MS,
  getHelpLines,
  scrollTransition,
  TERMINAL_FONT,
  typeCommand,
  updateSettingDisplay,
} from './pauseSceneHelpers.ts'

export const PAUSE_OVERLAY_ALPHA = 0.7
export const PAUSE_MENU_ITEMS = ['RESUME', 'SETTING', 'HELP'] as const
export type PauseMenuItem = (typeof PAUSE_MENU_ITEMS)[number]

export class PauseScene extends Phaser.Scene {
  private selectedIndex = 0
  private menuTexts: Phaser.GameObjects.Text[] = []
  private mainMenuContainer!: Phaser.GameObjects.Container
  private helpScreenContainer!: Phaser.GameObjects.Container
  private settingsScreenContainer!: Phaser.GameObjects.Container
  private mainPromptCommand!: Phaser.GameObjects.Text
  private helpPromptCommand?: Phaser.GameObjects.Text
  private settingsPromptCommand?: Phaser.GameObjects.Text
  private settingsReturnBtn?: Phaser.GameObjects.Text
  private settingShiftText?: Phaser.GameObjects.Text
  private settingStickyText?: Phaser.GameObjects.Text
  private settingDescText?: Phaser.GameObjects.Text
  private helpManualText?: Phaser.GameObjects.Text
  private currentTypingMode: CommandTypingMode = 'hold-shift'
  private settingFocusIndex: 0 | 1 | 2 = 0
  private inHelp = false
  private inSettings = false
  private isTransitioning = false

  constructor() {
    super({ key: 'pause' })
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000')
    this.currentTypingMode = loadCommandTypingMode()
    this.settingFocusIndex = this.currentTypingMode === 'hold-shift' ? 0 : 1
    this.mainMenuContainer = this.add.container(0, 0)
    this.helpScreenContainer = this.add.container(0, 0).setVisible(false)
    this.settingsScreenContainer = this.add.container(0, 0).setVisible(false)

    const overlay = this.add.graphics()
    overlay.fillStyle(0x000000, PAUSE_OVERLAY_ALPHA)
    overlay.fillRect(0, 0, 1920, 1080)
    const border = this.add.graphics()
    border.lineStyle(2, 0x333333, 1)
    border.strokeRect(40, 40, 1840, 1000)
    this.mainMenuContainer.add([overlay, border])

    const title = this.add.text(960, 260, 'P A U S E D', {
      fontFamily: TERMINAL_FONT,
      fontSize: '42px',
      color: COLOR_WHITE,
      align: 'center',
    }).setOrigin(0.5, 0.5)
    const line = this.add.graphics()
    line.lineStyle(2, 0xffffff, 1)
    line.lineBetween(710, 320, 1210, 320)
    this.mainMenuContainer.add([title, line])

    const box = this.add.graphics()
    box.lineStyle(2, 0x333333, 1)
    box.strokeRect(710, 380, 500, 230)
    this.mainMenuContainer.add(box)
    this.menuTexts = PAUSE_MENU_ITEMS.map((item, index) => {
      const text = this.add.text(960, 455 + index * 55, `[ ${item} ]`, {
        fontFamily: TERMINAL_FONT,
        fontSize: '22px',
        color: COLOR_DIM,
        align: 'center',
      }).setOrigin(0.5, 0.5)
      this.mainMenuContainer.add(text)
      return text
    })

    this.mainMenuContainer.add(this.add.text(960, 860,
      '<W A S D> <ARROWS> SELECT    <ENTER> CONFIRM', {
      fontFamily: TERMINAL_FONT,
      fontSize: '14px',
      color: COLOR_MUTED,
      align: 'center',
    }).setOrigin(0.5, 0.5))
    const prompt = this.add.text(80, 920, 'guest_terminal:~$ ', {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_PROMPT,
    })
    this.mainPromptCommand = this.add.text(80 + (prompt.width || 304), 920, '', {
      fontFamily: TERMINAL_FONT,
      fontSize: '16px',
      color: COLOR_WHITE,
    })
    this.mainMenuContainer.add([prompt, this.mainPromptCommand])

    const help = buildHelpScreen(this, this.helpScreenContainer, this.currentTypingMode)
    this.helpPromptCommand = help.promptCommand
    this.helpManualText = help.manualText
    const setting = buildSettingScreen(this, this.settingsScreenContainer, this.currentTypingMode)
    this.settingsPromptCommand = setting.promptCommand
    this.settingsReturnBtn = setting.returnBtn
    this.settingShiftText = setting.shiftText
    this.settingStickyText = setting.stickyText
    this.settingDescText = setting.descText

    this.updateSelection()
    this.input.keyboard?.on('keydown', this.handleKeyDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.handleKeyDown)
    })
  }

  public getSelectedIndex(): number { return this.selectedIndex }
  public getSelectedChoice(): PauseMenuItem { return PAUSE_MENU_ITEMS[this.selectedIndex] }
  public isInHelp(): boolean { return this.inHelp }
  public isInSettings(): boolean { return this.inSettings }
  public isMenuTransitioning(): boolean { return this.isTransitioning }

  public resumeGame(): void {
    const gameScene = this.scene.get('game') as unknown as { resumeFromPause?: () => void }
    gameScene?.resumeFromPause?.()
    this.scene.stop()
  }

  public showHelp(animated = true): void {
    this.transitionToSubscreen(this.helpScreenContainer, 'help', () => { this.inHelp = true }, animated)
  }

  public exitHelp(animated = true): void {
    this.transitionFromSubscreen(this.helpScreenContainer, this.helpPromptCommand, () => { this.inHelp = false }, animated)
  }

  public showSettings(animated = true): void {
    this.settingFocusIndex = this.currentTypingMode === 'hold-shift' ? 0 : 1
    this.updateSettingDisplay()
    this.transitionToSubscreen(this.settingsScreenContainer, 'settings', () => { this.inSettings = true }, animated)
  }

  public exitSettings(animated = true): void {
    this.transitionFromSubscreen(this.settingsScreenContainer, this.settingsPromptCommand, () => { this.inSettings = false }, animated)
  }

  private updateSelection(): void {
    PAUSE_MENU_ITEMS.forEach((item, index) => {
      const text = this.menuTexts[index]
      if (!text) return
      text.setText(index === this.selectedIndex ? `> [ ${item} ] <` : `  [ ${item} ]  `)
      text.setColor(index === this.selectedIndex ? COLOR_WHITE : COLOR_DIM)
    })
  }

  private moveSelection(delta: -1 | 1): void {
    if (this.inHelp || this.inSettings || this.isTransitioning) return
    this.selectedIndex = (this.selectedIndex + delta + PAUSE_MENU_ITEMS.length) % PAUSE_MENU_ITEMS.length
    this.updateSelection()
  }

  private confirmSelection(): void {
    if (this.getSelectedChoice() === 'RESUME') this.resumeGame()
    if (this.getSelectedChoice() === 'SETTING') this.showSettings()
    if (this.getSelectedChoice() === 'HELP') this.showHelp()
  }

  private transitionToSubscreen(
    target: Phaser.GameObjects.Container,
    command: string,
    onEntered: () => void,
    animated: boolean,
  ): void {
    if (this.isTransitioning) return
    onEntered()
    if (!animated) {
      this.mainMenuContainer.setVisible(false).setY(0)
      target.setVisible(true).setY(0)
      this.mainPromptCommand?.setText('')
      return
    }
    this.isTransitioning = true
    typeCommand(this, this.mainPromptCommand, command, () => {
      this.time.delayedCall(EXECUTION_PAUSE_MS, () => {
        scrollTransition(this, this.mainMenuContainer, target, () => {
          this.mainMenuContainer.setVisible(false).setY(0)
          this.mainPromptCommand?.setText('')
          this.isTransitioning = false
        })
      })
    })
  }

  private transitionFromSubscreen(
    source: Phaser.GameObjects.Container,
    prompt: Phaser.GameObjects.Text | undefined,
    onExited: () => void,
    animated: boolean,
  ): void {
    if (this.isTransitioning) return
    onExited()
    if (!animated) {
      source.setVisible(false).setY(0)
      this.mainMenuContainer.setVisible(true).setY(0)
      prompt?.setText('')
      this.updateSelection()
      return
    }
    this.isTransitioning = true
    typeCommand(this, prompt!, './main', () => {
      this.time.delayedCall(EXECUTION_PAUSE_MS, () => {
        scrollTransition(this, source, this.mainMenuContainer, () => {
          source.setVisible(false).setY(0)
          prompt?.setText('')
          this.isTransitioning = false
          this.updateSelection()
        })
      })
    })
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

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey && event.key.toLowerCase() === 'p') {
      event.preventDefault()
      this.resumeGame()
      return
    }
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
        this.settingFocusIndex = this.settingFocusIndex === 2
          ? (this.currentTypingMode === 'hold-shift' ? 0 : 1)
          : 2
        this.updateSettingDisplay()
        return
      }
      if (key === 'ARROWUP' || key === 'W') {
        event.preventDefault()
        this.settingFocusIndex = this.settingFocusIndex === 2
          ? (this.currentTypingMode === 'hold-shift' ? 0 : 1)
          : 2
        this.updateSettingDisplay()
        return
      }
      if (key === 'ENTER') {
        event.preventDefault()
        if (this.settingFocusIndex === 0) {
          this.currentTypingMode = 'hold-shift'
          saveCommandTypingMode(this.currentTypingMode)
        } else if (this.settingFocusIndex === 1) {
          this.currentTypingMode = 'enter-sticky'
          saveCommandTypingMode(this.currentTypingMode)
        } else {
          this.exitSettings()
          return
        }
        this.updateSettingDisplay()
        this.helpManualText?.setText(getHelpLines(this.currentTypingMode))
        const gameScene = this.scene.get('game') as unknown as {
          setCommandTypingMode?: (mode: CommandTypingMode) => void
        }
        gameScene?.setCommandTypingMode?.(this.currentTypingMode)
      }
      return
    }
    if (key === 'ARROWUP' || key === 'W') this.moveSelection(-1)
    else if (key === 'ARROWDOWN' || key === 'S') this.moveSelection(1)
    else if (key === 'ENTER') {
      event.preventDefault()
      this.confirmSelection()
    }
  }
}
