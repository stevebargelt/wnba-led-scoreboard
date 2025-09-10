# NHL Integration & Multi-Sport Architecture Plan

## 🎯 Project Goals

Add **NHL game support** to the existing WNBA LED scoreboard while creating a **scalable multi-sport architecture** that supports future expansion to NBA, MLB, NFL, and other sports.

## 🔍 Research Findings

### NHL API Analysis
- **Base URL**: `https://api-web.nhle.com/v1/`
- **Key Endpoints**: 
  - `/score/now` - Current live scores
  - `/score/{YYYY-MM-DD}` - Scores for specific date
  - `/schedule/{YYYY-MM-DD}` - Schedule for specific date
- **Update Frequency**: ~1 minute (similar to ESPN)
- **Game Structure**: 3 periods (20 min each) + overtime/shootouts
- **Season**: October-June (overlaps with WNBA: May-October)

### Sport Differences Comparison

| Aspect | WNBA | NHL | NBA | MLB | NFL |
|--------|------|-----|-----|-----|-----|
| **Periods** | 4 quarters (10 min) | 3 periods (20 min) + OT | 4 quarters (12 min) | 9 innings | 4 quarters (15 min) |
| **Overtime** | 5 min | 3-on-3 + shootout | 5 min | Extra innings | 10 min (playoff) |
| **Season** | May-Oct | Oct-Jun | Oct-Jun | Mar-Oct | Sep-Feb |
| **API** | ESPN | NHL.com | ESPN/NBA | ESPN/MLB | ESPN/NFL |

### Current System Architecture Strengths
- ✅ **Resilience Infrastructure**: Circuit breaker, caching, fallbacks
- ✅ **Web Admin Interface**: Remote management and configuration
- ✅ **Adaptive Performance**: Smart refresh rates and network monitoring  
- ✅ **Type Safety**: Comprehensive TypeScript and Python typing
- ✅ **Hot Configuration Reload**: Live updates without restart

## 🏗️ Multi-Sport Architecture Design

### Core Principles
1. **Sport Agnostic Foundation**: Common interfaces that work across all sports
2. **Backward Compatibility**: Existing WNBA functionality unchanged
3. **Extensible Design**: Easy addition of new sports without major refactoring
4. **Unified Web Admin**: Single interface for all sport management
5. **Intelligent Conflict Resolution**: Smart priority system for overlapping games

### Architecture Components

#### 1. Sport Abstraction Layer

```python
# New: src/sports/base.py
class SportType(Enum):
    WNBA = "wnba"
    NHL = "nhl" 
    NBA = "nba"     # Future
    MLB = "mlb"     # Future
    NFL = "nfl"     # Future

@dataclass  
class SportGameSnapshot:
    """Universal game snapshot that works across all sports."""
    sport: SportType
    event_id: str
    start_time_local: datetime
    state: GameState
    home: TeamSide
    away: TeamSide
    
    # Sport-agnostic timing
    current_period: int
    period_name: str          # "Q1", "P2", "T9", "4th", etc.
    display_clock: str
    seconds_to_start: int = -1
    status_detail: str = ""
    
    # Sport-specific extensions
    sport_specific_data: Dict[str, Any] = field(default_factory=dict)

class SportClient(ABC):
    """Abstract base class for sport-specific API clients."""
    
    @abstractmethod
    def get_sport_type(self) -> SportType:
        pass
        
    @abstractmethod  
    def fetch_games(self, target_date: date) -> List[SportGameSnapshot]:
        pass
        
    @abstractmethod
    def get_team_assets_url(self) -> str:
        pass
```

#### 2. Enhanced Configuration Model

```python
# Updated: src/config/types.py  
@dataclass
class SportFavorites:
    sport: SportType
    teams: List[FavoriteTeam]
    enabled: bool = True
    priority: int = 1           # Lower number = higher priority

@dataclass
class SportPriorityConfig:
    """Handles conflicts between multiple active sports."""
    sport_priorities: List[SportFavorites]
    conflict_resolution: str = "priority"  # "priority", "live_first", "manual"
    live_game_boost: bool = True          # Live games get priority boost
    favorite_team_boost: bool = True      # Favorite teams get priority boost

@dataclass
class MultiSportConfig:
    sports: List[SportFavorites]
    sport_priority: SportPriorityConfig  
    timezone: str
    matrix: MatrixConfig
    refresh: RefreshConfig
    render: RenderConfig = field(default_factory=RenderConfig)
    tz: Optional[ZoneInfo] = None
```

#### 3. Multi-Sport Data Aggregation

```python
# New: src/sports/aggregator.py
class MultiSportAggregator:
    """Aggregates game data from multiple sports and resolves priorities."""
    
    def __init__(self, config: MultiSportConfig):
        self.config = config
        self.sport_clients: Dict[SportType, SportClient] = {}
        self._setup_sport_clients()
    
    def get_featured_game(self, now_local: datetime) -> Optional[SportGameSnapshot]:
        """Get the highest priority game across all enabled sports."""
        all_games = self._fetch_all_games(now_local.date())
        return self._resolve_game_priority(all_games, now_local)
    
    def _resolve_game_priority(self, games: List[SportGameSnapshot], now_local: datetime) -> Optional[SportGameSnapshot]:
        """Intelligent priority resolution across sports and teams."""
        # Implementation details in plan below...
```

#### 4. NHL-Specific Implementation

```python
# New: src/sports/nhl.py
class NHLClient(SportClient):
    """NHL API client using resilient HTTP infrastructure."""
    
    def fetch_games(self, target_date: date) -> List[SportGameSnapshot]:
        """Fetch NHL games and convert to SportGameSnapshot format."""
        # Use existing resilient_client infrastructure
        # Parse NHL-specific JSON format
        # Handle periods, overtime, shootouts
        
    def _parse_nhl_game(self, nhl_data: dict) -> SportGameSnapshot:
        """Convert NHL API format to universal SportGameSnapshot."""
        # Handle NHL-specific: periods, penalty situations, overtime
```

## 📋 Implementation Plan

### Phase 1: Multi-Sport Foundation (Week 1)

#### 1.1 Sport Abstraction Layer
- **Create**: `src/sports/base.py` - SportType enum, SportClient interface
- **Create**: `src/sports/aggregator.py` - Multi-sport game aggregation
- **Create**: `src/model/sport_game.py` - Enhanced sport-agnostic data models
- **Update**: `src/config/types.py` - Multi-sport configuration structure

#### 1.2 WNBA Migration to New Architecture  
- **Create**: `src/sports/wnba.py` - WNBA implementation of SportClient
- **Update**: `src/data/enhanced_espn.py` - Integrate with SportClient interface
- **Test**: Ensure WNBA functionality unchanged after migration

### Phase 2: NHL Integration (Week 2)

#### 2.1 NHL API Client
- **Create**: `src/sports/nhl.py` - NHL SportClient implementation
- **Create**: `src/data/nhl_api.py` - NHL API client using resilient infrastructure
- **Implement**: NHL-specific game parsing (periods, overtime, shootouts)
- **Add**: NHL team asset fetching script

#### 2.2 Priority Resolution System
- **Create**: `src/select/multi_sport_selector.py` - Cross-sport game selection
- **Implement**: Intelligent conflict resolution algorithm
- **Update**: `app.py` - Integrate multi-sport aggregator
- **Test**: WNBA vs NHL priority scenarios

### Phase 3: Web Admin Multi-Sport UI (Week 3)

#### 3.1 Backend API Extensions
- **Update**: Database schema for multi-sport configuration
- **Create**: API endpoints for sport management
- **Implement**: Real-time sport switching via Supabase

#### 3.2 Frontend Multi-Sport Interface
- **Create**: Sport management components
- **Implement**: Priority configuration interface
- **Add**: Live sport switching controls
- **Update**: Device configuration forms

## 🔧 Technical Implementation Details

### Sport Priority Algorithm

```python
def resolve_game_priority(games: List[SportGameSnapshot], config: SportPriorityConfig) -> SportGameSnapshot:
    """
    Priority resolution algorithm:
    1. Group by sport type
    2. Apply sport-level priorities  
    3. Within each sport, apply favorite team priorities
    4. Boost live games if enabled
    5. Use conflict resolution strategy (priority/live_first/manual)
    """
    
    # Example priority calculation:
    for game in games:
        base_score = config.get_sport_priority(game.sport) * 1000
        
        if game.state == GameState.LIVE:
            base_score += 500 if config.live_game_boost else 0
            
        if is_favorite_team(game, config):
            base_score += 200 if config.favorite_team_boost else 0
            
        game.priority_score = base_score
        
    return max(games, key=lambda g: g.priority_score)
```

### Configuration Migration Strategy

#### Current Configuration (favorites.json)
```json
{
  "favorites": [
    {"name": "Seattle Storm", "id": "18", "abbr": "SEA"}
  ]
}
```

#### New Multi-Sport Configuration
```json
{
  "sports": [
    {
      "sport": "wnba",
      "enabled": true,
      "priority": 1,
      "favorites": [
        {"name": "Seattle Storm", "id": "18", "abbr": "SEA"}
      ]
    },
    {
      "sport": "nhl", 
      "enabled": true,
      "priority": 2,
      "favorites": [
        {"name": "Seattle Kraken", "id": "55", "abbr": "SEA"}
      ]
    }
  ],
  "sport_priority": {
    "conflict_resolution": "priority",
    "live_game_boost": true,
    "favorite_team_boost": true
  }
}
```

### Web Admin Interface Design

#### Sport Management Dashboard
- **Sport Toggle Cards**: Enable/disable individual sports
- **Priority Drag-and-Drop**: Visual sport priority ordering
- **Favorite Teams per Sport**: Expandable team selection interfaces  
- **Conflict Preview**: Real-time view of current priority resolution
- **Manual Override**: Emergency sport switching button

#### Live Status Display
- **Current Game Info**: Show which sport/game is active and why
- **Available Games**: List all current games across sports with priorities
- **Switch Game**: Manual override to show different sport/game
- **Priority Explanation**: Clear explanation of why current game was chosen

## 🔮 Future Sports Expansion Framework

### MLB Integration (Future)
- **Timing**: 9 innings + extra innings
- **API**: ESPN MLB or MLB Stats API
- **Display**: Inning number, outs, runners on base
- **Season**: March-October (overlaps with WNBA/NHL)

### NBA Integration (Future) 
- **Timing**: 4 quarters (12 min) + overtime
- **API**: ESPN NBA or NBA Stats API  
- **Display**: Similar to WNBA but different timing
- **Season**: October-June (same as NHL)

### NFL Integration (Future)
- **Timing**: 4 quarters (15 min) + overtime
- **API**: ESPN NFL or NFL API
- **Display**: Quarter, down & distance, time remaining
- **Season**: September-February

### Sport Plugin Architecture (Future)
```python
# src/sports/plugins/
class SportPlugin(SportClient):
    """Plugin interface for community-contributed sports."""
    
    def get_plugin_info(self) -> SportPluginInfo:
        return SportPluginInfo(
            name="Custom League",
            version="1.0.0", 
            author="Community",
            supported_features=["live_scores", "schedules"]
        )
```

## 🧪 Testing Strategy

### Phase 1 Testing
- **Unit Tests**: Sport interface implementations
- **Integration Tests**: Multi-sport aggregation logic
- **Regression Tests**: WNBA functionality unchanged
- **Configuration Tests**: Backward compatibility validation

### Phase 2 Testing  
- **NHL API Tests**: Mock NHL API responses and error scenarios
- **Priority Resolution Tests**: Various WNBA vs NHL conflict scenarios
- **End-to-End Tests**: Full multi-sport workflow validation
- **Performance Tests**: Multiple concurrent API calls

### Phase 3 Testing
- **Web Admin Tests**: Multi-sport UI components and interactions
- **Real-time Tests**: Live sport switching and configuration updates
- **User Experience Tests**: Priority configuration usability
- **Integration Tests**: Full stack multi-sport functionality

## 📊 Success Metrics

### Technical Metrics
- **Zero Breaking Changes**: Existing WNBA deployments continue working
- **API Performance**: Multi-sport aggregation < 2x single sport latency
- **Test Coverage**: Maintain >30% coverage for new components
- **Configuration Migration**: Automatic upgrade from single to multi-sport config

### User Experience Metrics  
- **Setup Simplicity**: NHL enablement in <5 clicks via web admin
- **Conflict Resolution**: Clear priority explanations in web interface
- **Responsive Switching**: Sport priority changes reflected within 1 refresh cycle
- **Documentation Quality**: Complete setup guide for multi-sport configuration

## ⚖️ Risk Mitigation

### Technical Risks
- **API Compatibility**: NHL API changes breaking integration
  - *Mitigation*: Same resilience patterns as ESPN (caching, fallbacks)
- **Performance Impact**: Multiple API calls causing slowdown
  - *Mitigation*: Concurrent fetching, sport-specific caching strategies
- **Configuration Complexity**: Multi-sport config too complex for users
  - *Mitigation*: Sensible defaults, guided setup wizard, backward compatibility

### User Experience Risks  
- **Feature Confusion**: Too many options overwhelming users
  - *Mitigation*: Progressive disclosure, optional advanced features
- **Breaking Existing Setups**: Current users lose functionality
  - *Mitigation*: Automatic config migration, extensive regression testing
- **Priority Resolution Confusion**: Users don't understand game selection
  - *Mitigation*: Clear explanations, preview mode, manual override

## 🛣️ Implementation Timeline

### Week 1: Foundation
- **Days 1-2**: Sport abstraction layer and data models
- **Days 3-4**: WNBA migration to new architecture 
- **Days 5-6**: Multi-sport aggregation system
- **Day 7**: Testing and validation

### Week 2: NHL Integration
- **Days 1-2**: NHL API client and game parsing
- **Days 3-4**: Priority resolution system
- **Days 5-6**: NHL asset management and display
- **Day 7**: End-to-end testing

### Week 3: Web Admin Enhancement  
- **Days 1-2**: Database schema and backend API updates
- **Days 3-4**: Multi-sport UI components
- **Days 5-6**: Priority configuration interface
- **Day 7**: Full system testing and documentation

## 🔧 Configuration Examples

### Simple Single-Sport (Backward Compatible)
```json
{
  "favorites": [
    {"name": "Seattle Storm", "abbr": "SEA"}
  ],
  "timezone": "America/Los_Angeles"
}
```
*Automatically migrated to multi-sport format with WNBA as only enabled sport.*

### Multi-Sport Configuration
```json
{
  "sports": [
    {
      "sport": "wnba",
      "enabled": true, 
      "priority": 1,
      "favorites": [
        {"name": "Seattle Storm", "id": "18", "abbr": "SEA"},
        {"name": "Las Vegas Aces", "id": "26", "abbr": "LVA"}
      ]
    },
    {
      "sport": "nhl",
      "enabled": true,
      "priority": 2, 
      "favorites": [
        {"name": "Seattle Kraken", "id": "55", "abbr": "SEA"},
        {"name": "Vegas Golden Knights", "id": "54", "abbr": "VGK"}
      ]
    }
  ],
  "sport_priority": {
    "conflict_resolution": "priority",
    "live_game_boost": true,
    "favorite_team_boost": true
  },
  "timezone": "America/Los_Angeles"
}
```

### Web Admin Sport Priority Interface
```typescript
interface SportPriorityConfig {
  sports: SportConfig[]
  conflictResolution: 'priority' | 'live_first' | 'manual'
  liveGameBoost: boolean
  favoriteTeamBoost: boolean
}

interface SportConfig {
  sport: SportType
  enabled: boolean
  priority: number
  favorites: FavoriteTeam[]
}
```

## 🎨 Display Adaptations

### Sport-Specific Display Elements

#### NHL Adaptations
- **Period Display**: "P1", "P2", "P3", "OT", "SO" instead of quarters
- **Clock Format**: MM:SS countdown (vs MM:SS.T in basketball)  
- **Overtime Handling**: 3-on-3 OT, shootout indicators
- **Penalty Situations**: Power play indicators (optional)

#### Future Sport Considerations
- **MLB**: Inning number, outs, runners on base
- **NFL**: Down & distance, field position, timeouts remaining
- **NBA**: Similar to WNBA with different timing

### Unified Display Engine
```python
# Updated: src/render/sport_renderer.py
class SportAwareRenderer:
    """Renders games with sport-specific adaptations."""
    
    def render_live_game(self, game: SportGameSnapshot) -> None:
        if game.sport == SportType.WNBA:
            self._render_basketball_live(game)
        elif game.sport == SportType.NHL:  
            self._render_hockey_live(game)
        # Future sports...
            
    def _get_period_display(self, game: SportGameSnapshot) -> str:
        """Get sport-appropriate period display."""
        sport_formats = {
            SportType.WNBA: lambda p: f"Q{p}",
            SportType.NHL: lambda p: f"P{p}" if p <= 3 else "OT",
            SportType.NBA: lambda p: f"Q{p}",
            # Future formats...
        }
        return sport_formats[game.sport](game.current_period)
```

## 🌐 Web Admin Enhancements

### Multi-Sport Dashboard
1. **Sport Overview Cards**: Show enabled sports with current status
2. **Live Game Monitor**: Real-time view of games across all sports
3. **Priority Configuration**: Drag-and-drop sport priority interface
4. **Team Management**: Per-sport favorite team configuration
5. **Conflict Resolution**: Visual explanation of current game selection

### Sport Priority Interface
```typescript
// New: web-admin/src/components/sports/SportPriorityConfig.tsx
export function SportPriorityConfig() {
  return (
    <div className="space-y-6">
      <SportEnableToggles />
      <DragDropPriorityList />
      <ConflictResolutionSettings />
      <LiveGamePreview />
      <ManualOverrideButton />
    </div>
  )
}
```

### Database Schema Updates
```sql
-- Add sport support to existing tables
ALTER TABLE public.devices ADD COLUMN enabled_sports jsonb DEFAULT '["wnba"]';
ALTER TABLE public.configs ADD COLUMN sport_config jsonb;

-- New table for sport-specific team assets
CREATE TABLE public.sport_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport sport_type NOT NULL,
  external_id text NOT NULL,
  name text NOT NULL,
  abbreviation text NOT NULL,
  colors jsonb,
  logo_urls jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(sport, external_id)
);
```

## 🚀 Getting Started

### For Developers
1. **Understand Current System**: Review existing WNBA implementation
2. **Study NHL API**: Examine NHL data format and differences
3. **Design Sport Interface**: Plan your SportClient implementation
4. **Test-Driven Development**: Write tests before implementation

### For Users (After Implementation)
1. **Enable NHL**: Toggle NHL in web admin interface  
2. **Add Favorite Teams**: Configure NHL teams via web interface
3. **Set Sport Priorities**: Decide WNBA vs NHL preference
4. **Test Conflict Resolution**: Verify priority system works as expected

## 📚 Reference Materials

- **NHL LED Scoreboard Project**: https://github.com/falkyre/nhl-led-scoreboard
- **NHL API Documentation**: https://gitlab.com/dword4/nhlapi  
- **Current WNBA Implementation**: `src/data/enhanced_espn.py`
- **Resilience Infrastructure**: `src/data/resilient_client.py`
- **Game Selection Logic**: `src/select/choose.py`

## ✅ Success Criteria

### Must Have
- ✅ **NHL games display correctly** with periods, overtime, shootouts
- ✅ **WNBA functionality preserved** - zero breaking changes for existing users
- ✅ **Intelligent priority resolution** - clear logic for WNBA vs NHL conflicts  
- ✅ **Web admin sport management** - easy NHL enablement and team configuration
- ✅ **Resilience maintained** - NHL API failures handled gracefully

### Should Have
- ✅ **Future-ready architecture** - easy addition of NBA, MLB, NFL
- ✅ **Performance optimization** - concurrent API fetching, smart caching
- ✅ **Enhanced conflict resolution** - multiple resolution strategies
- ✅ **Comprehensive testing** - full coverage of multi-sport scenarios
- ✅ **Migration tools** - automatic config upgrade for existing users

### Could Have  
- 📅 **Advanced scheduling** - sport season awareness for automatic enabling/disabling
- 🎨 **Sport-specific themes** - different color schemes and layouts per sport
- 📊 **Analytics dashboard** - usage statistics across sports
- 🔄 **Auto-rotation** - cycle between active games across sports
- 🏆 **Playoff awareness** - enhanced priority during championship games

---

*This plan provides a comprehensive roadmap for integrating NHL support while building a scalable foundation for future multi-sport expansion. The architecture maintains all existing WNBA functionality while adding powerful new capabilities for sport priority management and conflict resolution.*