import type Phaser from 'phaser'
import {
  DEFAULT_GLITCH_SHAKE_BLOCK_SIZE,
  DEFAULT_GLITCH_SHAKE_COLOR_RATE,
  DEFAULT_GLITCH_SHAKE_POWER,
  DEFAULT_GLITCH_SHAKE_RATE,
  DEFAULT_GLITCH_SHAKE_SPEED,
} from './glitchShaderConstants.ts'

export const GLITCH_FILTER_NAME = 'FilterGlitch'

export const GLITCH_FRAGMENT_SHADER = [
  '#pragma phaserTemplate(shaderName)',
  'precision mediump float;',
  'uniform sampler2D uMainSampler;',
  'uniform float time;',
  'uniform float shake_power;',
  'uniform float shake_rate;',
  'uniform float shake_speed;',
  'uniform float shake_block_size;',
  'uniform float shake_color_rate;',
  'varying vec2 outTexCoord;',
  'float random(float seed) {',
  '    return fract(543.2543 * sin(dot(vec2(seed, seed), vec2(3525.46, -54.3415))));',
  '}',
  'void main() {',
  '    float enable_shift = float(random(floor(time * shake_speed)) < shake_rate);',
  '    vec2 fixed_uv = outTexCoord;',
  '    fixed_uv.x += (random((floor(outTexCoord.y * shake_block_size) / shake_block_size) + time) - 0.5) * shake_power * enable_shift;',
  '    vec4 pixel_color = texture2D(uMainSampler, fixed_uv);',
  '    pixel_color.r = mix(pixel_color.r, texture2D(uMainSampler, fixed_uv + vec2(shake_color_rate, 0.0)).r, enable_shift);',
  '    pixel_color.b = mix(pixel_color.b, texture2D(uMainSampler, fixed_uv + vec2(-shake_color_rate, 0.0)).b, enable_shift);',
  '    gl_FragColor = pixel_color;',
  '}',
].join('\n')

export class GlitchFilterController {
  active = false
  camera: Phaser.Cameras.Scene2D.Camera
  readonly renderNode = GLITCH_FILTER_NAME
  time = 0
  shakePower = DEFAULT_GLITCH_SHAKE_POWER
  shakeRate = DEFAULT_GLITCH_SHAKE_RATE
  shakeSpeed = DEFAULT_GLITCH_SHAKE_SPEED
  shakeBlockSize = DEFAULT_GLITCH_SHAKE_BLOCK_SIZE
  shakeColorRate = DEFAULT_GLITCH_SHAKE_COLOR_RATE
  ignoreDestroy = false

  constructor(camera: Phaser.Cameras.Scene2D.Camera) {
    this.camera = camera
  }

  getPaddingCeil(): { x: number; y: number; width: number; height: number; left: number; right: number; top: number; bottom: number } {
    return { x: 0, y: 0, width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 }
  }

  destroy(): void {
    this.camera = null as unknown as Phaser.Cameras.Scene2D.Camera
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGlitchRenderNodeClass(BaseFilterShaderClass: any): any {
  return class GlitchFilterRenderNode extends BaseFilterShaderClass {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(manager: any) {
      super(GLITCH_FILTER_NAME, manager, null, GLITCH_FRAGMENT_SHADER)
    }

    setupUniforms(controller: GlitchFilterController): void {
      const pm = (this as { programManager?: { setUniform: (name: string, val: unknown) => void } }).programManager
      if (!pm) return
      pm.setUniform('time', controller.time)
      pm.setUniform('shake_power', controller.shakePower)
      pm.setUniform('shake_rate', controller.shakeRate)
      pm.setUniform('shake_speed', controller.shakeSpeed)
      pm.setUniform('shake_block_size', controller.shakeBlockSize)
      pm.setUniform('shake_color_rate', controller.shakeColorRate)
    }
  }
}

export const GlitchFilterRenderNode = createGlitchRenderNodeClass(class {})

export function registerGlitchFilter(renderer: unknown): void {
  const r = renderer as { renderNodes?: { _nodeConstructors?: Record<string, unknown>; addNodeConstructor?: (name: string, ctor: unknown) => void } }
  if (!r?.renderNodes?.addNodeConstructor) return
  if (!r.renderNodes._nodeConstructors?.[GLITCH_FILTER_NAME]) {
    const BaseClass = r.renderNodes._nodeConstructors?.BaseFilterShader ?? class {}
    const nodeCtor = createGlitchRenderNodeClass(BaseClass)
    r.renderNodes.addNodeConstructor(GLITCH_FILTER_NAME, nodeCtor)
  }
}
