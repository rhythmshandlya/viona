#!/bin/bash
set -e

echo "Setting up audio enhancement dependencies..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv-enhance" ]; then
  python3 -m venv venv-enhance
fi

# Activate and install
source venv-enhance/bin/activate
pip install -r scripts/requirements.txt

echo "Audio enhancement setup complete!"
