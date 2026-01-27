@echo off
echo Setting up audio enhancement dependencies...

if not exist "venv-enhance" (
  python -m venv venv-enhance
)

call venv-enhance\Scripts\activate.bat
pip install -r scripts\requirements.txt

echo Audio enhancement setup complete!
