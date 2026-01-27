@echo off
echo Setting up WhisperX environment...
echo.

cd /d "%~dp0"

echo [1/3] Creating Python virtual environment...
python -m venv .venv
if errorlevel 1 (
    echo ERROR: Failed to create venv. Make sure Python 3.10+ is installed.
    exit /b 1
)

echo [2/3] Installing PyTorch with CUDA 12.1...
.venv\Scripts\pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
if errorlevel 1 (
    echo WARNING: CUDA install failed. Falling back to CPU-only PyTorch...
    .venv\Scripts\pip install torch torchaudio
)

echo [3/3] Installing WhisperX and dependencies...
.venv\Scripts\pip install "whisperx @ git+https://github.com/m-bain/whisperX.git"
if errorlevel 1 (
    echo ERROR: Failed to install WhisperX.
    exit /b 1
)

echo.
echo WhisperX setup complete!
echo Python: %cd%\.venv\Scripts\python.exe
