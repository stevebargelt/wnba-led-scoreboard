# TODO: Client-Side Preview

## Phase 1: Foundation
- [ ] **Task 1**: Types, Display, Fonts — `types.ts`, `display.ts`, `fonts.ts`, copy font assets to `web-admin/public/`
- [ ] **Task 2**: Logo Loader — `logos.ts`, copy/symlink logo assets to `web-admin/public/`
- [ ] **Task 3**: Demo Data — `demo-data.ts` with WNBA + NHL snapshots
- [ ] **CHECKPOINT 1**: All foundation modules built and tested independently

## Phase 2: Rendering
- [ ] **Task 4**: Idle + Live Stacked scenes — first two scene renderers in `scenes.ts`
- [ ] **Task 5**: Pregame, Final, Live Big — remaining three scene renderers
- [ ] **Task 6**: Generator + Index — `generator.ts`, `index.ts`, integration tests
- [ ] **CHECKPOINT 2**: Preview library complete and tested, no React component yet

## Phase 3: UI Integration
- [ ] **Task 7**: DisplayPreview rewrite — client-side Canvas rendering, 8x scaling, scene buttons
- [ ] **Task 8**: Device page wiring — pass renderConfig prop, auto-refresh on config changes
- [ ] **CHECKPOINT 3**: Feature complete — all tests, type-check, build pass, visual verification in browser
