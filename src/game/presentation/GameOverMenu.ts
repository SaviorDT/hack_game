export type GameOverChoice = 'reset' | 'title'

export const GAME_OVER_CHOICES: readonly GameOverChoice[] = ['reset', 'title']

// Selection state for the Game Over options. Disabled choices are skipped by keyboard
// navigation and cannot be confirmed.
export class GameOverMenu {
  private selectedIndex = 0
  private readonly enabled: ReadonlySet<GameOverChoice>

  constructor(enabledChoices: readonly GameOverChoice[]) {
    this.enabled = new Set(enabledChoices)
  }

  get selected(): GameOverChoice {
    return GAME_OVER_CHOICES[this.selectedIndex]
  }

  isEnabled(choice: GameOverChoice): boolean {
    return this.enabled.has(choice)
  }

  move(direction: -1 | 1): void {
    const count = GAME_OVER_CHOICES.length
    for (let step = 1; step <= count; step += 1) {
      const index = (this.selectedIndex + direction * step + count * step) % count
      if (this.isEnabled(GAME_OVER_CHOICES[index])) {
        this.selectedIndex = index
        return
      }
    }
  }

  // Mouse hover; ignored for disabled choices.
  select(choice: GameOverChoice): void {
    if (this.isEnabled(choice)) {
      this.selectedIndex = GAME_OVER_CHOICES.indexOf(choice)
    }
  }

  confirm(): GameOverChoice {
    return this.selected
  }
}
