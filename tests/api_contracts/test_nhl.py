"""
API contract tests for NHL API endpoints.

NHL game states:
  FUT  — future/scheduled: no periodDescriptor, no clock
  PRE  — pregame warmup: no periodDescriptor, no clock
  LIVE — in-progress: periodDescriptor and clock present
  CRIT — critical/overtime: periodDescriptor and clock present
  FINAL — final: periodDescriptor present, clock may be absent
  OFF  — official final: same as FINAL
"""

import requests
import pytest

# 2025 NHL Playoffs — May 6 should have multiple playoff games
NHL_SCOREBOARD_DATE = "2025-05-06"
NHL_SCOREBOARD_URL = f"https://api-web.nhle.com/v1/score/{NHL_SCOREBOARD_DATE}"
NHL_TEAMS_URL = "https://api.nhle.com/stats/rest/en/team"

# States that indicate a game is past the scheduled phase
_STARTED_STATES = {"live", "crit", "final", "off"}
# States that should have period/clock info
_ACTIVE_STATES = {"live", "crit"}
# States where game is definitively done
_FINAL_STATES = {"final", "off"}


# ---------------------------------------------------------------------------
# NHL scoreboard contract
# ---------------------------------------------------------------------------

class TestNHLScoreboardContract:
    """Validates nhl.py:58-173 parser expectations against the NHL API."""

    def test_top_level_structure(self, my_vcr):
        with my_vcr.use_cassette("nhl_scoreboard.yaml"):
            resp = requests.get(NHL_SCOREBOARD_URL)

        assert resp.status_code == 200
        data = resp.json()

        # parser: data["games"] — accessed via "games" in data
        assert "games" in data, "Response must have 'games' key"
        assert isinstance(data["games"], list)

        # parser: "prevDate" in data — optional but checked
        # Just assert the type if present, don't require it
        if "prevDate" in data:
            assert isinstance(data["prevDate"], str)

    def test_games_have_required_fields(self, my_vcr):
        """Core fields every game must have regardless of state."""
        with my_vcr.use_cassette("nhl_scoreboard.yaml"):
            resp = requests.get(NHL_SCOREBOARD_URL)

        data = resp.json()
        games = data.get("games", [])

        if not games:
            pytest.skip(f"No NHL games on {NHL_SCOREBOARD_DATE}")

        for game in games:
            gid = game.get("id", "<unknown>")

            # parser: game.get("id") — returns None if missing
            assert "id" in game, "game must have 'id'"

            # parser: game.get("gameState", "") — used for state mapping
            assert "gameState" in game, f"game {gid}: must have 'gameState'"
            gs = game["gameState"]
            assert gs in ("FUT", "PRE", "LIVE", "CRIT", "FINAL", "OFF"), \
                f"game {gid}: gameState '{gs}' not in known set"

            # parser: game.get("gameScheduleState", "")
            assert "gameScheduleState" in game, f"game {gid}: must have 'gameScheduleState'"

            # parser: game.get("startTimeUTC", "")
            assert "startTimeUTC" in game, f"game {gid}: must have 'startTimeUTC'"

    def test_team_structure(self, my_vcr):
        """homeTeam and awayTeam must have id, name.default, abbrev."""
        with my_vcr.use_cassette("nhl_scoreboard.yaml"):
            resp = requests.get(NHL_SCOREBOARD_URL)

        data = resp.json()
        games = data.get("games", [])

        if not games:
            pytest.skip(f"No NHL games on {NHL_SCOREBOARD_DATE}")

        for game in games:
            gid = game["id"]
            for side in ("homeTeam", "awayTeam"):
                assert side in game, f"game {gid}: must have '{side}'"
                team = game[side]

                # parser: home_team.get("id", "")
                assert "id" in team, f"game {gid}: {side} must have 'id'"

                # parser: home_team.get("name", {}).get("default", "")
                assert "name" in team, f"game {gid}: {side} must have 'name'"
                assert "default" in team["name"], \
                    f"game {gid}: {side}.name must have 'default' key"

                # parser: home_team.get("abbrev", "")
                assert "abbrev" in team, f"game {gid}: {side} must have 'abbrev'"

    def test_score_present_for_started_games(self, my_vcr):
        """Parser reads score with int(team.get("score", 0)) — score must exist for non-FUT."""
        with my_vcr.use_cassette("nhl_scoreboard.yaml"):
            resp = requests.get(NHL_SCOREBOARD_URL)

        data = resp.json()
        games = data.get("games", [])

        if not games:
            pytest.skip(f"No NHL games on {NHL_SCOREBOARD_DATE}")

        for game in games:
            gid = game["id"]
            gs = game.get("gameState", "FUT").upper()

            if gs in ("LIVE", "CRIT", "FINAL", "OFF"):
                for side in ("homeTeam", "awayTeam"):
                    team = game.get(side, {})
                    assert "score" in team, \
                        f"game {gid}: {side}.score required for gameState={gs}"

    def test_period_descriptor_for_active_and_final(self, my_vcr):
        """periodDescriptor must be present (and populated) for LIVE/CRIT/FINAL/OFF games."""
        with my_vcr.use_cassette("nhl_scoreboard.yaml"):
            resp = requests.get(NHL_SCOREBOARD_URL)

        data = resp.json()
        games = data.get("games", [])

        if not games:
            pytest.skip(f"No NHL games on {NHL_SCOREBOARD_DATE}")

        has_non_fut = False
        for game in games:
            gid = game["id"]
            gs = game.get("gameState", "FUT").upper()

            if gs in ("LIVE", "CRIT", "FINAL", "OFF"):
                has_non_fut = True
                # parser: game.get("periodDescriptor", {})
                assert "periodDescriptor" in game, \
                    f"game {gid}: periodDescriptor required for gameState={gs}"
                pd = game["periodDescriptor"]

                # parser: period_descriptor.get("number", 0)
                assert "number" in pd, \
                    f"game {gid}: periodDescriptor.number required for gameState={gs}"

                # parser: period_descriptor.get("periodType", "")
                assert "periodType" in pd, \
                    f"game {gid}: periodDescriptor.periodType required for gameState={gs}"

        if not has_non_fut:
            pytest.skip("All games are FUT/PRE — cannot test periodDescriptor for active games")

    def test_clock_for_live_games(self, my_vcr):
        """clock.timeRemaining must be present for LIVE and CRIT games."""
        with my_vcr.use_cassette("nhl_scoreboard.yaml"):
            resp = requests.get(NHL_SCOREBOARD_URL)

        data = resp.json()
        games = data.get("games", [])

        if not games:
            pytest.skip(f"No NHL games on {NHL_SCOREBOARD_DATE}")

        has_live = False
        for game in games:
            gid = game["id"]
            gs = game.get("gameState", "FUT").upper()

            if gs in ("LIVE", "CRIT"):
                has_live = True
                # parser: game.get("clock", {})
                assert "clock" in game, f"game {gid}: 'clock' required for gameState={gs}"
                # parser: clock.get("timeRemaining", "")
                assert "timeRemaining" in game["clock"], \
                    f"game {gid}: clock.timeRemaining required for gameState={gs}"

        if not has_live:
            pytest.skip("No LIVE/CRIT games in cassette — clock test skipped")

    def test_fut_games_have_no_period_info(self, my_vcr):
        """FUT games should not have meaningful periodDescriptor — parser uses defaults."""
        with my_vcr.use_cassette("nhl_scoreboard.yaml"):
            resp = requests.get(NHL_SCOREBOARD_URL)

        data = resp.json()
        games = data.get("games", [])

        fut_games = [g for g in games if g.get("gameState", "").upper() == "FUT"]

        if not fut_games:
            pytest.skip("No FUT games in cassette")

        for game in fut_games:
            gid = game["id"]
            # FUT games: periodDescriptor may be absent or have number=0
            pd = game.get("periodDescriptor", {})
            if pd:
                number = pd.get("number", 0)
                assert number == 0, \
                    f"game {gid}: FUT game should have periodDescriptor.number=0, got {number}"

    def test_prev_date_and_games_by_date(self, my_vcr):
        """Parser reads prevDate and gamesByDate for previous-day carryover."""
        with my_vcr.use_cassette("nhl_scoreboard.yaml"):
            resp = requests.get(NHL_SCOREBOARD_URL)

        data = resp.json()

        # Both must be present together for the parser branch to activate
        if "prevDate" in data:
            # parser: isinstance(data.get("gamesByDate"), list)
            if "gamesByDate" in data:
                assert isinstance(data["gamesByDate"], list), \
                    "gamesByDate must be a list when present"

                for date_entry in data["gamesByDate"]:
                    assert "date" in date_entry, "gamesByDate entry must have 'date'"
                    assert "games" in date_entry, "gamesByDate entry must have 'games'"


# ---------------------------------------------------------------------------
# NHL teams contract
# ---------------------------------------------------------------------------

class TestNHLTeamsContract:
    """Validates nhl.py:179-209 parser expectations against the NHL stats API."""

    def test_top_level_structure(self, my_vcr):
        with my_vcr.use_cassette("nhl_teams.yaml"):
            resp = requests.get(NHL_TEAMS_URL)

        assert resp.status_code == 200
        data = resp.json()

        # parser: data.get("data", [])
        assert "data" in data, "Response must have 'data' key"
        assert isinstance(data["data"], list)

    def test_team_required_fields(self, my_vcr):
        with my_vcr.use_cassette("nhl_teams.yaml"):
            resp = requests.get(NHL_TEAMS_URL)

        data = resp.json()
        teams = data.get("data", [])
        assert len(teams) >= 1, "Must have at least one NHL team"

        for team in teams:
            # parser: team.get("id", "")
            assert "id" in team, "team must have 'id'"

            # parser: team.get("fullName", "")
            assert "fullName" in team, "team must have 'fullName'"

            # parser: team.get("triCode", "")
            assert "triCode" in team, "team must have 'triCode'"

            # Sanity-check types
            assert isinstance(team["id"], (int, str)), "team.id must be int or str"
            assert isinstance(team["fullName"], str) and team["fullName"], \
                "team.fullName must be a non-empty string"
            assert isinstance(team["triCode"], str) and len(team["triCode"]) <= 4, \
                "team.triCode must be a string (≤4 chars)"
