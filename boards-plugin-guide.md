# Creating Custom Boards - Plugin Development Guide

This guide will help you create custom display boards for the LED scoreboard system. Custom boards allow you to display any content you want - weather, news, social media, custom animations, and more.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Board Architecture](#board-architecture)
3. [Creating Your First Board](#creating-your-first-board)
4. [Advanced Features](#advanced-features)
5. [Testing Your Board](#testing-your-board)
6. [Sharing Your Board](#sharing-your-board)

## Quick Start

### Minimal Board Example

Create a new folder in `src/boards/plugins/` with your board name:

```
src/boards/plugins/
└── hello_world/
    ├── __init__.py
    └── board.py
```

In `board.py`:

```python
from src.boards.base import BoardBase

class HelloWorldBoard(BoardBase):
    """Display a simple hello world message."""

    def should_display(self, context):
        """Show this board when idle."""
        return context.get('state') == 'idle'

    def render(self, buffer, draw, context):
        """Draw hello world on the LED matrix."""
        # Clear the buffer
        draw.rectangle([(0, 0), (buffer.width - 1, buffer.height - 1)], fill=(0, 0, 0))

        # Draw text
        draw.text((10, 10), "Hello World!", fill=(255, 255, 255))
```

That's it! Your board will automatically be loaded and displayed when the scoreboard is idle.

## Board Architecture

### BoardBase Class

All boards inherit from `BoardBase` which provides:

```python
class BoardBase(ABC):
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.enabled = config.get('enabled', True)
        self.priority = config.get('priority', 0)
        self.duration = config.get('duration', 10)  # seconds

    @abstractmethod
    def render(self, buffer: Image.Image, draw: ImageDraw.Draw, context: Dict[str, Any]) -> None:
        """Render your content to the LED matrix buffer."""
        pass

    @abstractmethod
    def should_display(self, context: Dict[str, Any]) -> bool:
        """Determine if this board should be shown given current context."""
        pass

    def update(self, context: Dict[str, Any]) -> None:
        """Optional: Update internal state with new data."""
        pass

    def on_enter(self) -> None:
        """Optional: Called when board becomes active."""
        pass

    def on_exit(self) -> None:
        """Optional: Called when switching away from board."""
        pass
```

### Context Dictionary

The `context` dictionary passed to your board contains:

```python
{
    'game_snapshot': GameSnapshot,     # Current game (if any)
    'current_time': datetime,           # Local time
    'state': str,                       # 'idle', 'pregame', 'live', 'postgame'
    'favorite_teams': Dict[str, List],  # User's favorite teams by league
    'device_config': DeviceConfiguration, # Full device configuration
}
```

## Creating Your First Board

### Step 1: Plan Your Board

Decide:
- **What to display**: Weather, news, custom graphics, etc.
- **When to display**: During idle, between games, specific times
- **Data sources**: APIs, local files, database
- **Update frequency**: How often data should refresh

### Step 2: Create Board Structure

```
src/boards/plugins/weather/
├── __init__.py
├── board.py
├── config.json (optional)
└── assets/ (optional)
    └── icons/
```

### Step 3: Implement the Board

```python
# src/boards/plugins/weather/board.py
import requests
from datetime import datetime, timedelta
from src.boards.base import BoardBase

class WeatherBoard(BoardBase):
    """Display current weather for configured location."""

    def __init__(self, config):
        super().__init__(config)
        self.api_key = config.get('api_key')
        self.location = config.get('location', 'New York')
        self.last_update = None
        self.weather_data = None
        self.update_interval = timedelta(minutes=30)

    def should_display(self, context):
        """Show weather when idle or between games."""
        return context.get('state') in ['idle', 'postgame']

    def update(self, context):
        """Fetch weather data if stale."""
        now = context['current_time']

        if not self.last_update or (now - self.last_update) > self.update_interval:
            self._fetch_weather()
            self.last_update = now

    def render(self, buffer, draw, context):
        """Render weather information."""
        # Update data if needed
        self.update(context)

        if not self.weather_data:
            self._render_error(draw)
            return

        # Clear background
        draw.rectangle([(0, 0), (63, 31)], fill=(0, 0, 0))

        # Draw temperature
        temp = f"{self.weather_data['temp']}°"
        draw.text((5, 5), temp, fill=(255, 255, 255))

        # Draw condition
        condition = self.weather_data['condition']
        draw.text((5, 15), condition, fill=(200, 200, 200))

        # Draw location
        draw.text((5, 25), self.location, fill=(150, 150, 150))

    def _fetch_weather(self):
        """Fetch weather from API."""
        try:
            # Example weather API call
            response = requests.get(
                f"https://api.weather.com/v1/current",
                params={'location': self.location, 'key': self.api_key},
                timeout=5
            )
            if response.ok:
                data = response.json()
                self.weather_data = {
                    'temp': data['temperature'],
                    'condition': data['condition'],
                    'icon': data['icon']
                }
        except Exception as e:
            print(f"Weather fetch failed: {e}")
            self.weather_data = None

    def _render_error(self, draw):
        """Show error when weather unavailable."""
        draw.text((10, 10), "Weather", fill=(255, 255, 255))
        draw.text((10, 20), "Unavailable", fill=(255, 0, 0))
```

### Step 4: Add Configuration (Optional)

Create `config.json` for default settings:

```json
{
  "enabled": true,
  "priority": 5,
  "duration": 15,
  "api_key": "",
  "location": "New York",
  "update_interval_minutes": 30,
  "show_forecast": false
}
```

## Advanced Features

### Using Animations

```python
class AnimatedLogoBoard(BoardBase):
    """Display animated team logo."""

    def __init__(self, config):
        super().__init__(config)
        self.frame = 0
        self.frames = []
        self._load_animation_frames()

    def render(self, buffer, draw, context):
        """Render current animation frame."""
        if self.frames:
            # Draw current frame
            buffer.paste(self.frames[self.frame], (0, 0))

            # Advance to next frame
            self.frame = (self.frame + 1) % len(self.frames)
```

### Responding to User Input

```python
class InteractiveBoard(BoardBase):
    """Board that responds to button presses."""

    def handle_input(self, button: str):
        """Handle button press events."""
        if button == 'up':
            self.scroll_up()
        elif button == 'down':
            self.scroll_down()
        elif button == 'select':
            self.select_item()
```

### Using Database Storage

```python
class StatsBoard(BoardBase):
    """Display statistics from database."""

    def __init__(self, config):
        super().__init__(config)
        self.supabase_client = config.get('supabase_client')

    def update(self, context):
        """Fetch latest stats from database."""
        try:
            response = self.supabase_client.table('game_stats')\
                .select('*')\
                .order('created_at', desc=True)\
                .limit(10)\
                .execute()
            self.stats = response.data
        except Exception as e:
            print(f"Stats fetch failed: {e}")
```

### Transitions and Effects

```python
class FadeTransitionBoard(BoardBase):
    """Board with fade in/out transitions."""

    def on_enter(self):
        """Fade in when board becomes active."""
        self.opacity = 0
        self.fade_direction = 1

    def on_exit(self):
        """Start fade out."""
        self.fade_direction = -1

    def render(self, buffer, draw, context):
        """Render with opacity."""
        # Update opacity
        self.opacity = max(0, min(255, self.opacity + self.fade_direction * 10))

        # Create temporary buffer for content
        temp_buffer = Image.new('RGBA', buffer.size, (0, 0, 0, 0))
        temp_draw = ImageDraw.Draw(temp_buffer)

        # Draw content to temp buffer
        self._render_content(temp_draw)

        # Apply opacity and composite
        temp_buffer.putalpha(self.opacity)
        buffer.paste(temp_buffer, (0, 0), temp_buffer)
```

## Testing Your Board

### Local Testing

1. **Simulation Mode**: Test without hardware
```bash
python app.py --sim
```

2. **Force Your Board**: Temporarily make your board high priority
```python
class MyTestBoard(BoardBase):
    def __init__(self, config):
        super().__init__(config)
        self.priority = 999  # Temporary high priority for testing
```

3. **Debug Output**: Add logging to understand behavior
```python
def render(self, buffer, draw, context):
    print(f"[MyBoard] Rendering with state: {context.get('state')}")
    # ... render logic
```

### Unit Testing

Create `test_board.py`:

```python
import unittest
from PIL import Image, ImageDraw
from src.boards.plugins.my_board.board import MyBoard

class TestMyBoard(unittest.TestCase):
    def setUp(self):
        self.config = {'enabled': True, 'priority': 5}
        self.board = MyBoard(self.config)
        self.buffer = Image.new('RGB', (64, 32))
        self.draw = ImageDraw.Draw(self.buffer)

    def test_should_display_when_idle(self):
        context = {'state': 'idle'}
        self.assertTrue(self.board.should_display(context))

    def test_render_without_errors(self):
        context = {'state': 'idle', 'current_time': datetime.now()}
        # Should not raise exception
        self.board.render(self.buffer, self.draw, context)

    def test_update_fetches_data(self):
        context = {'current_time': datetime.now()}
        self.board.update(context)
        self.assertIsNotNone(self.board.data)

if __name__ == '__main__':
    unittest.main()
```

## Sharing Your Board

### Package Your Board

1. **Create README**: Document requirements and configuration
2. **Include License**: Choose appropriate license (MIT, GPL, etc.)
3. **List Dependencies**: Note any required packages
4. **Provide Examples**: Show configuration examples

### Example Board Package

```
my_awesome_board/
├── README.md
├── LICENSE
├── requirements.txt
├── board.py
├── config.json
├── test_board.py
└── examples/
    └── config_example.json
```

### Publishing

1. **GitHub Repository**: Share as a git repository
2. **Forum Post**: Share on project forums
3. **Pull Request**: Submit to main project as built-in board

## Best Practices

### Performance

- **Cache Data**: Don't fetch on every render
- **Optimize Images**: Pre-process and cache images
- **Limit API Calls**: Respect rate limits
- **Use Threading**: For heavy operations

```python
def update(self, context):
    """Update data in background thread."""
    if self._should_update():
        thread = Thread(target=self._fetch_data_async)
        thread.daemon = True
        thread.start()
```

### Error Handling

- **Graceful Degradation**: Show something even if data fails
- **Timeout API Calls**: Prevent hanging
- **Log Errors**: Help users debug issues

```python
def _fetch_data(self):
    """Fetch with proper error handling."""
    try:
        response = requests.get(self.api_url, timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"[{self.__class__.__name__}] API error: {e}")
        return self._get_fallback_data()
    except Exception as e:
        print(f"[{self.__class__.__name__}] Unexpected error: {e}")
        return None
```

### User Experience

- **Smooth Transitions**: Avoid jarring changes
- **Readable Text**: Test on actual hardware
- **Color Contrast**: Ensure visibility
- **Loading States**: Show progress for slow operations

## Common Patterns

### Scrolling Text

```python
class ScrollingNewsBoard(BoardBase):
    def __init__(self, config):
        super().__init__(config)
        self.scroll_pos = 0
        self.text = "Breaking News: Your text here..."

    def render(self, buffer, draw, context):
        # Calculate text width
        text_width = draw.textlength(self.text)

        # Draw scrolling text
        draw.text((64 - self.scroll_pos, 10), self.text, fill=(255, 255, 255))

        # Update scroll position
        self.scroll_pos += 1
        if self.scroll_pos > text_width + 64:
            self.scroll_pos = 0
```

### Image Display

```python
class ImageBoard(BoardBase):
    def __init__(self, config):
        super().__init__(config)
        self.image = Image.open('path/to/image.png')
        self.image = self.image.resize((64, 32))

    def render(self, buffer, draw, context):
        buffer.paste(self.image, (0, 0))
```

### Data Visualization

```python
class GraphBoard(BoardBase):
    def render(self, buffer, draw, context):
        # Draw axes
        draw.line([(5, 5), (5, 27)], fill=(100, 100, 100))  # Y-axis
        draw.line([(5, 27), (59, 27)], fill=(100, 100, 100))  # X-axis

        # Plot data points
        for i, value in enumerate(self.data):
            x = 5 + (i * 5)
            y = 27 - int(value * 20 / max(self.data))
            draw.ellipse([(x-1, y-1), (x+1, y+1)], fill=(255, 0, 0))
```

## Troubleshooting

### Board Not Loading

1. Check file structure and naming
2. Verify no syntax errors: `python -m py_compile board.py`
3. Check logs for import errors
4. Ensure board class name matches file name

### Board Not Displaying

1. Check `should_display()` logic
2. Verify priority settings
3. Check enabled status in config
4. Review context state values

### Performance Issues

1. Profile render method timing
2. Cache expensive operations
3. Reduce API call frequency
4. Optimize image operations

## Resources

- **PIL/Pillow Docs**: https://pillow.readthedocs.io/
- **RGB Matrix Library**: https://github.com/hzeller/rpi-rgb-led-matrix
- **Example Boards**: `src/boards/builtins/` directory
- **Support**: Create an issue on GitHub

## Next Steps

1. Start with the Hello World example
2. Modify it to display something you want
3. Test in simulation mode
4. Share your creation with the community!

Remember: The best boards are ones that display information you personally find useful. Have fun creating!