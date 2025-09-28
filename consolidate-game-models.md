# Game Model Consolidation Plan

## Executive Summary

Consolidate three overlapping game snapshot models into a single unified `GameSnapshot` model that fully supports the sports/leagues architecture. This eliminates manual conversions, reduces complexity, and ensures sport/league context is preserved throughout the application.

## Current State Analysis

### Three Models Currently in Use

1. **`GameSnapshot`** (`src/model/game.py:24-34`)
   - Simple, legacy model
   - Used by: renderer, scenes, adaptive refresh
   - Missing: sport/league context, extended team info
   - **16 files** import this model

2. **`EnhancedGameSnapshot`** (`src/model/sport_game.py:89-193`)
   - Extended with `SportTeam`, `GameTiming`, `SportSituation`
   - Used by: demo simulator
   - Has conversion methods but incomplete (references undefined `SportType`)
   - **3 files** import this model

3. **`LeagueGameSnapshot`** (`src/sports/clients/base.py:17-49`)
   - Sport/league-aware with `SportConfig` and `LeagueConfig` objects
   - Used by: league clients (WNBA, NHL, NBA), league aggregator
   - Most complete model for multi-sport support
   - **8 files** import this model

### Problematic Conversion Points

1. **app.py:178-188** - Manual conversion `LeagueGameSnapshot` → `GameSnapshot`
   - Loses sport/league metadata
   - Loses sport-specific data dictionary
   - Duplicates team/timing data extraction

2. **src/model/sport_game.py:132-150** - `to_legacy_game_snapshot()`
   - Uses `setattr()` to attach sport metadata
   - References undefined `SportType` enum (lines 174, 177)
   - Incomplete implementation

3. **Rendering scenes** - All accept `GameSnapshot` without sport context
   - `pregame.py:11`, `live.py:11`, `final.py`, `live_big.py`
   - Use `infer_team_sport()` helper to guess sport from team data
   - Fragile sport detection based on logo availability

## Target Architecture

### Single Unified Model: `GameSnapshot`

Merge the best of all three models into `src/model/game.py`:

```python
@dataclass
class GameSnapshot:
    """Unified game snapshot with full sport/league context."""

    # Sport/League Context (REQUIRED - no longer optional)
    sport: SportConfig
    league: LeagueConfig

    # Core Identification
    event_id: str
    start_time_local: datetime
    state: GameState

    # Team Information (enhanced)
    home: TeamSide
    away: TeamSide

    # Timing Information (unified)
    current_period: int
    period_name: str              # "Q1", "P2", "OT", etc.
    display_clock: str
    seconds_to_start: int = -1

    # Status
    status_detail: str = ""

    # Sport-Specific Data
    sport_specific_data: Dict[str, Any] = field(default_factory=dict)
```

### Enhanced `TeamSide`

Merge fields from `SportTeam` into `TeamSide`:

```python
@dataclass
class TeamSide:
    """Team information with extended metadata."""
    id: Optional[str]
    name: str
    abbr: str
    score: int = 0

    # Extended metadata (from SportTeam)
    colors: Dict[str, str] = field(default_factory=dict)
    logo_url: Optional[str] = None
    conference: Optional[str] = None
    division: Optional[str] = None
```

### Deprecate Models

- **Delete**: `EnhancedGameSnapshot`, `SportTeam`, `GameTiming`, `SportSituation` from `sport_game.py`
- **Delete**: `LeagueGameSnapshot` from `clients/base.py`
- **Keep**: `GameState` enum (used everywhere)

## Implementation Plan

### Phase 1: Update Core Model (2-3 hours)

**Step 1.1**: Update `src/model/game.py`
- [ ] Add imports: `SportConfig`, `LeagueConfig`, `Dict`, `Any`, `field`
- [ ] Enhance `TeamSide` with colors, logo_url, conference, division
- [ ] Add sport/league fields to `GameSnapshot` (required, not optional)
- [ ] Add `period_name: str` field
- [ ] Add `sport_specific_data: Dict[str, Any]` field
- [ ] Remove `period: int` field (redundant with `current_period`)

**Files Modified**: 1
- `src/model/game.py`

**Validation**: Run `python -c "from src.model.game import GameSnapshot, TeamSide"`

---

### Phase 2: Update League Clients (1-2 hours)

**Step 2.1**: Update `src/sports/clients/base.py`
- [ ] Remove `LeagueGameSnapshot` class definition (lines 17-49)
- [ ] Import `GameSnapshot` from `src.model.game`
- [ ] Update `LeagueClient.fetch_games()` return type: `List[GameSnapshot]`
- [ ] Update `CachedLeagueClient._load_from_cache()` deserialization to use `GameSnapshot`
- [ ] Update `CachedLeagueClient._save_to_cache()` serialization for new fields

**Step 2.2**: Update WNBA client `src/sports/leagues/wnba.py`
- [ ] Import `GameSnapshot` instead of `LeagueGameSnapshot`
- [ ] Update `WNBAClient.fetch_games()` return type annotation
- [ ] Update `_parse_game()` return type to `Optional[GameSnapshot]`
- [ ] Update `_parse_game()` construction (lines 139-156):
  - Return `GameSnapshot` with `sport=self.sport`, `league=self.league`
  - Add `period_name` field
  - Remove separate `current_period` and `period_name` fields

**Step 2.3**: Update NHL client `src/sports/leagues/nhl.py`
- [ ] Same changes as WNBA client

**Step 2.4**: Update NBA client `src/sports/leagues/nba.py`
- [ ] Same changes as WNBA client

**Files Modified**: 4
- `src/sports/clients/base.py`
- `src/sports/leagues/wnba.py`
- `src/sports/leagues/nhl.py`
- `src/sports/leagues/nba.py`

**Validation**:
```bash
python -c "from src.sports.leagues.wnba import WNBAClient"
python -c "from src.sports.leagues.nhl import NHLClient"
```

---

### Phase 3: Update League Aggregator (30 min)

**Step 3.1**: Update `src/sports/league_aggregator.py`
- [ ] Remove import of `LeagueGameSnapshot`
- [ ] Import `GameSnapshot` from `src.model.game`
- [ ] Update `get_featured_game()` return type: `Optional[GameSnapshot]` (line 97)
- [ ] Update `_get_manual_override_game()` return type: `Optional[GameSnapshot]` (line 223)
- [ ] Update `get_all_games()` return type: `Dict[str, List[GameSnapshot]]` (line 251)
- [ ] Remove priority score storage in game object (line 130) - move to separate dict
- [ ] Update priority calculation to work with `GameSnapshot`

**Files Modified**: 1
- `src/sports/league_aggregator.py`

**Validation**:
```bash
python -c "from src.sports.league_aggregator import LeagueAggregator"
```

---

### Phase 4: Update app.py (30 min)

**Step 4.1**: Remove manual conversion in `app.py`
- [ ] Remove `LeagueGameSnapshot` import (line 14)
- [ ] Remove lines 178-194 (manual conversion from `LeagueGameSnapshot` to `GameSnapshot`)
- [ ] Direct usage: `snapshot = aggregator.get_featured_game(...)`
- [ ] Update log message to use `snapshot.league.name` (line 190)

**Files Modified**: 1
- `app.py`

**Validation**:
```bash
python app.py --sim --once
```

---

### Phase 5: Update Demo Simulator (1-2 hours)

**Step 5.1**: Update `src/demo/simulator.py`
- [ ] Remove `EnhancedGameSnapshot` import
- [ ] Import `GameSnapshot` from `src.model.game`
- [ ] Update `LeagueDemoSimulator.get_snapshot()` return type: `Optional[GameSnapshot]`
- [ ] Update `_build_snapshot()` return type: `Optional[GameSnapshot]`
- [ ] Update `WNBADemoSimulator._make_snapshot()`:
  - Remove `GameTiming` construction (lines 197-206)
  - Return `GameSnapshot` with inline fields
  - Use `sport` and `league` from registry
- [ ] Update `NHLDemoSimulator._make_snapshot()`: same as WNBA
- [ ] Convert `SportTeam` usage to `TeamSide` with extended fields

**Step 5.2**: Fetch sport/league configs from registry
- [ ] Add registry import at top of simulator
- [ ] In `LeagueDemoSimulator.__init__()`, fetch sport/league configs:
  ```python
  self.league_config = registry.get_league(league_code)
  self.sport_config = registry.get_sport(self.league_config.sport_code)
  ```
- [ ] Pass to `_make_snapshot()` methods

**Files Modified**: 1
- `src/demo/simulator.py`

**Validation**:
```bash
python app.py --demo --sim --once
```

---

### Phase 6: Update Renderer & Scenes (1 hour)

**Step 6.1**: Update `src/render/scenes/_helpers.py`
- [ ] Remove `infer_team_sport()` function (no longer needed)
- [ ] Add helper to get sport/league from snapshot directly:
  ```python
  def get_sport_code(snap: GameSnapshot) -> str:
      return snap.sport.code

  def get_league_code(snap: GameSnapshot) -> str:
      return snap.league.code
  ```

**Step 6.2**: Update `src/render/scenes/pregame.py`
- [ ] Remove `infer_team_sport()` calls (lines 17-18, 45-46)
- [ ] Use `snap.sport.code` and `snap.league.code` directly
- [ ] Use `snap.sport.terminology.game_start_term` instead of hardcoded "Drop"/"Tip" (lines 48-51)
- [ ] Access logos with sport from snapshot: `get_logo(..., sport=snap.sport.code, ...)`

**Step 6.3**: Update `src/render/scenes/live.py`
- [ ] Remove `infer_team_sport()` calls (lines 23, 35)
- [ ] Use `snap.sport.code` directly
- [ ] Use `snap.period_name` instead of `snap.status_detail` fallback (lines 49-52)

**Step 6.4**: Update `src/render/scenes/final.py`
- [ ] Same pattern as live.py

**Step 6.5**: Update `src/render/scenes/live_big.py`
- [ ] Same pattern as live.py

**Files Modified**: 5
- `src/render/scenes/_helpers.py`
- `src/render/scenes/pregame.py`
- `src/render/scenes/live.py`
- `src/render/scenes/final.py`
- `src/render/scenes/live_big.py`

**Validation**:
```bash
python app.py --sim --once
python app.py --demo --sim --once
```

---

### Phase 7: Update Adaptive Refresh (10 min)

**Step 7.1**: Update `src/runtime/adaptive_refresh.py`
- [ ] Verify `GameSnapshot` import is from `src.model.game`
- [ ] Update `_last_game_snapshot` type hint if needed (line 34)
- [ ] No functional changes needed (model changes are additive)

**Files Modified**: 1
- `src/runtime/adaptive_refresh.py`

**Validation**: Type check passes

---

### Phase 8: Cleanup & Deprecation (30 min)

**Step 8.1**: Delete unused code
- [ ] Delete `src/model/sport_game.py` entirely
  - Contains: `EnhancedGameSnapshot`, `SportTeam`, `GameTiming`, `SportSituation`
  - Contains broken conversion functions with undefined `SportType`
  - No longer referenced after previous phases

**Step 8.2**: Update imports in remaining files
- [ ] Search for any remaining `sport_game` imports:
  ```bash
  rg "from src.model.sport_game import" --files-with-matches
  ```
- [ ] Replace with `from src.model.game import GameSnapshot`

**Step 8.3**: Delete legacy ESPN client
- [ ] Delete `src/data/espn.py` (duplicate of `leagues/wnba.py`)
- [ ] Delete `src/data/enhanced_espn.py` if exists

**Step 8.4**: Update `src/sports/adapter.py` if needed
- [ ] Check if file uses old models
- [ ] Update or delete if obsolete

**Files Modified/Deleted**: 3-4
- DELETE: `src/model/sport_game.py`
- DELETE: `src/data/espn.py`
- DELETE: `src/data/enhanced_espn.py` (if exists)
- UPDATE: `src/sports/adapter.py` (if needed)

---

### Phase 9: Testing & Validation (1 hour)

**Step 9.1**: Manual testing
- [ ] Test simulation mode: `python app.py --sim --once`
- [ ] Test demo mode: `python app.py --demo --sim --once`
- [ ] Test multi-league demo: `python app.py --demo --demo-league wnba --demo-league nhl --sim`
- [ ] Verify output images in `out/frame.png`
- [ ] Check all scenes render correctly: pregame, live, final

**Step 9.2**: Verify no import errors
```bash
python -c "from src.model.game import GameSnapshot, TeamSide, GameState"
python -c "from src.sports.clients.base import LeagueClient"
python -c "from src.sports.leagues.wnba import WNBAClient"
python -c "from src.sports.leagues.nhl import NHLClient"
python -c "from src.sports.league_aggregator import LeagueAggregator"
python -c "from src.demo.simulator import DemoSimulator"
python -c "from src.render.renderer import Renderer"
```

**Step 9.3**: Type checking
```bash
cd /Users/stevebargelt/code/wnba-led-scoreboard
python -m mypy src/model/game.py
python -m mypy src/sports/clients/base.py
python -m mypy src/sports/league_aggregator.py
python -m mypy app.py
```

**Step 9.4**: Integration test with live data (if possible)
- [ ] Set valid `DEVICE_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Run: `python app.py --once` (no --demo, no --sim)
- [ ] Verify Supabase config loads
- [ ] Verify league games fetch correctly
- [ ] Check for any runtime errors

---

## Migration Checklist Summary

### Files to Modify (15 files)
- [x] `src/model/game.py` - Add sport/league fields
- [ ] `src/sports/clients/base.py` - Remove LeagueGameSnapshot
- [ ] `src/sports/leagues/wnba.py` - Use GameSnapshot
- [ ] `src/sports/leagues/nhl.py` - Use GameSnapshot
- [ ] `src/sports/leagues/nba.py` - Use GameSnapshot
- [ ] `src/sports/league_aggregator.py` - Use GameSnapshot
- [ ] `app.py` - Remove conversion logic
- [ ] `src/demo/simulator.py` - Use GameSnapshot
- [ ] `src/render/scenes/_helpers.py` - Remove infer_team_sport
- [ ] `src/render/scenes/pregame.py` - Use snapshot.sport/league
- [ ] `src/render/scenes/live.py` - Use snapshot.sport/league
- [ ] `src/render/scenes/final.py` - Use snapshot.sport/league
- [ ] `src/render/scenes/live_big.py` - Use snapshot.sport/league
- [ ] `src/runtime/adaptive_refresh.py` - Verify imports
- [ ] `src/sports/adapter.py` - Update if needed

### Files to Delete (3+ files)
- [ ] `src/model/sport_game.py`
- [ ] `src/data/espn.py`
- [ ] `src/data/enhanced_espn.py`
- [ ] `src/demo/simulator_old.py` (cleanup)

### Key Benefits After Consolidation

1. **No Manual Conversions** - Sport/league context preserved throughout
2. **Single Source of Truth** - One `GameSnapshot` model everyone uses
3. **Type Safety** - No `Optional[SportConfig]` - always present
4. **Simplified Code** - Remove 300+ lines of duplicate/conversion code
5. **Better Rendering** - Direct access to sport configs for terminology
6. **Easier Testing** - Consistent model across all components

### Risk Mitigation

- **Backup before starting**: `git checkout -b consolidate-game-models`
- **Phase-by-phase validation**: Test after each phase
- **Rollback plan**: Revert to main if issues arise
- **Demo mode testing**: Verify changes don't break simulation

### Estimated Total Time

- **Phases 1-9**: 8-12 hours total
- **Can be done incrementally** over 2-3 sessions
- **Each phase is independently testable**

---

## Post-Consolidation Tasks

After successful consolidation:

1. **Update Tests** - Ensure unit tests use new unified model
2. **Documentation** - Update CLAUDE.md to reflect single model
3. **Type Hints** - Run mypy strict mode and fix any issues
4. **Performance** - Verify no performance regression from larger model
5. **Web Admin** - Check if any API responses need updates

---

## Success Criteria

- [ ] Zero import errors for `GameSnapshot` in all modules
- [ ] `app.py --sim --once` runs without errors
- [ ] `app.py --demo --sim --once` runs without errors
- [ ] All render scenes display correctly
- [ ] No `LeagueGameSnapshot` or `EnhancedGameSnapshot` references remain
- [ ] Type checking passes with no errors
- [ ] All deleted files removed from git