import Phaser from 'phaser'
import { GameScene } from './scenes/GameScene.ts'
import { LevelEditorScene } from './scenes/LevelEditorScene.ts'
import { SpeedEditorScene } from './scenes/SpeedEditorScene.ts'

const SCENE_WIDTH = 1920
const SCENE_HEIGHT = 1080
const BACKGROUND_COLOR = '#101010'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    backgroundColor: BACKGROUND_COLOR,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [GameScene, LevelEditorScene, SpeedEditorScene],
  })
}
