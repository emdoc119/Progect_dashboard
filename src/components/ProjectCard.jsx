import React, { useState } from 'react';
import { ExternalLink, BookOpen, Loader2, Play, Square, AlertCircle, Terminal } from 'lucide-react';
import StatusBadge from './StatusBadge';

const typeColors = {
  'python-streamlit': '#3572A5',
  'python-fastapi': '#3572A5',
  'node-nextjs': '#f1e05a',
  'static-html': '#e34c26',
  'Default': '#8b949e'
};

const ProjectCard = ({ project }) => {
  const [deploying, setDeploying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const typeColor = typeColors[project.type] || typeColors.Default;
  
  // Rely exclusively on props from the backend polling
  const isRunning = project.isRunning;
  const port = project.currentPort;
  const status = project.status; // stopped, starting, running, crashed, backoff, stopping, deployed
  const retryCount = project.retryCount || 0;

  // Mask secrets in error messages safely (basic redaction for common secret formats if any, or just show brief error)
  const maskError = (errString) => {
    if (!errString) return '';
    return errString.replace(/(password|secret|key|token)[=:]\s*([^\s]+)/gi, '$1=***');
  };

  const handleStartClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (deploying) return;
    
    if (isRunning) {
      // Security check: restrict opening sub-apps directly from non-local connections (P0-2)
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
      const response = await fetch(`/api/projects/${project.name}/start`, {
        method: 'POST'
      });
      
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
    }
  };

  const handleStopClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (stopping || (status !== 'running' && status !== 'deployed' && status !== 'backoff' && status !== 'crashed')) return;

    setStopping(true);
    try {
      await fetch(`/api/projects/${project.name}/stop`, {
        method: 'POST'
      });
    } catch {
      alert('Error stopping app.');
    } finally {
      setStopping(false);
    }
  };
  
  const getStatusColor = () => {
    if (status === 'running' || status === 'deployed') return '#22c55e';
    if (status === 'crashed') return '#ef4444';
    if (status === 'backoff') return '#f59e0b';
    if (status === 'starting' || status === 'stopping') return 'var(--accent)';
    return 'inherit'; // stopped
  };

  return (
    <div className={`project-card ${isRunning ? 'running' : ''} ${status === 'crashed' ? 'crashed-card' : ''}`} onClick={handleStartClick}>
      <div className="project-header">
        <div className="project-title" style={{ color: "var(--text-main)" }}>
          <BookOpen size={20} color={getStatusColor()} />
          {project.name}
        </div>
        
        <div className="project-actions" onClick={e => e.stopPropagation()}>
          {(deploying || status === 'starting' || status === 'stopping') ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--accent)' }}>
              <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : status === 'backoff' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--accent)' }}>
              <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              Retrying ({retryCount}/5)
              <button className="icon-btn stop-btn" onClick={handleStopClick} title="Stop Retry">
                {stopping ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} color="#ef4444" fill="#ef4444" />}
              </button>
            </div>
          ) : isRunning ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="icon-btn stop-btn" onClick={handleStopClick} title="Stop App">
                {stopping ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} color="#ef4444" fill="#ef4444" />}
              </button>
              <button className="icon-btn" onClick={handleStartClick} title="Open App">
                <ExternalLink size={16} color="#22c55e" />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              {status === 'crashed' && (
                <button className="icon-btn stop-btn" onClick={handleStopClick} title="Clear Crash State">
                  {stopping ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} color="#ef4444" fill="#ef4444" />}
                </button>
              )}
              <button className="icon-btn play-btn" onClick={handleStartClick} title={status === 'crashed' ? "Restart App" : "Start App"}>
                <Play size={16} color="var(--text-muted)" fill="var(--text-muted)" />
              </button>
            </div>
          )}
        </div>
      </div>
      
      <p className="project-desc">
        {project.category ? project.category.toUpperCase() : 'OTHER'} • {project.always_on ? 'Always On' : 'On Demand'}
      </p>

      {project.lastError && (
        <div style={{ marginTop: '8px', padding: '6px', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '4px', fontSize: '12px', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 'bold' }}>
            <AlertCircle size={14} /> 
            Last Error {project.lastCrashTime && `(${new Date(project.lastCrashTime).toLocaleTimeString()})`}
          </div>
          <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={maskError(project.lastError)}>
             {maskError(project.lastError)}
          </div>
        </div>
      )}
      
      <div className="project-footer" style={{ marginTop: project.lastError ? '8px' : 'auto' }}>
        <div className="lang-badge">
          <span className="lang-dot" style={{ backgroundColor: typeColor }}></span>
          {project.type}
        </div>
        
        <div className="metrics" style={{ alignItems: 'center' }}>
          {port && status === 'running' && (
            <div className="metric-item" style={{ marginRight: '8px', color: 'var(--text-muted)' }}>
              <Terminal size={14} /> Port: {port}
            </div>
          )}
          <StatusBadge status={status} />
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
