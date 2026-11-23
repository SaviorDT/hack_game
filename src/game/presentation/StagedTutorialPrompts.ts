import type Phaser from 'phaser'
import type { WorldState } from '../domain/WorldState.ts'
import type { InputMode } from '../application/InputModeController.ts'
import type { CommandSlot } from '../application/commandSlots.ts'
import type { CommandTypingMode } from '../application/gameSettings.ts'
import { POPUP_FADE_DURATION_MS } from './uiTheme.ts'
import { fadeOut, scrollTransition } from './uiTransitions.ts'

const TUTORIAL3_EXECUTE_PROMPT = '<8,9,0> execute recorded command'

type TutorialRoomId = 'tutorial2' | 'tutorial3'
type TutorialStage =
  | 'open-command'
  | 'type-command'
  | 'execute-command'
  | 'record-command'
  | 'execute-slot'
  | 'complete'

export interface TutorialPromptBanner {
  container: Phaser.GameObjects.Container
  textContainer: Phaser.GameObjects.Container
  panel: Phaser.GameObjects.Rectangle
  text: Phaser.GameObjects.Text
}

export interface TutorialHudContext {
  commandDraft?: string
  commandOpenedByShift?: boolean
  recordedSlot?: CommandSlot
  executedSlot?: CommandSlot
}

type TypeText = (text: Phaser.GameObjects.Text, value: string) => void
type ClearTypingTimer = () => void

export class StagedTutorialPrompts {
  private readonly scene: Phaser.Scene
  private readonly banners: readonly [TutorialPromptBanner, TutorialPromptBanner]
  private readonly typeText: TypeText
  private readonly clearTypingTimer: ClearTypingTimer
  private roomId?: TutorialRoomId
  private stage?: TutorialStage
  private prompt?: string
  private historyStart?: number
  private activeBanner?: TutorialPromptBanner
  private scrollTween?: Phaser.Tweens.Tween
  private fadeTween?: Phaser.Tweens.Tween

  constructor(
    scene: Phaser.Scene,
    banners: readonly [TutorialPromptBanner, TutorialPromptBanner],
    typeText: TypeText,
    clearTypingTimer: ClearTypingTimer,
  ) {
    this.scene = scene
    this.banners = banners
    this.typeText = typeText
    this.clearTypingTimer = clearTypingTimer
  }

  update(
    roomId: TutorialRoomId,
    hint: string,
    state: WorldState,
    mode: InputMode | undefined,
    typingMode: CommandTypingMode,
    context: TutorialHudContext,
  ): void {
    if (roomId !== this.roomId) {
      this.reset()
      this.roomId = roomId
      this.historyStart = state.commandHistory.length
    }

    const stage = roomId === 'tutorial2'
      ? getTutorial2Stage(state, mode, context, this.historyStart ?? 0, getTutorial2Command(hint))
      : getTutorial3Stage(context)
    const prompt = roomId === 'tutorial2'
      ? getTutorial2Prompt(stage, hint, typingMode, context.commandOpenedByShift === true)
      : getTutorial3Prompt(stage, hint)
    if (stage === this.stage && prompt === this.prompt) return
    this.show(stage, prompt)
  }

  reset(): void {
    if (!this.roomId && !this.scrollTween && !this.fadeTween) return
    this.clearTypingTimer()
    this.scrollTween?.stop()
    this.scrollTween = undefined
    this.fadeTween?.stop()
    this.fadeTween = undefined
    this.roomId = undefined
    this.stage = undefined
    this.prompt = undefined
    this.historyStart = undefined
    this.activeBanner = undefined
    this.hideBanners()
  }

  private show(stage: TutorialStage, prompt: string): void {
    const currentBanner = this.activeBanner
    this.stage = stage
    this.prompt = prompt

    if (stage === 'complete') {
      this.clearTypingTimer()
      this.scrollTween?.stop()
      this.scrollTween = undefined
      this.fadeTween?.stop()
      this.fade(currentBanner)
      return
    }

    const targetBanner = this.getNextBanner(currentBanner)
    targetBanner.container.setVisible(true).setY(0).setAlpha(1)
    targetBanner.panel.setVisible(currentBanner === undefined)

    if (!currentBanner) {
      targetBanner.text.setText('')
      this.activeBanner = targetBanner
      this.typeText(targetBanner.text, prompt)
      return
    }

    this.scroll(currentBanner, targetBanner, prompt)
  }

  private getNextBanner(current?: TutorialPromptBanner): TutorialPromptBanner {
    return !current || current === this.banners[1] ? this.banners[0] : this.banners[1]
  }

  private fade(banner?: TutorialPromptBanner): void {
    if (!banner) return
    this.fadeTween = fadeOut(this.scene, banner.container, () => {
      this.fadeTween = undefined
      banner.container.setVisible(false).setY(0).setAlpha(1)
    }, POPUP_FADE_DURATION_MS)
  }

  private scroll(from: TutorialPromptBanner, to: TutorialPromptBanner, prompt: string): void {
    this.clearTypingTimer()
    this.scrollTween?.stop()
    this.fadeTween?.stop()
    to.text.setText('')
    to.panel.setVisible(false)
    this.scrollTween = scrollTransition(this.scene, from.textContainer, to.textContainer, () => {
      this.scrollTween = undefined
      from.container.setVisible(false)
      from.textContainer.setY(0).setAlpha(1)
      to.textContainer.setY(0).setAlpha(1).setVisible(true)
      to.panel.setVisible(true)
      this.activeBanner = to
      this.typeText(to.text, prompt)
    })
  }

  private hideBanners(): void {
    for (const banner of this.banners) {
      banner.container.setVisible(false).setY(0).setAlpha(1)
      banner.textContainer.setY(0).setAlpha(1).setVisible(true)
      banner.panel.setVisible(true)
    }
  }
}

function getTutorial2Stage(
  state: WorldState,
  mode: InputMode | undefined,
  context: TutorialHudContext,
  historyStart: number,
  expectedCommand: string,
): TutorialStage {
  const commandWasSubmitted = state.commandHistory.length > historyStart &&
    state.commandHistory.at(-1)?.trim() === expectedCommand
  if (commandWasSubmitted) return 'complete'
  if (mode === 'command') {
    return context.commandDraft?.trim() === expectedCommand ? 'execute-command' : 'type-command'
  }
  return 'open-command'
}

function getTutorial2Command(hint: string): string {
  return hint.startsWith('type:') ? hint.slice('type:'.length).trim() : ''
}

function getTutorial3Stage(context: TutorialHudContext): TutorialStage {
  if (context.executedSlot !== undefined) return 'complete'
  return context.recordedSlot !== undefined ? 'execute-slot' : 'record-command'
}

function getTutorial2Prompt(
  stage: TutorialStage,
  commandHint: string,
  mode: CommandTypingMode,
  openedByShift: boolean,
): string {
  switch (stage) {
    case 'open-command':
      return getCommandEntryHint(mode)
    case 'type-command':
      return commandHint
    case 'execute-command':
      return getCommandExecutionHint(mode, openedByShift)
    default:
      return ''
  }
}

function getTutorial3Prompt(stage: TutorialStage, commandHint: string): string {
  return stage === 'execute-slot' ? TUTORIAL3_EXECUTE_PROMPT : commandHint
}

function getCommandEntryHint(mode: CommandTypingMode): string {
  switch (mode) {
    case 'hold-shift':
      return '<Hold SHIFT> open command'
    case 'hybrid':
      return '<Hold SHIFT / Press ENTER> open command'
    case 'enter-sticky':
      return '<Press ENTER> open command'
  }
}

function getCommandExecutionHint(mode: CommandTypingMode, openedByShift: boolean): string {
  if (mode === 'enter-sticky' || (mode === 'hybrid' && !openedByShift)) {
    return '<Press ENTER> execute command'
  }
  return '<Release SHIFT> execute command'
}
