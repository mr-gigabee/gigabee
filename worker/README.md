# gigabee-worker

**Gigabee native GPU worker** — connect your GPU to the [Gigabee](https://gigabee.io) hive and earn USDC for every AI inference job you complete.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org)
[![Ollama](https://img.shields.io/badge/Ollama-required-orange)](https://ollama.ai)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)

---

## How it works

1. Your machine connects to the Gigabee orchestrator over WebSocket
2. When a user sends a chat message and no worker is assigned, the orchestrator dispatches the job to you
3. Your GPU runs the model locally via Ollama and streams tokens back in real time
4. You earn **Honey** (USDC) for every completed job — 75% of the job's credit value

```
User → Gigabee Orchestrator → Your GPU (Ollama) → tokens stream back → User
```

---

## Requirements

| Component | Minimum         | Notes                                      |
|-----------|-----------------|---------------------------------------------|
| OS        | Ubuntu 20.04+   | Debian, Fedora also work                    |
| Node.js   | v18             | v22 LTS recommended                         |
| GPU       | 4 GB VRAM       | For `bee-hover`. 40 GB for `bee-glide`      |
| RAM       | 8 GB            | 16 GB+ recommended                          |
| Disk      | 10 GB free      | Ollama model files                          |
| Network   | Stable outbound | WebSocket to gigabee.io on port 443         |

> **No GPU?** Ollama can run on CPU, but inference is 10–50× slower and the scheduler assigns fewer jobs. A GPU is required for meaningful earnings.

---

## Quick start

### 1. Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # v22.x.x
```

### 2. Install Ollama

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

Ollama starts automatically as a systemd service. Verify with:

```bash
ollama --version
curl http://localhost:11434/api/tags   # should return JSON
```

### 3. Pull a model

```bash
# bee-hover tier — requires ~4 GB VRAM
ollama pull llama3.2:3b

# bee-glide tier — requires ~40 GB VRAM (high-end GPUs only)
ollama pull llama3.3:70b
```

Confirm the model is ready:

```bash
ollama list
```

### 4. Clone this repo and install dependencies

```bash
git clone https://github.com/mr-gigabee/gigabee-worker.git
cd gigabee-worker
npm install
```

### 5. Get your session token

Log in at [gigabee.io/earn](https://gigabee.io/earn), open the **Native Worker** tab, and copy your session token.

> Keep this token private. Anyone with it can register a worker under your account.

### 6. Run

```bash
export GIGABEE_TOKEN=your-session-token-here
export GIGABEE_MODELS=bee-hover   # or bee-glide, or bee-hover,bee-glide

node gigabee-worker.mjs
```

Expected output:

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

[job 3a1b2c3d] Accepted (bee-hover → llama3.2:3b)
[job 3a1b2c3d] Done — 312 tokens, ~38 tok/s, 8.2s
[job 3a1b2c3d] Earned $0.0075 Honey (pending 24h)
```

---

## Configuration

All configuration is via environment variables:

| Variable          | Default                  | Description                                              |
|-------------------|--------------------------|----------------------------------------------------------|
| `GIGABEE_TOKEN`   | *(required)*             | Your session token from gigabee.io/earn                  |
| `GIGABEE_MODELS`  | `bee-glide`              | Comma-separated tier IDs to serve                        |
| `GIGABEE_SERVER`  | `https://gigabee.io`     | Orchestrator URL — leave as default                      |
| `OLLAMA_HOST`     | `http://localhost:11434` | Ollama API base URL                                      |

### GIGABEE_MODELS values

| Value       | Ollama model   | Min VRAM | Best for                        |
|-------------|----------------|----------|---------------------------------|
| `bee-hover` | `llama3.2:3b`  | 4 GB     | Fast responses, everyday chat   |
| `bee-glide` | `llama3.3:70b` | ~40 GB   | Complex reasoning, long answers |

You can serve both tiers from the same machine if you have enough VRAM:

```bash
export GIGABEE_MODELS=bee-hover,bee-glide
```

---

## Running as a service (systemd)

Keep the worker running after reboots and auto-restart on crashes:

```bash
sudo nano /etc/systemd/system/gigabee-worker.service
```

Paste (replace values in `<angle brackets>`):

```ini
[Unit]
Description=Gigabee GPU Worker
After=network-online.target ollama.service
Wants=network-online.target

[Service]
Type=simple
User=<your-linux-user>
WorkingDirectory=/home/<your-linux-user>/gigabee-worker
Environment=GIGABEE_TOKEN=<your-session-token>
Environment=GIGABEE_MODELS=bee-hover
Environment=OLLAMA_HOST=http://localhost:11434
ExecStart=/usr/bin/node gigabee-worker.mjs
Restart=always
RestartSec=15
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable gigabee-worker
sudo systemctl start gigabee-worker

# Check status
sudo systemctl status gigabee-worker

# Follow live logs
sudo journalctl -u gigabee-worker -f
```

---

## Running with Docker

```dockerfile
# Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY gigabee-worker.mjs ./
CMD ["node", "gigabee-worker.mjs"]
```

```bash
docker build -t gigabee-worker .
docker run -d \
  --name gigabee-worker \
  --restart unless-stopped \
  -e GIGABEE_TOKEN=your-token \
  -e GIGABEE_MODELS=bee-hover \
  -e OLLAMA_HOST=http://host.docker.internal:11434 \
  gigabee-worker
```

> On Linux, use `--network host` instead of `-e OLLAMA_HOST=http://host.docker.internal:11434`.

---

## Earnings

The earning formula is fixed in the protocol:

```
earnings_USD = credits_charged × $0.01 × rate
rate = 75%   (standard)
rate = 85%   (staked — Phase 2)
```

| Tier        | Credits/job | Your earnings |
|-------------|-------------|---------------|
| bee-hover   | 10          | $0.0750/job   |
| bee-glide   | 15          | $0.1125/job   |

**Honey** (your balance) matures 24 hours after each job while integrity checks run.
USDC withdrawals to your Solana wallet are in development.

---

## Troubleshooting

**Cannot reach Ollama**
```bash
# Check if Ollama is running
systemctl status ollama
# or start it manually
ollama serve &
# Test
curl http://localhost:11434/api/tags
```

**Auth error: invalid token**
Copy a fresh token from [gigabee.io/earn](https://gigabee.io/earn). The token must match your currently logged-in account.

**Model not found warning**
```bash
ollama pull llama3.2:3b   # bee-hover
ollama pull llama3.3:70b  # bee-glide
```

**GPU not being used**
```bash
# Check NVIDIA GPU is visible to Ollama
nvidia-smi
# Watch GPU utilization during a job
watch -n1 nvidia-smi
```

**Jobs are very slow**
The scheduler deprioritises slow workers. Ensure:
- Ollama is using the GPU (`nvidia-smi` shows usage during jobs)
- No other process is consuming VRAM
- Model is fully loaded (first job is always slower)

**Worker disconnects frequently**
Port 443 outbound (WebSocket / WSS) must be open. Check your VPS firewall:
```bash
sudo ufw status
curl -v https://gigabee.io/api/healthz
```

---

## License

MIT — see [LICENSE](./LICENSE)
