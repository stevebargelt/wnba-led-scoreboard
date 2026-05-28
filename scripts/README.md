# Scripts

Hardware setup + deploy helpers for the Multi-League LED Scoreboard.

> **Note:** Most of the Python helpers that used to live in this directory (asset fetchers, migration runners, device setup, test connection) are scheduled for removal as part of the Python codebase cleanup. See the open backlog ticket for "Remove frozen Python scoreboard codebase."

## Currently active

| Script | Purpose |
|--------|---------|
| `install_rgbmatrix.sh` | Clones and builds the [hzeller/rpi-rgb-led-matrix](https://github.com/hzeller/rpi-rgb-led-matrix) C library on the Pi. Required — the Go scoreboard's `-tags matrix` build links against this library via CGO. |
| `hardware_self_test.sh` | Runs a basic LED panel sanity test (uses the upstream library's example binaries). Useful when wiring up a new Pi or panel. |
| `deploy/` | Deploy-related helpers (review for relevance during the Python cleanup pass). |
| `systemd/` | Systemd unit files for auto-starting the scoreboard on boot. |

## Logo fetching (Go)

The previous Python asset fetchers (`fetch_wnba_assets.py`, `fetch_nhl_assets.py`) are being replaced by Go equivalents in `go-scoreboard/cmd/fetch-logos`. WNBA is supported today; NHL is an open follow-up.
