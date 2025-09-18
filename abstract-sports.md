# Sports and Leagues Abstraction Architecture

## Overview

This document outlines the comprehensive plan to refactor the current flat sports implementation into a hierarchical structure with sports as top-level containers and leagues as specific implementations. This architecture enables shared sport-level rules while allowing league-specific overrides.

## Current State

The application currently uses a flat `SportType` enum (WNBA, NHL, NBA, MLB, NFL) where each league is treated as a separate sport. This leads to:
- Duplicated logic for sports that share rules (e.g., NBA and WNBA both use quarters)
- Hardcoded sport-specific logic scattered throughout the codebase
- Difficulty adding new leagues for existing sports
- No clear separation between sport rules and league-specific variations

## Proposed Architecture

### Hierarchy Structure

```
Sport (Abstract Container)
├── Hockey
│   ├── NHL (National Hockey League)
│   ├── WHL (Western Hockey League)
│   ├── PWHL (Professional Women's Hockey League)
│   └── AHL (American Hockey League)
├── Basketball
│   ├── NBA (National Basketball Association)
│   ├── WNBA (Women's National Basketball Association)
│   ├── NCAA Men's Basketball
│   └── NCAA Women's Basketball
├── Soccer
│   ├── MLS (Major League Soccer)
│   ├── NWSL (National Women's Soccer League)
│   └── Premier League
├── Football
│   ├── NFL (National Football League)
│   ├── NCAA Football
│   └── CFL (Canadian Football League)
└── Baseball
    ├── MLB (Major League Baseball)
    └── MiLB (Minor League Baseball)
```

## Core Components

### 1. Sport Configuration Model

```python
# src/sports/models/sport_config.py

from dataclasses import dataclass
from enum import Enum
from typing import Optional, Dict, Any

class PeriodType(Enum):
    QUARTER = "quarter"
    PERIOD = "period"
    HALF = "half"
    INNING = "inning"
    SET = "set"

class ClockDirection(Enum):
    COUNT_DOWN = "down"  # Basketball, Hockey, Football
    COUNT_UP = "up"      # Soccer
    NONE = "none"        # Baseball

@dataclass
class TimingConfig:
    """Sport-level timing configuration"""
    period_type: PeriodType
    regulation_periods: int
    period_duration_minutes: float  # Can be fractional for seconds
    clock_direction: ClockDirection
    has_overtime: bool
    overtime_duration_minutes: Optional[float] = None
    has_shootout: bool = False  # Hockey specific
    has_sudden_death: bool = False
    intermission_duration_minutes: float = 15.0

    # Display formatting
    period_name_format: str = "{type}{number}"  # e.g., "Q{number}", "P{number}"
    overtime_name: str = "OT"

@dataclass
class ScoringConfig:
    """Sport-level scoring configuration"""
    scoring_types: Dict[str, int]  # e.g., {"goal": 1, "safety": 2, "touchdown": 6}
    default_score_value: int = 1

@dataclass
class TerminologyConfig:
    """Sport-specific terminology"""
    game_start_term: str  # "Tip", "Drop", "Kickoff", "First Pitch"
    period_end_term: str  # "End of Quarter", "End of Period"
    game_end_term: str    # "Final", "Full Time"
    overtime_term: str    # "Overtime", "Extra Time"

@dataclass
class SportConfig:
    """Complete sport configuration"""
    name: str
    code: str  # e.g., "hockey", "basketball"
    timing: TimingConfig
    scoring: ScoringConfig
    terminology: TerminologyConfig

    # Optional sport-specific extensions
    extensions: Dict[str, Any] = None
```

### 2. League Configuration Model

```python
# src/sports/models/league_config.py

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from datetime import date

@dataclass
class LeagueAPIConfig:
    """League-specific API configuration"""
    base_url: str
    endpoints: Dict[str, str]
    rate_limit_per_minute: int = 60
    cache_ttl_seconds: int = 300

@dataclass
class LeagueSeason:
    """League season information"""
    start_date: date
    end_date: date
    playoff_start: Optional[date] = None
    is_active: bool = True

@dataclass
class LeagueConfig:
    """League-specific configuration with sport overrides"""
    name: str
    code: str  # e.g., "nhl", "wnba"
    sport_code: str  # Reference to parent sport

    # API configuration
    api: LeagueAPIConfig

    # Season information
    current_season: Optional[LeagueSeason] = None

    # Optional overrides of sport-level configurations
    timing_overrides: Optional[Dict[str, Any]] = None
    scoring_overrides: Optional[Dict[str, Any]] = None
    terminology_overrides: Optional[Dict[str, Any]] = None

    # League-specific data
    team_count: int = 0
    conference_structure: Optional[Dict[str, List[str]]] = None

    def get_effective_timing(self, sport_timing: TimingConfig) -> TimingConfig:
        """Merge sport timing with league overrides"""
        if not self.timing_overrides:
            return sport_timing

        # Create copy and apply overrides
        config_dict = sport_timing.__dict__.copy()
        config_dict.update(self.timing_overrides)
        return TimingConfig(**config_dict)
```

### 3. Sport Registry Implementation

```python
# src/sports/registry.py

from typing import Dict, Optional, Type
from .models.sport_config import SportConfig
from .models.league_config import LeagueConfig

class SportRegistry:
    """Central registry for sports and leagues"""

    def __init__(self):
        self._sports: Dict[str, SportConfig] = {}
        self._leagues: Dict[str, LeagueConfig] = {}
        self._league_clients: Dict[str, Type['LeagueClient']] = {}

    def register_sport(self, sport: SportConfig) -> None:
        """Register a sport configuration"""
        self._sports[sport.code] = sport

    def register_league(self, league: LeagueConfig, client_class: Type['LeagueClient']) -> None:
        """Register a league with its API client"""
        if league.sport_code not in self._sports:
            raise ValueError(f"Sport {league.sport_code} not registered")

        self._leagues[league.code] = league
        self._league_clients[league.code] = client_class

    def get_sport(self, sport_code: str) -> Optional[SportConfig]:
        """Get sport configuration"""
        return self._sports.get(sport_code)

    def get_league(self, league_code: str) -> Optional[LeagueConfig]:
        """Get league configuration"""
        return self._leagues.get(league_code)

    def get_league_client(self, league_code: str) -> Optional[Type['LeagueClient']]:
        """Get league API client class"""
        return self._league_clients.get(league_code)

    def get_leagues_for_sport(self, sport_code: str) -> List[LeagueConfig]:
        """Get all leagues for a sport"""
        return [
            league for league in self._leagues.values()
            if league.sport_code == sport_code
        ]

# Global registry instance
registry = SportRegistry()
```

### 4. League Client Base Class

```python
# src/sports/clients/base.py

from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import date
from ..models.league_config import LeagueConfig
from ..models.sport_config import SportConfig

class LeagueClient(ABC):
    """Base class for league-specific API clients"""

    def __init__(self, league: LeagueConfig, sport: SportConfig):
        self.league = league
        self.sport = sport
        self.effective_timing = league.get_effective_timing(sport.timing)
        self.effective_scoring = self._merge_config(sport.scoring, league.scoring_overrides)
        self.effective_terminology = self._merge_config(sport.terminology, league.terminology_overrides)

    @abstractmethod
    def fetch_games(self, target_date: date) -> List['SportGameSnapshot']:
        """Fetch games for the target date"""
        pass

    @abstractmethod
    def fetch_teams(self) -> List[Dict[str, Any]]:
        """Fetch team information"""
        pass

    def _merge_config(self, base_config, overrides: Optional[Dict]):
        """Helper to merge configurations"""
        if not overrides:
            return base_config
        merged = base_config.__dict__.copy()
        merged.update(overrides)
        return type(base_config)(**merged)
```

## Sport Definitions

### Hockey Sport Configuration

```python
# src/sports/definitions/hockey.py

HOCKEY_SPORT = SportConfig(
    name="Hockey",
    code="hockey",
    timing=TimingConfig(
        period_type=PeriodType.PERIOD,
        regulation_periods=3,
        period_duration_minutes=20,
        clock_direction=ClockDirection.COUNT_DOWN,
        has_overtime=True,
        overtime_duration_minutes=5,
        has_shootout=True,
        has_sudden_death=True,
        intermission_duration_minutes=18,
        period_name_format="P{number}",
        overtime_name="OT",
    ),
    scoring=ScoringConfig(
        scoring_types={"goal": 1},
        default_score_value=1,
    ),
    terminology=TerminologyConfig(
        game_start_term="Puck Drop",
        period_end_term="End of Period",
        game_end_term="Final",
        overtime_term="Overtime",
    ),
)
```

### Basketball Sport Configuration

```python
# src/sports/definitions/basketball.py

BASKETBALL_SPORT = SportConfig(
    name="Basketball",
    code="basketball",
    timing=TimingConfig(
        period_type=PeriodType.QUARTER,
        regulation_periods=4,
        period_duration_minutes=12,  # Default NBA/WNBA
        clock_direction=ClockDirection.COUNT_DOWN,
        has_overtime=True,
        overtime_duration_minutes=5,
        has_shootout=False,
        has_sudden_death=False,
        intermission_duration_minutes=15,
        period_name_format="Q{number}",
        overtime_name="OT",
    ),
    scoring=ScoringConfig(
        scoring_types={
            "free_throw": 1,
            "field_goal": 2,
            "three_pointer": 3,
        },
        default_score_value=2,
    ),
    terminology=TerminologyConfig(
        game_start_term="Tip Off",
        period_end_term="End of Quarter",
        game_end_term="Final",
        overtime_term="Overtime",
    ),
)
```

## League Implementations

### NHL League Configuration

```python
# src/sports/leagues/nhl.py

NHL_LEAGUE = LeagueConfig(
    name="National Hockey League",
    code="nhl",
    sport_code="hockey",
    api=LeagueAPIConfig(
        base_url="https://api-web.nhle.com/v1",
        endpoints={
            "scoreboard": "/score/{date}",
            "teams": "/teams",
            "standings": "/standings",
        },
        rate_limit_per_minute=60,
        cache_ttl_seconds=300,
    ),
    team_count=32,
    conference_structure={
        "Eastern": ["Metropolitan", "Atlantic"],
        "Western": ["Central", "Pacific"],
    },
    # NHL uses 3-on-3 OT in regular season
    timing_overrides={
        "overtime_duration_minutes": 5,
        "has_shootout": True,
    },
)

class NHLClient(LeagueClient):
    """NHL-specific API client"""

    def fetch_games(self, target_date: date) -> List[SportGameSnapshot]:
        # Implementation specific to NHL API
        pass

    def fetch_teams(self) -> List[Dict[str, Any]]:
        # Implementation specific to NHL API
        pass
```

### WNBA League Configuration

```python
# src/sports/leagues/wnba.py

WNBA_LEAGUE = LeagueConfig(
    name="Women's National Basketball Association",
    code="wnba",
    sport_code="basketball",
    api=LeagueAPIConfig(
        base_url="http://site.api.espn.com/apis/site/v2/sports/basketball/wnba",
        endpoints={
            "scoreboard": "/scoreboard",
            "teams": "/teams",
            "standings": "/standings",
        },
        rate_limit_per_minute=60,
        cache_ttl_seconds=300,
    ),
    team_count=12,
    # WNBA uses 10-minute quarters
    timing_overrides={
        "period_duration_minutes": 10,
    },
)

class WNBAClient(LeagueClient):
    """WNBA-specific API client"""
    # Implementation...
```

## Web Admin Interface

### New Route: `/admin/sports-leagues`

The web admin will have a dedicated interface for managing sports and leagues configuration.

#### Features:

1. **Sport Management**
   - View all registered sports
   - Edit sport-level default configurations
   - Preview timing, scoring, and terminology settings

2. **League Management**
   - Add/remove leagues for each sport
   - Configure league-specific overrides
   - Test API connections
   - View team rosters

3. **Visual Hierarchy Editor**
   - Drag-and-drop interface to organize sports and leagues
   - Visual indication of inherited vs overridden settings
   - Real-time preview of configuration effects

#### UI Components

```typescript
// web-admin/src/components/sports/SportLeagueManager.tsx

interface SportDefinition {
  code: string
  name: string
  timing: TimingConfig
  scoring: ScoringConfig
  terminology: TerminologyConfig
}

interface LeagueDefinition {
  code: string
  name: string
  sportCode: string
  api: APIConfig
  overrides?: {
    timing?: Partial<TimingConfig>
    scoring?: Partial<ScoringConfig>
    terminology?: Partial<TerminologyConfig>
  }
}

export function SportLeagueManager() {
  const [sports, setSports] = useState<SportDefinition[]>([])
  const [leagues, setLeagues] = useState<LeagueDefinition[]>([])

  return (
    <div className="sport-league-manager">
      <SportHierarchy sports={sports} leagues={leagues} />
      <ConfigurationEditor />
      <PreviewPanel />
    </div>
  )
}
```

### Database Schema Updates

```sql
-- Sports table
CREATE TABLE sports (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leagues table
CREATE TABLE leagues (
    code VARCHAR(50) PRIMARY KEY,
    sport_code VARCHAR(50) REFERENCES sports(code),
    name VARCHAR(100) NOT NULL,
    api_config JSONB NOT NULL,
    overrides JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table (updated)
CREATE TABLE teams (
    id VARCHAR(50) PRIMARY KEY,
    league_code VARCHAR(50) REFERENCES leagues(code),
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    logo_url TEXT,
    colors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(league_code, abbreviation)
);
```

## Implementation Plan

Since we're pre-release with no existing users, we can make a clean break from the current implementation:

### Direct Implementation Steps

1. **Replace SportType enum** with new Sport/League hierarchy
2. **Remove old API clients** and implement new LeagueClient pattern
3. **Update all references** throughout the codebase
4. **New configuration format** without backward compatibility concerns

### Clean Architecture Benefits

- No adapter layers needed
- No parallel implementations
- No feature flags
- Direct, clean codebase from the start
- Simpler testing (no legacy code paths)
```

## Configuration File Updates

### New Configuration Structure

The configuration will change from sport-based to league-based, with leagues inheriting from their parent sports:

```json
{
  "leagues": [
    {
      "league": "wnba",
      "sport": "basketball",
      "enabled": true,
      "priority": 1,
      "favorites": [
        {
          "id": "14",
          "abbr": "SEA",
          "name": "Seattle Storm"
        },
        {
          "id": "8",
          "abbr": "MIN",
          "name": "Minnesota Lynx"
        }
      ]
    },
    {
      "league": "nhl",
      "sport": "hockey",
      "enabled": true,
      "priority": 2,
      "favorites": [
        {
          "id": "55",
          "abbr": "SEA",
          "name": "Seattle Kraken"
        },
        {
          "id": "5",
          "abbr": "PIT",
          "name": "Pittsburgh Penguins"
        }
      ]
    },
    {
      "league": "nba",
      "sport": "basketball",
      "enabled": false,
      "priority": 3,
      "favorites": []
    },
    {
      "league": "pwhl",
      "sport": "hockey",
      "enabled": false,
      "priority": 4,
      "favorites": []
    }
  ],
  "matrix": {
    "width": 64,
    "height": 32,
    "parallel": 1,
    "pwm_bits": 11,
    "brightness": 80,
    "chain_length": 1,
    "gpio_slowdown": 2,
    "hardware_mapping": "adafruit-hat"
  },
  "render": {
    "live_layout": "stacked",
    "logo_variant": "mini"
  },
  "refresh": {
    "final_sec": 60,
    "ingame_sec": 5,
    "pregame_sec": 30
  },
  "timezone": "America/Los_Angeles"
}
```

This structure makes the sport-league relationship explicit while maintaining simplicity.

## Benefits of This Architecture

1. **Extensibility**: Easy to add new leagues for existing sports
2. **Maintainability**: Sport rules defined once, inherited by all leagues
3. **Flexibility**: League-specific overrides without code duplication
4. **Clarity**: Clear separation of concerns between sports and leagues
5. **Scalability**: Can easily add international leagues or minor leagues
6. **Configuration**: Sport and league settings manageable through web interface

## Testing Strategy

### Unit Tests
- Test sport configuration merging
- Test league override application
- Test registry operations

### Integration Tests
- Test league client implementations
- Test configuration persistence
- Test web admin CRUD operations

### End-to-End Tests
- Test complete flow from configuration to display
- Test failover and error handling
- Test multi-league game aggregation

## Implementation Timeline

- **Week 1**: Core models, registry, and sport definitions
- **Week 2**: League implementations (NHL, WNBA) with new structure
- **Week 3**: Web admin interface and configuration management
- **Week 4**: Testing and documentation

## Simplified Approach Benefits

| Benefit | Description |
|---------|-------------|
| Clean codebase | No legacy code or compatibility layers |
| Faster development | No migration complexity |
| Easier testing | Single code path to test |
| Better performance | No adapter overhead |
| Clear documentation | No need to document migration paths |

## Future Enhancements

1. **Multi-language support**: Terminology in different languages
2. **Custom leagues**: User-defined leagues with manual data entry
3. **League federation**: Group related leagues (e.g., all NCAA basketball)
4. **Season awareness**: Automatic league priority based on active seasons
5. **Rule variations**: Support for tournament-specific rules (playoffs vs regular season)

## Conclusion

This architecture provides a robust foundation for supporting multiple sports and leagues while maintaining clean separation of concerns and allowing for future growth. The hierarchical structure mirrors real-world sports organization and provides intuitive configuration management through the web admin interface.