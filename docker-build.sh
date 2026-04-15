#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# docker-build.sh – Build & run the PTP4 landing page as a Docker image.
#
# Usage:
#   ./docker-build.sh [OPTIONS]
#
# Options:
#   --with-supabase   Also start a local Supabase stack (DB, Auth, REST, …)
#   --build-only      Only build the image, don't start containers
#   --down            Stop and remove containers (and volumes with --volumes)
#   --volumes         Used together with --down: also remove named volumes
#   --tag <name>      Image tag (default: ptp4-landingpage:latest)
#   --env-file <f>    Env file to use (default: .env.docker)
#   -h, --help        Show this help
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Defaults ─────────────────────────────────────────────────────────────────
WITH_SUPABASE=false
BUILD_ONLY=false
DOWN=false
REMOVE_VOLUMES=false
IMAGE_TAG="ptp4-landingpage:latest"
ENV_FILE=".env.docker"

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-supabase) WITH_SUPABASE=true ;;
    --build-only)    BUILD_ONLY=true ;;
    --down)          DOWN=true ;;
    --volumes)       REMOVE_VOLUMES=true ;;
    --tag)           shift; IMAGE_TAG="$1" ;;
    --env-file)      shift; ENV_FILE="$1" ;;
    -h|--help)
      sed -n '/^# ─/,/^# ─/p' "$0" | grep '^#' | sed 's/^# \?//'
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

# ── Helper ────────────────────────────────────────────────────────────────────
info()    { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
success() { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn()    { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
error()   { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; exit 1; }

# ── Compose file list ─────────────────────────────────────────────────────────
COMPOSE_FILES=(-f docker-compose.yml)
if $WITH_SUPABASE; then
  COMPOSE_FILES+=(-f docker-compose.supabase.yml)
fi

# ── Env file check ────────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f ".env.docker.example" ]]; then
    warn "Env file '$ENV_FILE' not found. Copying from .env.docker.example …"
    cp .env.docker.example "$ENV_FILE"
    warn "Please edit '$ENV_FILE' and re-run this script."
    exit 1
  else
    warn "Env file '$ENV_FILE' not found. Using environment variables only."
  fi
fi

ENV_FLAG=()
if [[ -f "$ENV_FILE" ]]; then
  ENV_FLAG=(--env-file "$ENV_FILE")
fi

# ── Down ──────────────────────────────────────────────────────────────────────
if $DOWN; then
  info "Stopping containers …"
  VOL_FLAG=()
  $REMOVE_VOLUMES && VOL_FLAG=(--volumes)
  docker compose "${COMPOSE_FILES[@]}" "${ENV_FLAG[@]}" down "${VOL_FLAG[@]}"
  success "Done."
  exit 0
fi

# ── Build ─────────────────────────────────────────────────────────────────────
info "Building Docker image: $IMAGE_TAG"
docker compose "${COMPOSE_FILES[@]}" "${ENV_FLAG[@]}" build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  web

# Re-tag with the requested tag (docker compose uses service name)
docker tag ptp4-landingpage:latest "$IMAGE_TAG" 2>/dev/null || true

success "Image built: $IMAGE_TAG"

if $BUILD_ONLY; then
  exit 0
fi

# ── Start ─────────────────────────────────────────────────────────────────────
info "Starting containers …"
docker compose "${COMPOSE_FILES[@]}" "${ENV_FLAG[@]}" up -d --remove-orphans

# ── Summary ───────────────────────────────────────────────────────────────────
WEB_PORT="${WEB_PORT:-8080}"
echo ""
success "Stack is up!"
echo ""
echo "  🌐  Landing Page  →  http://localhost:${WEB_PORT}"
if $WITH_SUPABASE; then
  KONG_PORT="${KONG_HTTP_PORT:-8000}"
  STUDIO_PORT="${STUDIO_PORT:-3000}"
  echo "  🗄️   Supabase API  →  http://localhost:${KONG_PORT}"
  echo "  🖥️   Studio        →  http://localhost:${STUDIO_PORT}"
fi
echo ""
echo "  Logs:  docker compose ${COMPOSE_FILES[*]} logs -f"
echo "  Stop:  ./docker-build.sh --down${WITH_SUPABASE:+ --with-supabase}"
echo ""
