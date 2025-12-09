# Check for Python 3.11+
$pythonVersion = python --version 2>&1
Write-Host "Detected Python: $pythonVersion"

# 1. Create Main Venv (for Demucs)
Write-Host "`n--- Setting up Main Venv (Demucs) ---"
if (-not (Test-Path ".venv")) {
    Write-Host "Creating .venv..."
    python -m venv .venv
} else {
    Write-Host ".venv already exists."
}

# Install Demucs and Torch (CUDA)
Write-Host "Installing Demucs dependencies (CUDA enabled)..."
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
& .\.venv\Scripts\python.exe -m pip install demucs

# 2. Create MAEST Venv
Write-Host "`n--- Setting up MAEST Venv ---"
if (-not (Test-Path ".venv\maest")) {
    Write-Host "Creating .venv\maest..."
    python -m venv .venv\maest
} else {
    Write-Host ".venv\maest already exists."
}

# Install MAEST dependencies
Write-Host "Installing MAEST dependencies..."
& .\.venv\maest\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\maest\Scripts\python.exe -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
& .\.venv\maest\Scripts\python.exe -m pip install "transformers>=4.44" "accelerate>=0.33" librosa soundfile numpy

Write-Host "`n--- Setup Complete! ---"
Write-Host "1. Ensure 'config\windows.env' points to these venvs (it should match the defaults)."
Write-Host "2. Run 'npm install' if you haven't already."
Write-Host "3. Start the app with 'npm run dev'."
