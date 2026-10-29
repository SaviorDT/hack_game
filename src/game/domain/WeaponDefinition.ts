export type AttackShape = 'single'

export class WeaponDefinition {
  readonly id: string
  readonly damage: number
  readonly cooldownMs: number
  readonly reach: number
  readonly attackShape: AttackShape

  constructor(id: string, damage: number, cooldownMs: number, reach: number, attackShape: AttackShape = 'single') {
    this.id = id
    this.damage = damage
    this.cooldownMs = cooldownMs
    this.reach = reach
    this.attackShape = attackShape
  }
}

export const UNARMED = new WeaponDefinition('unarmed', 10, 500, 5)
export const DAGGER = new WeaponDefinition('dagger', 35, 500, 10)
export const GUARD_STRIKE = new WeaponDefinition('guard-strike', 20, 1000, 5)

const WEAPONS_BY_ID: ReadonlyMap<string, WeaponDefinition> = new Map(
  [UNARMED, DAGGER, GUARD_STRIKE].map((weapon) => [weapon.id, weapon]),
)

export function weaponFor(weaponId: string | null): WeaponDefinition {
  if (weaponId === null) {
    return UNARMED
  }

  const weapon = WEAPONS_BY_ID.get(weaponId)
  if (!weapon) {
    throw new Error(`Unknown weapon "${weaponId}".`)
  }

  return weapon
}
