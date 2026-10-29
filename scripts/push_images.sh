#!/usr/bin/env bash
# Builds the 3 images for the cloud server (Intel/AMD, linux/amd64) and pushes them to Docker Hub.
# Usage: scripts/push_images.sh <dockerhub-user> [tag]      (run `docker login` first)
# On an Apple Silicon Mac the first build is slow because it runs under emulation.
set -euo pipefail
HUB_USER="${1:?usage: $0 <dockerhub-user> [tag]}"
TAG="${2:-$(git rev-parse --short=8 HEAD)}"
cd "$(dirname "$0")/.."

docker buildx build --platform linux/amd64 -f ai_service/Dockerfile -t "$HUB_USER/steel-ai:$TAG" --push .
docker buildx build --platform linux/amd64 -t "$HUB_USER/steel-gateway:$TAG" --push server
docker buildx build --platform linux/amd64 -t "$HUB_USER/steel-web:$TAG" --push client
echo "Pushed $HUB_USER/steel-{ai,gateway,web}:$TAG"
