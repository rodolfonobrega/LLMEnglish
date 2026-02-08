.PHONY: install dev build preview clean docker-build docker-run docker-stop

# ──────────────────────────────────────────────
# Local development
# ──────────────────────────────────────────────

install: ## Install dependencies
	npm ci

dev: ## Start dev server (hot-reload)
	npm run dev -- --host 0.0.0.0

build: ## Production build
	npm run build

preview: build ## Build and preview production locally
	npm run preview -- --host 0.0.0.0

clean: ## Remove build artifacts and dependencies
	rm -rf dist node_modules

# ──────────────────────────────────────────────
# Docker
# ──────────────────────────────────────────────

IMAGE_NAME := speaklab
CONTAINER_NAME := speaklab
PORT := 8888

docker-build: ## Build Docker image
	docker build -t $(IMAGE_NAME) .

docker-run: ## Run container (port 8080)
	docker run -d --name $(CONTAINER_NAME) -p $(PORT):80 $(IMAGE_NAME)
	@echo "App running at http://localhost:$(PORT)"

docker-stop: ## Stop and remove container
	docker stop $(CONTAINER_NAME) 2>/dev/null || true
	docker rm $(CONTAINER_NAME) 2>/dev/null || true

docker-restart: docker-stop docker-run ## Restart container

docker-logs: ## Tail container logs
	docker logs -f $(CONTAINER_NAME)

# ──────────────────────────────────────────────
# Help
# ──────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
