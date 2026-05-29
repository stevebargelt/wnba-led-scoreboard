package sports

import "testing"

func TestStateFor(t *testing.T) {
	cases := []struct {
		name string
		typ  espnStatusType
		want GameState
	}{
		// The bug: at the final buzzer ESPN still reports state "in" but sets
		// completed=true. Without the completed check this rendered as "4th 0:00".
		{"completed overrides lingering in-state", espnStatusType{State: "in", Completed: true}, StateFinal},
		{"completed post", espnStatusType{State: "post", Completed: true}, StateFinal},
		{"live in-progress", espnStatusType{State: "in", Completed: false}, StateLive},
		{"pregame", espnStatusType{State: "pre"}, StatePre},
		{"post without completed flag", espnStatusType{State: "post"}, StateFinal},
		{"unknown state", espnStatusType{State: "nonsense"}, StateUnknown},
	}
	for _, c := range cases {
		if got := stateFor(c.typ); got != c.want {
			t.Errorf("%s: stateFor(%+v) = %v, want %v", c.name, c.typ, got, c.want)
		}
	}
}
