import React, { useState } from 'react';
import { Star, GitFork, ExternalLink, BookOpen, Loader2, Play, Square, RefreshCw } from 'lucide-react';

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
  
  // Optimistic UI state
  const [isRunning, setIsRunning] = useState(project.isRunning || project.status === 'deployed');
  const [port, setPort] = useState(project.currentPort);

  const handleStartClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (deploying || isRunning) {
      // If it's already running, just open it
      if (project.type === 'static-html' && project.access_url) {
        window.open(project.access_url, '_blank');
      } else if (port) {
        window.open(`http://localhost:${port}/`, '_blank');
      }
      return;
    }
    
    setDeploying(true);
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${project.name}/start`, {
        method: 'POST'
      });
      
      const data = await response.json();
      if (data.success) {
        setIsRunning(true);
        if (data.url.includes('localhost:')) {
          const match = data.url.match(/:(\d+)/);
          if (match) setPort(match[1]);
        }
        window.open(data.url, '_blank');
      } else {
        alert('Failed to start app: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error connecting to server.');
    } finally {
      setDeploying(false);
    }
  };

  const handleStopClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (stopping || !isRunning) return;

    setStopping(true);
    try {
      const response = await fetch(`http://localhost:3001/api/projects/${project.name}/stop`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        setIsRunning(false);
        setPort(null);
      }
    } catch (err) {
      alert('Error stopping app.');
    } finally {
      setStopping(false);
    }
  };
  
  return (
    <div className={`project-card ${isRunning ? 'running' : ''}`} onClick={handleStartClick}>
      <div className="project-header">
        <div className="project-title">
          <BookOpen size={20} color={isRunning ? '#22c55e' : 'var(--accent)'} />
          {project.name}
        </div>
        
        <div className="project-actions" onClick={e => e.stopPropagation()}>
          {deploying ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--accent)' }}>
              <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
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
            <button className="icon-btn play-btn" onClick={handleStartClick} title="Start App">
              <Play size={16} color="var(--text-muted)" fill="var(--text-muted)" />
            </button>
          )}
        </div>
      </div>
      
      <p className="project-desc">
        {project.category.toUpperCase()} • {project.always_on ? 'Always On' : 'On Demand'}
      </p>
      
      <div className="project-footer">
        <div className="lang-badge">
          <span className="lang-dot" style={{ backgroundColor: typeColor }}></span>
          {project.type}
        </div>
        
        <div className="metrics">
          <div className="metric-item" style={{ color: isRunning ? '#22c55e' : 'inherit' }}>
            {isRunning ? (port ? `Port: ${port}` : 'Deployed') : 'Stopped'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
