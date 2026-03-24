#!/bin/bash
# Backend server sidecar for Android TV Remote
# This script runs the Node.js backend server

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
exec node src/server.js
