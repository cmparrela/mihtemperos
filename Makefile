PM := pnpm

.PHONY: run install build preview lint

run:
	@if [ ! -d node_modules ]; then $(PM) install; fi
	$(PM) dev -- --open

install:
	$(PM) install

build:
	$(PM) build

preview:
	$(PM) preview

lint:
	$(PM) lint
