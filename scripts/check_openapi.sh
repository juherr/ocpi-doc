#!/usr/bin/env bash
set -euo pipefail

shopt -s nullglob

version_dirs=(openapi/ocpi-*)
if [ ${#version_dirs[@]} -eq 0 ]; then
  echo "ERROR: no OpenAPI version directories found under openapi/ocpi-*"
  exit 1
fi

for version_dir in "${version_dirs[@]}"; do
  if [ ! -d "${version_dir}" ]; then
    continue
  fi

  files=("${version_dir}"/*.yaml)
  if [ ${#files[@]} -eq 0 ]; then
    echo "WARNING: no YAML files found in ${version_dir}"
    continue
  fi

  module_files=()
  for file in "${files[@]}"; do
    if [ "$(basename "${file}")" != "openapi.yaml" ]; then
      module_files+=("${file}")
    fi
  done

  for file in "${files[@]}"; do
    echo "=== redocly lint ${file} ==="
    redocly lint "${file}"
  done

  for file in "${files[@]}"; do
    echo "=== swagger-cli validate ${file} ==="
    swagger-cli validate "${file}"
  done

  for file in "${module_files[@]}"; do
    echo "=== spectral lint ${file} ==="
    spectral lint --fail-severity=error "${file}"
  done

  for file in "${module_files[@]}"; do
    echo "=== openapi-generator validate ${file} ==="
    openapi-generator validate -i "${file}"
  done
done
