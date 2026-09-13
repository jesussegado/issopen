#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd)"
readonly NAMESPACE="issopen"
readonly SOURCE_FILE="${ISSOPEN_PRODUCTION_SECRET_FILE:-${REPO_ROOT}/.local/secrets/issopen-production.env}"
readonly DOCKER_CONFIG_FILE="${ISSOPEN_DOCKER_CONFIG_FILE:-${HOME}/.docker/config.json}"
readonly KUBECTL_BIN="${KUBECTL:-kubectl}"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

[[ -f "$SOURCE_FILE" ]] || fail "missing local secret source: $SOURCE_FILE"
[[ "$(stat -c '%a' "$SOURCE_FILE")" == "600" ]] || fail "secret source must have mode 0600"
[[ -f "$DOCKER_CONFIG_FILE" ]] || fail "missing Docker credential source"

set -a
# shellcheck disable=SC1090
source "$SOURCE_FILE"
set +a

[[ -n "${POSTGRES_PASSWORD:-}" ]] || fail "POSTGRES_PASSWORD is missing"
[[ ${#POSTGRES_PASSWORD} -ge 32 ]] || fail "POSTGRES_PASSWORD is too short"
[[ -n "${BETTER_AUTH_SECRET:-}" ]] || fail "BETTER_AUTH_SECRET is missing"
[[ ${#BETTER_AUTH_SECRET} -ge 32 ]] || fail "BETTER_AUTH_SECRET is too short"
if { [[ -n "${GOOGLE_CLIENT_ID:-}" ]] && [[ -z "${GOOGLE_CLIENT_SECRET:-}" ]]; } || \
  { [[ -z "${GOOGLE_CLIENT_ID:-}" ]] && [[ -n "${GOOGLE_CLIENT_SECRET:-}" ]]; }; then
  fail "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together"
fi

"$KUBECTL_BIN" get namespace "$NAMESPACE" >/dev/null

create_literal_secret_if_missing() {
  local name="$1"
  local key="$2"
  local value="$3"

  if "$KUBECTL_BIN" -n "$NAMESPACE" get secret "$name" >/dev/null 2>&1; then
    printf 'Secret %s already exists; left unchanged.\n' "$name"
    return
  fi

  "$KUBECTL_BIN" -n "$NAMESPACE" create secret generic "$name" \
    --from-literal="${key}=${value}" >/dev/null
  printf 'Created Secret %s.\n' "$name"
}

reconcile_issopen_env() {
  local manifest
  local -a arguments=(
    create secret generic issopen-env
    "--from-literal=BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}"
  )

  if [[ -n "${GOOGLE_CLIENT_ID:-}" ]]; then
    arguments+=(
      "--from-literal=GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
      "--from-literal=GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}"
    )
  elif "$KUBECTL_BIN" -n "$NAMESPACE" get secret issopen-env >/dev/null 2>&1; then
    printf 'Secret issopen-env already exists and Google OAuth is not configured; left unchanged.\n'
    return
  fi

  manifest="$(mktemp)"
  chmod 600 "$manifest"
  trap "rm -f -- '$manifest'" EXIT
  "$KUBECTL_BIN" -n "$NAMESPACE" "${arguments[@]}" \
    --dry-run=client -o yaml >"$manifest"
  "$KUBECTL_BIN" apply -f "$manifest" >/dev/null
  rm -f -- "$manifest"
  trap - EXIT
  printf 'Reconciled Secret issopen-env without printing values.\n'
}

reconcile_issopen_env
create_literal_secret_if_missing issopen-postgres-env POSTGRES_PASSWORD "$POSTGRES_PASSWORD"

if "$KUBECTL_BIN" -n "$NAMESPACE" get secret registry-serviciosegado >/dev/null 2>&1; then
  printf 'Secret registry-serviciosegado already exists; left unchanged.\n'
else
  "$KUBECTL_BIN" -n "$NAMESPACE" create secret generic registry-serviciosegado \
    --type=kubernetes.io/dockerconfigjson \
    --from-file=".dockerconfigjson=${DOCKER_CONFIG_FILE}" >/dev/null
  printf 'Created Secret registry-serviciosegado.\n'
fi

for secret_name in issopen-env issopen-postgres-env registry-serviciosegado; do
  "$KUBECTL_BIN" -n "$NAMESPACE" get secret "$secret_name" -o name
done
