# Project guidance

- Before design discussions, read `CONTEXT.md` (glossary), `docs/adr/` (decisions), and `docs/architecture.md` (implementation architecture and runtime responsibilities).
- `CONTEXT.md` is a glossary only; put implementation detail in `docs/architecture.md`.
- After adding or changing a feature, update `docs/architecture.md` to reflect the new state.

## Layer Discipline

| Layer | Allowed to… | Must NOT… |
|---|---|---|
| `scenes/` | Wire session, views, input | Contain physics math, domain logic, or inline process behavior |
| `presentation/` | Render domain state via Phaser | Own or mutate `WorldState` |
| `simulation/` | Apply Forces per tick | Read Phaser objects or scene state |
| `domain/` | Define pure domain types and logic | Import Phaser or Vite assets |
| `application/` | Orchestrate session lifecycle | Directly mutate world objects |

## Discovery Before Generation

Before writing ANY new utility, session helper, process, or UI element:
- Scan the relevant layer directory for existing modules.
- Check `src/game/scenes/editorTheme.ts` before defining any editor visual constant.
- Never redefine `FONT_FAMILY`, `TEXT_COLOR`, `DIM_COLOR`, `ACCENT_COLOR`, `VALUE_COLOR`, or `PANEL_BG` locally in an editor scene or overlay.

## New File Size Guidance

- **~400 lines** is a signal to pause and consider extracting reusable logic into the appropriate layer. Pre-existing large files (`LevelEditorScene.ts`, `BehaviorTreeEditorScene.ts`, `PhaserCommandInputView.ts`) are exempt.
- Prefer functions ≤ 40 lines; split at logical seams.
- Scenes (`src/game/scenes/`) must stay as orchestrators: no inline physics or process logic.

## DRY Verification Gate

Before finishing any multi-file edit, run:
```bash
npm run check:dry
```
If it fails, refactor the duplicated block into a shared module before presenting the diff.
