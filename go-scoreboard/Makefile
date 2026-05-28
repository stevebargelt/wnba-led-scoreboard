.PHONY: build sim build-pi clean

build:
	go build -o scoreboard ./cmd/scoreboard

sim:
	go build -o scoreboard ./cmd/scoreboard && ./scoreboard --sim

build-pi:
	go build -tags matrix -o scoreboard ./cmd/scoreboard

clean:
	rm -f scoreboard out/frame.png
