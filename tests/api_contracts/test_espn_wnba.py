"""
API contract tests for ESPN WNBA endpoints.

Cassette dates are pinned to ensure URL match on replay.
"""

import requests
import pytest

# Mid-season Friday with multiple WNBA games
WNBA_SCOREBOARD_DATE = "20240712"

WNBA_BASE = "http://site.api.espn.com/apis/site/v2/sports/basketball/wnba"
WNBA_SCOREBOARD_URL = f"{WNBA_BASE}/scoreboard?dates={WNBA_SCOREBOARD_DATE}"
WNBA_TEAMS_URL = f"{WNBA_BASE}/teams"


# ---------------------------------------------------------------------------
# WNBA scoreboard contract
# ---------------------------------------------------------------------------

class TestWNBAScoreboardContract:
    """Validates wnba.py:67-156 parser expectations against the ESPN API."""

    def test_top_level_structure(self, my_vcr):
        with my_vcr.use_cassette("wnba_scoreboard.yaml"):
            resp = requests.get(WNBA_SCOREBOARD_URL)

        assert resp.status_code == 200
        data = resp.json()
        assert "events" in data, "Response must contain 'events' list"
        assert isinstance(data["events"], list)

    def test_events_have_required_fields(self, my_vcr):
        with my_vcr.use_cassette("wnba_scoreboard.yaml"):
            resp = requests.get(WNBA_SCOREBOARD_URL)

        data = resp.json()
        events = data.get("events", [])

        if not events:
            pytest.skip(f"No WNBA events on {WNBA_SCOREBOARD_DATE} — cassette has empty events list")

        for event in events:
            eid = event.get("id", "<unknown>")

            # parser: event.get("id") — required, returns None if missing
            assert "id" in event, f"event must have 'id'"

            # parser: event.get("date")
            assert "date" in event, f"event {eid}: must have 'date'"

            # NOTE: the WNBA parser reads event.get("broadcasts", []) but ESPN puts
            # broadcasts in competition[0], not the event. Test competition-level broadcasts.
            competitions = event.get("competitions", [])
            if competitions:
                comp0 = competitions[0]
                assert "broadcasts" in comp0, \
                    f"event {eid}: competition[0] must have 'broadcasts' key"
                assert isinstance(comp0["broadcasts"], list), \
                    f"event {eid}: competition[0].broadcasts must be a list"

    def test_events_have_competitions(self, my_vcr):
        with my_vcr.use_cassette("wnba_scoreboard.yaml"):
            resp = requests.get(WNBA_SCOREBOARD_URL)

        data = resp.json()
        events = data.get("events", [])

        if not events:
            pytest.skip(f"No WNBA events on {WNBA_SCOREBOARD_DATE}")

        for event in events:
            eid = event["id"]
            competitions = event.get("competitions", [])
            assert len(competitions) >= 1, f"event {eid}: must have at least one competition"

    def test_competitors_structure(self, my_vcr):
        """Parser reads homeAway, team.id/displayName/abbreviation, score."""
        with my_vcr.use_cassette("wnba_scoreboard.yaml"):
            resp = requests.get(WNBA_SCOREBOARD_URL)

        data = resp.json()
        events = data.get("events", [])

        if not events:
            pytest.skip(f"No WNBA events on {WNBA_SCOREBOARD_DATE}")

        for event in events:
            eid = event["id"]
            comp = (event.get("competitions") or [{}])[0]
            competitors = comp.get("competitors", [])

            assert len(competitors) >= 2, f"event {eid}: needs ≥2 competitors"

            home_count = sum(1 for c in competitors if c.get("homeAway") == "home")
            away_count = sum(1 for c in competitors if c.get("homeAway") == "away")
            assert home_count == 1, f"event {eid}: must have exactly one 'home' competitor"
            assert away_count == 1, f"event {eid}: must have exactly one 'away' competitor"

            for comp_entry in competitors:
                # parser: c.get("homeAway")
                assert "homeAway" in comp_entry, f"event {eid}: competitor must have 'homeAway'"

                # parser: comp_entry.get("score") — used as int(competitor.get("score") or 0)
                assert "score" in comp_entry, f"event {eid}: competitor must have 'score'"

                team = comp_entry.get("team", {})
                assert team, f"event {eid}: competitor must have non-empty 'team'"

                # parser: team.get("id")
                assert "id" in team, f"event {eid}: team must have 'id'"

                # parser: team.get("displayName") or team.get("name") — assert PRIMARY
                assert "displayName" in team, \
                    f"event {eid}: team must have 'displayName' (primary key in fallback chain)"

                # parser: team.get("abbreviation") or (team.get("shortDisplayName") or "").upper() — assert PRIMARY
                assert "abbreviation" in team, \
                    f"event {eid}: team must have 'abbreviation' (primary key in fallback chain)"

    def test_status_structure(self, my_vcr):
        """Parser reads competition.status.type.state and .detail, plus period/displayClock."""
        with my_vcr.use_cassette("wnba_scoreboard.yaml"):
            resp = requests.get(WNBA_SCOREBOARD_URL)

        data = resp.json()
        events = data.get("events", [])

        if not events:
            pytest.skip(f"No WNBA events on {WNBA_SCOREBOARD_DATE}")

        for event in events:
            eid = event["id"]
            comp = (event.get("competitions") or [{}])[0]
            status = comp.get("status", {})

            assert "status" in comp, f"event {eid}: competition must have 'status'"

            status_type = status.get("type", {})
            assert "type" in status, f"event {eid}: competition.status must have 'type'"

            # parser: status.get("state") — used for game state mapping
            assert "state" in status_type, f"event {eid}: status.type must have 'state'"
            state = status_type["state"].lower()
            assert state in ("pre", "in", "post"), \
                f"event {eid}: status.type.state must be pre/in/post, got '{state}'"

            # parser: status.get("detail")
            assert "detail" in status_type, f"event {eid}: status.type must have 'detail'"

            # period and displayClock are read by parser with defaults,
            # but must be present for live/final games
            if state in ("in", "post"):
                assert "period" in status, \
                    f"event {eid}: competition.status must have 'period' for state={state}"
                assert "displayClock" in status, \
                    f"event {eid}: competition.status must have 'displayClock' for state={state}"


# ---------------------------------------------------------------------------
# WNBA teams contract
# ---------------------------------------------------------------------------

class TestWNBATeamsContract:
    """Validates wnba.py:162-190 parser expectations against the ESPN API."""

    def test_top_level_structure(self, my_vcr):
        with my_vcr.use_cassette("wnba_teams.yaml"):
            resp = requests.get(WNBA_TEAMS_URL)

        assert resp.status_code == 200
        data = resp.json()

        # parser: data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])
        assert "sports" in data, "Response must have 'sports'"
        assert len(data["sports"]) >= 1, "'sports' must be non-empty"
        sports0 = data["sports"][0]
        assert "leagues" in sports0, "sports[0] must have 'leagues'"
        assert len(sports0["leagues"]) >= 1, "sports[0].leagues must be non-empty"
        leagues0 = sports0["leagues"][0]
        assert "teams" in leagues0, "sports[0].leagues[0] must have 'teams'"

    def test_team_required_fields(self, my_vcr):
        with my_vcr.use_cassette("wnba_teams.yaml"):
            resp = requests.get(WNBA_TEAMS_URL)

        data = resp.json()
        teams_list = (
            data.get("sports", [{}])[0]
                .get("leagues", [{}])[0]
                .get("teams", [])
        )

        assert len(teams_list) >= 1, "Must have at least one WNBA team"

        for team_entry in teams_list:
            assert "team" in team_entry, "Each teams[] entry must have 'team' key"
            team = team_entry["team"]

            # parser: team.get("id", "")
            assert "id" in team, f"team must have 'id'"

            # parser: team.get("displayName", "")
            assert "displayName" in team, f"team must have 'displayName'"

            # parser: team.get("abbreviation", "")
            assert "abbreviation" in team, f"team must have 'abbreviation'"

            # parser: team.get("color", "")
            assert "color" in team, f"team must have 'color'"

            # parser: team.get("alternateColor", "")
            assert "alternateColor" in team, f"team must have 'alternateColor'"

            # parser: team.get("venue", {}).get("fullName", "")
            # venue is not always present in the ESPN WNBA teams endpoint;
            # when present its fullName must be accessible
            if team.get("venue"):
                assert "fullName" in team["venue"], f"team.venue must have 'fullName'"

    def test_team_logos(self, my_vcr):
        """Parser reads logos[0].href — logos must be a non-empty list with href."""
        with my_vcr.use_cassette("wnba_teams.yaml"):
            resp = requests.get(WNBA_TEAMS_URL)

        data = resp.json()
        teams_list = (
            data.get("sports", [{}])[0]
                .get("leagues", [{}])[0]
                .get("teams", [])
        )

        for team_entry in teams_list:
            team = team_entry["team"]
            # parser: team.get("logos", [{}])[0].get("href") if team.get("logos") else None
            logos = team.get("logos")
            if logos:  # parser skips logos if falsy
                assert isinstance(logos, list), f"team.logos must be a list"
                assert len(logos) >= 1, f"team.logos must be non-empty when present"
                assert "href" in logos[0], f"team.logos[0] must have 'href'"
