import { describe, expect, it, vi } from 'vitest'
import {
  GLITCH_FILTER_NAME,
  GLITCH_FRAGMENT_SHADER,
  GlitchFilterController,
  GlitchFilterRenderNode,
  registerGlitchFilter,
} from './GlitchFilterRenderNode.ts'

describe('GlitchFilterRenderNode & Controller', () => {
  it('contains required GLSL variables in the fragment shader', () => {
    expect(GLITCH_FILTER_NAME).toBe('FilterGlitch')
    expect(GLITCH_FRAGMENT_SHADER).toContain('#pragma phaserTemplate(shaderName)')
    expect(GLITCH_FRAGMENT_SHADER).toContain('uniform float shake_power;')
    expect(GLITCH_FRAGMENT_SHADER).toContain('uniform float shake_color_rate;')
    expect(GLITCH_FRAGMENT_SHADER).toContain('uniform sampler2D uMainSampler;')
    expect(GLITCH_FRAGMENT_SHADER).toContain('varying vec2 outTexCoord;')
    expect(GLITCH_FRAGMENT_SHADER).toContain('gl_FragColor = pixel_color;')
  })

  it('initializes GlitchFilterController with inactive state and positive tuning values', () => {
    const mockCamera = {} as unknown as Phaser.Cameras.Scene2D.Camera
    const controller = new GlitchFilterController(mockCamera)

    expect(controller.active).toBe(false)
    expect(controller.time).toBe(0)
    expect(controller.shakeRate).toBeGreaterThan(0)
    expect(controller.shakeSpeed).toBeGreaterThan(0)
    expect(controller.shakeBlockSize).toBeGreaterThan(0)
  })

  it('sets uniforms through programManager during setupUniforms', () => {
    const mockManager = {}
    const node = new GlitchFilterRenderNode(mockManager)
    const setUniformMock = vi.fn()
      ; (node as unknown as { programManager: { setUniform: typeof setUniformMock } }).programManager = {
        setUniform: setUniformMock,
      }

    const mockCamera = {} as unknown as Phaser.Cameras.Scene2D.Camera
    const controller = new GlitchFilterController(mockCamera)
    controller.time = 1.25

    node.setupUniforms(controller)

    expect(setUniformMock).toHaveBeenCalledWith('time', 1.25)
    expect(setUniformMock).toHaveBeenCalledWith('shake_power', controller.shakePower)
    expect(setUniformMock).toHaveBeenCalledWith('shake_rate', controller.shakeRate)
    expect(setUniformMock).toHaveBeenCalledWith('shake_speed', controller.shakeSpeed)
    expect(setUniformMock).toHaveBeenCalledWith('shake_block_size', controller.shakeBlockSize)
    expect(setUniformMock).toHaveBeenCalledWith('shake_color_rate', controller.shakeColorRate)
  })

  it('registers FilterGlitch constructor with renderer.renderNodes', () => {
    const addNodeConstructorMock = vi.fn()
    const mockRenderer = {
      renderNodes: {
        _nodeConstructors: {} as Record<string, unknown>,
        addNodeConstructor: addNodeConstructorMock,
      },
    }

    registerGlitchFilter(mockRenderer)
    expect(addNodeConstructorMock).toHaveBeenCalledWith(GLITCH_FILTER_NAME, expect.any(Function))

    // Does not re-register if already present
    mockRenderer.renderNodes._nodeConstructors[GLITCH_FILTER_NAME] = GlitchFilterRenderNode
    addNodeConstructorMock.mockClear()
    registerGlitchFilter(mockRenderer)
    expect(addNodeConstructorMock).not.toHaveBeenCalled()
  })

  it('safely handles missing or non-WebGL renderer in registerGlitchFilter', () => {
    expect(() => registerGlitchFilter(null)).not.toThrow()
    expect(() => registerGlitchFilter({})).not.toThrow()
  })
})
