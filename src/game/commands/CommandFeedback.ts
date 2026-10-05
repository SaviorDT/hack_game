import type { WorldObjectId } from '../domain/ids.ts'

export type CommandFeedback =
  | { readonly kind: 'object'; readonly targetObjectId: WorldObjectId; readonly text: string }
  | {
      readonly kind: 'popup'
      readonly text: string
      readonly reverseColorLines?: readonly string[]
    }
