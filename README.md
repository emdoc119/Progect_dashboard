# Progect Dashboard

A centralized project manager and process watchdog dashboard designed to monitor, start, and stop multiple web apps, scripts, and agents on a single host.

## Requirements
- Node.js (v18+)
- Local `git` and network access

## Installation & Setup

1. **Clone the dashboard**:
   ```bash
   git clone https://github.com/emdoc119/Progect_dashboard.git
   cd Progect_dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and set the credentials:
   ```bash
   cp .env.example .env
   ```
   See [.env.example](.env.example) for all available options and descriptions.

4. **Register Projects**:
   The `projects.json` file dictates which repositories are managed.
   Update the `local_path` fields in `projects.json` to point to the correct clone locations on your machine.

   > **Note**: Dependency installation (`pip install`, `npm ci`) must be done manually in the respective project directories before attempting to start them through the dashboard.

## Starting the Dashboard

### Development Mode
```bash
npm run dev
```
Runs the Express API server (port 3001) and the Vite dev server (port 8081) concurrently. The Vite server proxies `/api` requests to Express. Access the dashboard at `http://localhost:8081`.

### Production Mode (Tailscale / Remote)
```bash
npm run build    # Build the React frontend
npm run start    # Start Express with the built UI
```
The production dashboard is available at `http://<dashboard-host>:3001`. Express serves the built UI, API, and handles authentication from a single origin. **Do not expose the Vite development server through Tailscale.**

### Safe Verification Mode
```bash
DASHBOARD_AUTOSTART=false npm run start
```
Starts the dashboard without launching any `always_on` projects. Use this for testing and validation.

## Key Features

### Process Manager
Safely starts and stops arbitrary scripts (Python, Node, Go) by executing their commands in the background. Tracks running PIDs, ports, and status transitions (`starting` → `running` → `stopped` / `crashed`).

### Auto-restart (Watchdog)
Projects with `"always_on": true` automatically restart on crash with exponential backoff:
- **Backoff delay**: 5s → 10s → 20s → 40s → 60s (capped)
- **Max retries**: 5 consecutive crashes
- **Stability window**: 60 seconds of stable run resets the retry counter
- After 5 failures, the project enters `crashed` state and stops retrying

### Loopback Security
All dynamic sub-apps are bound to `127.0.0.1` by default. The `{host}` placeholder in `run_command` is replaced with `127.0.0.1` at runtime. Projects without `"exposure": "loopback"` are rejected.

> **Remote access**: When using the dashboard remotely (via Tailscale), you can view status and start/stop projects, but **cannot directly open sub-app UIs** since they are bound to loopback. A reverse proxy is required for remote sub-app access (not implemented).

### Log Rotation
Process logs are written to `logs_<name>.txt` with automatic rotation:
- **File size limit**: 10MB per file
- **Time interval**: Daily rotation
- **Retention**: Maximum 5 rotated files

### Authentication & Security
- **Basic Auth**: Enabled when `DASHBOARD_AUTH_USERNAME` and `DASHBOARD_AUTH_PASSWORD` are set
- **Mandatory for external access**: If `DASHBOARD_ALLOW_LAN=true` (binds to `0.0.0.0`), authentication credentials are **required** — the server refuses to start without them
- **Timing-safe comparison**: Password verification uses `crypto.timingSafeEqual`
- **Error masking**: Sensitive data (passwords, tokens, DB URLs) is masked in API responses and logs

### Registry Schema Validation
On startup, `projects.json` entries are validated:
- Dynamic projects must have `name`, `type`, `local_path`, `run_command`, `always_on`, `exposure: "loopback"`, and `{host}` placeholder
- Static projects must have `access_url` or `entry_point`
- Invalid entries are logged with specific errors and disabled (server continues running)

## Troubleshooting

### App repeatedly crashing
Check `logs_<app_name>.txt` in the root directory. If an app crashes 5 times in a row, the watchdog will stop trying and flag it as `Crashed` on the dashboard. Use manual Start to reset the retry counter.

### Port already in use
The dashboard dynamically searches for available ports starting from 4000. It injects the chosen port into the `{port}` token in your `run_command`.

### secretary_agent Database Errors

| Mode | DB Host | When to Use |
|------|---------|-------------|
| **Native (Mac)** | `127.0.0.1` or `localhost` | Running via the dashboard with `uv run uvicorn` |
| **Docker Compose** | `db` (service name) | Running in a container network |

- **`socket.gaierror`**: Usually means the DB host in `.env` is set to a Docker service name (`db`) but you're running natively. Change to `127.0.0.1`.
- **Connection refused**: Local PostgreSQL may not be running. Start it with `brew services start postgresql`.
- The dashboard will mask credentials in error messages and display a safe summary on the UI.

## Testing
```bash
npm test          # Run all tests (node --test)
npm run lint      # Run oxlint
npm run build     # Build production bundle
```

Tests run with `DASHBOARD_AUTOSTART=false` to prevent sub-project launches.
