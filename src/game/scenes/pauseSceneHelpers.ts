import type Phaser from 'phaser'
import type { CommandTypingMode } from '../application/gameSettings.ts'

export const TERMINAL_FONT = '"Press Start 2P", monospace'
export const COLOR_WHITE = '#ffffff'
export const COLOR_DIM = '#606060'
export const COLOR_MUTED = '#202020'
export const COLOR_PROMPT = '#9f9f9f'
const LEGACY_DIM = '#555555'
const LEGACY_PROMPT = '#888888'

export const TYPING_SPEED_MS = 15
export const SCROLL_SPEED_MS = 27
export const PAUSE_DURATION_MS = 150
export const EXECUTION_PAUSE_MS = PAUSE_DURATION_MS
export const SHRINK_MS = 50
export const EXPAND_MS = 75

export interface SubscreenChrome {
  bottomCommandText: Phaser.GameObjects.Text
  returnBtn: Phaser.GameObjects.Text
}

export interface HelpScreenRefs {
  promptCommand: Phaser.GameObjects.Text
  manualText: Phaser.GameObjects.Text
  descText: Phaser.GameObjects.Text
}

export interface SettingScreenRefs {
  promptCommand: Phaser.GameObjects.Text
  returnBtn: Phaser.GameObjects.Text
  shiftText: Phaser.GameObjects.Text
  separatorText: Phaser.GameObjects.Text
  stickyText: Phaser.GameObjects.Text
  descText: Phaser.GameObjects.Text
}

export function typeCommand(
  scene: Phaser.Scene,
  textObj: Phaser.GameObjects.Text,
  command: string,
  onComplete: () => void,
): void {
  if (!textObj) {
    onComplete()
    return
  }
  textObj.setText('')
  scene.time.delayedCall(TYPING_SPEED_MS, () => {
    textObj.setText(command.slice(0, 1))
    scene.time.delayedCall(TYPING_SPEED_MS, () => {
      textObj.setText(command.slice(0, 2))
      scene.time.delayedCall(TYPING_SPEED_MS, () => {
        textObj.setText(command)
        onComplete()
      })
    })
  })
}

export function scrollTransition(
  scene: Phaser.Scene,
  fromContainer: Phaser.GameObjects.Container,
  toContainer: Phaser.GameObjects.Container,
  onComplete: () => void,
): void {
  toContainer.setY(850).setVisible(true)
  if (scene.tweens?.add) {
    scene.tweens.add({
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
  }
}

export function shrinkToPoint(
  scene: Phaser.Scene,
  targetX: number,
  targetY: number,
  onComplete: () => void,
): void {
  const pivot = wrapChildrenAtPoint(scene, targetX, targetY)
  tweenPointScale(scene, pivot, 0, SHRINK_MS, 'Quad.easeIn', onComplete)
}

export function expandFromPoint(
  scene: Phaser.Scene,
  sourceX: number,
  sourceY: number,
  onComplete: () => void,
): void {
  const pivot = wrapChildrenAtPoint(scene, sourceX, sourceY)
  pivot.setScale(0)
  tweenPointScale(scene, pivot, 1, EXPAND_MS, 'Quad.easeOut', () => {
    restoreChildrenAtOrigin(pivot, sourceX, sourceY)
    onComplete()
  })
}

function wrapChildrenAtPoint(
  scene: Phaser.Scene,
  pointX: number,
  pointY: number,
): Phaser.GameObjects.Container {
  const allChildren = [...(scene.children?.list ?? [])]
  const pivot = scene.add.container(pointX, pointY)

  for (const child of allChildren) {
    offsetDisplayObject(child, -pointX, -pointY)
    pivot.add(child)
  }

  return pivot
}

function tweenPointScale(
  scene: Phaser.Scene,
  pivot: Phaser.GameObjects.Container,
  scale: number,
  duration: number,
  ease: string,
  onComplete: () => void,
): void {
  if (scene.tweens?.add) {
    scene.tweens.add({
      targets: pivot,
      scaleX: scale,
      scaleY: scale,
      duration,
      ease,
      onComplete,
    })
  } else {
    pivot.setScale(scale)
    onComplete()
  }
}

function restoreChildrenAtOrigin(
  pivot: Phaser.GameObjects.Container,
  offsetX: number,
  offsetY: number,
): void {
  for (const child of pivot.list) {
    offsetDisplayObject(child, offsetX, offsetY)
  }
  pivot.setPosition(0, 0)
}

function offsetDisplayObject(child: Phaser.GameObjects.GameObject, offsetX: number, offsetY: number): void {
  const displayObject = child as Phaser.GameObjects.GameObject & {
    x?: number
    y?: number
    setPosition?: (x: number, y: number) => void
  }
  if (displayObject.x !== undefined && displayObject.y !== undefined && displayObject.setPosition) {
    displayObject.setPosition(displayObject.x + offsetX, displayObject.y + offsetY)
  }
}

export function buildSubscreenChrome(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  command: string,
  navHint: string,
): SubscreenChrome {
  const promptPrefix = scene.add.text(80, 70, 'guest_terminal:~$ ', {
    fontFamily: TERMINAL_FONT,
    fontSize: '16px',
    color: COLOR_PROMPT,
  })
  const prefixWidth = promptPrefix.width || 304
  const promptCommand = scene.add.text(80 + prefixWidth, 70, command, {
    fontFamily: TERMINAL_FONT,
    fontSize: '16px',
    color: COLOR_WHITE,
  })

  const topLine = scene.add.graphics()
  topLine.lineStyle(1, 0x333333, 1)
  topLine.lineBetween(80, 105, 1840, 105)

  const bottomLine = scene.add.graphics()
  bottomLine.lineStyle(1, 0x333333, 1)
  bottomLine.lineBetween(80, 750, 1840, 750)

  const returnBtn = scene.add.text(960, 810, '> [ RETURN ] <', {
    fontFamily: TERMINAL_FONT,
    fontSize: '22px',
    color: COLOR_WHITE,
    align: 'center',
  }).setOrigin(0.5, 0.5)

  const navText = scene.add.text(960, 860, navHint, {
    fontFamily: TERMINAL_FONT,
    fontSize: '14px',
    color: COLOR_MUTED,
    align: 'center',
  }).setOrigin(0.5, 0.5)

  const bottomPrompt = scene.add.text(80, 920, 'guest_terminal:~$ ', {
    fontFamily: TERMINAL_FONT,
    fontSize: '16px',
    color: COLOR_PROMPT,
  })
  const bottomPrefixWidth = bottomPrompt.width || 304
  const bottomCommandText = scene.add.text(80 + bottomPrefixWidth, 920, '', {
    fontFamily: TERMINAL_FONT,
    fontSize: '16px',
    color: COLOR_WHITE,
  })

  container.add([
    promptPrefix,
    promptCommand,
    topLine,
    bottomLine,
    returnBtn,
    navText,
    bottomPrompt,
    bottomCommandText,
  ])

  return { bottomCommandText, returnBtn }
}

export function getHelpLines(mode: CommandTypingMode): string[] {
  const commandLineBindings = mode === 'hold-shift'
    ? [
      '  HOLD SHIFT           Open command prompt beneath hacker (slows time to 0.25x)',
      '  RELEASE SHIFT        Execute typed command (empty input cancels & closes)',
    ]
    : [
      '  ENTER                Open command prompt (slows time to 0.25x)',
      '  ENTER on empty bar   Close command prompt without executing',
    ]

  return [
    '── MOVEMENT & COMBAT ──',
    '  WASD / ARROW KEYS    Move hacker',
    '  SPACE                Attack with equipped weapon (auto-pickup on touch)',
    '',
    '── COMMAND LINE ──',
    ...commandLineBindings,
    '',
    '── VIRTUAL COMMANDS ──',
    '  help                 Print available commands and current room objective',
    '  ls                   Discover and reveal hidden objects in current room',
    '  mv <src> <target>    Throw object towards target, or rename object',
    '  cd <room>            Pass through exit doorway into adjacent room',
    '',
    '── SHORTCUTS ──',
    '  TAB                  Auto-complete command name or discovered object label',
    '  CTRL+BACKSPACE       Delete previous word in prompt',
    '  UP / DOWN            Browse command history',
    '  CTRL+P               Open pause menu',
  ]
}

export function buildHelpScreen(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  typingMode: CommandTypingMode,
): HelpScreenRefs {
  const chrome = buildSubscreenChrome(scene, container, 'help', '<ENTER> CONFIRM')
  const manualText = scene.add.text(80, 125, '', {
    fontFamily: TERMINAL_FONT,
    fontSize: '15px',
    color: LEGACY_PROMPT,
    lineSpacing: 10,
  })
  const descText = scene.add.text(80, 125, '', {
    fontFamily: TERMINAL_FONT,
    fontSize: '15px',
    color: LEGACY_DIM,
    lineSpacing: 10,
  })

  const originalSetText = manualText.setText.bind(manualText)
  manualText.setText = ((value: string | string[]) => {
    const lines = Array.isArray(value) ? value : [value]
    descText.setText(lines.map((line) => line.startsWith('──') ? '' : line))
    return originalSetText(lines.map((line) => line.startsWith('──') ? line : ''))
  }) as typeof manualText.setText

  manualText.setText(getHelpLines(typingMode))
  container.add([manualText, descText])

  return { promptCommand: chrome.bottomCommandText, manualText, descText }
}

export function buildSettingScreen(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  typingMode: CommandTypingMode,
): SettingScreenRefs {
  const chrome = buildSubscreenChrome(
    scene,
    container,
    './setting',
    '<W A S D> <ARROWS> SELECT    <ENTER> CONFIRM',
  )
  const header = scene.add.text(80, 125, '── IN-GAME COMMAND TYPING MODE ──', {
    fontFamily: TERMINAL_FONT,
    fontSize: '15px',
    color: COLOR_PROMPT,
  })
  const shiftText = scene.add.text(110, 165, '', {
    fontFamily: TERMINAL_FONT,
    fontSize: '15px',
    color: COLOR_WHITE,
  })
  const separatorText = scene.add.text(435, 165, '-', {
    fontFamily: TERMINAL_FONT,
    fontSize: '15px',
    color: COLOR_DIM,
  })
  const stickyText = scene.add.text(475, 165, '', {
    fontFamily: TERMINAL_FONT,
    fontSize: '15px',
    color: LEGACY_DIM,
  })
  const descText = scene.add.text(110, 210, '', {
    fontFamily: TERMINAL_FONT,
    fontSize: '14px',
    color: COLOR_DIM,
  })

  container.add([header, shiftText, separatorText, stickyText, descText])
  updateSettingDisplay({
    typingMode,
    focusIndex: typingMode === 'hold-shift' ? 0 : 1,
    returnBtn: chrome.returnBtn,
    shiftText,
    stickyText,
    descText,
  })

  return {
    promptCommand: chrome.bottomCommandText,
    returnBtn: chrome.returnBtn,
    shiftText,
    separatorText,
    stickyText,
    descText,
  }
}

export function updateSettingDisplay({
  typingMode,
  focusIndex,
  returnBtn,
  shiftText,
  stickyText,
  descText,
}: {
  typingMode: CommandTypingMode
  focusIndex: 0 | 1 | 2
  returnBtn: Phaser.GameObjects.Text
  shiftText: Phaser.GameObjects.Text
  stickyText: Phaser.GameObjects.Text
  descText: Phaser.GameObjects.Text
}): void {
  const isShiftSelected = typingMode === 'hold-shift'
  const shiftTag = isShiftSelected ? '* HOLD SHIFT *' : '  HOLD SHIFT  '
  shiftText.setText(focusIndex === 0 ? `> [${shiftTag}] <` : `  [${shiftTag}]  `)
  shiftText.setColor(focusIndex === 0 ? COLOR_WHITE : LEGACY_DIM)

  const stickyTag = !isShiftSelected ? '* ENTER + STICKY *' : '  ENTER + STICKY  '
  stickyText.setText(focusIndex === 1 ? `> [${stickyTag}] <` : `  [${stickyTag}]  `)
  stickyText.setColor(focusIndex === 1 ? COLOR_WHITE : LEGACY_DIM)

  const activeForDesc = focusIndex === 0
    ? 'hold-shift'
    : focusIndex === 1
      ? 'enter-sticky'
      : typingMode
  descText.setText(activeForDesc === 'hold-shift'
    ? 'Hold Shift to type commands; release Shift to submit or cancel.'
    : 'Press Enter to open/submit; Enter on empty bar closes; Shift disabled.')

  const isReturnFocused = focusIndex === 2
  returnBtn.setText(isReturnFocused ? '> [ RETURN ] <' : '  [ RETURN ]  ')
  returnBtn.setColor(isReturnFocused ? COLOR_WHITE : COLOR_DIM)
}
