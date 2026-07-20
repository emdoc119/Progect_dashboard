import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import checkPort from 'tcp-port-used';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/* 
// [Phase 1: Basic Auth Middleware - uncomment to enable]
// npm install express-basic-auth
import basicAuth from 'express-basic-auth';
app.use(basicAuth({
    users: { 'admin': 'farmer123!' },
    challenge: true
}));
*/

const APPS_DIR = path.join(__dirname, 'apps');
app.use('/apps', express.static(APPS_DIR));

// Load Registry
const registryPath = path.join(__dirname, 'projects.json');
let projects = [];
try {
  projects = JSON.parse(fs.readFileSync(registryPath, 'utf8')).projects;
} catch (err) {
  console.error('Failed to load projects.json:', err);
}

const runningApps = {};
let nextAppPort = 4000;

async function findAvailablePort(startPort) {
  let port = startPort;
  while (await checkPort.check(port, '127.0.0.1')) {
    port++;
  }
  return port;
}

// 1. Get all projects
app.get('/api/projects', (req, res) => {
  const enriched = projects.map(p => ({
    ...p,
    isRunning: !!runningApps[p.name],
    currentPort: runningApps[p.name] ? runningApps[p.name].port : null
  }));
  res.json(enriched);
});

// 2. Start a project
app.post('/api/projects/:name/start', async (req, res) => {
  const { name } = req.params;
  const project = projects.find(p => p.name === name);

  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.type === 'static-html') {
    return res.json({ success: true, message: 'Static project', url: project.access_url || `/apps/${name}/${project.entry_point}` });
  }

  if (runningApps[name]) {
    return res.json({ success: true, message: 'Already running', url: `http://localhost:${runningApps[name].port}/` });
  }

  try {
    const port = await findAvailablePort(nextAppPort++);
    let commandStr = project.run_command.replace(/{port}/g, port.toString());
    
    console.log(`[ProcessManager] Starting ${name} on port ${port}`);
    console.log(`[ProcessManager] Command: ${commandStr}`);
    console.log(`[ProcessManager] Cwd: ${project.local_path}`);

    if (!fs.existsSync(project.local_path)) {
      return res.status(400).json({ error: 'Local path does not exist: ' + project.local_path });
    }

    const child = spawn('bash', ['-c', commandStr], { 
      cwd: project.local_path, 
      stdio: 'pipe',
      detached: true // Allow independent execution
    });

    // Handle logs
    const logPath = path.join(__dirname, `logs_${name}.txt`);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    child.on('error', (err) => {
      console.error(`[ProcessManager] Error starting ${name}:`, err);
      delete runningApps[name];
    });

    child.on('close', (code) => {
      console.log(`[ProcessManager] ${name} exited with code ${code}`);
      delete runningApps[name];
      
      // Watchdog: auto-restart if always_on is true
      if (project.always_on) {
        console.log(`[Watchdog] Restarting ${name}...`);
        // Basic delay before restart to avoid spawn loop
        setTimeout(() => {
          axios.post(`http://localhost:${PORT}/api/projects/${name}/start`).catch(e => {});
        }, 5000);
      }
    });

    runningApps[name] = { port, process: child, logPath };

    res.json({ success: true, message: 'Started', url: `http://localhost:${port}/` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start process: ' + err.message });
  }
});

// 3. Stop a project
app.post('/api/projects/:name/stop', (req, res) => {
  const { name } = req.params;
  const running = runningApps[name];
  
  if (!running) return res.json({ success: true, message: 'Not running' });

  try {
    process.kill(-running.process.pid); // Kill process group
    delete runningApps[name];
    res.json({ success: true, message: 'Stopped' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop process' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend API Server running on http://localhost:${PORT}`);
  
  // Auto-start always_on projects
  setTimeout(async () => {
    const axios = (await import('axios')).default;
    projects.forEach(p => {
      if (p.always_on && p.type !== 'static-html') {
        console.log(`[Watchdog] Auto-starting always_on project: ${p.name}`);
        axios.post(`http://localhost:${PORT}/api/projects/${p.name}/start`).catch(err => {
          console.error(`Failed to auto-start ${p.name}`);
        });
      }
    });
  }, 1000);
});
