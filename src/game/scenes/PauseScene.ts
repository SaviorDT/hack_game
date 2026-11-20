import Phaser from 'phaser'
import {
  loadCommandTypingMode,
  saveCommandTypingMode,
  type CommandTypingMode,
} from '../application/gameSettings.ts'
import {
  focusForMode,
  nextSettingFocus,
  settingChoiceAt,
  type SettingFocus,
} from './settingsFocus.ts'
import {
  buildHelpScreen,
  buildSettingScreen,
  COLOR_DIM,
  COLOR_MUTED,
  COLOR_PROMPT,
  COLOR_WHITE,
  expandFromPoint,
  EXECUTION_PAUSE_MS,
  getHelpLines,
  scrollTransition,
  scrollOut,
  shrinkToPoint,
  TERMINAL_FONT,
  typeCommand,
  updateSettingDisplay,
} from './pauseSceneHelpers.ts'
import { buildRecordedCommandsBox } from './recordedCommandsBox.ts'
import { loadCommandSlots } from '../application/commandSlots.ts'

export const PAUSE_OVERLAY_ALPHA = 0.7
export const PAUSE_MENU_ITEMS = ['RESUME', 'SETTING', 'HELP', 'TITLE'] as const
export type PauseMenuItem = (typeof PAUSE_MENU_ITEMS)[number]
export const TITLE_CONFIRM_OPTIONS = ['YES', 'NO'] as const

export class PauseScene extends Phaser.Scene {
  private selectedIndex = 0
  private menuTexts: Phaser.GameObjects.Text[] = []
  private mainMenuContainer!: Phaser.GameObjects.Container
  private recordedCommandsBox?: Phaser.GameObjects.Container
  private helpScreenContainer!: Phaser.GameObjects.Container
  private settingsScreenContainer!: Phaser.GameObjects.Container
  private mainPromptCommand!: Phaser.GameObjects.Text
  private helpPromptCommand?: Phaser.GameObjects.Text
  private settingsPromptCommand?: Phaser.GameObjects.Text
  private settingsReturnBtn?: Phaser.GameObjects.Text
  private settingModeTexts: Phaser.GameObjects.Text[] = []
  private confirmTexts: Phaser.GameObjects.Text[] = []
  private confirmQuestion?: Phaser.GameObjects.Text
  private confirmIndex = 1
  private inConfirm = false
  private settingDescText?: Phaser.GameObjects.Text
  private helpManualText?: Phaser.GameObjects.Text
  private currentTypingMode: CommandTypingMode = 'hold-shift'
  private settingFocusIndex: SettingFocus = 0
  private inHelp = false
  private inSettings = false
  private isTransitioning = false

  constructor() {
    super({ key: 'pause' })
  }

  create(): void {
    this.selectedIndex = 0
    this.inConfirm = false
    this.confirmIndex = 1
    this.inHelp = false
    this.inSettings = false
    this.isTransitioning = true
    this.cameras.main.setBackgroundColor('#000000')
    this.currentTypingMode = loadCommandTypingMode()
    this.settingFocusIndex = focusForMode(this.currentTypingMode)

    const overlay = this.add.graphics()
    overlay.fillStyle(0x000000, PAUSE_OVERLAY_ALPHA)
    overlay.fillRect(0, 0, 1920, 1080)
    this.mainMenuContainer = this.add.container(0, 0)
    this.helpScreenContainer = this.add.container(0, 0).setVisible(false)
    this.settingsScreenContainer = this.add.container(0, 0).setVisible(false)

    const border = this.add.graphics()
    border.lineStyle(2, 0x333333, 1)
    border.strokeRect(40, 40, 1840, 1000)

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
    box.strokeRect(710, 380, 500, 290)
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

    const gameSceneRef = this.scene.get('game') as unknown as {
      session?: {
        getCommandSlots?: () => Record<number, string>
      }
    }
    const currentSlots = gameSceneRef?.session?.getCommandSlots?.() ?? loadCommandSlots()
    this.recordedCommandsBox = buildRecordedCommandsBox(this, this.mainMenuContainer, currentSlots)

    this.buildTitleConfirm()

    this.mainMenuContainer.add(this.add.text(960, 860,
      '<W A S D> <ARROWS> SELECT    <ENTER> CONFIRM    <SPACE/P> RESUME', {
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
    this.settingModeTexts = setting.modeTexts
    this.settingDescText = setting.descText

    this.updateSelection()
    this.input.keyboard?.on('keydown', this.handleKeyDown)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.handleKeyDown)
    })

    const gameScene = this.scene.get('game') as unknown as {
      session?: {
        getRenderPosition?: (id: string) => { x: number; y: number } | undefined
      }
    }
    const position = gameScene?.session?.getRenderPosition?.('player')
    const sourceX = position?.x ?? 960
    const sourceY = position?.y ?? 540

    expandFromPoint(this, sourceX, sourceY, () => {
      this.isTransitioning = false
    })
  }

  private buildTitleConfirm(): void {
    this.confirmQuestion = this.add.text(960, 470, 'ABANDON RUN AND\nRETURN TO TITLE?', {
      fontFamily: TERMINAL_FONT,
      fontSize: '18px',
      color: COLOR_WHITE,
      align: 'center',
      lineSpacing: 12,
    }).setOrigin(0.5, 0.5).setVisible(false)
    this.confirmTexts = TITLE_CONFIRM_OPTIONS.map((option, index) =>
      this.add.text(960 + (index === 0 ? -100 : 100), 580, `[ ${option} ]`, {
        fontFamily: TERMINAL_FONT,
        fontSize: '22px',
        color: COLOR_DIM,
        align: 'center',
      }).setOrigin(0.5, 0.5).setVisible(false))
    this.mainMenuContainer.add([this.confirmQuestion, ...this.confirmTexts])
  }

  public isInTitleConfirm(): boolean { return this.inConfirm }
  public getConfirmChoice(): (typeof TITLE_CONFIRM_OPTIONS)[number] { return TITLE_CONFIRM_OPTIONS[this.confirmIndex] }

  public showTitleConfirm(): void {
    if (this.isTransitioning) return
    this.inConfirm = true
    this.confirmIndex = 1
    this.menuTexts.forEach((text) => text.setVisible(false))
    this.recordedCommandsBox?.setVisible(false)
    this.confirmQuestion?.setVisible(true)
    this.confirmTexts.forEach((text) => text.setVisible(true))
    this.updateConfirmSelection()
  }

  public cancelTitleConfirm(): void {
    this.inConfirm = false
    this.confirmQuestion?.setVisible(false)
    this.confirmTexts.forEach((text) => text.setVisible(false))
    this.menuTexts.forEach((text) => text.setVisible(true))
    this.recordedCommandsBox?.setVisible(true)
    this.updateSelection()
  }

  private updateConfirmSelection(): void {
    TITLE_CONFIRM_OPTIONS.forEach((option, index) => {
      const text = this.confirmTexts[index]
      if (!text) return
      text.setText(index === this.confirmIndex ? `> [ ${option} ] <` : `  [ ${option} ]  `)
      text.setColor(index === this.confirmIndex ? COLOR_WHITE : COLOR_DIM)
    })
  }

  private handleConfirmKey(key: string, event: KeyboardEvent): void {
    if (key === 'ARROWLEFT' || key === 'A' || key === 'ARROWRIGHT' || key === 'D') {
      event.preventDefault()
      this.confirmIndex = this.confirmIndex === 0 ? 1 : 0
      this.updateConfirmSelection()
    } else if (key === 'ENTER') {
      event.preventDefault()
      if (this.getConfirmChoice() === 'YES') this.returnToTitle()
      else this.cancelTitleConfirm()
    }
  }

  /** Abandons the live run (the Save Slot is left untouched) and shows the title screen. */
  public returnToTitle(): void {
    if (this.isTransitioning) return
    this.isTransitioning = true
    typeCommand(this, this.mainPromptCommand, './menu', () => {
      this.time.delayedCall(EXECUTION_PAUSE_MS, () => {
        scrollOut(this, this.mainMenuContainer, () => {
          this.scene.stop('game')
          this.scene.start('title')
        })
      })
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
    this.settingFocusIndex = focusForMode(this.currentTypingMode)
    this.updateSettingDisplay()
    this.transitionToSubscreen(this.settingsScreenContainer, './setting', () => { this.inSettings = true }, animated)
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
    if (this.inHelp || this.inSettings || this.inConfirm || this.isTransitioning) return
    this.selectedIndex = (this.selectedIndex + delta + PAUSE_MENU_ITEMS.length) % PAUSE_MENU_ITEMS.length
    this.updateSelection()
  }

  private confirmSelection(): void {
    if (this.getSelectedChoice() === 'RESUME') this.resumeWithAnimation()
    if (this.getSelectedChoice() === 'SETTING') this.showSettings()
    if (this.getSelectedChoice() === 'HELP') this.showHelp()
    if (this.getSelectedChoice() === 'TITLE') this.showTitleConfirm()
  }

  private resumeWithAnimation(): void {
    if (this.isTransitioning) return
    this.isTransitioning = true

    const gameScene = this.scene.get('game') as unknown as {
      session?: {
        getRenderPosition?: (id: string) => { x: number; y: number } | undefined
      }
    }
    const position = gameScene?.session?.getRenderPosition?.('player')
    const targetX = position?.x ?? 960
    const targetY = position?.y ?? 540

    typeCommand(this, this.mainPromptCommand, './main', () => {
      this.time.delayedCall(EXECUTION_PAUSE_MS, () => {
        shrinkToPoint(this, targetX, targetY, () => {
          this.isTransitioning = false
          this.resumeGame()
        })
      })
    })
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
    typeCommand(this, prompt!, './pause', () => {
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
    if (!this.settingsReturnBtn || !this.settingDescText) return
    updateSettingDisplay({
      typingMode: this.currentTypingMode,
      focusIndex: this.settingFocusIndex,
      returnBtn: this.settingsReturnBtn,
      modeTexts: this.settingModeTexts,
      descText: this.settingDescText,
    })
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
      this.handleSettingsKey(key, event)
      return
    }
    if (this.inConfirm) {
      this.handleConfirmKey(key, event)
      return
    }
    if (key === ' ' || key === 'SPACE' || key === 'P') {
      event.preventDefault()
      if (!event.repeat) {
        this.resumeWithAnimation()
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

  private handleSettingsKey(key: string, event: KeyboardEvent): void {
    const nextFocus = nextSettingFocus(this.settingFocusIndex, this.currentTypingMode, key)
    if (nextFocus !== undefined) {
      event.preventDefault()
      if (nextFocus !== this.settingFocusIndex) {
        this.settingFocusIndex = nextFocus
        this.updateSettingDisplay()
      }
      return
    }
    if (key !== 'ENTER') return
    event.preventDefault()
    const choice = settingChoiceAt(this.settingFocusIndex)
    if (choice === 'return') {
      this.exitSettings()
      return
    }
    this.currentTypingMode = choice
    saveCommandTypingMode(choice)
    this.updateSettingDisplay()
    this.helpManualText?.setText(getHelpLines(choice))
    const gameScene = this.scene.get('game') as unknown as {
      setCommandTypingMode?: (mode: CommandTypingMode) => void
    }
    gameScene?.setCommandTypingMode?.(choice)
  }
}
