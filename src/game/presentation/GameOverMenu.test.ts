import { describe, expect, it } from 'vitest'
import { GameOverMenu } from './GameOverMenu.ts'

describe('GameOverMenu', () => {
  it('starts on reset and wraps with left/right', () => {
    const menu = new GameOverMenu(['reset', 'title'])
    expect(menu.selected).toBe('reset')
    menu.move(1)
    expect(menu.selected).toBe('title')
    menu.move(1)
    expect(menu.selected).toBe('reset')
    menu.move(-1)
    expect(menu.selected).toBe('title')
  })

  it('skips and refuses disabled choices', () => {
    const menu = new GameOverMenu(['reset'])
    menu.move(1)
    expect(menu.selected).toBe('reset')
    menu.select('title')
    expect(menu.confirm()).toBe('reset')
    expect(menu.isEnabled('title')).toBe(false)
  })
})
