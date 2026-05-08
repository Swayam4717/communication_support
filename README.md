# Communication Support — Expo Prototype

Lightweight React Native + Expo prototype for a calm parent/child communication flow.

Where to look
- `focus-test/app/CommunicationMvp.tsx` — app entry (now small), imports below.
- `focus-test/app/communicationHelpers.ts` — shared types, constants, and session helpers.
- `focus-test/app/communicationCommon.tsx` — shared styles and some UI wiring.
- `focus-test/app/communicationUI.tsx` — small UI components (`OptionCard`, `Header`).
- `focus-test/app/ParentMode.tsx` — Parent builder UI + keyboard-aware behavior.
- `focus-test/app/ChildMode.tsx` — Child flow (incoming → choice → confirmation).

Quick start
- Install deps and start Expo (dev server):

```bash
npx expo install
npx expo start
# then press `i` (iOS) or `a` (Android) in the dev tools
```

- Run TypeScript checks:

```bash
npx tsc --noEmit
```

Recent notes
- The large `CommunicationMvp` implementation was split into helpers and UI files to improve maintainability.
- Parent mode includes keyboard avoidance and auto-scroll for focused inputs (uses `onLayout` caching).

If you want me to commit these changes, run the git commands locally or ask me to create the commit for you.
