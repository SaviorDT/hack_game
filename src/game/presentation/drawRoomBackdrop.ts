import type Phaser from 'phaser'
import { ROOM_LAYOUT } from '../content/roomConstants.ts'

/** Decorative geometry only: the domain still owns all room boundaries. */
export function drawRoomBackdrop(g: Phaser.GameObjects.Graphics): void {
  const { left, top, right, bottom } = ROOM_LAYOUT
  const width = right - left
  const height = bottom - top
  const rect = (x: number, y: number, w: number, h: number, color: number, alpha = 1) =>
    g.fillStyle(color, alpha).fillRect(x, y, w, h)

  // Raised masonry rim and a dark foundation beneath the floor.
  rect(left - 20, top - 12, width + 40, height + 44, 0x080f17)
  rect(left - 12, top - 8, width + 24, height + 24, 0x354652)
  rect(left, top, width, height, 0x26343d)
  const stones = [0x2b3d47, 0x30424a, 0x293b43, 0x34464c, 0x2e3e48]
  for (let row = 0, y = top; y < bottom; row++, y += 62) {
    for (let col = 0, x = left - (row % 2) * 48; x < right; col++, x += 96) {
      const x0 = Math.max(left, x)
      const w = Math.min(right, x + 96) - x0
      const h = Math.min(62, bottom - y)
      rect(x0 + 2, y + 2, w - 4, h - 4, stones[(row * 7 + col * 3) % stones.length])
      rect(x0 + 4, y + 3, Math.max(0, w - 8), 2, 0x668084, 0.22)
      rect(x0 + 3, y + h - 5, Math.max(0, w - 6), 2, 0x111f29, 0.45)
      // Sparse chips and moss use deterministic placement, stable across restarts.
      if ((row * 11 + col * 7) % 13 === 0 && w > 40) {
        rect(x0 + 14, y + 20, 16, 3, 0x172b32, 0.7)
        rect(x0 + 27, y + 23, 3, 9, 0x172b32, 0.7)
      }
      if ((row + col * 3) % 17 === 0 && w > 40) {
        rect(x0 + 6, y + h - 10, 18, 5, 0x42594b, 0.65)
      }
    }
  }
  // North wall faces give a shallow, fixed-camera sense of height.
  for (let x = left; x < right; x += 108) {
    const w = Math.min(108, right - x)
    rect(x + 2, top, w - 4, 26, 0x52636a)
    rect(x + 2, top + 26, w - 4, 30, 0x3c4d58)
    rect(x + 4, top + 2, w - 8, 3, 0x829091)
    rect(x + 2, top + 53, w - 4, 3, 0x1a2a35)
  }
  // Contact shadows stay inside the walkable boundary and introduce no obstacles.
  rect(left, top + 56, width, 12, 0x0b1722, 0.35)
  rect(left, top + 68, width, 12, 0x0b1722, 0.15)
  rect(left, top, 10, height, 0x0b1722, 0.5)
  rect(right - 10, top, 10, height, 0x0b1722, 0.5)
  rect(left, bottom - 8, width, 8, 0x101f29, 0.65)
  rect(left - 12, bottom + 4, width + 24, 8, 0x58656a)
  rect(left - 12, bottom + 12, width + 24, 8, 0x273845)

  // Pixel sconces with restrained, stepped pools of warm light.
  for (const x of [left + 170, left + width / 2, right - 170]) {
    rect(x - 64, top + 30, 128, 100, 0xe7ad61, 0.025)
    rect(x - 40, top + 30, 80, 70, 0xe7ad61, 0.04)
    rect(x - 18, top + 20, 36, 45, 0xf7b55a, 0.08)
    rect(x - 8, top + 18, 16, 26, 0x15232d)
    rect(x - 3, top + 24, 6, 20, 0x8c7160)
    rect(x - 8, top + 12, 16, 16, 0xc97c3f)
    rect(x - 5, top + 8, 10, 18, 0xf1b75d)
    rect(x - 2, top + 12, 4, 10, 0xffe1a1)
  }
}
