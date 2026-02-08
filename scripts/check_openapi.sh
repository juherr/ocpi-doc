#!/usr/bin/env bash
set -euo pipefail

for file in openapi-2.3.0/*.yaml; do
  echo "=== redocly lint ${file} ==="
  redocly lint "${file}"
done

for file in openapi-2.3.0/*.yaml; do
  echo "=== swagger-cli validate ${file} ==="
  swagger-cli validate "${file}"
done

for file in openapi-2.3.0/*.yaml; do
  echo "=== spectral lint ${file} ==="
  spectral lint --fail-severity=error "${file}"
done

for file in openapi-2.3.0/*.yaml; do
  echo "=== openapi-generator validate ${file} ==="
  openapi-generator validate -i "${file}"
done
