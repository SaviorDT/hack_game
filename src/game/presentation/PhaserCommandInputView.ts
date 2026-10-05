import type Phaser from 'phaser'
import type {
  CommandCompletionProvider,
  CommandHistoryProvider,
  CommandInputView,
} from './CommandInputView.ts'

export const COMMAND_INPUT_TEXTURE_KEY = 'command-input-textbox'

const TEXTBOX_WIDTH = 1850
const TEXTBOX_HEIGHT = 300
const BOTTOM_MARGIN = 32
const HORIZONTAL_PADDING = 60
const VERTICAL_PADDING = 32
const SCROLLBAR_WIDTH = 14
const SCROLLBAR_GAP = 14
const MIN_SCROLLBAR_THUMB_HEIGHT = 24
const FONT_FAMILY = '"Press Start 2P", monospace'
const FONT_SIZE = 36
const LINE_SPACING = 4
const VISIBLE_LINE_COUNT = 6
const TEXT_COLOR = '#d6d6d6'
const PLACEHOLDER_COLOR = '#777777'
const CURSOR_COLOR = 0xd6d6d6
const FIELD_COLOR = '#101010'
const CURSOR_BLINK_MS = 500

export class PhaserCommandInputView implements CommandInputView {
  private scene: Phaser.Scene | undefined
  private onSubmit: ((rawText: string) => void) | undefined
  private completionProvider: CommandCompletionProvider | undefined
  private historyProvider: CommandHistoryProvider | undefined
  private reverseColorTexts: Phaser.GameObjects.Text[] = []
  private background: Phaser.GameObjects.Image | undefined
  private commandText: Phaser.GameObjects.Text | undefined
  private placeholderText: Phaser.GameObjects.Text | undefined
  private cursorBlock: Phaser.GameObjects.Rectangle | undefined
  private cursorGlyph: Phaser.GameObjects.Text | undefined
  private scrollbarTrack: Phaser.GameObjects.Rectangle | undefined
  private scrollbarThumb: Phaser.GameObjects.Rectangle | undefined
  private cursorBlinkEvent: Phaser.Time.TimerEvent | undefined
  private prompt = '~/room1$ '
  private value = ''
  private readonly transcript: { text: string; reverseColorLines: readonly string[] }[] = []
  private cursorIndex = 0
  private historyIndex: number | undefined
  private historyDraft = ''
  private cursorVisible = true
  private activeCursorVisible = true
  private showActivePrompt = true
  private baseCharacterWidth = FONT_SIZE
  private characterWidth = FONT_SIZE
  private charactersPerLine = 1
  private visibleLineCount = 1
  private textLeft = 0
  private textTop = 0
  private scrollOffset = 0
  private maxScrollOffset = 0
  private scrollbarTrackTop = 0
  private scrollbarTrackHeight = 0
  private scrollbarThumbHeight = 0
  private isDraggingScrollbar = false
  private scrollbarDragOffset = 0

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

    const camera = scene.cameras.main
    const left = (camera.width - TEXTBOX_WIDTH) / 2
    const top = camera.height - BOTTOM_MARGIN - TEXTBOX_HEIGHT
    const centerX = left + TEXTBOX_WIDTH / 2
    const centerY = top + TEXTBOX_HEIGHT / 2
    const contentWidth = TEXTBOX_WIDTH - HORIZONTAL_PADDING * 2 - SCROLLBAR_WIDTH - SCROLLBAR_GAP
    const contentHeight = TEXTBOX_HEIGHT - VERTICAL_PADDING * 2

    this.textLeft = left + HORIZONTAL_PADDING
    this.textTop = top + VERTICAL_PADDING
    this.scrollbarTrackTop = this.textTop
    this.scrollbarTrackHeight = contentHeight
    this.baseCharacterWidth = this.measureCharacterWidth()
    this.characterWidth = this.baseCharacterWidth
    this.scrollOffset = 0
    this.charactersPerLine = Math.max(1, Math.floor(contentWidth / this.characterWidth))
    this.visibleLineCount = VISIBLE_LINE_COUNT
    this.background = scene.add
      .image(centerX, centerY, COMMAND_INPUT_TEXTURE_KEY)
      .setDisplaySize(TEXTBOX_WIDTH, TEXTBOX_HEIGHT)
      .setDepth(10)
      .setInteractive()

    this.commandText = scene.add
      .text(this.textLeft, this.textTop, '', {
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZE,
        color: TEXT_COLOR,
        lineSpacing: LINE_SPACING,
      })
      .setOrigin(0, 0)
      .setDepth(11)

    this.placeholderText = scene.add
      .text(this.textLeft, this.textTop, 'help', {
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZE,
        fontStyle: 'italic',
        color: PLACEHOLDER_COLOR,
        lineSpacing: LINE_SPACING,
      })
      .setOrigin(0, 0)
      .setDepth(11)

    this.cursorBlock = scene.add
      .rectangle(0, 0, this.characterWidth, FONT_SIZE, CURSOR_COLOR)
      .setOrigin(0, 0)
      .setDepth(12)

    this.cursorGlyph = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZE,
        color: FIELD_COLOR,
        lineSpacing: LINE_SPACING,
      })
      .setOrigin(0, 0)
      .setDepth(13)

    const scrollbarX = left + TEXTBOX_WIDTH - HORIZONTAL_PADDING - SCROLLBAR_WIDTH / 2
    this.scrollbarTrack = scene.add
      .rectangle(scrollbarX, this.scrollbarTrackTop, SCROLLBAR_WIDTH, this.scrollbarTrackHeight, 0x555555, 0.65)
      .setOrigin(0.5, 0)
      .setDepth(14)
      .setInteractive()
    this.scrollbarThumb = scene.add
      .rectangle(scrollbarX, this.scrollbarTrackTop, SCROLLBAR_WIDTH, this.scrollbarTrackHeight, 0xd6d6d6, 0.9)
      .setOrigin(0.5, 0)
      .setDepth(15)
      .setInteractive()
    this.scrollbarThumb.on('pointerdown', this.handleScrollbarPointerDown)
    this.scrollbarTrack.on('pointerdown', this.handleScrollbarTrackPointerDown)

    const keyboard = scene.input.keyboard
    if (!keyboard) {
      throw new Error('Phaser keyboard input is not enabled for the game scene.')
    }

    keyboard.on('keydown', this.handleKeyboardEvent)
    scene.input.on('wheel', this.handleWheel)
    scene.input.on('pointermove', this.handlePointerMove)
    scene.input.on('pointerup', this.handlePointerUp)
    scene.input.on('pointerupoutside', this.handlePointerUp)
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

  setPrompt(prompt: string): void {
    if (this.prompt === prompt) {
      return
    }

    this.prompt = prompt
    this.render()
  }

  appendOutput(text: string, reverseColorLines: readonly string[] = []): void {
    this.transcript.push({ text, reverseColorLines })
    this.render()
  }

  finishExecution(): void {
    this.showActivePrompt = true
    this.render()
  }

  destroy(): void {
    this.scene?.input.keyboard?.off('keydown', this.handleKeyboardEvent)
    this.scene?.input.off('wheel', this.handleWheel)
    this.scene?.input.off('pointermove', this.handlePointerMove)
    this.scene?.input.off('pointerup', this.handlePointerUp)
    this.scene?.input.off('pointerupoutside', this.handlePointerUp)
    this.cursorBlinkEvent?.remove()
    this.background?.destroy()
    this.commandText?.destroy()
    this.placeholderText?.destroy()
    this.cursorBlock?.destroy()
    this.cursorGlyph?.destroy()
    this.clearReverseColorTexts()
    this.scrollbarTrack?.destroy()
    this.scrollbarThumb?.destroy()

    this.scene = undefined
    this.onSubmit = undefined
    this.completionProvider = undefined
    this.historyProvider = undefined
    this.background = undefined
    this.commandText = undefined
    this.placeholderText = undefined
    this.cursorBlock = undefined
    this.cursorGlyph = undefined
    this.reverseColorTexts = []
    this.scrollbarTrack = undefined
    this.scrollbarThumb = undefined
    this.cursorBlinkEvent = undefined
    this.value = ''
    this.cursorIndex = 0
    this.historyIndex = undefined
    this.historyDraft = ''
    this.transcript.length = 0
    this.showActivePrompt = true
    this.scrollOffset = 0
    this.maxScrollOffset = 0
    this.isDraggingScrollbar = false
  }

  private readonly handleKeyboardEvent = (event: KeyboardEvent): void => {
    if (!this.showActivePrompt) {
      event.preventDefault()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      this.submit()
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
        this.markCursorActive()
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
        this.markCursorActive()
        this.render()
      }
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      this.cursorIndex = Math.max(0, this.cursorIndex - 1)
      this.markCursorActive()
      this.render()
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      this.cursorIndex = Math.min(characters.length, this.cursorIndex + 1)
      this.markCursorActive()
      this.render()
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      this.cursorIndex = 0
      this.markCursorActive()
      this.render()
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      this.cursorIndex = characters.length
      this.markCursorActive()
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
      this.markCursorActive()
      this.render()
    }
  }

  private submit(): void {
    const submittedText = this.value

    this.transcript.push({
      text: `${this.prompt}${submittedText}`,
      reverseColorLines: [],
    })
    this.value = ''
    this.cursorIndex = 0
    this.historyIndex = undefined
    this.historyDraft = ''
    this.scrollOffset = 0
    this.showActivePrompt = false
    this.markCursorActive()
    this.render()

    this.onSubmit?.(submittedText)
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
        this.markCursorActive()
        this.render()
        return
      }
      this.historyIndex = nextIndex
    }

    this.value = history[this.historyIndex] ?? ''
    this.cursorIndex = Array.from(this.value).length
    this.markCursorActive()
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
    const candidates = this.value.length === 0 && this.cursorIndex === 0
      ? ['help']
      : this.completionProvider(this.value, this.cursorIndex)
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
    this.markCursorActive()
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

  private readonly handleWheel = (
    pointer: Phaser.Input.Pointer,
    _overObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void => {
    if (
      pointer.x < this.textLeft - HORIZONTAL_PADDING ||
      pointer.x > this.textLeft + TEXTBOX_WIDTH - HORIZONTAL_PADDING ||
      pointer.y < this.textTop ||
      pointer.y > this.textTop + this.scrollbarTrackHeight ||
      this.maxScrollOffset === 0
    ) {
      return
    }

    this.scrollOffset = Math.max(
      0,
      Math.min(this.maxScrollOffset, this.scrollOffset - Math.sign(deltaY) * 3),
    )
    this.render()
  }

  private readonly handleScrollbarPointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.isDraggingScrollbar = true
    this.scrollbarDragOffset = pointer.y - (this.scrollbarThumb?.y ?? this.scrollbarTrackTop)
  }

  private readonly handleScrollbarTrackPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.maxScrollOffset === 0) {
      return
    }

    this.scrollbarDragOffset = this.scrollbarThumbHeight / 2
    this.isDraggingScrollbar = true
    this.updateScrollFromPointer(pointer.y)
  }

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.isDraggingScrollbar) {
      this.updateScrollFromPointer(pointer.y)
    }
  }

  private readonly handlePointerUp = (): void => {
    this.isDraggingScrollbar = false
  }

  private updateScrollFromPointer(pointerY: number): void {
    const thumbTravel = this.scrollbarTrackHeight - this.scrollbarThumbHeight
    if (thumbTravel <= 0) {
      return
    }

    const thumbTop = Math.max(
      this.scrollbarTrackTop,
      Math.min(this.scrollbarTrackTop + thumbTravel, pointerY - this.scrollbarDragOffset),
    )
    const scrollRatio = (thumbTop - this.scrollbarTrackTop) / thumbTravel
    this.scrollOffset = Math.round((1 - scrollRatio) * this.maxScrollOffset)
    this.render()
  }

  private markCursorActive(): void {
    this.cursorVisible = true
    this.scrollOffset = 0
    this.updateCursorVisibility()
  }

  private updateCursorVisibility(): void {
    this.cursorBlock?.setVisible(this.cursorVisible && this.activeCursorVisible)
    const displayCursorIndex = Array.from(this.prompt).length + this.cursorIndex
    const hasCharacterUnderCursor = displayCursorIndex < Array.from(`${this.prompt}${this.value}`).length ||
      (this.value.length === 0 && this.cursorIndex < 'help'.length)
    this.cursorGlyph?.setVisible(
      this.cursorVisible && this.activeCursorVisible && hasCharacterUnderCursor,
    )
  }

  private render(): void {
    if (
      !this.commandText ||
      !this.placeholderText ||
      !this.cursorBlock ||
      !this.cursorGlyph ||
      !this.scrollbarTrack ||
      !this.scrollbarThumb
    ) {
      return
    }

    const contentWidth = TEXTBOX_WIDTH - HORIZONTAL_PADDING * 2 - SCROLLBAR_WIDTH - SCROLLBAR_GAP
    const fontSize = FONT_SIZE
    const characterWidth = this.baseCharacterWidth
    const charactersPerLine = Math.max(1, Math.floor(contentWidth / characterWidth))
    this.characterWidth = characterWidth
    this.charactersPerLine = charactersPerLine
    this.visibleLineCount = VISIBLE_LINE_COUNT
    const activeLine = this.showActivePrompt ? `${this.prompt}${this.value}` : ''
    const transcriptLines = this.transcript.flatMap((entry) =>
      this.wrapText(entry.text, this.charactersPerLine).map((line) => ({
        text: line,
        reverseColor: entry.reverseColorLines.includes(line),
      })),
    )
    const allLines = [
      ...transcriptLines.map((line) => line.text),
      ...this.wrapText(activeLine, this.charactersPerLine),
    ]

    const transcriptLineCount = transcriptLines.length
    const cursorPosition = this.showActivePrompt
      ? Array.from(this.prompt).length + this.cursorIndex
      : 0
    const cursorRow = transcriptLineCount +
      (this.showActivePrompt ? Math.floor(cursorPosition / this.charactersPerLine) : 0)
    while (allLines.length <= cursorRow) {
      allLines.push('')
    }
    const cursorColumn = cursorPosition % this.charactersPerLine
    this.maxScrollOffset = Math.max(0, allLines.length - this.visibleLineCount)
    this.scrollOffset = Math.max(0, Math.min(this.maxScrollOffset, this.scrollOffset))
    const firstVisibleRow = this.maxScrollOffset - this.scrollOffset
    const visibleLines = allLines.slice(firstVisibleRow, firstVisibleRow + this.visibleLineCount)
    const lineSpacing = LINE_SPACING
    const cursorVisible = this.showActivePrompt &&
      cursorRow >= firstVisibleRow &&
      cursorRow < firstVisibleRow + this.visibleLineCount
    this.activeCursorVisible = cursorVisible

    this.commandText.setFontSize(fontSize)
    this.commandText.setLineSpacing(lineSpacing)
    this.placeholderText.setVisible(this.value.length === 0 && cursorVisible)
    this.placeholderText.setFontSize(fontSize)
    this.placeholderText.setLineSpacing(lineSpacing)
    this.clearReverseColorTexts()
    const renderedLines = visibleLines.map((line, index) => {
      const transcriptLine = transcriptLines[firstVisibleRow + index]
      if (!transcriptLine?.reverseColor) {
        return line
      }

      const reverseText = this.scene?.add
        .text(
          this.textLeft,
          this.textTop + index * (fontSize + lineSpacing),
          line,
          {
            fontFamily: FONT_FAMILY,
            fontSize,
            color: FIELD_COLOR,
            backgroundColor: TEXT_COLOR,
            lineSpacing,
          },
        )
        .setOrigin(0, 0)
        .setDepth(11.5)
      if (reverseText) {
        this.reverseColorTexts.push(reverseText)
      }
      return ' '.repeat(line.length)
    })
    this.commandText.setText(renderedLines.join('\n'))

    const cursorX = this.textLeft + cursorColumn * this.characterWidth
    const cursorY = this.textTop + (cursorRow - firstVisibleRow) * (fontSize + lineSpacing)
    this.placeholderText.setPosition(cursorX, cursorY)
    this.cursorBlock
      .setPosition(cursorX, cursorY)
      .setSize(this.characterWidth, fontSize)
      .setVisible(cursorVisible && this.cursorVisible)
    this.cursorGlyph.setPosition(cursorX, cursorY)
    this.cursorGlyph.setFontSize(fontSize)
    this.cursorGlyph.setLineSpacing(lineSpacing)
    this.cursorGlyph.setText(
      this.value.length === 0 ? 'help'[this.cursorIndex] ?? '' : Array.from(this.value)[this.cursorIndex] ?? '',
    )
    const trackX = this.textLeft + contentWidth + SCROLLBAR_GAP + SCROLLBAR_WIDTH / 2
    this.scrollbarTrack
      .setPosition(trackX, this.scrollbarTrackTop)
      .setVisible(this.maxScrollOffset > 0)
    this.scrollbarThumb
      .setPosition(trackX, this.scrollbarTrackTop)
      .setVisible(this.maxScrollOffset > 0)

    if (this.maxScrollOffset > 0) {
      this.scrollbarThumbHeight = Math.max(
        MIN_SCROLLBAR_THUMB_HEIGHT,
        this.scrollbarTrackHeight * this.visibleLineCount / allLines.length,
      )
      const thumbTravel = this.scrollbarTrackHeight - this.scrollbarThumbHeight
      const thumbTop = this.scrollbarTrackTop +
        (1 - this.scrollOffset / this.maxScrollOffset) * thumbTravel
      this.scrollbarThumb
        .setPosition(trackX, thumbTop)
        .setSize(SCROLLBAR_WIDTH, this.scrollbarThumbHeight)
    } else {
      this.scrollbarThumbHeight = this.scrollbarTrackHeight
      this.scrollbarThumb.setSize(SCROLLBAR_WIDTH, this.scrollbarTrackHeight)
    }

    this.updateCursorVisibility()
  }

  private wrapText(text: string, charactersPerLine: number): string[] {
    return text.split(/\r?\n/).flatMap((line) => {
      if (line.length === 0) {
        return ['']
      }

      const wrappedLines: string[] = []
      for (let index = 0; index < line.length; index += charactersPerLine) {
        wrappedLines.push(line.slice(index, index + charactersPerLine))
      }
      return wrappedLines
    })
  }

  private clearReverseColorTexts(): void {
    for (const text of this.reverseColorTexts) {
      text.destroy()
    }
    this.reverseColorTexts = []
  }

  private measureCharacterWidth(): number {
    const measurementCanvas = document.createElement('canvas')
    const context = measurementCanvas.getContext('2d')

    if (!context) {
      return FONT_SIZE
    }

    context.font = `${FONT_SIZE}px ${FONT_FAMILY}`
    const measuredWidth = context.measureText('M').width

    return measuredWidth > 0 ? measuredWidth : FONT_SIZE
  }
}
