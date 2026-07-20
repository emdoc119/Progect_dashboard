import React from 'react';
import ProjectCard from './ProjectCard';
import { Activity } from 'lucide-react';

const Dashboard = ({ projects, loading, error }) => {
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

  // Filter out forks if preferred, or show everything
  // For now we will show all projects but we can sort them by recently updated
  const sortedProjects = [...projects].sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

  const totalStars = projects.reduce((acc, repo) => acc + repo.stargazers_count, 0);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>emdoc119 Projects</h1>
        <p>An overview of all ongoing and active repositories</p>
      </header>
      
      <div className="stats-container">
        <div className="stat-box">
          <div className="stat-value">{projects.length}</div>
          <div className="stat-label">Total Repositories</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{totalStars}</div>
          <div className="stat-label">Total Stars</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">
            <Activity size={32} color="var(--accent)" />
          </div>
          <div className="stat-label">Active</div>
        </div>
      </div>

      <div className="grid">
        {sortedProjects.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
