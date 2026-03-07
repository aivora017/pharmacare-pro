#!/usr/bin/env bash
set -euo pipefail

REPO_PATH="${1:-$HOME/workspace/pharmacare-pro}"

echo "[1/7] Updating apt packages..."
sudo apt update

echo "[2/7] Installing base build tools and Tauri Linux deps..."

# WebKitGTK package naming varies by Ubuntu release. Pick one that exists.
WEBKIT_DEV_PKG=""
if apt-cache show libwebkit2gtk-4.1-dev >/dev/null 2>&1; then
  WEBKIT_DEV_PKG="libwebkit2gtk-4.1-dev"
elif apt-cache show libwebkit2gtk-4.0-dev >/dev/null 2>&1; then
  WEBKIT_DEV_PKG="libwebkit2gtk-4.0-dev"
else
  echo "Error: no supported WebKitGTK dev package found (tried libwebkit2gtk-4.1-dev, libwebkit2gtk-4.0-dev)."
  exit 1
fi

sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  pkg-config \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  "$WEBKIT_DEV_PKG"

echo "[3/7] Installing Node.js 20.x..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "[4/7] Installing Rust toolchain..."
if ! command -v rustc >/dev/null 2>&1; then
  curl https://sh.rustup.rs -sSf | sh -s -- -y
fi

# shellcheck disable=SC1091
source "$HOME/.cargo/env"

# rustup may be present without an active default toolchain (e.g. interrupted install).
if command -v rustup >/dev/null 2>&1; then
  if ! rustup show active-toolchain >/dev/null 2>&1; then
    rustup default stable
  fi
fi

echo "[5/7] Verifying toolchain..."
git --version
node -v
npm -v
rustc --version
cargo --version

echo "[6/7] Configuring git line-ending behavior for Linux..."
git config --global core.autocrlf input
git config --global core.eol lf

echo "[7/7] Installing project dependencies..."
cd "$REPO_PATH"
npm install

echo "Bootstrap complete."
echo "Next commands:"
echo "  cd $REPO_PATH"
echo "  npm run typecheck"
echo "  npm run lint"
echo "  npm run test -- --run"
echo "  npm run tauri:dev"
