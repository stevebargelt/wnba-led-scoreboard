# ADR: TypeScript Preview Generator

**Status:** Accepted
**Date:** 2026-04-06
**Deciders:** Development Team
**Context:** Web Admin Configuration Preview System

## Context and Problem Statement

The WNBA LED Scoreboard web admin interface needs to show users real-time previews of how their configuration changes will look on the physical LED matrix display. Users configure display settings (brightness, layout, logo variants) through the web interface and need immediate visual feedback before changes are deployed to the hardware.

The production scoreboard runs Python on a Raspberry Pi with physical LED matrix hardware. How do we provide accurate previews in the browser-based web admin without running Python or accessing the hardware?

## Decision Drivers

- **User Experience**: Instant visual feedback when changing configuration
- **Accuracy**: Preview must match actual hardware output pixel-for-pixel
- **Independence**: Web admin shouldn't require Python runtime or hardware access
- **Performance**: Preview generation must be fast (<100ms)
- **Maintainability**: Changes to rendering logic should be straightforward
- **Testing**: Preview system needs comprehensive test coverage

## Considered Options

### Option 1: Server-Side Python Rendering via API

Run Python renderer on server, expose as API endpoint, web admin requests preview images.

**Pros:**
- Single source of truth for rendering logic
- No code duplication
- Guaranteed consistency with hardware

**Cons:**
- Requires Python server infrastructure
- Network latency for every preview (500ms+ roundtrip)
- Server becomes single point of failure
- Deployment complexity (Python + Node.js)
- No offline functionality

### Option 2: WebAssembly Port of Python Renderer

Compile Python renderer to WebAssembly, run in browser.

**Pros:**
- Single source of truth
- No network latency
- Runs in browser

**Cons:**
- WASM tooling immature for Python
- PIL/Pillow dependencies difficult to compile
- Large bundle size (>5MB)
- Complex build pipeline
- Browser compatibility concerns

### Option 3: TypeScript Reimplementation (Selected)

Reimplement rendering logic in TypeScript using Canvas API.

**Pros:**
- Native browser performance (<50ms)
- No server dependency
- Works offline
- Testable with standard tools (Jest)
- Familiar stack for web developers
- Smaller bundle size (<200KB)

**Cons:**
- Code duplication
- Manual synchronization required
- Risk of drift between implementations

## Decision Outcome

**Chosen option:** TypeScript Reimplementation

We accept intentional code duplication between Python and TypeScript implementations to achieve the required user experience. The duplicate code is concentrated in well-defined modules (font management, logo loading, scene rendering) making synchronization manageable.

### Positive Consequences

- Instant preview updates (<50ms)
- No infrastructure overhead
- Simple deployment (Next.js only)
- Standard web development workflow
- Comprehensive test coverage (Jest + React Testing Library)
- Works offline after initial load

### Negative Consequences

- Two implementations must be kept in sync
- Changes to rendering require updates in both languages
- Risk of subtle pixel-level differences
- Higher cognitive load for developers

## Mitigation Strategies

### 1. Automated Visual Regression Testing

Compare PNG outputs from both systems using pixel-diff testing. Any rendering change must pass visual regression tests proving TypeScript output matches Python output.

```bash
python app.py --sim --once  # Generate Python output
npm test                     # Generate TS output + compare
```

### 2. Structured Synchronization Protocol

See `docs/preview-maintenance.md` for the complete workflow:
- Checklist for syncing changes
- Verification steps
- Common gotchas

### 3. Isolated Module Boundaries

Duplicate code is contained to specific modules:
- Font management (`src/render/fonts.py` ↔ `web-admin/src/lib/preview/fonts.ts`)
- Logo loading (`src/render/logos.py` ↔ `web-admin/src/lib/preview/logos.ts`)
- Scene rendering (`src/render/scenes/*.py` ↔ `web-admin/src/lib/preview/scenes/*.ts`)

Changes outside these modules don't require synchronization.

### 4. Documentation

This ADR and accompanying documentation establish:
- Why duplication is intentional (not technical debt)
- Which code is duplicated
- How to maintain synchronization
- When to choose Python vs TypeScript for new features

## Implementation Notes

### Architecture Alignment

Both implementations follow the same high-level architecture:

```
┌─────────────────┐         ┌─────────────────┐
│  Python Stack   │         │ TypeScript Stack│
├─────────────────┤         ├─────────────────┤
│ Renderer        │   ↔     │ PreviewGenerator│
│  ├─ FontManager │   ↔     │  ├─ FontManager │
│  ├─ LogoLoader  │   ↔     │  ├─ LogoLoader  │
│  └─ Scenes      │   ↔     │  └─ Scenes      │
│     ├─ Idle     │   ↔     │     ├─ Idle     │
│     ├─ Pregame  │   ↔     │     ├─ Pregame  │
│     ├─ Live     │   ↔     │     ├─ Live     │
│     ├─ LiveBig  │   ↔     │     ├─ LiveBig  │
│     └─ Final    │   ↔     │     └─ Final    │
└─────────────────┘         └─────────────────┘
```

### API Surface Parity

Key classes maintain equivalent APIs:

**Python:**
```python
class Renderer:
    def render_idle(self, now_local: datetime) -> None
    def render_pregame(self, snap: GameSnapshot, now_local: datetime) -> None
    def render_live(self, snap: GameSnapshot, now_local: datetime) -> None
    def render_final(self, snap: GameSnapshot, now_local: datetime) -> None
```

**TypeScript:**
```typescript
class PreviewGenerator {
    generateIdleScene(): Buffer
    generatePregameScene(snapshot?: GameSnapshot): Buffer
    async generateLiveScene(snapshot?: GameSnapshot, bigLogos?: boolean): Promise<Buffer>
    generateFinalScene(snapshot?: GameSnapshot): Buffer
}
```

### Type System Alignment

Both systems share the same data models (via JSON schema):
- `GameSnapshot` - game state data
- `DeviceConfiguration` - display settings
- `TeamInfo` - team identification
- `SportInfo` - sport metadata

TypeScript types are generated from the same source of truth as Python Pydantic models.

## Alternatives Not Considered

- **Screenshot capture from hardware**: Too slow, requires physical device
- **SVG-based rendering**: Browser inconsistencies, poor pixel control
- **Pre-rendered static images**: Can't show user's actual configuration

## Related Decisions

- Scene system architecture (src/display/scenes/)
- Configuration management (src/config/)
- Display abstraction layer (src/display/)

## References

- Implementation: `web-admin/src/lib/preview/`
- Python renderer: `src/render/`
- Maintenance guide: `docs/preview-maintenance.md`
- Test suite: `web-admin/src/lib/preview/*.test.ts`
