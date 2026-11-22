import type Phaser from 'phaser'
import { POPUP_FADE_DURATION_MS } from './uiTheme.ts'

export const SCROLL_SPEED_MS = 27

export function scrollTransition(
  scene: Phaser.Scene,
  fromContainer: Phaser.GameObjects.Container,
  toContainer: Phaser.GameObjects.Container,
  onComplete: () => void,
): Phaser.Tweens.Tween | undefined {
  toContainer.setY(850).setVisible(true)
  if (scene.tweens?.add) {
    return scene.tweens.add({
      targets: [fromContainer, toContainer],
      y: '-=850',
      duration: SCROLL_SPEED_MS,
      ease: 'Linear',
      onComplete,
    })
  } else {
    toContainer.setY(0)
    fromContainer.setY(-850)
    onComplete()
    return undefined
  }
}

export function fadeOut(
  scene: Phaser.Scene,
  targets: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[],
  onComplete: () => void,
  durationMs = POPUP_FADE_DURATION_MS,
): Phaser.Tweens.Tween | undefined {
  if (!scene.tweens?.add) {
    onComplete()
    return undefined
  }

  return scene.tweens.add({
    targets,
    alpha: 0,
    duration: durationMs,
    ease: 'Linear',
    onComplete,
  })
}
