import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import ProjectCard from './ProjectCard';

const Dashboard = ({ projects, loading, error }) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    const cats = new Set(projects.map(p => p.category || 'other'));
    return ['All', ...Array.from(cats)].sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects
      .filter(p => activeCategory === 'All' || (p.category || 'other') === activeCategory)
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, activeCategory, searchQuery]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading projects...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-container">
        <p style={{ color: '#ef4444' }}>{error}</p>
      </div>
    );
  }

  const runningCount = projects.filter(p => p.isRunning || p.status === 'running' || p.status === 'deployed').length;
  const crashedCount = projects.filter(p => p.status === 'crashed').length;

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>emdoc119 Projects</h1>
        <p>An overview of all ongoing and active repositories</p>
      </header>
      
      <div className="stats-container">
        <div className="stat-box">
          <div className="stat-value">{projects.length}</div>
          <div className="stat-label">Total Projects</div>
        </div>
        <div className="stat-box">
          <div className="stat-value" style={{ color: '#22c55e' }}>{runningCount}</div>
          <div className="stat-label">Running</div>
        </div>
        <div className="stat-box">
          <div className="stat-value" style={{ color: crashedCount > 0 ? '#ef4444' : 'var(--accent)' }}>{crashedCount}</div>
          <div className="stat-label">Crashed</div>
        </div>
      </div>

      <div className="filter-bar">
        {categories.map(cat => (
          <button 
            key={cat} 
            className={`filter-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat.toUpperCase()}
          </button>
        ))}
        
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search projects..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid">
        {filteredProjects.map(project => (
          <ProjectCard key={project.name} project={project} />
        ))}
        {filteredProjects.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
            No projects found matching the criteria.
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
