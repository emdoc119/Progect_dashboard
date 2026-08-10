import 'dotenv/config';
import express from 'express';
import basicAuth from 'express-basic-auth';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execFile } from 'child_process';
import checkPort from 'tcp-port-used';
import { createStream } from 'rotating-file-stream';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getTailscaleIpv4() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(entry.address)) {
        return entry.address;
      }
    }
  }
  return null;
}

let tailscaleServeCache = { checkedAt: 0, routes: [], configured: false };

function readTailscaleServe() {
  const now = Date.now();
  if (now - tailscaleServeCache.checkedAt < 30000) return Promise.resolve(tailscaleServeCache);

  return new Promise((resolve) => {
    execFile('tailscale', ['serve', 'status', '--json'], { timeout: 2500 }, (error, stdout) => {
      if (error) {
        tailscaleServeCache = { checkedAt: now, routes: [], configured: false };
        return resolve(tailscaleServeCache);
      }

      try {
        const config = JSON.parse(stdout);
        const routes = Object.entries(config.Web || {}).flatMap(([host, value]) =>
          Object.entries(value.Handlers || {}).map(([route, handler]) => ({
            host,
            route,
            proxy: handler.Proxy || null
          }))
        );
        tailscaleServeCache = { checkedAt: now, routes, configured: routes.length > 0 };
      } catch {
        tailscaleServeCache = { checkedAt: now, routes: [], configured: false };
      }
      resolve(tailscaleServeCache);
    });
  });
}

// Telegram notification helper (Sprint 4)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown'
      })
    });
  } catch (e) {
    console.error('[Telegram] Failed to send notification:', e.message);
  }
}

// Mask sensitive data (P0-3)
export function maskSecretData(str) {
  if (!str || typeof str !== 'string') return str;
  // Mask URLs containing credentials: scheme://user:pass@host
  let masked = str.replace(/([a-zA-Z0-9+.-]+:\/\/)([^:/@\s]+):([^:/@\s]+)@/gi, '$1***:***@');
  // Mask quoted token/key values: token="value" or token='value'
  masked = masked.replace(/(password|secret|token|key|api_key)\s*[=:]\s*["']([^"']+)["']/gi, '$1=***');
  // Mask unquoted key=value secrets
  masked = masked.replace(/(password|secret|token|key|api_key)\s*[=:]\s*([^\s&"']+)/gi, '$1=***');
  return masked;
}

/**
 * Creates and configures the Express application.
 * @param {Object} [options] - Configuration overrides for testing.
 * @param {string} [options.host] - Bind host override.
 * @param {number} [options.port] - Bind port override.
 * @param {boolean} [options.autoStart] - Whether to auto-start always_on projects.
 * @param {string} [options.authUsername] - Basic Auth username override.
 * @param {string} [options.authPassword] - Basic Auth password override.
 * @param {string} [options.registryPath] - Path to projects.json override.
 * @param {string} [options.distPath] - Path to dist/ override.
 * @returns {{ app: express.Application, runningApps: Object, projects: Array, startProject: Function, startServer: Function }}
 */
export function createApp(options = {}) {
  const HOST = options.host ?? (process.env.DASHBOARD_ALLOW_LAN === 'true' ? '0.0.0.0' : (process.env.DASHBOARD_HOST || '127.0.0.1'));
  const PORT = options.port ?? (process.env.DASHBOARD_PORT || 3001);
  const AUTO_START_ENABLED = options.autoStart ?? (process.env.DASHBOARD_AUTOSTART !== 'false');
  const authUsername = options.authUsername !== undefined ? options.authUsername : process.env.DASHBOARD_AUTH_USERNAME;
  const authPassword = options.authPassword !== undefined ? options.authPassword : process.env.DASHBOARD_AUTH_PASSWORD;

  // External bind safety check
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1') {
    if (!authUsername || !authPassword) {
      console.error(`FATAL: Server bound to external interface ${HOST} without DASHBOARD_AUTH_USERNAME/PASSWORD. Authentication is strictly required.`);
      process.exit(1);
    }
  }

  const app = express();
  app.use(express.json());

  // Basic Auth Middleware applied before static routing
  if (authUsername && authPassword) {
    app.use(basicAuth({
      authorizer: (username, password) => {
        try {
          const expectedUser = Buffer.from(authUsername);
          const expectedPass = Buffer.from(authPassword);
          const givenUser = Buffer.from(username);
          const givenPass = Buffer.from(password);

          if (expectedUser.length !== givenUser.length || expectedPass.length !== givenPass.length) {
            return false;
          }

          const userMatches = crypto.timingSafeEqual(givenUser, expectedUser);
          const passMatches = crypto.timingSafeEqual(givenPass, expectedPass);
          return userMatches && passMatches;
        } catch {
          return false;
        }
      },
      challenge: true
    }));
  }

  // Serve /apps
  const APPS_DIR = path.join(__dirname, 'apps');
  app.use('/apps', express.static(APPS_DIR));

  // Serve the built dashboard in production. Vite serves the source files only
  // during development and proxies /api to this process.
  const distPath = options.distPath ?? path.join(__dirname, 'dist');
  const hasFrontendBuild = fs.existsSync(distPath);
  if (hasFrontendBuild) {
    app.use(express.static(distPath));
  }

  const regPath = options.registryPath ?? path.join(__dirname, 'projects.json');
  let projects = [];
  try {
    projects = JSON.parse(fs.readFileSync(regPath, 'utf8')).projects;
  } catch (err) {
    console.error('Failed to load projects.json:', err);
  }

  // Validate registry schema and filter out invalid entries
  const validationErrors = [];
  projects = projects.filter(p => {
    const errors = [];
    if (!p.name || typeof p.name !== 'string') errors.push('missing or invalid "name"');
    if (!p.type || typeof p.type !== 'string') errors.push('missing or invalid "type"');

    const isRemote = p.runtime === 'remote' || p.service_kind === 'remote';
    if (isRemote) {
      if (!p.access_url && !p.health_url) errors.push('remote project must have "access_url" or "health_url"');
      if (typeof p.always_on !== 'boolean') errors.push('"always_on" must be a boolean');
      if (errors.length > 0) {
        const msg = `[Registry] Project "${p.name || '(unnamed)'}" has schema errors: ${errors.join('; ')}`;
        console.warn(msg);
        validationErrors.push(msg);
        return false;
      }
      return true;
    }

    if (p.type === 'static-html') {
      // Static projects need at least one of access_url or entry_point
      if (!p.access_url && !p.entry_point) {
        errors.push('static-html project must have "access_url" or "entry_point"');
      }
    } else {
      // Dynamic projects need these fields
      if (!p.local_path) errors.push('missing "local_path"');
      if (!p.run_command) errors.push('missing "run_command"');
      if (p.exposure !== 'loopback') errors.push('"exposure" must be "loopback" for dynamic projects');
      // Docker Compose commands don't need {host} — containers bind internally
      const isDockerCompose = p.run_command && p.run_command.includes('docker compose');
      if (p.run_command && !p.run_command.includes('{host}') && !isDockerCompose) {
        errors.push('"run_command" must include {host} placeholder');
      }
      if (typeof p.always_on !== 'boolean') errors.push('"always_on" must be a boolean');
    }

    if (errors.length > 0) {
      const msg = `[Registry] Project "${p.name || '(unnamed)'}" has schema errors: ${errors.join('; ')}`;
      console.warn(msg);
      validationErrors.push(msg);
      return false; // filter out invalid project
    }
    return true;
  });

  const runningApps = {};
  const uptimeStats = {};
  let nextAppPort = 4000;
  const healthCache = new Map();

  function getPublicDashboardUrl() {
    const configured = process.env.DASHBOARD_PUBLIC_URL?.trim();
    if (configured) return configured.replace(/\/$/, '');
    const tailscaleIp = getTailscaleIpv4();
    return tailscaleIp ? `http://${tailscaleIp}:${PORT}` : `http://127.0.0.1:${PORT}`;
  }

  async function getAccessInfo() {
    const tailscaleIp = getTailscaleIpv4();
    const serve = await readTailscaleServe();
    const dashboardProxy = serve.routes.find(route => route.proxy?.endsWith(`:${PORT}`)) || null;
    const configuredUrl = process.env.DASHBOARD_PUBLIC_URL?.trim()?.replace(/\/$/, '');
    const serveUrl = dashboardProxy
      ? `https://${dashboardProxy.host.replace(/:443$/, '')}${dashboardProxy.route === '/' ? '' : dashboardProxy.route}`
      : null;

    return {
      bindHost: HOST,
      port: Number(PORT),
      tailscaleIp,
      dashboardUrl: getPublicDashboardUrl(),
      tailscaleUrl: configuredUrl || (tailscaleIp ? `http://${tailscaleIp}:${PORT}` : null),
      serveConfigured: serve.configured,
      dashboardProxy,
      serveUrl,
      serveRoutes: serve.routes
    };
  }

  async function probeHealth(project, appState) {
    const configuredUrl = project.health_url || project.healthUrl;
    if (!configuredUrl) {
      return { status: 'unknown', url: null, checkedAt: null, latencyMs: null, detail: 'No health URL configured' };
    }

    const port = appState?.port || project.fixed_port || project.port;
    const target = configuredUrl
      .replaceAll('{port}', String(port || ''))
      .replaceAll('{host}', '127.0.0.1');
    const cacheKey = `${project.name}:${target}`;
    const now = Date.now();
    const cached = healthCache.get(cacheKey);
    if (cached && now - cached.checkedAt < 5000) return cached;

    const started = Date.now();
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(2500), redirect: 'manual' });
      const result = {
        status: response.ok ? 'healthy' : 'unhealthy',
        url: target,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        httpStatus: response.status,
        detail: response.ok ? 'Health check passed' : `HTTP ${response.status}`
      };
      healthCache.set(cacheKey, { ...result, checkedAt: now });
      return result;
    } catch (err) {
      const result = {
        status: 'unhealthy',
        url: target,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        httpStatus: null,
        detail: maskSecretData(err.message)
      };
      healthCache.set(cacheKey, { ...result, checkedAt: now });
      return result;
    }
  }

 async function findAvailablePort(startPort) {
   let port = startPort;
    try {
      while (await checkPort.check(port, '127.0.0.1')) {
        port++;
      }
      return port;
    } catch (err) {
      if (err.code === 'EPERM' || (err.message && err.message.includes('EPERM'))) {
        const epermErr = new Error(`Port check failed with EPERM: ${err.message}`);
        epermErr.code = 'EPERM';
        throw epermErr;
      }
      throw err;
    }
 }

  // Log rotation utility using rotating-file-stream
  function getLogStream(name) {
    return createStream(`logs_${name}.txt`, {
      size: '10M', // rotate every 10 MegaBytes
      interval: '1d', // rotate daily
      maxFiles: 5, // keep at most 5 files
      path: __dirname
    });
  }

  async function startProject(name, manual = false) {
    const project = projects.find(p => p.name === name);
    if (!project) return { status: 404, message: 'Project not found' };

    if (project.runtime === 'remote' || project.service_kind === 'remote') {
      return {
        status: 409,
        message: 'This is a remote service. The dashboard can monitor it but cannot start or stop it here.',
        url: project.access_url || project.health_url || null
      };
    }

    if (project.type === 'static-html') {
      if (project.access_url) {
        return { status: 200, message: 'Static project', url: project.access_url };
      } else if (project.entry_point) {
        return { status: 200, message: 'Static project', url: `/apps/${name}/${project.entry_point}` };
      } else {
        return { status: 400, message: 'No access URL or entry point defined for this static project.' };
      }
    }

    if (runningApps[name]) {
      if (runningApps[name].status === 'running') {
        return { status: 200, message: 'Already running', url: `http://localhost:${runningApps[name].port}/` };
      }
      if (runningApps[name].status === 'starting') {
        return { status: 400, message: 'Already starting' };
      }
      if (runningApps[name].status === 'stopping') {
        return { status: 400, message: 'Currently stopping' };
      }
    }

    // Reset retry count on manual start
   if (manual && runningApps[name]) {
     runningApps[name].retryCount = 0;
     if (runningApps[name].restartTimer) {
       clearTimeout(runningApps[name].restartTimer);
       runningApps[name].restartTimer = null;
     }
   }

    let port;
    try {
      if (project.fixed_port || project.port) {
        port = Number(project.fixed_port || project.port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          return { status: 400, error: `Invalid fixed port for project: ${port}` };
        }
        if (await checkPort.check(port, '127.0.0.1')) {
          return { status: 409, error: `Fixed port ${port} is already in use` };
        }
      } else {
        port = await findAvailablePort(nextAppPort++);
      }
    } catch (err) {
      if (err.code === 'EPERM' || (err.message && err.message.includes('EPERM'))) {
        console.warn(`[ProcessManager] Skipping project "${name}" start due to port check EPERM in sandbox environment.`);
        return { status: 500, error: `Port check failed due to sandbox restriction (EPERM): ${err.message}` };
      }
      return { status: 500, error: `Failed to find available port: ${err.message}` };
    }
   let commandStr = project.run_command;

    if (project.type !== 'static-html') {
      if (project.exposure !== 'loopback') {
        return { status: 400, message: 'Invalid exposure setting. Only loopback is permitted for dynamic apps.' };
      }
      const isDockerCompose = commandStr.includes('docker compose');
      if (!commandStr.includes('{host}') && !isDockerCompose) {
        return { status: 400, message: 'run_command must use {host} placeholder for security binding.' };
      }
      if (!isDockerCompose) {
        commandStr = commandStr.replace(/{host}/g, '127.0.0.1');
        commandStr = commandStr.replace(/{port}/g, port.toString());
      }
    }

    if (!fs.existsSync(project.local_path)) {
      return { status: 500, error: 'Local path does not exist: ' + project.local_path };
    }

    console.log(`[ProcessManager] Starting ${name} on port ${port}`);

    const child = spawn('bash', ['-c', commandStr], {
      cwd: project.local_path,
      stdio: 'pipe',
      detached: true
    });

    const logStream = getLogStream(name);
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    const appState = {
      port,
      process: child,
      status: 'starting',
      retryCount: (runningApps[name] && !manual) ? runningApps[name].retryCount : 0,
      lastError: null,
      manualStop: false,
      logStream: logStream,
      startedAt: new Date().toISOString()
    };
    runningApps[name] = appState;

    // Track uptime
    if (!uptimeStats[name]) uptimeStats[name] = { totalUptimeSec: 0, lastStarted: null, lastCrashed: null, crashCount: 0 };
    uptimeStats[name].lastStarted = appState.startedAt;

    // Mark running after a stable time (60 seconds)
    const runTimer = setTimeout(() => {
      if (runningApps[name] && runningApps[name].status === 'starting') {
        runningApps[name].status = 'running';
        runningApps[name].retryCount = 0; // reset on stable run
        sendTelegramMessage(`✅ *${name}* is running and stable.`);
      }
    }, 60000);

    function closeLogStream(appName) {
      if (runningApps[appName] && runningApps[appName].logStream) {
        runningApps[appName].logStream.end();
        runningApps[appName].logStream = null;
      }
    }

    child.on('error', (err) => {
      console.error(`[ProcessManager] Error starting ${name}:`, err);
      closeLogStream(name);
      if (runningApps[name]) {
        runningApps[name].status = 'crashed';
        runningApps[name].lastError = maskSecretData(err.message);
        runningApps[name].lastCrashTime = new Date().toISOString();
      }
    });

    child.on('close', (code) => {
      clearTimeout(runTimer);
      console.log(`[ProcessManager] ${name} exited with code ${code}`);

      // Safely end log stream to prevent FD leaks
      closeLogStream(name);

      if (runningApps[name] && !runningApps[name].manualStop) {
        runningApps[name].status = 'crashed';
        runningApps[name].lastError = maskSecretData(`Exited with code ${code}`);
        runningApps[name].lastCrashTime = new Date().toISOString();

        // Accumulate uptime on crash
        if (runningApps[name].startedAt && uptimeStats[name]) {
          const elapsed = Math.floor((Date.now() - new Date(runningApps[name].startedAt).getTime()) / 1000);
          uptimeStats[name].totalUptimeSec += elapsed;
          uptimeStats[name].lastCrashed = new Date().toISOString();
          uptimeStats[name].crashCount++;
        }

        if (project.always_on) {
          runningApps[name].retryCount++;
          if (runningApps[name].retryCount > 5) {
            console.error(`[Watchdog] ${name} crashed too many times. Giving up.`);
            runningApps[name].status = 'crashed';
            sendTelegramMessage(`🚨 *${name}* gave up after ${runningApps[name].retryCount} crashes. Manual intervention required.`);
          } else {
            const delay = Math.min(5000 * Math.pow(2, runningApps[name].retryCount - 1), 60000);
            console.log(`[Watchdog] Restarting ${name} in ${delay}ms (Attempt ${runningApps[name].retryCount})...`);
            runningApps[name].status = 'backoff';
            sendTelegramMessage(`⚠️ *${name}* crashed (exit code ${code}). Restarting in ${Math.round(delay/1000)}s (attempt ${runningApps[name].retryCount}/5)...`);
            runningApps[name].restartTimer = setTimeout(() => {
               if (runningApps[name] && runningApps[name].status === 'backoff') {
                 startProject(name, false).catch(e => console.error(`Watchdog restart failed for ${name}:`, e));
               }
            }, delay);
          }
        }
      } else if (runningApps[name]) {
        runningApps[name].status = 'stopped';

        // Accumulate uptime on manual stop
        if (runningApps[name].startedAt && uptimeStats[name]) {
          const elapsed = Math.floor((Date.now() - new Date(runningApps[name].startedAt).getTime()) / 1000);
          uptimeStats[name].totalUptimeSec += elapsed;
        }
      }
    });

    return { status: 200, message: 'Started', url: `http://localhost:${port}/` };
  }

  // System health endpoint (Sprint 2)
  app.get('/api/system', async (req, res) => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const uptimeSec = os.uptime();

    // Calculate CPU usage from /proc-like data (macOS: use loadavg as proxy)
    const loadAvg = os.loadavg();
    const cpuCount = cpus.length;
    const cpuUsage = Math.min(100, Math.round((loadAvg[0] / cpuCount) * 100));

    // Disk info via sync call
    let diskUsage = { total: 0, used: 0, free: 0, percent: 0 };
    try {
      const stat = fs.statfsSync ? fs.statfsSync(__dirname) : null;
      if (stat) {
        diskUsage = {
          total: stat.bsize * stat.blocks,
          free: stat.bsize * stat.bfree,
          used: stat.bsize * (stat.blocks - stat.bfree),
          percent: Math.round(((stat.blocks - stat.bfree) / stat.blocks) * 100)
        };
      }
    } catch {
      // fs.statfsSync not available, leave zeros
    }

    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptimeSec,
      cpuCount,
      cpuUsage,
      loadAvg: loadAvg.map(l => Math.round(l * 100) / 100),
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        percent: Math.round(((totalMem - freeMem) / totalMem) * 100)
      },
      disk: diskUsage,
      access: await getAccessInfo()
    });
  });

  // Project logs endpoint (Sprint 3)
  app.get('/api/projects/:name/logs', (req, res) => {
    const { name } = req.params;
    const lines = Math.min(parseInt(req.query.lines) || 100, 500);
    const logFile = path.join(__dirname, `logs_${name}.txt`);

    if (!fs.existsSync(logFile)) {
      return res.json({ lines: [], totalLines: 0, message: 'No log file found' });
    }

    try {
      const content = fs.readFileSync(logFile, 'utf8');
      const allLines = content.split('\n').filter(l => l.length > 0);
      const tailLines = allLines.slice(-lines);
      return res.json({
        lines: tailLines,
        totalLines: allLines.length,
        fileSize: fs.statSync(logFile).size,
        lastModified: fs.statSync(logFile).mtime.toISOString()
      });
    } catch {
      return res.status(500).json({ error: 'Failed to read log file' });
    }
  });

  app.get('/api/projects', async (req, res) => {
    const enriched = await Promise.all(projects.map(async (p) => {
      const appState = runningApps[p.name];
      const stats = uptimeStats[p.name];
      const isRemote = p.runtime === 'remote' || p.service_kind === 'remote';
      const isStaticDeployed = p.type === 'static-html' && p.status === 'deployed';
      const health = await probeHealth(p, appState);

      // Calculate current session uptime if running
      let currentSessionSec = 0;
      if (appState && appState.startedAt && (appState.status === 'running' || appState.status === 'starting')) {
        currentSessionSec = Math.floor((Date.now() - new Date(appState.startedAt).getTime()) / 1000);
      }

      return {
        ...p,
        serverType: p.server_type || p.type,
        runtimeHost: p.runtime_host || (isRemote ? 'Remote server' : 'Mac Mini'),
        accessUrl: p.public_url || p.access_url || p.public_path || null,
        isRemote,
        isRunning: isRemote ? health.status === 'healthy' : (isStaticDeployed || appState?.status === 'running'),
        status: isRemote ? (health.status === 'healthy' ? 'remote' : 'unhealthy') : (isStaticDeployed ? 'deployed' : (appState ? appState.status : 'stopped')),
        currentPort: appState ? appState.port : (p.fixed_port || p.port || null),
        lastError: appState ? appState.lastError : null,
        lastCrashTime: appState ? appState.lastCrashTime : null,
        retryCount: appState ? appState.retryCount : 0,
        startedAt: appState ? appState.startedAt : null,
        health,
        uptime: stats ? {
          totalSec: stats.totalUptimeSec + currentSessionSec,
          currentSessionSec,
          lastStarted: stats.lastStarted,
          lastCrashed: stats.lastCrashed,
          crashCount: stats.crashCount
        } : null
      };
    }));
    res.json(enriched);
  });

  // Register new project endpoint (Sprint 6)
  app.post("/api/projects", async (req, res) => {
    try {
      const {
        name,
        category = "other",
        type,
        github_repo,
        local_path,
        entry_point,
        run_command,
        always_on = false,
        exposure = "loopback",
        access_url,
        notes,
        quick_links = []
      } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Project name is required" });
      }

      const trimmedName = name.trim();
      if (projects.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
        return res.status(400).json({ error: `Project with name "${trimmedName}" already exists` });
      }

      if (!type || typeof type !== "string") {
        return res.status(400).json({ error: "Project type is required" });
      }

      const isStatic = type === "static-html";

      if (isStatic) {
        if (!access_url && !entry_point) {
          return res.status(400).json({ error: "static-html project must have access_url or entry_point" });
        }
      } else {
        if (!run_command) {
          return res.status(400).json({ error: "run_command is required for dynamic projects" });
        }
        const isDockerCompose = run_command.includes("docker compose");
        if (!run_command.includes("{host}") && !isDockerCompose) {
          return res.status(400).json({ error: "run_command must include {host} placeholder" });
        }
      }

      // Normalize GitHub Repo URL or name
      let normalizedRepo = github_repo ? github_repo.trim() : "";
      if (normalizedRepo) {
        normalizedRepo = normalizedRepo
          .replace(/^https?:\/\/github\.com\//i, "")
          .replace(/^git@github\.com:/i, "")
          .replace(/\.git$/i, "");
      }

      // Determine local path
      let repoDirName = trimmedName;
      if (normalizedRepo && normalizedRepo.includes("/")) {
        repoDirName = normalizedRepo.split("/")[1] || trimmedName;
      }
      let finalLocalPath = local_path ? local_path.trim() : path.join("/Users/choo/.gemini/antigravity/scratch", repoDirName);

      let cloneWarning = null;
      if (normalizedRepo && !fs.existsSync(finalLocalPath)) {
        try {
          console.log(`[Registry] Cloning repo ${normalizedRepo} to ${finalLocalPath}...`);
          const cloneUrl = `https://github.com/${normalizedRepo}.git`;
          const cloneProc = spawn("git", ["clone", cloneUrl, finalLocalPath], { stdio: "pipe" });
          await new Promise((resolve) => {
            cloneProc.on("close", (code) => {
              if (code !== 0) {
                console.warn(`[Registry] Git clone exited with code ${code}`);
                cloneWarning = `Git clone exited with code ${code}. Path: ${finalLocalPath}`;
              } else {
                console.log("[Registry] Git clone completed successfully.");
              }
              resolve();
            });
            cloneProc.on("error", (err) => {
              console.warn(`[Registry] Git clone error: ${err.message}`);
              cloneWarning = `Git clone error: ${err.message}`;
              resolve();
            });
          });
        } catch (e) {
          cloneWarning = `Git clone failed: ${e.message}`;
        }
      }

      const newProject = {
        name: trimmedName,
        category: category ? category.trim() : "other",
        type: type.trim(),
        github_repo: normalizedRepo || undefined,
        local_path: isStatic && !local_path ? undefined : finalLocalPath,
        entry_point: entry_point ? entry_point.trim() : "",
        run_command: run_command ? run_command.trim() : "",
        always_on: Boolean(always_on),
        exposure: isStatic ? undefined : exposure,
        status: isStatic && access_url ? "deployed" : "stopped"
      };

      if (access_url) newProject.access_url = access_url.trim();
      if (notes) newProject.notes = notes.trim();
      if (Array.isArray(quick_links) && quick_links.length > 0) newProject.quick_links = quick_links;

      projects.push(newProject);

      try {
        const fileContent = JSON.parse(fs.readFileSync(regPath, "utf8"));
        fileContent.projects = projects;
        fs.writeFileSync(regPath, JSON.stringify(fileContent, null, 2), "utf8");
      } catch (err) {
        console.error("Failed to update projects.json:", err);
      }

      return res.status(201).json({ success: true, project: newProject, cloneWarning });
    } catch (err) {
      console.error("Error registering project:", err);
      return res.status(500).json({ error: "Failed to register project: " + err.message });
    }
  });

  // Add quick link to project endpoint (Sprint 6)
  app.post("/api/projects/:name/quick-links", (req, res) => {
    const { name } = req.params;
    const { label, url } = req.body;
    const project = projects.find(p => p.name === name);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!label || !url) return res.status(400).json({ error: "Label and URL are required" });

    if (!project.quick_links) project.quick_links = [];
    project.quick_links.push({ label: label.trim(), url: url.trim() });

    try {
      const fileContent = JSON.parse(fs.readFileSync(regPath, "utf8"));
      fileContent.projects = projects;
      fs.writeFileSync(regPath, JSON.stringify(fileContent, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to update projects.json:", err);
    }

    return res.json({ success: true, quick_links: project.quick_links });
  });

  app.post('/api/projects/:name/start', async (req, res) => {
    try {
      const result = await startProject(req.params.name, true);
      if (result.status === 200) {
        res.json({ success: true, ...result });
      } else {
        res.status(result.status).json({ error: result.error || result.message });
      }
    } catch (err) {
      res.status(500).json({ error: 'Failed to start process: ' + maskSecretData(err.message) });
    }
  });

  app.post('/api/projects/:name/stop', (req, res) => {
    const { name } = req.params;
    const project = projects.find(p => p.name === name);
    if (project?.runtime === 'remote' || project?.service_kind === 'remote') {
      return res.status(409).json({ error: 'Remote services are read-only from this dashboard.' });
    }
    const appState = runningApps[name];

    if (!appState) return res.json({ success: true, message: 'Not running' });

    if (appState.restartTimer) {
      clearTimeout(appState.restartTimer);
      appState.restartTimer = null;
    }

    appState.manualStop = true;

    if (!appState.process) {
      appState.status = 'stopped';
      return res.json({ success: true, message: 'Stopped backoff timer' });
    }

    try {
      appState.status = 'stopping';
      process.kill(-appState.process.pid);
      res.json({ success: true, message: 'Stopped' });
    } catch {
      res.status(500).json({ error: 'Failed to stop process' });
    }
  });

  // Express 5 does not support the former app.get('*') wildcard syntax. Use a
  // final middleware so client-side routes receive index.html while API, /apps,
  // and missing asset requests keep their own status codes.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/apps')) {
      return next();
    }
    if (path.extname(req.path)) return next();
    if (!hasFrontendBuild) {
      return res.status(503).send('Dashboard frontend is not built. Run npm run build before npm run start.');
    }
    return res.sendFile('index.html', { root: distPath });
  });

  // Graceful shutdown helper
  function gracefulShutdown() {
    Object.keys(runningApps).forEach(name => {
      if (runningApps[name].restartTimer) clearTimeout(runningApps[name].restartTimer);
      if (runningApps[name].logStream) {
        runningApps[name].logStream.end();
        runningApps[name].logStream = null;
      }
      if (runningApps[name].process) {
        try { process.kill(-runningApps[name].process.pid); } catch{}
      }
    });
    process.exit(0);
  }

  /**
   * Start the server. Separated from createApp() so tests can create the app
   * without binding to a port.
   */
  function startServer() {
    app.listen(PORT, HOST, () => {
      console.log(`Backend API Server running on http://${HOST}:${PORT}`);
      sendTelegramMessage(`🖥️ *Progect Dashboard* started on ${HOST}:${PORT}`);

      if (AUTO_START_ENABLED) {
        setTimeout(() => {
          projects.forEach(p => {
            if (p.always_on && p.type !== 'static-html') {
              console.log(`[Watchdog] Auto-starting always_on project: ${p.name}`);
              startProject(p.name, false).catch(err => {
                console.error(`Failed to auto-start ${p.name}`, err);
              });
            }
          });
        }, 1000);
      } else {
        console.log('Project auto-start is disabled (DASHBOARD_AUTOSTART=false).');
      }
    });

    // Cleanup on exit
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  }

  return { app, runningApps, projects, startProject, startServer, gracefulShutdown, validationErrors };
}

// Only listen if this file is run directly (allows importing for tests)
const currentFile = fileURLToPath(import.meta.url);
const argv1 = process.argv[1] || '';
const isTest = process.argv.some(a => a.includes('test') || a.includes('node:test'));
const isPM2 = Boolean(process.env.pm_id !== undefined || process.env.PM2_HOME || argv1.includes('ProcessContainer') || argv1.includes('pm2'));
const isDirectRun = Boolean(
  argv1 && (
    argv1 === currentFile ||
    argv1 + '.js' === currentFile ||
    currentFile.endsWith(argv1) ||
    currentFile.endsWith(argv1 + '.js')
  )
);

if (!isTest && (isPM2 || isDirectRun)) {
  const { startServer } = createApp();
  startServer();
}

export default createApp;
