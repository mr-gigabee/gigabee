# Gigabee Worker — Windows Setup Guide

Earn Honey (USDC) by running a Gigabee GPU worker on your Windows PC.  
This guide covers everything from a fresh Windows machine to a running worker.

---

## Requirements

| Component | Minimum | Notes |
|-----------|---------|-------|
| OS | Windows 10 (64-bit) | Windows 11 recommended |
| GPU | 4 GB VRAM | NVIDIA or AMD |
| RAM | 8 GB | 16 GB+ recommended |
| Disk | 10 GB free | For Ollama model files |
| Node.js | v18 or newer | v22 LTS recommended |
| Network | Stable internet | WebSocket on port 443 (HTTPS) |

> **No GPU?** Ollama can run on CPU, but inference is much slower and you will receive fewer jobs. A GPU is strongly recommended for meaningful earnings.

---

## Step 1 — Install Node.js

1. Go to **https://nodejs.org** and click **LTS** (the green button).
2. Run the downloaded `.msi` installer.
3. Click **Next** through all the default options — do not change anything.
4. When prompted about **"Tools for Native Modules"**, you can leave it unchecked.
5. Click **Install**, then **Finish**.

**Verify the install** — open **Command Prompt** (`Win + R` → type `cmd` → Enter):

```cmd
node --version
npm --version
```

You should see something like `v22.x.x` for Node and `10.x.x` for npm.

---

## Step 2 — Install Ollama

1. Go to **https://ollama.ai** and click **Download for Windows**.
2. Run **OllamaSetup.exe**.
3. Click through the installer — Ollama installs itself and starts automatically in the system tray (bottom-right corner of your taskbar).

**Verify** in Command Prompt:

```cmd
ollama --version
```

> If you see `'ollama' is not recognized`, restart Command Prompt and try again.

---

## Step 3 — Pull a Model

Choose based on your GPU's VRAM. In Command Prompt:

```cmd
rem bee-hover tier — requires ~4 GB VRAM (most gaming GPUs)
ollama pull llama3.2:3b

rem bee-glide tier — requires ~40 GB VRAM (A100, dual RTX 3090, etc.)
ollama pull llama3.3:70b
```

| Tier | Model | VRAM | Example GPUs |
|------|-------|------|--------------|
| bee-hover | llama3.2:3b | ~4 GB | RTX 3060, RTX 4060, RX 6600 |
| bee-glide | llama3.3:70b | ~40 GB | A100, 2× RTX 3090, RTX 4090 + offload |

The download takes a few minutes. Confirm the model is ready:

```cmd
ollama list
```

---

## Step 4 — Get Your Session Token

1. Go to **https://gigabee.io/earn** in your browser.
2. Connect your Solana wallet.
3. Open the **Native Worker** tab.
4. Click **Copy Token**.

Keep this token private — it identifies your account.

---

## Step 5 — Download the Worker Script

Open **Command Prompt** and run:

```cmd
mkdir %USERPROFILE%\gigabee-worker
cd %USERPROFILE%\gigabee-worker

curl -fsSL https://gigabee.io/gigabee-worker.mjs -o gigabee-worker.mjs

npm init -y
npm install socket.io-client
```

This creates a folder at `C:\Users\<YourName>\gigabee-worker` and downloads the worker.

---

## Step 6 — Run the Worker

Still in Command Prompt, set your token and start:

```cmd
set GIGABEE_TOKEN=your-token-here
set GIGABEE_MODELS=bee-hover
node gigabee-worker.mjs
```

To serve the glide tier instead:

```cmd
set GIGABEE_TOKEN=your-token-here
set GIGABEE_MODELS=bee-glide
node gigabee-worker.mjs
```

To serve both tiers at once (requires enough VRAM):

```cmd
set GIGABEE_TOKEN=your-token-here
set GIGABEE_MODELS=bee-hover,bee-glide
node gigabee-worker.mjs
```

**Expected output on a successful start:**

```
🐝 Gigabee Worker v1.0.0
   Server : https://gigabee.io
   Ollama : http://localhost:11434
   Models : bee-hover

[gigabee] Ollama OK — 1 model(s) available
[gigabee] Benchmarking llama3.2:3b…
[gigabee] Benchmark: ~42 tok/s

[gigabee] Connected to hive — registering…
[gigabee] Registered as worker-a3f8b1c2
[gigabee] Waiting for jobs…
```

Leave this window open while you want to earn. Press `Ctrl + C` to stop.

---

## Step 7 — Keep It Running Automatically (Optional)

### Option A — Startup batch file (simple)

Create a file called `start-worker.bat` inside your `gigabee-worker` folder with this content:

```bat
@echo off
set GIGABEE_TOKEN=your-token-here
set GIGABEE_MODELS=bee-hover
node "%USERPROFILE%\gigabee-worker\gigabee-worker.mjs"
pause
```

Double-click `start-worker.bat` any time you want to start the worker.

### Option B — Auto-start on login with Task Scheduler

1. Press `Win + S` and search for **Task Scheduler** → open it.
2. Click **Create Basic Task** in the right panel.
3. **Name:** `Gigabee Worker` → click **Next**.
4. **Trigger:** select **When I log on** → click **Next**.
5. **Action:** select **Start a program** → click **Next**.
6. **Program/script:** click **Browse** → find your `start-worker.bat` file.
7. Click **Next** → **Finish**.

The worker will now start automatically every time you log into Windows.

### Option C — pm2 (most reliable)

pm2 is a process manager that keeps the worker alive and restarts it if it crashes:

```cmd
npm install -g pm2

set GIGABEE_TOKEN=your-token-here
set GIGABEE_MODELS=bee-hover
pm2 start "%USERPROFILE%\gigabee-worker\gigabee-worker.mjs" --name gigabee-worker

rem Save the process list
pm2 save

rem Set pm2 to start on boot (follow the printed instruction)
pm2 startup
```

View live logs:

```cmd
pm2 logs gigabee-worker
```

Restart after a config change:

```cmd
pm2 restart gigabee-worker
```

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `GIGABEE_TOKEN` | *(required)* | Your session token from gigabee.io/earn |
| `GIGABEE_MODELS` | `bee-glide` | Comma-separated tier IDs to serve |
| `GIGABEE_SERVER` | `https://gigabee.io` | Orchestrator URL — leave as default |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API base URL |

---

## Troubleshooting

### Ollama not found / "ollama is not recognized"

- Restart Command Prompt after installing Ollama.
- Check the system tray (bottom-right) — Ollama should show as a running icon.
- Try restarting your PC.

### Cannot reach Ollama

Test in Command Prompt:

```cmd
curl http://localhost:11434/api/tags
```

If this fails, Ollama is not running. Click the Ollama icon in the system tray, or run:

```cmd
ollama serve
```

### Auth error / invalid token

- Go to gigabee.io/earn and copy a fresh token.
- Make sure there are no spaces when you paste it.
- Check that you copied the full token (they can be long).

### Model not found warning

Run:

```cmd
ollama pull llama3.2:3b
```

Then restart the worker.

### GPU not being used (slow inference)

- Open **Task Manager** → **Performance** → **GPU** tab while a job is active. GPU utilization should be above 0%.
- Make sure no other GPU-heavy app is running (games, video editors, etc.).
- For NVIDIA cards: run `nvidia-smi` in Command Prompt to check VRAM usage.

### Worker disconnects repeatedly

Port 443 outbound (HTTPS/WebSocket) must be open. Test:

```cmd
curl -v https://gigabee.io/api/healthz
```

If this fails, check your firewall or antivirus — some software blocks WebSocket connections.

---

## Summary

```
Install Node.js  →  Install Ollama  →  ollama pull llama3.2:3b
→  Copy token from /earn  →  Download worker script
→  set GIGABEE_TOKEN=...  →  node gigabee-worker.mjs
```

That's it — you're earning Honey. 🐝
