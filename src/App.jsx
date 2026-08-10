import { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import ProjectDetail from './components/ProjectDetail';

function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentProjectName, setCurrentProjectName] = useState(null);

  // Helper to extract project name from location pathname or hash
  const parseProjectFromUrl = () => {
    const pathname = window.location.pathname;
    const hash = window.location.hash;

    if (pathname.startsWith('/project/')) {
      return decodeURIComponent(pathname.replace('/project/', ''));
    }
    if (hash.startsWith('#/project/')) {
      return decodeURIComponent(hash.replace('#/project/', ''));
    }
    if (hash.startsWith('#project/')) {
      return decodeURIComponent(hash.replace('#project/', ''));
    }
    return null;
  };

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      setProjects(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 3000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  useEffect(() => {
    const handleLocationChange = () => {
      const projName = parseProjectFromUrl();
      setCurrentProjectName(projName);
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigateToProject = (name) => {
    const newPath = `/project/${encodeURIComponent(name)}`;
    window.history.pushState({}, '', newPath);
    setCurrentProjectName(name);
  };

  const navigateToHome = () => {
    window.history.pushState({}, '', '/');
    setCurrentProjectName(null);
  };

  const selectedProject = projects.find(p => p.name === currentProjectName);

  return (
    <>
      {currentProjectName && selectedProject ? (
        <ProjectDetail
          project={selectedProject}
          onBack={navigateToHome}
          onRefresh={fetchProjects}
        />
      ) : (
        <Dashboard
          projects={projects}
          loading={loading}
          error={error}
          onSelectProject={navigateToProject}
          onProjectRegistered={(newProj) => {
            fetchProjects();
            if (newProj && newProj.name) {
              navigateToProject(newProj.name);
            }
          }}
        />
      )}
    </>
  );
}

export default App;
