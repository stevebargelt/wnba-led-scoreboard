import unittest
from datetime import timedelta

from src.demo.simulator import DemoSimulator, NHLDemoSimulator, WNBADemoSimulator, parse_demo_options
from src.config.multi_sport_types import (
    SportFavorites,
    create_default_multi_sport_config,
    convert_multi_sport_to_legacy,
)
from src.config.types import FavoriteTeam
from src.sports.base import SportType
from src.model.game import GameState


class DemoSimulatorTests(unittest.TestCase):
    def _enable_sport(self, cfg, sport: SportType, favorites: list[FavoriteTeam]) -> None:
        for sport_cfg in cfg.sports:
            if sport_cfg.sport == sport:
                sport_cfg.enabled = True
                if favorites:
                    sport_cfg.teams = favorites
                break
        else:
            cfg.sports.append(
                SportFavorites(sport=sport, enabled=True, priority=len(cfg.sports) + 1, teams=favorites)
            )
        cfg.enabled_sports = cfg.get_enabled_sports()

    def test_wnba_demo_transitions(self) -> None:
        cfg = create_default_multi_sport_config()
        legacy = convert_multi_sport_to_legacy(cfg)
        demo = DemoSimulator(cfg, legacy)
        simulator = demo.simulators[0]
        self.assertIsInstance(simulator, WNBADemoSimulator)

        start = simulator._start_time  # type: ignore[attr-defined]
        pre_snapshot = demo.get_snapshot(start - timedelta(seconds=5))
        self.assertIsNotNone(pre_snapshot)
        self.assertEqual(pre_snapshot.state, GameState.PRE)

        live_snapshot = demo.get_snapshot(start + timedelta(seconds=5))
        self.assertIsNotNone(live_snapshot)
        self.assertEqual(live_snapshot.state, GameState.LIVE)

        final_snapshot = demo.get_snapshot(
            start
            + timedelta(seconds=WNBADemoSimulator.period_seconds * WNBADemoSimulator.period_count + 60)
        )
        self.assertIsNotNone(final_snapshot)
        self.assertEqual(final_snapshot.state, GameState.FINAL)

    def test_rotation_between_sports(self) -> None:
        cfg = create_default_multi_sport_config()
        self._enable_sport(
            cfg,
            SportType.NHL,
            [
                FavoriteTeam(name="Seattle Kraken", id="55", abbr="SEA"),
                FavoriteTeam(name="Vancouver Canucks", id="23", abbr="VAN"),
            ],
        )
        legacy = convert_multi_sport_to_legacy(cfg)
        options = parse_demo_options(rotation_seconds=1, forced_sports=["wnba", "nhl"])
        demo = DemoSimulator(cfg, legacy, options=options)
        self.assertEqual(len(demo.simulators), 2)

        start = demo.simulators[0]._start_time  # type: ignore[attr-defined]
        first_snapshot = demo.get_snapshot(start)
        self.assertIsNotNone(first_snapshot)
        first_index = demo._current_index

        later = start + timedelta(seconds=2)
        second_snapshot = demo.get_snapshot(later)
        self.assertIsNotNone(second_snapshot)
        second_index = demo._current_index
        self.assertNotEqual(first_index, second_index)

    def test_nhl_demo_reaches_final(self) -> None:
        cfg = create_default_multi_sport_config()
        # Disable WNBA to focus on NHL only
        for sport_cfg in cfg.sports:
            sport_cfg.enabled = False
        self._enable_sport(
            cfg,
            SportType.NHL,
            [
                FavoriteTeam(name="Seattle Kraken", id="55", abbr="SEA"),
                FavoriteTeam(name="Edmonton Oilers", id="22", abbr="EDM"),
            ],
        )
        legacy = convert_multi_sport_to_legacy(cfg)
        options = parse_demo_options(rotation_seconds=0, forced_sports=["nhl"])
        demo = DemoSimulator(cfg, legacy, options=options)
        simulator = demo.simulators[0]
        self.assertIsInstance(simulator, NHLDemoSimulator)

        # Keep scores level to drive overtime/shootout path deterministically
        simulator._home.score = 2  # type: ignore[attr-defined]
        simulator._away.score = 2  # type: ignore[attr-defined]
        simulator._next_score_time = simulator._start_time + timedelta(days=1)  # type: ignore[attr-defined]

        regulation_end = (
            simulator._start_time  # type: ignore[attr-defined]
            + timedelta(seconds=NHLDemoSimulator.regulation_periods * NHLDemoSimulator.regulation_period_seconds)
        )
        overtime_snapshot = demo.get_snapshot(regulation_end + timedelta(seconds=60))
        self.assertIsNotNone(overtime_snapshot)
        self.assertEqual(overtime_snapshot.state, GameState.LIVE)

        final_snapshot = demo.get_snapshot(regulation_end + timedelta(seconds=NHLDemoSimulator.overtime_seconds + 300))
        self.assertIsNotNone(final_snapshot)
        self.assertEqual(final_snapshot.state, GameState.FINAL)
        self.assertIn(final_snapshot.status_detail.lower(), {"final", "final/ot", "final/so"})


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
