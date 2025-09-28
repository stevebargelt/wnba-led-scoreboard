"""
Board manager for orchestrating board lifecycle and transitions.
"""

import os
import importlib
import importlib.util
from pathlib import Path
from typing import Dict, Optional, List, Any
from queue import Queue
from PIL import Image, ImageDraw

from src.boards.base import BoardBase
from src.boards.builtins.scoreboard import ScoreboardFactory
from src.config.supabase_config_loader import DeviceConfiguration


class BoardManager:
    """Manages board lifecycle, transitions, and selection."""

    def __init__(self, config: DeviceConfiguration):
        """
        Initialize board manager with device configuration.

        Args:
            config: Device configuration from Supabase
        """
        self.config = config
        self.boards: Dict[str, BoardBase] = {}
        self.current_board: Optional[BoardBase] = None
        self.board_history: List[str] = []
        self.interrupts: Queue = Queue()
        self._last_context: Optional[Dict[str, Any]] = None

        # Load all boards
        self._load_builtin_boards()
        self._load_plugin_boards()

        print(f"[BoardManager] Loaded {len(self.boards)} boards")

    def _load_builtin_boards(self):
        """Load all built-in boards from src/boards/builtins/"""
        # Get board configurations from device config
        # For now, use defaults
        board_configs = getattr(self.config, 'board_configs', {})

        # Load sport-specific scoreboards
        for sport_code in ['hockey', 'basketball']:
            board_config = board_configs.get(f'scoreboard_{sport_code}', {
                'enabled': True,
                'priority': 100,  # High priority for game boards
                'refresh_rate': 2.0,
                'logo_variant': self.config.render_config.logo_variant,
                'live_layout': self.config.render_config.live_layout,
            })
            board_key = f'scoreboard_{sport_code}'
            self.boards[board_key] = ScoreboardFactory.create_scoreboard(
                sport_code, board_config
            )
            print(f"[BoardManager] Loaded {board_key}")

        # Load generic scoreboard as fallback
        generic_config = board_configs.get('scoreboard_generic', {
            'enabled': True,
            'priority': 90,
            'refresh_rate': 2.0,
            'logo_variant': self.config.render_config.logo_variant,
            'live_layout': self.config.render_config.live_layout,
        })
        self.boards['scoreboard_generic'] = ScoreboardFactory.create_scoreboard(
            'generic', generic_config
        )

        # Future: Load other built-in boards (Clock, Standings, etc.)
        # self._load_clock_board(board_configs)
        # self._load_standings_board(board_configs)

    def _load_plugin_boards(self):
        """Dynamically load user-created boards from src/boards/plugins/"""
        plugins_dir = Path("src/boards/plugins")
        if not plugins_dir.exists():
            return

        for plugin_dir in plugins_dir.iterdir():
            if not plugin_dir.is_dir():
                continue

            board_file = plugin_dir / "board.py"
            if not board_file.exists():
                continue

            try:
                # Load the plugin module
                module_name = f"src.boards.plugins.{plugin_dir.name}.board"
                spec = importlib.util.spec_from_file_location(module_name, board_file)
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)

                    # Find the board class (should inherit from BoardBase)
                    for item_name in dir(module):
                        item = getattr(module, item_name)
                        if (isinstance(item, type) and
                            issubclass(item, BoardBase) and
                            item != BoardBase):
                            # Found a board class, instantiate it
                            config_file = plugin_dir / "config.json"
                            config = {}
                            if config_file.exists():
                                import json
                                with open(config_file) as f:
                                    config = json.load(f)

                            board_instance = item(config)
                            board_key = f"plugin_{plugin_dir.name}"
                            self.boards[board_key] = board_instance
                            print(f"[BoardManager] Loaded plugin board: {board_key}")
                            break

            except Exception as e:
                print(f"[BoardManager] Failed to load plugin {plugin_dir.name}: {e}")

    def get_next_board(self, context: Dict[str, Any]) -> Optional[BoardBase]:
        """
        Select the next board to display based on context and priority.

        Args:
            context: Runtime context with game state, time, etc.

        Returns:
            Board to display or None
        """
        self._last_context = context

        # Check for interrupts (user input, alerts, etc.)
        if not self.interrupts.empty():
            interrupt = self.interrupts.get()
            if interrupt and interrupt in self.boards:
                return self.boards[interrupt]

        # Special handling for game snapshots - select sport-specific scoreboard
        game_snapshot = context.get('game_snapshot')
        if game_snapshot:
            sport_code = game_snapshot.sport.code if game_snapshot.sport else 'generic'
            board_key = f'scoreboard_{sport_code}'

            # Try sport-specific board first
            if board_key in self.boards and self.boards[board_key].enabled:
                board = self.boards[board_key]
                if board.should_display(context):
                    return board

            # Fall back to generic scoreboard
            if 'scoreboard_generic' in self.boards:
                board = self.boards['scoreboard_generic']
                if board.enabled and board.should_display(context):
                    return board

        # No game, find highest priority board that wants to display
        eligible_boards = []
        for board_key, board in self.boards.items():
            if board.enabled and board.should_display(context):
                eligible_boards.append((board.priority, board_key, board))

        if eligible_boards:
            # Sort by priority (highest first)
            eligible_boards.sort(reverse=True)
            return eligible_boards[0][2]

        return None

    def transition_to(self, board: BoardBase):
        """
        Handle transition from current board to new board.

        Args:
            board: New board to transition to
        """
        # Exit current board
        if self.current_board and self.current_board != board:
            self.current_board.on_exit()
            self.board_history.append(self.current_board.name)

        # Enter new board
        if board != self.current_board:
            board.on_enter()
            self.current_board = board

    def handle_interrupt(self, interrupt_type: str, data: Any = None):
        """
        Handle interrupts like button presses or alerts.

        Args:
            interrupt_type: Type of interrupt
            data: Optional interrupt data
        """
        # Pass to current board first
        if self.current_board:
            handled = self.current_board.handle_input(interrupt_type, data)
            if handled:
                return

        # Board didn't handle it, queue for manager processing
        if interrupt_type == 'force_board' and data:
            # Force switch to specific board
            self.interrupts.put(data)

    def render_current(self, buffer: Image.Image, draw: ImageDraw.Draw):
        """
        Render the current active board.

        Args:
            buffer: PIL Image buffer to render to
            draw: ImageDraw object for the buffer
        """
        if self.current_board and self._last_context:
            # Update board state before rendering
            self.current_board.update(self._last_context)
            # Render the board
            self.current_board.render(buffer, draw, self._last_context)

    def get_current_refresh_rate(self) -> float:
        """
        Get refresh rate for current board.

        Returns:
            Refresh interval in seconds
        """
        if self.current_board:
            return self.current_board.get_refresh_rate()
        return 10.0  # Default refresh rate