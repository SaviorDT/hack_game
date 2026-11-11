---
name: phaser-dry-feature
description: >
  Plans, implements, and verifies new game features, mechanics, processes, or UI
  using this project's composition model and automated DRY checks. Activate when
  creating or modifying game mechanics, simulation processes, scene UI, or commands.
---

# DRY Feature Implementation Workflow

Follow these steps strictly in order. Do NOT write code until Step 1 is approved.

## Step 1: Audit & Propose (DO NOT WRITE CODE YET)

1. Read `docs/architecture.md` and `CONTEXT.md`.
2. Scan the relevant layer directories:
   - New behavior/process → check `src/game/simulation/` and `src/game/processes/`
   - New command → check `src/game/commands/executors/`
   - New UI element → check `src/game/presentation/` and `src/game/scenes/editorTheme.ts`
   - New domain concept → check `src/game/domain/`
3. Output a **Reuse & Extraction Plan** (max 15 lines):
   - Existing modules that will be reused or extended.
   - New modules to be created, with their layer and estimated line count.
   - Files to be modified.
4. **STOP and await approval** if the change touches > 3 files or adds > 80 lines.

## Step 2: Layered Implementation

Implement in dependency order (domain → simulation → commands → presentation → scenes):
1. Pure domain types or logic in `src/game/domain/`.
2. Process definitions (new behaviors) in `src/game/simulation/` or `src/game/simulation/room1/`.
3. Command executors in `src/game/commands/executors/` using `CommandExecutor` base.
4. Presentation in `src/game/presentation/` — purely reactive to `WorldState`.
5. Scene wiring in `src/game/scenes/` — orchestration only, no inline logic.

For editor UI: import `FONT_FAMILY`, colors from `src/game/scenes/editorTheme.ts`.

New files approaching **400 lines** are a signal to pause and extract. Use this as a decision
point, not a build failure — `check:dry` is the actual automated gate.

## Step 3: DRY Verification

1. Run `npm run check:dry`.
2. If it reports clones, extract the duplicated block to a shared helper before finishing.
3. Run `npm test` to confirm no regressions.
4. Update `docs/architecture.md` if the change adds a new module or layer concept.

