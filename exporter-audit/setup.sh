#!/usr/bin/env bash
set -euo pipefail

script_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$script_dir"

prompt_existing_dir() {
  local label="$1"
  local input resolved

  while true; do
    printf '%s: ' "$label" >&2
    IFS= read -r input

    if [ -z "$input" ]; then
      echo "Path cannot be empty." >&2
      continue
    fi

    if [ ! -d "$input" ]; then
      echo "Not a directory: $input" >&2
      continue
    fi

    resolved="$(cd -- "$input" && pwd -P)"
    printf '%s\n' "$resolved"
    return 0
  done
}

confirm() {
  local prompt="$1"
  local answer

  printf '%s ' "$prompt" >&2
  IFS= read -r answer
  case "${answer:-}" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

replace_path() {
  local path="$1"
  if [ -e "$path" ] || [ -L "$path" ]; then
    rm -rf "$path"
  fi
}

game_managed="$(prompt_existing_dir 'Captain of Industry Managed folder')"
mods_target="$(prompt_existing_dir 'Captain of Industry Mods folder')"

echo
echo "game_libs -> $game_managed"
echo "mods_folder -> $mods_target"
echo

if ! confirm "Create or replace these links in $script_dir? [y/N]"; then
  echo "Cancelled."
  exit 1
fi

replace_path "game_libs"
replace_path "mods_folder"

ln -s "$game_managed" game_libs
ln -s "$mods_target" mods_folder

echo "Setup complete."
