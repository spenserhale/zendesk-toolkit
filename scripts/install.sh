#!/usr/bin/env sh
# Install the Zendesk Toolkit CLI from GitHub Releases.
# Usage: curl -fsSL https://raw.githubusercontent.com/spenserhale/zendesk-toolkit/main/scripts/install.sh | sh

set -eu

REPO="spenserhale/zendesk-toolkit"
VERSION="${ZENDESK_TOOLKIT_VERSION:-latest}"
INSTALL_DIR="${ZENDESK_TOOLKIT_INSTALL:-$HOME/.local/bin}"

detect_platform() {
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  arch=$(uname -m)
  case "$os" in darwin|linux) ;; *) echo "Unsupported OS: $os"; exit 1 ;; esac
  case "$arch" in x86_64|amd64) arch="x64" ;; arm64|aarch64) arch="arm64" ;; *) echo "Unsupported arch: $arch"; exit 1 ;; esac
  echo "${os}-${arch}"
}

asset="zendesk-$(detect_platform)"
if [ "$VERSION" = "latest" ]; then
  base="https://github.com/${REPO}/releases/latest/download"
else
  base="https://github.com/${REPO}/releases/download/${VERSION}"
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
echo "Downloading $asset..."
curl -fsSL -o "$tmp/$asset" "$base/$asset"
curl -fsSL -o "$tmp/$asset.sha256" "$base/$asset.sha256"
echo "Verifying checksum..."
(cd "$tmp" && shasum -a 256 -c "$asset.sha256")

mkdir -p "$INSTALL_DIR"
install_path="$INSTALL_DIR/zendesk"
mv "$tmp/$asset" "$install_path"
chmod +x "$install_path"
echo "Installed zendesk to $install_path"
case ":$PATH:" in *":$INSTALL_DIR:"*) ;; *) echo "Add to PATH: export PATH=\"$INSTALL_DIR:\$PATH\"" ;; esac
