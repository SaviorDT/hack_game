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

export class MacroIndicatorView {
  private scene: Phaser.Scene | undefined
  private container: Phaser.GameObjects.Container | undefined
  private pillBg: Phaser.GameObjects.Rectangle | undefined
  private textObject: Phaser.GameObjects.Text | undefined
  private fadeTween: Phaser.Tweens.Tween | undefined
  private hideTimer: Phaser.Time.TimerEvent | undefined

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

    this.container.add([this.pillBg, this.textObject])
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

  private show(message: string, isSuccess: boolean): void {
    if (!this.container || !this.pillBg || !this.textObject || !this.scene) {
      return
    }

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
    this.fadeTween?.stop()
    this.fadeTween = undefined
    this.hideTimer?.remove()
    this.hideTimer = undefined

    this.container?.destroy(true)
    this.container = undefined
    this.pillBg = undefined
    this.textObject = undefined
    this.scene = undefined
  }
}
