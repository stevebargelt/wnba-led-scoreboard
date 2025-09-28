# Boards Model Implementation Plan

## Overview
This document outlines the implementation of a modular, plugin-based boards system for the multi-league LED scoreboard, inspired by the [nhl-led-scoreboard](https://github.com/falkyre/nhl-led-scoreboard) project. This architecture will provide better modularity, extensibility, and state management for displaying different types of content on the LED matrix.

## Documentation

- **[Plugin Development Guide](boards-plugin-guide.md)**: Step-by-step guide for creating custom boards
- **Architecture Overview**: This document
- **API Reference**: See code documentation in `src/boards/base.py`

## Motivation

The current system uses a simple scene-based rendering approach with separate functions for pregame, live, and final states. While functional, this approach has limitations:

- **Limited Extensibility**: Adding new display types requires modifying core code
- **No Plugin Support**: Users cannot easily add custom displays
- **Rigid State Management**: Transitions between displays are hardcoded
- **Limited Customization**: Display sequences and priorities are not configurable

The boards model addresses these limitations by providing a flexible, plugin-based architecture.

## Architecture Overview

### Core Concepts

1. **Board**: A self-contained display module that knows how to render specific content
   - Each board is independent and reusable
   - Boards handle their own data fetching and caching
   - Can be enabled/disabled via configuration

2. **Board Manager**: Orchestrates board loading, selection, and transitions
   - Loads built-in and plugin boards dynamically
   - Manages board lifecycle (enter/exit callbacks)
   - Handles board selection based on context and priority

3. **Board State**: Tracks current display state and manages transitions
   - Maintains state machine for different display modes
   - Provides context to boards for decision making
   - Manages transition animations between boards

4. **Board Priority**: Determines which board to display based on context
   - Each board has a configurable priority value
   - Higher priority boards are preferred when multiple boards are eligible
   - Sport-specific scoreboards selected automatically based on game sport

5. **Board Interrupts**: Handles user interactions and alerts
   - Button presses can trigger board changes
   - Alert boards can override normal rotation
   - Manual overrides for testing specific boards

### Board Hierarchy

```
BoardBase (Abstract)
├── BaseScoreboardBoard (Abstract)
│   ├── HockeyScoreboardBoard      # NHL, periods, OT/SO
│   ├── BasketballScoreboardBoard  # WNBA/NBA, quarters
│   ├── BaseballScoreboardBoard    # MLB, innings, bases
│   └── FootballScoreboardBoard    # NFL/CFB, downs
├── ClockBoard                     # Time/date display
├── StandingsBoard                 # League standings
├── ScheduleBoard                  # Upcoming games
├── TeamStatsBoard                 # Team statistics
└── [Custom Plugin Boards]         # User-created boards
```

## Implementation Details

### 1. Board Base Class (`src/boards/base.py`)

```python
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from PIL import Image, ImageDraw
from datetime import datetime
from src.model.game import GameSnapshot

class BoardBase(ABC):
    """Abstract base class for all display boards."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.enabled = config.get('enabled', True)
        self.priority = config.get('priority', 0)
        self.duration = config.get('duration', 10)  # seconds

    @abstractmethod
    def render(self,
               buffer: Image.Image,
               draw: ImageDraw.Draw,
               context: Dict[str, Any]) -> None:
        """Render the board content to the buffer."""
        pass

    @abstractmethod
    def should_display(self, context: Dict[str, Any]) -> bool:
        """Determine if this board should be displayed given the context."""
        pass

    def update(self, context: Dict[str, Any]) -> None:
        """Update board state with new context data."""
        pass

    def on_enter(self) -> None:
        """Called when this board becomes active."""
        pass

    def on_exit(self) -> None:
        """Called when switching away from this board."""
        pass
```

### 2. Board Manager (`src/boards/manager.py`)

```python
class BoardManager:
    """Manages board lifecycle, transitions, and selection."""

    def __init__(self, config: DeviceConfiguration):
        self.config = config
        self.boards: Dict[str, BoardBase] = {}
        self.current_board: Optional[BoardBase] = None
        self.board_history: List[str] = []
        self.interrupts: Queue = Queue()

        self._load_builtin_boards()
        self._load_plugin_boards()

    def _load_builtin_boards(self):
        """Load all built-in boards from src/boards/builtins/"""
        # Load non-sport boards
        self.boards['clock'] = ClockBoard(self.config.board_configs.get('clock', {}))
        self.boards['standings'] = StandingsBoard(self.config.board_configs.get('standings', {}))

        # Load sport-specific scoreboards
        for sport_code in ['hockey', 'basketball', 'baseball', 'football']:
            board_config = self.config.board_configs.get(f'scoreboard_{sport_code}', {})
            self.boards[f'scoreboard_{sport_code}'] = ScoreboardFactory.create_scoreboard(
                sport_code, board_config
            )

    def _load_plugin_boards(self):
        """Dynamically load user-created boards from src/boards/plugins/"""

    def get_next_board(self, context: Dict[str, Any]) -> Optional[BoardBase]:
        """Select the next board to display based on context and priority."""
        # If there's a game, select appropriate sport scoreboard
        game_snapshot = context.get('game_snapshot')
        if game_snapshot:
            sport_code = game_snapshot.sport.code
            board_key = f'scoreboard_{sport_code}'
            if board_key in self.boards:
                return self.boards[board_key]
            # Fallback to generic scoreboard if sport-specific not available
            return self.boards.get('scoreboard_base')

    def transition_to(self, board: BoardBase):
        """Handle transition from current board to new board."""

    def handle_interrupt(self, interrupt_type: str, data: Any):
        """Handle interrupts like button presses or alerts."""

    def render_current(self, buffer: Image.Image, draw: ImageDraw.Draw):
        """Render the current active board."""
```

### 3. Built-in Boards

#### Sport-Specific Scoreboards (`src/boards/builtins/scoreboard/`)
Each sport has unique display requirements, so we'll use sport-specific scoreboards inheriting from a base.

##### Base Scoreboard (`src/boards/builtins/scoreboard/base.py`)
```python
class BaseScoreboardBoard(BoardBase):
    """Base class for all sport scoreboards."""

    def should_display(self, context):
        return context.get('game_snapshot') is not None

    def render(self, buffer, draw, context):
        snapshot = context['game_snapshot']
        if snapshot.state == GameState.PRE:
            self._render_pregame(buffer, draw, snapshot)
        elif snapshot.state == GameState.LIVE:
            self._render_live(buffer, draw, snapshot)
        else:
            self._render_final(buffer, draw, snapshot)

    # Abstract methods for sport-specific implementations
    @abstractmethod
    def _render_pregame(self, buffer, draw, snapshot):
        pass

    @abstractmethod
    def _render_live(self, buffer, draw, snapshot):
        pass

    @abstractmethod
    def _render_final(self, buffer, draw, snapshot):
        pass
```

##### Hockey Scoreboard (`src/boards/builtins/scoreboard/hockey.py`)
```python
class HockeyScoreboardBoard(BaseScoreboardBoard):
    """NHL/hockey-specific scoreboard with periods, OT, shootout."""

    def _render_live(self, buffer, draw, snapshot):
        # Display period (1st, 2nd, 3rd, OT, SO)
        # Show time remaining in period
        # Display penalties/power play status
        # Show shots on goal if available
```

##### Basketball Scoreboard (`src/boards/builtins/scoreboard/basketball.py`)
```python
class BasketballScoreboardBoard(BaseScoreboardBoard):
    """WNBA/NBA-specific scoreboard with quarters and shot clock."""

    def _render_live(self, buffer, draw, snapshot):
        # Display quarter (1st, 2nd, 3rd, 4th, OT)
        # Show game clock and shot clock
        # Display timeouts remaining
        # Show team fouls if available
```

##### Baseball Scoreboard (`src/boards/builtins/scoreboard/baseball.py`)
```python
class BaseballScoreboardBoard(BaseScoreboardBoard):
    """MLB-specific scoreboard with innings, outs, and bases."""

    def _render_live(self, buffer, draw, snapshot):
        # Display inning (Top/Bot 1st-9th, Extra)
        # Show outs, balls, strikes
        # Display base runners
        # Show line score (runs by inning)
```

##### Football Scoreboard (`src/boards/builtins/scoreboard/football.py`)
```python
class FootballScoreboardBoard(BaseScoreboardBoard):
    """NFL/CFB-specific scoreboard with quarters and downs."""

    def _render_live(self, buffer, draw, snapshot):
        # Display quarter (1st, 2nd, 3rd, 4th, OT)
        # Show game clock and play clock
        # Display down and distance
        # Show possession indicator
```

##### Scoreboard Factory (`src/boards/builtins/scoreboard/factory.py`)
```python
class ScoreboardFactory:
    """Factory to create appropriate scoreboard for sport."""

    SPORT_SCOREBOARDS = {
        'hockey': HockeyScoreboardBoard,
        'basketball': BasketballScoreboardBoard,
        'baseball': BaseballScoreboardBoard,
        'football': FootballScoreboardBoard,
    }

    @classmethod
    def create_scoreboard(cls, sport_code: str, config: Dict[str, Any]):
        """Create sport-specific scoreboard or fallback to base."""
        board_class = cls.SPORT_SCOREBOARDS.get(sport_code, BaseScoreboardBoard)
        return board_class(config)
```

#### Clock Board (`src/boards/builtins/clock/`)
Display time and date when no games are active.

```python
class ClockBoard(BoardBase):
    """Display current time and date."""

    def should_display(self, context):
        return context.get('game_snapshot') is None

    def render(self, buffer, draw, context):
        now = context['current_time']
        # Render clock display
```

#### Standings Board (`src/boards/builtins/standings/`)
Show league standings for favorite teams.

```python
class StandingsBoard(BoardBase):
    """Display league standings."""

    def should_display(self, context):
        return context.get('state') in ['idle', 'postgame']

    def render(self, buffer, draw, context):
        # Fetch and render standings
```

### 4. Plugin Architecture

Plugins follow this structure:
```
src/boards/plugins/
└── my_custom_board/
    ├── __init__.py
    ├── board.py        # Contains MyCustomBoard class
    └── config.json     # Optional configuration
```

Example custom board:
```python
# src/boards/plugins/team_news/board.py
from src.boards.base import BoardBase

class TeamNewsBoard(BoardBase):
    """Display latest news for favorite teams."""

    def should_display(self, context):
        return context.get('state') == 'idle'

    def render(self, buffer, draw, context):
        # Fetch and display team news
```

### 5. State Management

The board manager maintains state and handles transitions:

```python
class BoardState(Enum):
    IDLE = "idle"
    PREGAME = "pregame"
    LIVE = "live"
    INTERMISSION = "intermission"
    POSTGAME = "postgame"
    ALERT = "alert"

class StateManager:
    """Manages board state transitions."""

    def __init__(self):
        self.current_state = BoardState.IDLE
        self.state_sequences = {
            BoardState.IDLE: ['clock', 'standings', 'schedule'],
            BoardState.PREGAME: ['scoreboard', 'team_stats'],
            BoardState.LIVE: ['scoreboard'],
            BoardState.POSTGAME: ['scoreboard', 'standings']
        }

    def get_board_sequence(self) -> List[str]:
        """Get the board sequence for current state."""
        return self.state_sequences.get(self.current_state, [])
```

### 6. Configuration Integration

Board configuration in Supabase:

```python
@dataclass
class BoardConfig:
    """Configuration for a specific board."""
    name: str
    enabled: bool
    priority: int
    duration: int  # Display duration in seconds
    settings: Dict[str, Any]  # Board-specific settings

@dataclass
class BoardSequence:
    """Sequence of boards for a specific state."""
    state: str
    boards: List[str]
    cycle_time: int  # Time to cycle through all boards
```

### 7. Database Schema

```sql
-- Board configuration per device
CREATE TABLE device_boards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    board_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 10,  -- seconds
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(device_id, board_name)
);

-- Board display sequences for different states
CREATE TABLE device_board_sequences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    state TEXT NOT NULL CHECK (state IN ('idle', 'pregame', 'live', 'intermission', 'postgame')),
    board_sequence TEXT[] NOT NULL,
    cycle_time INTEGER DEFAULT 60,  -- seconds to cycle through all boards
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(device_id, state)
);

-- Create indexes
CREATE INDEX idx_device_boards_device_id ON device_boards(device_id);
CREATE INDEX idx_device_board_sequences_device_id ON device_board_sequences(device_id);
```

## Migration Strategy

### Phase 1: Foundation (Week 1)
1. Create BoardBase abstract class
2. Create BaseScoreboardBoard abstract class for all sports
3. Implement BoardManager with basic functionality
4. Create HockeyScoreboardBoard and BasketballScoreboardBoard using existing scene code
5. Implement ScoreboardFactory for sport selection
6. Test with existing app.py integration

### Phase 2: Core Boards (Week 2)
1. Convert all existing scenes to boards
2. Implement ClockBoard for idle display
3. Add state management and transitions
4. Test complete board lifecycle

### Phase 3: Extended Boards (Week 3)
1. Add StandingsBoard
2. Add ScheduleBoard
3. Implement TeamStatsBoard

### Phase 4: Configuration (Week 4)
1. Add database schema for board configuration
2. Update web admin for board management
3. Implement plugin loading system
4. Document plugin creation

## Integration with Existing Code

Update `app.py` to use BoardManager:

```python
from src.boards.manager import BoardManager

def main():
    # Initialize board manager
    board_manager = BoardManager(device_config)

    while True:
        # Update context
        context = {
            'game_snapshot': snapshot,
            'current_time': now_local,
            'state': determine_state(snapshot),
            'favorite_teams': device_config.favorite_teams
        }

        # Let board manager handle display
        board = board_manager.get_next_board(context)
        if board:
            board.render(renderer._buffer, renderer._draw, context)
            renderer.flush()
```

## Benefits

1. **Modularity**: Each board is self-contained with its own logic
2. **Sport-Specific Displays**: Each sport gets optimized layouts (hockey periods vs basketball quarters)
3. **Extensibility**: Easy to add new board types without modifying core
4. **Customization**: Users can create and share custom boards
5. **Configuration**: Web admin control over board behavior
6. **State Management**: Clear, predictable state transitions
7. **Reusability**: Boards can be shared between users
8. **Testing**: Each board can be tested independently
9. **Future Sports**: Adding new leagues/sports just requires a new scoreboard subclass

## Example Custom Boards

### Social Media Board
Display tweets/posts about favorite teams

### Fantasy Stats Board
Show fantasy sports statistics

### Birthday Board
Display player birthdays

### Historical Stats Board
Show this day in team history

### Betting Odds Board
Display current betting lines

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create `src/boards/base.py` with `BoardBase` abstract class
- [ ] Create `src/boards/builtins/scoreboard/base.py` with `BaseScoreboardBoard`
- [ ] Implement `src/boards/builtins/scoreboard/hockey.py` for NHL games
- [ ] Implement `src/boards/builtins/scoreboard/basketball.py` for WNBA/NBA games
- [ ] Create `src/boards/builtins/scoreboard/factory.py` for sport selection
- [ ] Implement `src/boards/manager.py` with `BoardManager` class
- [ ] Update `app.py` to use `BoardManager` instead of direct scene rendering
- [ ] Test with existing games

### Phase 2: Core Boards
- [ ] Implement `src/boards/builtins/clock/` for idle display
- [ ] Implement `src/boards/state.py` for state management
- [ ] Add transition animations between boards
- [ ] Convert remaining sports to board architecture

### Phase 3: Extended Boards
- [ ] Implement `src/boards/builtins/standings/`
- [ ] Implement `src/boards/builtins/schedule/`
- [ ] Implement `src/boards/builtins/team_stats/`
- [ ] Create example plugin board

### Phase 4: Configuration
- [ ] Add database migrations for board configuration
- [ ] Update web admin UI for board management
- [ ] Implement plugin discovery and loading
- [ ] Write comprehensive documentation

## Testing Strategy

### Unit Tests
- Test each board's `should_display()` logic
- Test render methods with mock data
- Test state transitions
- Test priority calculations

### Integration Tests
- Test board manager with multiple boards
- Test sport-specific scoreboard selection
- Test plugin loading
- Test configuration updates

### Hardware Tests
- Test on actual LED matrix
- Verify smooth transitions
- Check performance with multiple boards
- Test memory usage with plugins

## Migration Path

### For Users
1. System continues working with existing configuration
2. New boards appear automatically as they're added
3. Web admin shows new board configuration options
4. Existing scenes seamlessly converted to boards

### For Developers
1. Existing scene code moved into board classes
2. Minimal changes to rendering logic
3. New boards follow simple template
4. Plugin system enables community contributions

## Performance Considerations

### Memory Management
- Boards loaded on-demand
- Unused boards can be unloaded
- Image caching for frequently used assets
- Lazy loading of plugin boards

### Rendering Optimization
- Only active board renders
- Pre-render static content
- Cache rendered frames for static boards
- Efficient image compositing

### Data Fetching
- Boards manage their own caching
- Shared data sources for efficiency
- Background updates for slow APIs
- Graceful degradation on failures

## Security Considerations

### Plugin Safety
- Plugins run in same process (no sandboxing initially)
- Configuration validation before loading
- Resource limits for plugin operations
- Audit logging for plugin actions

### Future Enhancements
- Plugin sandboxing with separate processes
- Plugin marketplace with verified boards
- Digital signatures for trusted plugins
- Resource quotas per plugin

## Conclusion

The boards model provides a robust, extensible architecture that will grow with the project. It maintains backward compatibility while enabling new features and customization options. The plugin system allows the community to contribute boards without modifying core code, fostering an ecosystem of display options.

### Key Advantages

1. **Modularity**: Clean separation of concerns
2. **Sport-Specific**: Optimized displays for each sport
3. **Extensibility**: Easy to add new boards and sports
4. **Community**: Plugin system enables contributions
5. **Maintainability**: Well-organized, testable code
6. **Performance**: Efficient resource usage
7. **User Control**: Full configuration via web admin

### Success Metrics

- Zero regression in existing functionality
- 50% reduction in code duplication
- Support for 10+ board types within 3 months
- Community contributions of custom boards
- Improved user satisfaction with customization options