import React, { useState } from 'react';
import { ArrowLeft, Play, Square, ExternalLink, GitBranch, Folder, Terminal, Clock, FileText, AlertCircle, Bookmark, Plus, Loader2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import LogDrawer from './LogDrawer';

const typeColors = {
  'python-streamlit': '#3572A5',
  'python-fastapi': '#3572A5',
  'node-nextjs': '#f1e05a',
  'static-html': '#e34c26',
  'Default': '#8b949e'
};

const ProjectDetail = ({ project, onBack, onOpenLogs, onRefresh }) => {
  const [deploying, setDeploying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  if (!project) return null;

  const typeColor = typeColors[project.type] || typeColors.Default;
  const isRunning = project.isRunning;
  const port = project.currentPort;
  const status = project.status;

  const formatUptime = (sec) => {
    if (!sec || sec < 0) return '0s';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const handleStartClick = async () => {
    if (deploying) return;

    if (isRunning) {
      const hostname = window.location.hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
        alert('Remote Connection Detected: Direct access to sub-apps is restricted to local connections for security.');
        return;
      }
      if (project.type === 'static-html' && project.access_url) {
        window.open(project.access_url, '_blank');
      } else if (port) {
        window.open(`http://${hostname}:${port}/`, '_blank');
      }
      return;
    }

    setDeploying(true);
    try {
      const response = await fetch(`/api/projects/${project.name}/start`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        let finalUrl = data.url;
        const hostname = window.location.hostname;
        if (finalUrl.includes('localhost:')) {
          if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
            alert('App started successfully on remote host. Proxy access is not available yet.');
            return;
          }
          finalUrl = finalUrl.replace('localhost', hostname);
        }
        window.open(finalUrl, '_blank');
      } else {
        alert('Failed to start app: ' + (data.error || 'Unknown error'));
      }
    } catch {
      alert('Error connecting to server.');
    } finally {
      setDeploying(false);
      if (onRefresh) onRefresh();
    }
  };

  const handleStopClick = async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await fetch(`/api/projects/${project.name}/stop`, { method: 'POST' });
    } catch {
      alert('Error stopping app.');
    } finally {
      setStopping(false);
      if (onRefresh) onRefresh();
    }
  };

  const handleAddQuickLink = async (e) => {
    e.preventDefault();
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;

    setAddingLink(true);
    try {
      const res = await fetch(`/api/projects/${project.name}/quick-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLinkLabel.trim(), url: newLinkUrl.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setNewLinkLabel('');
        setNewLinkUrl('');
        if (onRefresh) onRefresh();
      } else {
        alert('Failed to add quick link: ' + (data.error || 'Unknown error'));
      }
    } catch {
      alert('Error adding quick link');
    } finally {
      setAddingLink(false);
    }
  };

  const githubUrl = project.github_repo
    ? (project.github_repo.startsWith('http') ? project.github_repo : `https://github.com/${project.github_repo}`)
    : null;

  return (
    <div className="project-detail-container">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Projects
        </button>

        <div className="detail-header-actions">
          {project.type !== 'static-html' && (
            <button
              className="btn-secondary"
              onClick={() => setIsLogOpen(true)}
            >
              <FileText size={16} /> View Logs
            </button>
          )}

          {isRunning ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-danger" onClick={handleStopClick} disabled={stopping}>
                {stopping ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />} Stop Process
              </button>
              <button className="btn-success" onClick={handleStartClick}>
                <ExternalLink size={16} /> Open App
              </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={handleStartClick} disabled={deploying}>
              {deploying ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Start App
            </button>
          )}
        </div>
      </div>

      <div className="detail-title-card">
        <div className="detail-title-row">
          <h1>{project.name}</h1>
          <StatusBadge status={status} />
        </div>
        <div className="detail-badges">
          <span className="badge category-badge">
            {(project.category || 'other').toUpperCase()}
          </span>
          <span className="badge type-badge" style={{ borderLeftColor: typeColor }}>
            <span className="lang-dot" style={{ backgroundColor: typeColor }}></span>
            {project.type}
          </span>
          <span className="badge exposure-badge">
            {project.always_on ? 'Always On (Watchdog Enabled)' : 'On Demand'}
          </span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <h2>Process & Health Stats</h2>
          <div className="info-list">
            <div className="info-item">
              <span className="info-label">Status</span>
              <span className="info-value" style={{ textTransform: 'capitalize' }}>{status}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Active Port</span>
              <span className="info-value">{port ? `Port ${port}` : 'None (Stopped)'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Total Uptime</span>
              <span className="info-value">{project.uptime ? formatUptime(project.uptime.totalSec) : 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Current Session</span>
              <span className="info-value">{project.uptime ? formatUptime(project.uptime.currentSessionSec) : '0s'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Crash Count</span>
              <span className="info-value" style={{ color: project.uptime && project.uptime.crashCount > 0 ? '#ef4444' : 'inherit' }}>
                {project.uptime ? project.uptime.crashCount : 0} times
              </span>
            </div>
          </div>
        </div>

        <div className="detail-card">
          <h2>Repository & Code Configuration</h2>
          <div className="info-list">
            <div className="info-item">
              <span className="info-label"><GitBranch size={14} /> GitHub Repo</span>
              <span className="info-value">
                {githubUrl ? (
                  <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="external-link">
                    {project.github_repo} <ExternalLink size={12} />
                  </a>
                ) : (
                  'Not specified'
                )}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label"><Folder size={14} /> Local Path</span>
              <span className="info-value font-mono">{project.local_path || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Entry Point</span>
              <span className="info-value font-mono">{project.entry_point || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label"><Terminal size={14} /> Run Command</span>
              <span className="info-value font-mono code-block">{project.run_command || 'N/A'}</span>
            </div>
          </div>
        </div>

        {project.lastError && (
          <div className="detail-card error-card">
            <h2><AlertCircle size={18} color="#ef4444" /> Last Error Log</h2>
            <div className="error-time">
              Occurred at: {project.lastCrashTime ? new Date(project.lastCrashTime).toLocaleString() : 'Recent'}
            </div>
            <pre className="error-text">{project.lastError}</pre>
          </div>
        )}

        {project.notes && (
          <div className="detail-card">
            <h2>Notes & Instructions</h2>
            <p className="notes-content">{project.notes}</p>
          </div>
        )}

        <div className="detail-card detail-card-full">
          <h2><Bookmark size={18} className="text-accent" /> Project Quick Links</h2>

          <div className="project-quick-links-list">
            {githubUrl && (
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="quick-link-chip-btn">
                <GitBranch size={14} /> GitHub Repository <ExternalLink size={12} />
              </a>
            )}
            {project.access_url && (
              <a href={project.access_url} target="_blank" rel="noopener noreferrer" className="quick-link-chip-btn">
                <ExternalLink size={14} /> Live Access URL <ExternalLink size={12} />
              </a>
            )}
            {project.quick_links && project.quick_links.map((link, idx) => (
              <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="quick-link-chip-btn">
                {link.label} <ExternalLink size={12} />
              </a>
            ))}
          </div>

          <form onSubmit={handleAddQuickLink} className="add-quick-link-form">
            <h3>Add Quick Link for {project.name}</h3>
            <div className="form-inline-row">
              <input
                type="text"
                placeholder="Label (e.g. API Docs)"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                required
              />
              <input
                type="url"
                placeholder="URL (https://...)"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                required
              />
              <button type="submit" className="btn-secondary" disabled={addingLink}>
                {addingLink ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
              </button>
            </div>
          </form>
        </div>
      </div>

      <LogDrawer
        projectName={project.name}
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
      />
    </div>
  );
};

export default ProjectDetail;
