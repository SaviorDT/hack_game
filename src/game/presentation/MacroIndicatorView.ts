import type Phaser from 'phaser'

const FONT_FAMILY = 'Consolas, monospace'
const FONT_SIZE = 16
const TEXT_COLOR_SUCCESS = '#d6e8e5'
const TEXT_COLOR_WARN = '#e08282'
const BG_COLOR = 0x101d26
const STROKE_COLOR_SUCCESS = 0x547e82
const STROKE_COLOR_WARN = 0x9e4b4b
const PADDING_H = 14
const PADDING_V = 8
const OFFSET_Y = 90
const VIEW_DEPTH = 21

const PROGRESS_BAR_WIDTH = 120
const PROGRESS_BAR_HEIGHT = 4
const PROGRESS_BAR_BG_COLOR = 0x1f333e
const PROGRESS_BAR_FILL_COLOR = 0x64ffda
const PILL_HOLD_HEIGHT = FONT_SIZE + PADDING_V * 2 + 10

export class MacroIndicatorView {
  private scene: Phaser.Scene | undefined
  private container: Phaser.GameObjects.Container | undefined
  private pillBg: Phaser.GameObjects.Rectangle | undefined
  private textObject: Phaser.GameObjects.Text | undefined
  private progressTrack: Phaser.GameObjects.Rectangle | undefined
  private progressFill: Phaser.GameObjects.Rectangle | undefined
  private progressTween: Phaser.Tweens.Tween | undefined
  private fadeTween: Phaser.Tweens.Tween | undefined
  private hideTimer: Phaser.Time.TimerEvent | undefined
  private holdShowTimer: Phaser.Time.TimerEvent | undefined
  private isHolding = false

  private playerX = 960
  private playerY = 540

  mount(scene: Phaser.Scene): void {
    this.destroy()
    this.scene = scene

    this.container = scene.add
      .container(this.playerX, this.playerY + OFFSET_Y)
      .setDepth(VIEW_DEPTH)
      .setVisible(false)

    this.pillBg = scene.add
      .rectangle(0, 0, 100, FONT_SIZE + PADDING_V * 2, BG_COLOR, 0.94)
      .setStrokeStyle(2, STROKE_COLOR_SUCCESS)
      .setOrigin(0.5, 0.5)

    this.textObject = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZE,
        color: TEXT_COLOR_SUCCESS,
      })
      .setOrigin(0.5, 0.5)

    this.progressTrack = scene.add
      .rectangle(0, 10, PROGRESS_BAR_WIDTH, PROGRESS_BAR_HEIGHT, PROGRESS_BAR_BG_COLOR)
      .setOrigin(0.5, 0.5)
      .setVisible(false)

    this.progressFill = scene.add
      .rectangle(-PROGRESS_BAR_WIDTH / 2, 10, PROGRESS_BAR_WIDTH, PROGRESS_BAR_HEIGHT, PROGRESS_BAR_FILL_COLOR)
      .setOrigin(0, 0.5)
      .setVisible(false)

    this.container.add([this.pillBg, this.textObject, this.progressTrack, this.progressFill])
  }

  setPlayerPosition(x: number, y: number): void {
    this.playerX = x
    this.playerY = y
    this.container?.setPosition(x, y + OFFSET_Y)
  }

  showRecordSuccess(slot: number, command: string): void {
    const truncated = command.length > 30 ? `${command.slice(0, 27)}...` : command
    this.show(`[SLOT ${slot} RECORDED: ${truncated}]`, true)
  }

  showRecordEmpty(): void {
    this.show('[NO COMMAND TO RECORD]', false)
  }

  showExecutedCommand(slot: number, command: string): void {
    const truncated = command.length > 30 ? `${command.slice(0, 27)}...` : command
    this.show(`[${slot}: ${truncated}]`, true)
  }

  showSlotEmpty(slot: number): void {
    this.show(`[SLOT ${slot} EMPTY (HOLD TO RECORD)]`, false)
  }

  startHoldProgress(slot: number, durationMs: number, showDelayMs: number = durationMs / 4): void {
    if (
      !this.container ||
      !this.pillBg ||
      !this.textObject ||
      !this.progressTrack ||
      !this.progressFill ||
      !this.scene
    ) {
      return
    }

    this.isHolding = true
    this.fadeTween?.stop()
    this.fadeTween = undefined
    this.hideTimer?.remove()
    this.hideTimer = undefined
    this.holdShowTimer?.remove()
    this.holdShowTimer = undefined
    this.progressTween?.stop()
    this.progressTween = undefined

    const message = `[RECORDING SLOT ${slot}]`
    this.textObject.setText(message).setColor(TEXT_COLOR_SUCCESS).setPosition(0, -6)

    const barWidth = Math.max(PROGRESS_BAR_WIDTH, this.textObject.width)
    this.progressTrack.setSize(barWidth, PROGRESS_BAR_HEIGHT).setPosition(0, 10).setVisible(true)
    this.progressFill
      .setSize(barWidth, PROGRESS_BAR_HEIGHT)
      .setPosition(-barWidth / 2, 10)
      .setScale(0, 1)
      .setVisible(true)

    const totalWidth = Math.max(140, barWidth + PADDING_H * 2)
    this.pillBg.setSize(totalWidth, PILL_HOLD_HEIGHT).setStrokeStyle(2, STROKE_COLOR_SUCCESS)

    if (showDelayMs > 0) {
      this.container.setVisible(false)
      this.holdShowTimer = this.scene.time.delayedCall(showDelayMs, () => {
        if (!this.isHolding || !this.container || !this.progressFill || !this.scene) return
        this.container.setAlpha(1).setVisible(true)
        this.progressFill.setScale(0, 1)
        const remainingDurationMs = Math.max(0, durationMs - showDelayMs)
        this.progressTween = this.scene.tweens.add({
          targets: this.progressFill,
          scaleX: 1,
          duration: remainingDurationMs,
          ease: 'Linear',
        })
      })
    } else {
      this.container.setAlpha(1).setVisible(true)
      this.progressTween = this.scene.tweens.add({
        targets: this.progressFill,
        scaleX: 1,
        duration: durationMs,
        ease: 'Linear',
      })
    }
  }

  setHoldProgress(progress: number): void {
    if (!this.progressFill) return
    const clamped = Math.max(0, Math.min(1, progress))
    this.progressFill.setScale(clamped, 1)
  }

  cancelHoldProgress(): void {
    if (!this.isHolding) return
    this.isHolding = false
    this.holdShowTimer?.remove()
    this.holdShowTimer = undefined
    this.progressTween?.stop()
    this.progressTween = undefined
    this.progressTrack?.setVisible(false)
    this.progressFill?.setVisible(false)
    this.textObject?.setPosition(0, 0)
    this.container?.setVisible(false)
  }

  private show(message: string, isSuccess: boolean): void {
    if (!this.container || !this.pillBg || !this.textObject || !this.scene) {
      return
    }

    this.isHolding = false
    this.holdShowTimer?.remove()
    this.holdShowTimer = undefined
    this.progressTween?.stop()
    this.progressTween = undefined
    this.progressTrack?.setVisible(false)
    this.progressFill?.setVisible(false)
    this.textObject.setPosition(0, 0)

    this.fadeTween?.stop()
    this.fadeTween = undefined
    this.hideTimer?.remove()
    this.hideTimer = undefined

    const textColor = isSuccess ? TEXT_COLOR_SUCCESS : TEXT_COLOR_WARN
    const strokeColor = isSuccess ? STROKE_COLOR_SUCCESS : STROKE_COLOR_WARN

    this.textObject.setText(message).setColor(textColor)
    const totalWidth = Math.max(120, this.textObject.width + PADDING_H * 2)
    const totalHeight = FONT_SIZE + PADDING_V * 2

    this.pillBg.setSize(totalWidth, totalHeight).setStrokeStyle(2, strokeColor)
    this.container.setAlpha(1).setVisible(true)

    this.hideTimer = this.scene.time.delayedCall(1200, () => {
      if (!this.scene || !this.container) return
      this.fadeTween = this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 250,
        ease: 'Linear',
        onComplete: () => {
          this.container?.setVisible(false)
        },
      })
    })
  }

  destroy(): void {
    this.isHolding = false
    this.holdShowTimer?.remove()
    this.holdShowTimer = undefined
    this.progressTween?.stop()
    this.progressTween = undefined
    this.fadeTween?.stop()
    this.fadeTween = undefined
    this.hideTimer?.remove()
    this.hideTimer = undefined

    this.container?.destroy(true)
    this.container = undefined
    this.pillBg = undefined
    this.textObject = undefined
    this.progressTrack = undefined
    this.progressFill = undefined
    this.scene = undefined
  }
}
