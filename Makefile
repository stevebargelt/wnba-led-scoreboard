# Makefile for WNBA LED Scoreboard

.PHONY: test test-coverage test-watch install clean

# Install dependencies
install:
	pip install -r requirements.txt
	pip install coverage

# Run tests
test:
	python -m unittest discover tests -v

# Run tests with coverage
test-coverage:
	coverage erase
	coverage run -m unittest discover tests -q
	coverage report
	@echo "\nFor detailed HTML report, run: make test-html"

# Run tests with coverage and generate HTML report
test-html:
	coverage erase
	coverage run -m unittest discover tests -q
	coverage html
	@echo "\nHTML coverage report generated at: htmlcov/index.html"
	@echo "Run 'open htmlcov/index.html' to view in browser"

# Run specific test file
test-file:
	@echo "Usage: make test-file FILE=tests/test_board_base.py"
	python -m unittest $(FILE) -v

# Watch tests (requires pytest and pytest-watch)
test-watch:
	@echo "Installing pytest-watch if not present..."
	@pip install -q pytest pytest-watch
	ptw tests/ --runner "python -m unittest discover tests -q"

# Clean temporary files
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf htmlcov/
	rm -f .coverage
	rm -rf .pytest_cache/

# Run the app in simulation mode
run-sim:
	python app.py --sim --once

# Run the app in demo mode
run-demo:
	python app.py --demo

# Help
help:
	@echo "Available targets:"
	@echo "  install        - Install dependencies"
	@echo "  test          - Run all tests"
	@echo "  test-coverage - Run tests with coverage report"
	@echo "  test-html     - Run tests and generate HTML coverage report"
	@echo "  test-file     - Run specific test file (FILE=path/to/test.py)"
	@echo "  test-watch    - Watch tests and re-run on changes"
	@echo "  clean         - Clean temporary files"
	@echo "  run-sim       - Run app in simulation mode"
	@echo "  run-demo      - Run app in demo mode"
	@echo "  help          - Show this help message"