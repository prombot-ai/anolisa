# Makefile for copilot-shell

.PHONY: help install build build-sandbox build-all test lint format preflight clean start debug release run-npx create-alias

help:
	@echo "Makefile for copilot-shell"
	@echo ""
	@echo "Usage:"
	@echo "  make install          - Install npm dependencies"
	@echo "  make build            - Build the main project"
	@echo "  make test             - Run the test suite"
	@echo "  make lint             - Lint the code"
	@echo "  make format           - Format the code"
	@echo "  make preflight        - Run formatting, linting, and tests"
	@echo "  make clean            - Remove generated files"
	@echo "  make start            - Start the Copilot Shell"
	@echo "  make debug            - Start the Copilot Shell in debug mode"
	@echo ""
	@echo "  make rpm              - Build an RPM package"
	@echo "  make create-alias     - Create a 'co' alias for your shell"

install:
	npm install

build:
	npm run build

test:
	npm run test

lint:
	npm run lint

format:
	npm run format

preflight:
	npm run preflight

clean:
	npm run clean

start:
	npm run start

debug:
	npm run debug

rpm:
	npm run package:rpm

create-alias:
	scripts/create_alias.sh
