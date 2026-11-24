import type Phaser from 'phaser'
import type { InputMode } from '../application/InputModeController.ts'
import {
  DEFAULT_GLITCH_SHAKE_POWER,
  GLITCH_FADE_IN_MS,
  GLITCH_FADE_OUT_MS,
} from './glitchShaderConstants.ts'
import {
  GlitchFilterController,
  registerGlitchFilter,
} from './GlitchFilterRenderNode.ts'

export class TimeDilationGlitchView {
  private scene?: Phaser.Scene
  private filter?: GlitchFilterController
  private currentMode: InputMode = 'movement'
  private fadeTween?: Phaser.Tweens.Tween
  private timeAccumulator = 0

  mount(scene: Phaser.Scene): void {
    this.destroy()
    this.scene = scene
    this.currentMode = 'movement'
    this.timeAccumulator = 0

    const renderer = (scene as unknown as { renderer?: unknown }).renderer
    const camera = scene.cameras?.main
    const filterList = (camera as unknown as { filters?: { internal?: { add: (filter: unknown) => void } } })
      ?.filters?.internal

    if (!renderer || !filterList) {
      return
    }

    registerGlitchFilter(renderer)
    const filter = new GlitchFilterController(camera)
    this.filter = filter
    filterList.add(filter)
  }

  setMode(mode: InputMode): void {
    if (this.currentMode === mode) return
    this.currentMode = mode

    if (mode === 'command') {
      this.activate()
    } else {
      this.deactivate()
    }
  }

  update(delta: number): void {
    if (!this.filter || !this.filter.active) return
    this.timeAccumulator += delta * 0.001
    this.filter.time = this.timeAccumulator
  }

  private activate(): void {
    if (!this.filter) return
    this.filter.active = true
    this.filter.shakePower = 0
    this.fadeTween?.stop()

    if (this.scene?.tweens?.add) {
      this.fadeTween = this.scene.tweens.add({
        targets: this.filter,
        shakePower: DEFAULT_GLITCH_SHAKE_POWER,
        duration: GLITCH_FADE_IN_MS,
        ease: 'Linear',
      })
    } else {
      this.filter.shakePower = DEFAULT_GLITCH_SHAKE_POWER
    }
  }

  private deactivate(): void {
    if (!this.filter) return
    this.fadeTween?.stop()

    if (this.scene?.tweens?.add) {
      this.fadeTween = this.scene.tweens.add({
        targets: this.filter,
        shakePower: 0,
        duration: GLITCH_FADE_OUT_MS,
        ease: 'Linear',
        onComplete: () => {
          if (this.filter && this.currentMode === 'movement') {
            this.filter.active = false
          }
        },
      })
    } else {
      this.filter.shakePower = 0
      this.filter.active = false
    }
  }

  getFilter(): GlitchFilterController | undefined {
    return this.filter
  }

  isActive(): boolean {
    return this.filter?.active ?? false
  }

  getShakePower(): number {
    return this.filter?.shakePower ?? 0
  }

  destroy(): void {
    this.fadeTween?.stop()
    this.fadeTween = undefined

    if (this.filter && this.scene?.cameras?.main) {
      const filterList = (this.scene.cameras.main as unknown as {
        filters?: { internal?: { remove: (filter: unknown) => void } }
      })?.filters?.internal
      filterList?.remove(this.filter)
    }

    this.filter = undefined
    this.scene = undefined
    this.currentMode = 'movement'
    this.timeAccumulator = 0
  }
}
