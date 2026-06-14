# Octopus Local Bridge

The Bridge is a small Node.js process that runs on **your machine** and connects it to the Octopus Cockpit (`octopuskills.com`). It is the **eyes and hands** of Octopus Agent on your local environment:

- 🏠 **Smart Home**: discovers and controls WiZ lights
- 🦙 **Ollama** (FASE 1): detects local LLM models (works even when Ollama is closed)
- 💻 **Code Arm** (FASE 3, coming): executes shell, edits files, runs commands

## How it works

The Bridge is automatically generated and downloaded with your **personal token** baked in. There is **no manual configuration**.

### Quick install (single-script, recommended)

Open the Octopus Cockpit → **Brazos Activos** → **Hogar Inteligente** → **Descargar Bridge**.

The app generates a script for your platform:

| Platform | File          | Mode                                      |
|----------|---------------|-------------------------------------------|
| macOS    | `.command`    | Manual (terminal stays open)              |
| Windows  | `.bat`        | Manual (cmd window stays open)            |
| Linux    | `.sh`         | Manual (terminal stays open)              |
| macOS    | service `.command` | Background (LaunchAgent, auto-start) |
| Windows  | service `.bat`     | Background (Startup shortcut, hidden)|
| Linux    | service `.sh`      | Background (systemd user service)    |

Double-click the file and the Bridge starts — no extra steps.

## Ollama detection — multi-strategy

The Bridge detects Ollama using **3 layers** so it works even when the Ollama service is closed:

1. **HTTP probe** → `GET http://localhost:11434/api/tags` (most reliable when running)
2. **Filesystem walk** → reads `~/.ollama/models/manifests/registry.ollama.ai/<namespace>/<model>/<tag>` to enumerate downloaded models even if Ollama is closed
3. **Process check** → `tasklist` / `ps` to see if `ollama` is running in background

This means: even if you have Ollama installed but **closed**, Octopus will still know about your models. ✅

The Bridge POSTs the result to:

```
POST /api/arms/ollama/status
Headers: x-bridge-token: <your token>
Body: { installed, running, version, models, detectionMethod, os }
```

every 60 seconds.

## Endpoints used by the Bridge

- `GET  /api/hogar/bridge` — pull pending Smart Home commands
- `POST /api/hogar/bridge` — report device state, command results, heartbeat
- `POST /api/arms/ollama/status` — report Ollama detection (FASE 1)

## Future evolution

This directory will become a fully separate package (`@octopus/bridge`) in FASE 3 when the Code Arm lands and the Bridge needs:

- WebSocket bidirectional channel (instead of polling)
- Sandboxed code execution
- File watcher / live preview server
- Per-arm capability registry

For FASE 1 the Bridge is generated dynamically by `app/api/hogar/bridge/installer/route.ts` — every download embeds a fresh user token.
