"""
API contract tests for ESPN NBA endpoints.

Key difference from WNBA: NBA parser reads status from event level (not competition),
and uses status.type.name (not status.type.state) for game-state mapping.
"""

import requests
import pytest

# NBA Opening Night 2024 — guaranteed multiple games
NBA_SCOREBOARD_DATE = "20241025"

NBA_BASE = "http://site.api.espn.com/apis/site/v2/sports/basketball/nba"
NBA_SCOREBOARD_URL = f"{NBA_BASE}/scoreboard?dates={NBA_SCOREBOARD_DATE}"
NBA_TEAMS_URL = f"{NBA_BASE}/teams"


# ---------------------------------------------------------------------------
# NBA scoreboard contract
# ---------------------------------------------------------------------------

class TestNBAScoreboardContract:
    """Validates nba.py:77-156 parser expectations against the ESPN API."""

    def test_top_level_structure(self, my_vcr):
        with my_vcr.use_cassette("nba_scoreboard.yaml"):
            resp = requests.get(NBA_SCOREBOARD_URL)

        assert resp.status_code == 200
        data = resp.json()
        assert "events" in data, "Response must contain 'events' list"
        assert isinstance(data["events"], list)

    def test_events_have_required_fields(self, my_vcr):
        with my_vcr.use_cassette("nba_scoreboard.yaml"):
            resp = requests.get(NBA_SCOREBOARD_URL)

        data = resp.json()
        events = data.get("events", [])

        if not events:
            pytest.skip(f"No NBA events on {NBA_SCOREBOARD_DATE}")

        for event in events:
            eid = event.get("id", "<unknown>")

            # parser: event.get("id")
            assert "id" in event, "event must have 'id'"

            # parser: event.get("date", "")
            assert "date" in event, f"event {eid}: must have 'date'"

    def test_event_level_status(self, my_vcr):
        """NBA reads status from event (not competition) — nba.py:89-104."""
        with my_vcr.use_cassette("nba_scoreboard.yaml"):
            resp = requests.get(NBA_SCOREBOARD_URL)

        data = resp.json()
        events = data.get("events", [])

        if not events:
            pytest.skip(f"No NBA events on {NBA_SCOREBOARD_DATE}")

        for event in events:
            eid = event["id"]

            # parser: event.get("status", {})
            assert "status" in event, f"event {eid}: must have 'status' at event level"
            status = event["status"]

            # parser: status.get("type", {})
            assert "type" in status, f"event {eid}: event.status must have 'type'"
            status_type = status["type"]

            # parser: status_type.get("name", "STATUS_SCHEDULED") — KEY DIFFERENCE FROM WNBA
            assert "name" in status_type, \
                f"event {eid}: event.status.type must have 'name' (not 'state')"

            # parser: status_type.get("detail", "")
            assert "detail" in status_type, f"event {eid}: event.status.type must have 'detail'"

            name = status_type["name"]
            assert isinstance(name, str) and name.startswith("STATUS_"), \
                f"event {eid}: status.type.name should be STATUS_* string, got '{name}'"

    def test_status_period_and_clock(self, my_vcr):
        """NBA reads period and displayClock from event.status (not competition.status)."""
        with my_vcr.use_cassette("nba_scoreboard.yaml"):
            resp = requests.get(NBA_SCOREBOARD_URL)

        data = resp.json()
        events = data.get("events", [])

        if not events:
            pytest.skip(f"No NBA events on {NBA_SCOREBOARD_DATE}")

        for event in events:
            eid = event["id"]
            status = event.get("status", {})
            status_name = status.get("type", {}).get("name", "")

            # For completed games, period and clock must be present
            if status_name in ("STATUS_FINAL", "STATUS_FINAL_OT"):
                assert "period" in status, \
                    f"event {eid}: status.period required for {status_name}"
                assert "displayClock" in status, \
                    f"event {eid}: status.displayClock required for {status_name}"

    def test_competitors_structure(self, my_vcr):
        """Parser reads competition.competitors[*].homeAway, team.*, score."""
        with my_vcr.use_cassette("nba_scoreboard.yaml"):
            resp = requests.get(NBA_SCOREBOARD_URL)

        data = resp.json()
        events = data.get("events", [])

        if not events:
            pytest.skip(f"No NBA events on {NBA_SCOREBOARD_DATE}")

        for event in events:
            eid = event["id"]
            competitions = event.get("competitions", [])
            assert len(competitions) >= 1, f"event {eid}: must have competitions"

            competition = competitions[0]
            competitors = competition.get("competitors", [])
            assert len(competitors) >= 2, f"event {eid}: must have ≥2 competitors"

            home_count = sum(1 for c in competitors if c.get("homeAway") == "home")
            away_count = sum(1 for c in competitors if c.get("homeAway") == "away")
            assert home_count == 1, f"event {eid}: must have exactly one 'home' competitor"
            assert away_count == 1, f"event {eid}: must have exactly one 'away' competitor"

            for comp_entry in competitors:
                # parser: comp.get("homeAway")
                assert "homeAway" in comp_entry, f"event {eid}: competitor must have 'homeAway'"

                # parser: int(comp.get("score", 0))
                assert "score" in comp_entry, f"event {eid}: competitor must have 'score'"

                team = comp_entry.get("team", {})
                assert team, f"event {eid}: competitor must have non-empty 'team'"

                # parser: team_data.get("id")
                assert "id" in team, f"event {eid}: team must have 'id'"

                # parser: team_data.get("displayName", "")
                assert "displayName" in team, f"event {eid}: team must have 'displayName'"

                # parser: team_data.get("abbreviation", "")
                assert "abbreviation" in team, f"event {eid}: team must have 'abbreviation'"


# ---------------------------------------------------------------------------
# NBA teams contract
# ---------------------------------------------------------------------------

class TestNBATeamsContract:
    """Validates nba.py:177-200 parser expectations against the ESPN API."""

    def test_top_level_structure(self, my_vcr):
        with my_vcr.use_cassette("nba_teams.yaml"):
            resp = requests.get(NBA_TEAMS_URL)

        assert resp.status_code == 200
        data = resp.json()

        # parser: data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])
        assert "sports" in data
        assert len(data["sports"]) >= 1
        assert "leagues" in data["sports"][0]
        assert len(data["sports"][0]["leagues"]) >= 1
        assert "teams" in data["sports"][0]["leagues"][0]

    def test_team_required_fields(self, my_vcr):
        with my_vcr.use_cassette("nba_teams.yaml"):
            resp = requests.get(NBA_TEAMS_URL)

        data = resp.json()
        teams_list = (
            data.get("sports", [{}])[0]
                .get("leagues", [{}])[0]
                .get("teams", [])
        )

        assert len(teams_list) >= 1, "Must have at least one NBA team"

        for team_entry in teams_list:
            assert "team" in team_entry
            team = team_entry["team"]

            # parser: team.get("id")
            assert "id" in team, "team must have 'id'"

            # parser: team.get("displayName")
            assert "displayName" in team, "team must have 'displayName'"

            # parser: team.get("abbreviation")
            assert "abbreviation" in team, "team must have 'abbreviation'"

            # ESPN API returns 'logos' (array) for NBA teams — same shape as WNBA.
            # NOTE: nba.py:194 reads team.get("logo") which is a parser bug; the correct
            # field is 'logos'. This assertion tests what the API actually provides.
            assert "logos" in team, \
                "team must have 'logos' array (parser bug: nba.py reads 'logo' not 'logos')"
            if team.get("logos"):
                assert "href" in team["logos"][0], "logos[0] must have 'href'"
