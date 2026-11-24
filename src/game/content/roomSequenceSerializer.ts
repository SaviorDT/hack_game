export function generateRoomSequenceSource(
  activeRoomIds: readonly string[],
  unusedRoomIds: readonly string[],
  roomContentSnapshot: Readonly<Record<string, unknown>> = {},
): string {
  const active = activeRoomIds.map((roomId) => `  ${JSON.stringify(roomId)},`).join('\n')
  const unused = unusedRoomIds.map((roomId) => `  ${JSON.stringify(roomId)},`).join('\n')
  const unusedBody = unused.length > 0 ? `\n${unused}\n` : ''

  const snapshot = JSON.stringify(roomContentSnapshot, null, 2)

  return `export const ACTIVE_ROOM_IDS: readonly string[] = [
${active}
]

export const UNUSED_ROOM_IDS: readonly string[] = [${unusedBody}]

export const ROOM_CONTENT_SNAPSHOT: Readonly<Record<string, unknown>> = ${snapshot}
`
}
