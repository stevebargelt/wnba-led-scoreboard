package config

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type LeagueRef struct {
	Code string `json:"code"`
}

type FavoriteTeam struct {
	TeamID       string `json:"team_id"`
	Name         string `json:"name"`
	Abbreviation string `json:"abbreviation"`
	LogoURL      string `json:"logo_url,omitempty"`
}

type MatrixConfig struct {
	Width             int    `json:"width"`
	Height            int    `json:"height"`
	Brightness        int    `json:"brightness"`
	PixelMapperConfig string `json:"pixel_mapper_config"`
}

type RenderConfig struct {
	LiveLayout  string `json:"live_layout"`
	LogoVariant string `json:"logo_variant"`
}

type RefreshConfig struct {
	PregameSec int `json:"pregame_sec"`
	IngameSec  int `json:"ingame_sec"`
	FinalSec   int `json:"final_sec"`
}

type DeviceConfig struct {
	EnabledLeagues []LeagueRef               `json:"enabled_leagues"`
	FavoriteTeams  map[string][]FavoriteTeam `json:"favorite_teams"`
	Matrix         MatrixConfig              `json:"matrix_config"`
	Render         RenderConfig              `json:"render_config"`
	Refresh        RefreshConfig             `json:"refresh_config"`
	Timezone       string                    `json:"timezone"`
}

// FetchDeviceConfig calls the Supabase get_device_configuration RPC via PostgREST.
func FetchDeviceConfig(ctx context.Context, supabaseURL, anonKey, deviceID string) (*DeviceConfig, error) {
	url := strings.TrimRight(supabaseURL, "/") + "/rest/v1/rpc/get_device_configuration"
	body, err := json.Marshal(map[string]string{"p_device_id": deviceID})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("apikey", anonKey)
	req.Header.Set("Authorization", "Bearer "+anonKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("supabase rpc: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase rpc: status %d: %s", resp.StatusCode, string(raw))
	}

	var cfg DeviceConfig
	if err := json.NewDecoder(resp.Body).Decode(&cfg); err != nil {
		return nil, fmt.Errorf("supabase rpc decode: %w", err)
	}
	return &cfg, nil
}
