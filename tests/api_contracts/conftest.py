"""
Pytest conftest for API contract tests.

Default mode: replay cassettes (deterministic, CI-safe).
Live mode: --live flag hits real endpoints and re-records cassettes.
"""

import json
import os

import pytest
import vcr as vcrlib

CASSETTES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cassettes")


def pytest_addoption(parser):
    parser.addoption(
        "--live",
        action="store_true",
        default=False,
        help="Hit real API endpoints and re-record cassettes",
    )


@pytest.fixture(scope="session")
def live_mode(request):
    return request.config.getoption("--live")


def _strip_espn_team(team: dict) -> dict:
    for key in ("links", "athletes", "nextEvent", "franchise"):
        team.pop(key, None)
    return team


def _strip_espn_competitor(competitor: dict) -> dict:
    for key in ("statistics", "leaders", "records", "linescores", "probables", "roster"):
        competitor.pop(key, None)
    if "team" in competitor:
        _strip_espn_team(competitor["team"])
    return competitor


def _strip_espn_competition(comp: dict) -> dict:
    for key in ("odds", "notes", "situation", "headlines", "geoBroadcasts",
                "tickets", "playByPlayAvailable", "drives", "highlights",
                "powerPlayStrength"):
        comp.pop(key, None)
    comp["competitors"] = [_strip_espn_competitor(c) for c in comp.get("competitors", [])]
    return comp


def _strip_espn_event(event: dict) -> dict:
    for key in ("links", "weather", "notes", "rockets", "videos",
                "article", "timeValid"):
        event.pop(key, None)
    event["competitions"] = [_strip_espn_competition(c) for c in event.get("competitions", [])]
    return event


def _strip_espn_scoreboard(data: dict) -> dict:
    for key in ("calendar", "news", "links", "article", "week"):
        data.pop(key, None)
    data["events"] = [_strip_espn_event(e) for e in data.get("events", [])]
    return data


def _strip_espn_teams(data: dict) -> dict:
    for sport in data.get("sports", []):
        sport.pop("links", None)
        for league in sport.get("leagues", []):
            league.pop("links", None)
            league.pop("notes", None)
            for team_entry in league.get("teams", []):
                team = team_entry.get("team", {})
                _strip_espn_team(team)
    return data


def _strip_nhl_game(game: dict) -> dict:
    for key in ("tvBroadcasts", "gameVideo", "winOdds", "threeMinRecap",
                "gameCenterLink", "venue", "specialEvent", "gameOutcome",
                "seriesStatus", "ticketsLink"):
        game.pop(key, None)
    for side in ("homeTeam", "awayTeam"):
        team = game.get(side, {})
        for key in ("placeName", "placeNameWithPreposition", "commonName",
                    "darkLogo", "lightLogo", "logo", "radioLink"):
            team.pop(key, None)
    return game


def _strip_nhl_scoreboard(data: dict) -> dict:
    data["games"] = [_strip_nhl_game(g) for g in data.get("games", [])]
    if "gamesByDate" in data:
        for date_entry in data.get("gamesByDate", []):
            date_entry["games"] = [_strip_nhl_game(g) for g in date_entry.get("games", [])]
    return data


def _strip_nhl_teams(data: dict) -> dict:
    kept = []
    for team in data.get("data", []):
        kept.append({
            "id": team.get("id"),
            "fullName": team.get("fullName"),
            "triCode": team.get("triCode"),
        })
    data["data"] = kept
    return data


def _detect_and_strip(data: dict) -> dict:
    """Route to the right stripper based on response body shape."""
    if "events" in data and "sports" not in data:
        return _strip_espn_scoreboard(data)
    if "sports" in data:
        return _strip_espn_teams(data)
    if "games" in data and "prevDate" in data:
        return _strip_nhl_scoreboard(data)
    if isinstance(data.get("data"), list):
        if data["data"] and isinstance(data["data"][0], dict) and "triCode" in data["data"][0]:
            return _strip_nhl_teams(data)
    return data


def before_record_response(response):
    """Strip unused fields from recorded responses to keep cassettes small."""
    content_type = ""
    for key, val in response.get("headers", {}).items():
        if key.lower() == "content-type":
            content_type = val[0] if isinstance(val, list) else val
            break

    if "application/json" not in content_type and "json" not in content_type:
        return response

    body = response["body"]["string"]
    try:
        if isinstance(body, bytes):
            data = json.loads(body.decode("utf-8"))
        else:
            data = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return response

    data = _detect_and_strip(data)

    stripped = json.dumps(data)
    if isinstance(body, bytes):
        response["body"]["string"] = stripped.encode("utf-8")
    else:
        response["body"]["string"] = stripped

    # Remove content-encoding so the stored body is plain JSON
    headers = {k: v for k, v in response.get("headers", {}).items()
               if k.lower() not in ("content-encoding", "content-length")}
    response["headers"] = headers

    return response


@pytest.fixture(scope="session")
def my_vcr(live_mode):
    """Session-scoped VCR instance."""
    record_mode = "all" if live_mode else "none"
    return vcrlib.VCR(
        cassette_library_dir=CASSETTES_DIR,
        record_mode=record_mode,
        before_record_response=before_record_response,
        match_on=["method", "scheme", "host", "port", "path", "query"],
        decode_compressed_response=True,
    )
