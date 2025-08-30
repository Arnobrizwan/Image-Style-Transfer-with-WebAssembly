#!/bin/bash
set -e

echo "Building Rust WebAssembly package..."

cd wasm-engine

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build the WebAssembly package
wasm-pack build --target web --out-dir ../public/wasm --out-name style_transfer_wasm

cd ..

echo "WebAssembly build completed!"
echo "Files generated in public/wasm/"
