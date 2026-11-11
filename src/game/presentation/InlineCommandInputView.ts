import type Phaser from 'phaser'

export type CommandCompletionProvider = (
  rawText: string,
  cursorIndex: number,
) => readonly string[]

export type CommandHistoryProvider = () => readonly string[]

const FONT_FAMILY = 'Consolas, monospace'
const FONT_SIZE = 22
const TEXT_COLOR = '#d6e8e5'
const CURSOR_COLOR = 0xd6d6d6
const FIELD_COLOR = '#101010'
const CURSOR_BLINK_MS = 500
const PADDING_H = 12
const PADDING_V = 6
const PILL_MIN_WIDTH = 120
const PROMPT = '$ '
const OFFSET_Y = 90
const VIEW_DEPTH = 20

export class InlineCommandInputView {
  private scene: Phaser.Scene | undefined
  private onSubmit: ((rawText: string) => void) | undefined
  private completionProvider: CommandCompletionProvider | undefined
  private historyProvider: CommandHistoryProvider | undefined
  private keyGate: ((event: KeyboardEvent) => boolean) | undefined

  private container: Phaser.GameObjects.Container | undefined
  private pillBg: Phaser.GameObjects.Rectangle | undefined
  private textObject: Phaser.GameObjects.Text | undefined
  private cursorBlock: Phaser.GameObjects.Rectangle | undefined
  private cursorGlyph: Phaser.GameObjects.Text | undefined
  private cursorBlinkEvent: Phaser.Time.TimerEvent | undefined

  private value = ''
  private cursorIndex = 0
  private historyIndex: number | undefined
  private historyDraft = ''
  private cursorVisible = true
  private visible = false
  private playerX = 960
  private playerY = 540
  private charWidth = 13

  mount(
    scene: Phaser.Scene,
    onSubmit: (rawText: string) => void,
    completionProvider?: CommandCompletionProvider,
    historyProvider?: CommandHistoryProvider,
  ): void {
    this.destroy()
    this.scene = scene
    this.onSubmit = onSubmit
    this.completionProvider = completionProvider
    this.historyProvider = historyProvider

    this.charWidth = this.measureCharacterWidth()

    this.container = scene.add.container(this.playerX, this.playerY + OFFSET_Y).setDepth(VIEW_DEPTH).setVisible(false)

    this.pillBg = scene.add
      .rectangle(0, 0, PILL_MIN_WIDTH, FONT_SIZE + PADDING_V * 2, 0x101d26, 0.92)
      .setStrokeStyle(2, 0x547e82)
      .setOrigin(0.5, 0.5)

    this.textObject = scene.add
      .text(0, 0, PROMPT, {
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZE,
        color: TEXT_COLOR,
      })
      .setOrigin(0, 0.5)

    this.cursorBlock = scene.add
      .rectangle(0, 0, this.charWidth, FONT_SIZE, CURSOR_COLOR)
      .setOrigin(0, 0.5)

    this.cursorGlyph = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZE,
        color: FIELD_COLOR,
      })
      .setOrigin(0, 0.5)

    this.container.add([this.pillBg, this.textObject, this.cursorBlock, this.cursorGlyph])

    const keyboard = scene.input.keyboard
    if (keyboard) {
      keyboard.on('keydown', this.handleKeyboardEvent)
    }

    this.cursorBlinkEvent = scene.time.addEvent({
      delay: CURSOR_BLINK_MS,
      loop: true,
      callback: () => {
        this.cursorVisible = !this.cursorVisible
        this.updateCursorVisibility()
      },
    })

    this.render()
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) {
      return
    }
    this.visible = visible
    this.container?.setVisible(visible)
    if (!visible) {
      this.clearInput()
    } else {
      this.cursorVisible = true
      this.render()
    }
  }

  clearInput(): void {
    this.value = ''
    this.cursorIndex = 0
    this.historyIndex = undefined
    this.historyDraft = ''
    this.cursorVisible = true
    this.render()
  }

  getValue(): string {
    return this.value
  }

  setPlayerPosition(x: number, y: number): void {
    this.playerX = x
    this.playerY = y
    this.container?.setPosition(x, y + OFFSET_Y)
  }

  setKeyGate(gate: (event: KeyboardEvent) => boolean): void {
    this.keyGate = gate
  }

  destroy(): void {
    this.scene?.input.keyboard?.off('keydown', this.handleKeyboardEvent)
    this.cursorBlinkEvent?.remove()
    this.cursorBlinkEvent = undefined

    this.container?.destroy(true)
    this.container = undefined
    this.pillBg = undefined
    this.textObject = undefined
    this.cursorBlock = undefined
    this.cursorGlyph = undefined

    this.scene = undefined
    this.onSubmit = undefined
    this.completionProvider = undefined
    this.historyProvider = undefined
    this.keyGate = undefined
    this.value = ''
    this.cursorIndex = 0
    this.historyIndex = undefined
    this.historyDraft = ''
    this.visible = false
  }

  private readonly handleKeyboardEvent = (event: KeyboardEvent): void => {
    if (this.keyGate && !this.keyGate(event)) {
      return
    }

    if (!this.visible) {
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      this.submit()
      return
    }

    // Escape does NOT close the command utility (closed only via Shift release)
    if (event.key === 'Escape') {
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      this.completeCurrentToken()
      return
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      this.navigateHistory(event.key === 'ArrowUp' ? -1 : 1)
      return
    }

    const characters = Array.from(this.value)

    if (event.key === 'Backspace') {
      event.preventDefault()
      if (this.cursorIndex > 0) {
        this.resetHistoryNavigation()
        if (event.ctrlKey || event.metaKey) {
          let deleteStart = this.cursorIndex
          while (deleteStart > 0 && /\s/.test(characters[deleteStart - 1])) {
            deleteStart -= 1
          }
          while (deleteStart > 0 && !/\s/.test(characters[deleteStart - 1])) {
            deleteStart -= 1
          }
          characters.splice(deleteStart, this.cursorIndex - deleteStart)
          this.cursorIndex = deleteStart
        } else {
          characters.splice(this.cursorIndex - 1, 1)
          this.cursorIndex -= 1
        }
        this.value = characters.join('')
        this.cursorVisible = true
        this.render()
      }
      return
    }

    if (event.key === 'Delete') {
      event.preventDefault()
      if (this.cursorIndex < characters.length) {
        this.resetHistoryNavigation()
        characters.splice(this.cursorIndex, 1)
        this.value = characters.join('')
        this.cursorVisible = true
        this.render()
      }
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      this.cursorIndex = Math.max(0, this.cursorIndex - 1)
      this.cursorVisible = true
      this.render()
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      this.cursorIndex = Math.min(characters.length, this.cursorIndex + 1)
      this.cursorVisible = true
      this.render()
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      this.cursorIndex = 0
      this.cursorVisible = true
      this.render()
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      this.cursorIndex = characters.length
      this.cursorVisible = true
      this.render()
      return
    }

    if (
      event.key.length === 1 &&
      /^[\x20-\x7e]$/.test(event.key) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault()
      this.resetHistoryNavigation()
      characters.splice(this.cursorIndex, 0, event.key)
      this.cursorIndex += 1
      this.value = characters.join('')
      this.cursorVisible = true
      this.render()
    }
  }

  submit(): void {
    const textToSubmit = this.value
    this.value = ''
    this.cursorIndex = 0
    this.historyIndex = undefined
    this.historyDraft = ''
    this.render()
    this.onSubmit?.(textToSubmit)
  }

  private navigateHistory(direction: -1 | 1): void {
    const history = this.historyProvider?.() ?? []
    if (history.length === 0) {
      return
    }

    if (this.historyIndex === undefined) {
      if (direction > 0) {
        return
      }
      this.historyDraft = this.value
      this.historyIndex = history.length - 1
    } else {
      const nextIndex = this.historyIndex + direction
      if (nextIndex < 0) {
        return
      }
      if (nextIndex >= history.length) {
        this.historyIndex = undefined
        this.value = this.historyDraft
        this.cursorIndex = Array.from(this.value).length
        this.cursorVisible = true
        this.render()
        return
      }
      this.historyIndex = nextIndex
    }

    this.value = history[this.historyIndex] ?? ''
    this.cursorIndex = Array.from(this.value).length
    this.cursorVisible = true
    this.render()
  }

  private resetHistoryNavigation(): void {
    this.historyIndex = undefined
    this.historyDraft = ''
  }

  private completeCurrentToken(): void {
    if (!this.completionProvider) {
      return
    }

    const characters = Array.from(this.value)
    let tokenStart = this.cursorIndex
    while (tokenStart > 0 && !/\s/.test(characters[tokenStart - 1])) {
      tokenStart -= 1
    }

    let tokenEnd = this.cursorIndex
    while (tokenEnd < characters.length && !/\s/.test(characters[tokenEnd])) {
      tokenEnd += 1
    }

    const prefix = characters.slice(tokenStart, this.cursorIndex).join('')
    const candidates = this.completionProvider(this.value, this.cursorIndex)
    const matches = [...new Set(
      candidates.filter((candidate) => candidate.toLowerCase().startsWith(prefix.toLowerCase())),
    )]
    if (matches.length === 0) {
      return
    }

    const commonPrefix = this.getCommonPrefix(matches)
    if (matches.length > 1 && commonPrefix.length <= prefix.length) {
      return
    }

    const completedToken = matches.length === 1 ? matches[0] : commonPrefix
    const shouldAddSpace = matches.length === 1 && tokenEnd === characters.length
    const replacement = shouldAddSpace ? `${completedToken} ` : completedToken
    characters.splice(tokenStart, tokenEnd - tokenStart, ...Array.from(replacement))
    this.value = characters.join('')
    this.cursorIndex = tokenStart + Array.from(replacement).length
    this.cursorVisible = true
    this.render()
  }

  private getCommonPrefix(values: readonly string[]): string {
    let prefix = values[0] ?? ''
    for (const value of values.slice(1)) {
      let index = 0
      while (
        index < prefix.length &&
        index < value.length &&
        prefix[index].toLowerCase() === value[index].toLowerCase()
      ) {
        index += 1
      }
      prefix = prefix.slice(0, index)
    }
    return prefix
  }

  private updateCursorVisibility(): void {
    const show = this.visible && this.cursorVisible
    this.cursorBlock?.setVisible(show)
    const hasCharUnderCursor = this.cursorIndex < Array.from(this.value).length
    this.cursorGlyph?.setVisible(show && hasCharUnderCursor)
  }

  private render(): void {
    if (!this.textObject || !this.pillBg || !this.cursorBlock || !this.cursorGlyph) {
      return
    }

    const fullLine = `${PROMPT}${this.value}`
    this.textObject.setText(fullLine)

    const textWidth = Math.max(10, this.textObject.width)
    const totalWidth = Math.max(PILL_MIN_WIDTH, textWidth + PADDING_H * 2)
    const totalHeight = FONT_SIZE + PADDING_V * 2

    this.pillBg.setSize(totalWidth, totalHeight)

    const startX = -totalWidth / 2 + PADDING_H
    this.textObject.setPosition(startX, 0)

    const cursorCharPos = Array.from(PROMPT).length + this.cursorIndex
    const cursorX = startX + cursorCharPos * this.charWidth

    this.cursorBlock.setPosition(cursorX, 0).setSize(this.charWidth, FONT_SIZE)
    this.cursorGlyph.setPosition(cursorX, 0)

    const charUnderCursor = Array.from(this.value)[this.cursorIndex] ?? ''
    this.cursorGlyph.setText(charUnderCursor)

    this.updateCursorVisibility()
  }

  private measureCharacterWidth(): number {
    if (typeof document === 'undefined') {
      return 13
    }
    const measurementCanvas = document.createElement('canvas')
    const context = measurementCanvas.getContext('2d')
    if (!context) {
      return 13
    }
    context.font = `${FONT_SIZE}px ${FONT_FAMILY}`
    const measuredWidth = context.measureText('M').width
    return measuredWidth > 0 ? measuredWidth : 13
  }
}

