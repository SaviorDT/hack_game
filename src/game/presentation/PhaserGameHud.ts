import type Phaser from 'phaser'
import type { WorldState } from '../domain/WorldState.ts'
import type { InputMode } from '../application/InputModeController.ts'
import {
  COLOR_DIM,
  COLOR_PROMPT,
  PANEL_BG,
  PANEL_BG_ALPHA,
  PANEL_BORDER,
  PANEL_BORDER_WIDTH,
  POPUP_FADE_DURATION_MS,
  TERMINAL_FONT,
  TYPING_SPEED_MS,
} from './uiTheme.ts'
import { fadeOut, scrollTransition } from './uiTransitions.ts'

const BANNER_LEFT = 120
const BANNER_TOP = 96
const BANNER_WIDTH = 1680
const BANNER_HEIGHT = 92
const BANNER_PADDING_X = 30
const HINT_TEXT_X = BANNER_LEFT + BANNER_PADDING_X
const TUTORIAL_MOVE_PROMPT = '<W A S D> Move'
const TUTORIAL_ATTACK_PROMPT = '<J> Attack'

type TutorialPromptStage = 'move' | 'attack' | 'complete' | null

interface HintBanner {
  container: Phaser.GameObjects.Container
  textContainer: Phaser.GameObjects.Container
  panel: Phaser.GameObjects.Rectangle
  text: Phaser.GameObjects.Text
}

function createHintBanner(scene: Phaser.Scene, initialText: string): HintBanner {
  const panel = scene.add.rectangle(960, BANNER_TOP, BANNER_WIDTH, BANNER_HEIGHT, PANEL_BG, PANEL_BG_ALPHA)
    .setOrigin(0.5, 0).setStrokeStyle(PANEL_BORDER_WIDTH, PANEL_BORDER)
  const text = scene.add.text(HINT_TEXT_X, BANNER_TOP + BANNER_HEIGHT / 2, initialText, {
    fontFamily: TERMINAL_FONT,
    fontSize: '15px',
    color: COLOR_PROMPT,
  }).setOrigin(0, 0.5).setAlign('left').setWordWrapWidth(BANNER_WIDTH - BANNER_PADDING_X * 2).setLineSpacing(10)
  const container = scene.add.container(0, 0).setVisible(false)
  const textContainer = scene.add.container(0, 0)
  textContainer.add(text)
  container.add([panel, textContainer])
  return { container, textContainer, panel, text }
}

/** Main-game chrome. World coordinates and editor layouts remain independent. */
export class PhaserGameHud {
  private readonly scene: Phaser.Scene
  private readonly root: Phaser.GameObjects.Container
  private readonly roomText: Phaser.GameObjects.Text
  private readonly hintBanner: HintBanner
  private readonly movePromptBanner: HintBanner
  private readonly attackPromptBanner: HintBanner
  private readonly popupMaskGraphics: Phaser.GameObjects.Graphics
  private readonly popupGeometryMask: Phaser.Display.Masks.GeometryMask
  private shownHintRoomId: string | null | undefined
  private tutorialPromptStage: TutorialPromptStage | undefined
  private typingTimer?: Phaser.Time.TimerEvent
  private scrollTween?: Phaser.Tweens.Tween
  private fadeTween?: Phaser.Tweens.Tween

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setDepth(8)
    const label = (x: number, y: number, text: string, size = 15, color = COLOR_PROMPT) =>
      scene.add.text(x, y, text, { fontFamily: TERMINAL_FONT, fontSize: `${size}px`, color })

    this.roomText = label(96, 38, '', 16, COLOR_PROMPT)
    const navigation = label(1824, 38, 'F1 Command   F2 Layout   F3 Speed   F4 AI', 13, COLOR_DIM).setOrigin(1, 0)
    this.hintBanner = createHintBanner(scene, '')
    this.movePromptBanner = createHintBanner(scene, TUTORIAL_MOVE_PROMPT)
    this.attackPromptBanner = createHintBanner(scene, TUTORIAL_ATTACK_PROMPT)
    this.popupMaskGraphics = scene.make.graphics({})
      .fillStyle(0xffffff, 1)
      .fillRect(BANNER_LEFT, BANNER_TOP, BANNER_WIDTH, BANNER_HEIGHT)
    this.popupGeometryMask = this.popupMaskGraphics.createGeometryMask()
    this.applyPopupMask(this.movePromptBanner.container)
    this.applyPopupMask(this.attackPromptBanner.container)

    this.root.add([
      this.roomText,
      navigation,
      this.hintBanner.container,
      this.movePromptBanner.container,
      this.attackPromptBanner.container,
    ])
  }

  private applyPopupMask(container: Phaser.GameObjects.Container): void {
    container.enableFilters()
    const filters = container.filters
    if (filters) {
      const mask = filters.external.addMask(this.popupMaskGraphics, false, this.scene.cameras.main)
      mask.autoUpdate = false
    } else {
      container.setMask(this.popupGeometryMask)
    }
  }

  update(state: WorldState, _mode?: InputMode): void {
    this.roomText.setText(`ROOM  /  ${state.currentRoomId ?? 'unknown'}`)

    const room = state.rooms.find((candidate) => candidate.id === state.currentRoomId)
    if (room?.id === 'tutorial1') {
      this.updateTutorialPrompt(state)
      return
    }

    this.resetTutorialPrompt()
    this.updateRoomHint(room)
  }

  private updateRoomHint(room: WorldState['rooms'][number] | undefined): void {
    if (room?.id === this.shownHintRoomId) return
    this.shownHintRoomId = room?.id
    this.clearTypingTimer()

    if (room?.hint) {
      this.hintBanner.text.setText(room.hint)
      const bannerHeight = Math.max(92, this.hintBanner.text.height + 30)
      this.hintBanner.panel.setSize(BANNER_WIDTH, bannerHeight)
      this.hintBanner.text.setPosition(HINT_TEXT_X, BANNER_TOP + bannerHeight / 2)
      this.hintBanner.container.setVisible(true)
      this.hintBanner.panel.setVisible(true)
      this.hintBanner.text.setVisible(true)

      this.typeText(this.hintBanner.text, room.hint)
    } else {
      this.hintBanner.text.setText('')
      this.hintBanner.container.setVisible(false)
      this.hintBanner.panel.setVisible(false)
      this.hintBanner.text.setVisible(false)
    }
  }

  private updateTutorialPrompt(state: WorldState): void {
    if (this.shownHintRoomId !== 'tutorial1') {
      this.clearTypingTimer()
      this.shownHintRoomId = 'tutorial1'
      this.hintBanner.container.setVisible(false)
      this.hintBanner.panel.setVisible(false)
      this.hintBanner.text.setVisible(false)
    }

    const nextStage = this.getTutorialPromptStage(state)
    if (nextStage === this.tutorialPromptStage) return

    const previousStage = this.tutorialPromptStage
    this.tutorialPromptStage = nextStage

    if (previousStage === undefined) {
      this.showTutorialPrompt(nextStage)
    } else if (previousStage === 'move' && nextStage === 'attack') {
      this.scrollTween?.stop()
      this.clearTypingTimer()
      this.attackPromptBanner.text.setText('')
      this.attackPromptBanner.container.setVisible(true)
      this.attackPromptBanner.panel.setVisible(false)
      this.scrollTween = scrollTransition(
        this.scene,
        this.movePromptBanner.textContainer,
        this.attackPromptBanner.textContainer,
        () => {
          this.scrollTween = undefined
          this.movePromptBanner.container.setVisible(false)
          this.movePromptBanner.textContainer.setY(0).setAlpha(1)
          this.attackPromptBanner.textContainer.setY(0).setAlpha(1).setVisible(true)
          this.attackPromptBanner.panel.setVisible(true)
          this.typeText(this.attackPromptBanner.text, TUTORIAL_ATTACK_PROMPT)
        },
      )
    } else if (nextStage === 'complete' && previousStage === 'attack') {
      this.dismissAttackPrompt()
    } else {
      this.showTutorialPrompt(nextStage)
    }
  }

  private getTutorialPromptStage(state: WorldState): TutorialPromptStage {
    const player = state.worldObjects.find(
      (object) => object.id === 'player' || object.metadata.role === 'player',
    )
    const dagger = state.worldObjects.find((object) => object.id === 'tutorial1dagger')
    const dummy = state.worldObjects.find((object) => object.id === 'dummy')
    if (!player || !dagger || !dummy) return null

    const daggerState = dagger.state as Record<string, unknown>
    const dummyState = dummy.state as Record<string, unknown>
    if (dummyState.alive === false) return 'complete'
    return daggerState.equippedBy === player.id ? 'attack' : 'move'
  }

  private showTutorialPrompt(stage: TutorialPromptStage): void {
    this.hideTutorialBanners()
    if (stage === 'move') {
      this.movePromptBanner.container.setVisible(true)
      this.typeText(this.movePromptBanner.text, TUTORIAL_MOVE_PROMPT)
    } else if (stage === 'attack') {
      this.attackPromptBanner.container.setVisible(true)
      this.typeText(this.attackPromptBanner.text, TUTORIAL_ATTACK_PROMPT)
    }
  }

  private dismissAttackPrompt(): void {
    this.clearTypingTimer()
    this.scrollTween?.stop()
    this.scrollTween = undefined
    this.fadeTween?.stop()
    this.fadeTween = fadeOut(this.scene, this.attackPromptBanner.container, () => {
      this.fadeTween = undefined
      this.attackPromptBanner.container.setVisible(false).setY(0).setAlpha(1)
    }, POPUP_FADE_DURATION_MS)
  }

  private hideTutorialBanners(): void {
    this.movePromptBanner.container.setVisible(false).setY(0).setAlpha(1)
    this.attackPromptBanner.container.setVisible(false).setY(0).setAlpha(1)
    this.movePromptBanner.textContainer.setY(0).setAlpha(1).setVisible(true)
    this.attackPromptBanner.textContainer.setY(0).setAlpha(1).setVisible(true)
    this.movePromptBanner.panel.setVisible(true)
    this.attackPromptBanner.panel.setVisible(true)
  }

  private resetTutorialPrompt(): void {
    if (this.tutorialPromptStage === undefined && !this.scrollTween && !this.fadeTween && !this.typingTimer) return
    this.clearTypingTimer()
    this.scrollTween?.stop()
    this.scrollTween = undefined
    this.fadeTween?.stop()
    this.fadeTween = undefined
    this.tutorialPromptStage = undefined
    this.hideTutorialBanners()
  }

  destroy(): void {
    this.clearTypingTimer()
    this.scrollTween?.stop()
    this.scrollTween = undefined
    this.fadeTween?.stop()
    this.fadeTween = undefined
    this.root.destroy(true)
    this.popupGeometryMask.destroy()
    this.popupMaskGraphics.destroy()
  }

  private typeText(text: Phaser.GameObjects.Text, value: string): void {
    this.clearTypingTimer()
    text.setText('')
    if (!value) return
    if (!this.scene.time?.addEvent) {
      text.setText(value)
      return
    }

    let charIndex = 0
    this.typingTimer = this.scene.time.addEvent({
      delay: TYPING_SPEED_MS,
      repeat: value.length - 1,
      callback: () => {
        charIndex++
        text.setText(value.slice(0, charIndex))
        if (charIndex === value.length) this.typingTimer = undefined
      },
    })
  }

  private clearTypingTimer(): void {
    this.typingTimer?.remove()
    this.typingTimer = undefined
  }
}
