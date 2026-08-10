import React, { useState } from 'react';
import { X, Plus, GitBranch, Folder, Terminal, ExternalLink, Loader2, Info } from 'lucide-react';

const RegisterProjectModal = ({ isOpen, onClose, onProjectRegistered }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('dashboard');
  const [type, setType] = useState('python-streamlit');
  const [githubRepo, setGitBranchRepo] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [entryPoint, setEntryPoint] = useState('');
  const [runCommand, setRunCommand] = useState('');
  const [accessUrl, setAccessUrl] = useState('');
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [exposure, setExposure] = useState('loopback');
  const [notes, setNotes] = useState('');
  const [quickLinkLabel, setQuickLinkLabel] = useState('');
  const [quickLinkUrl, setQuickLinkUrl] = useState('');
  const [quickLinks, setQuickLinks] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const isStatic = type === 'static-html';

  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === 'python-streamlit' && !runCommand) {
      setRunCommand('source venv/bin/activate && streamlit run main.py --server.address {host} --server.port {port} --server.headless true');
    } else if (newType === 'python-fastapi' && !runCommand) {
      setRunCommand('python -m uvicorn main:app --host {host} --port {port}');
    } else if (newType === 'node-nextjs' && !runCommand) {
      setRunCommand('npm run dev -- -H {host} -p {port}');
    }
  };

  const handleAddQuickLink = (e) => {
    e.preventDefault();
    if (quickLinkLabel && quickLinkUrl) {
      setQuickLinks([...quickLinks, { label: quickLinkLabel.trim(), url: quickLinkUrl.trim() }]);
      setQuickLinkLabel('');
      setQuickLinkUrl('');
    }
  };

  const handleRemoveQuickLink = (index) => {
    setQuickLinks(quickLinks.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    if (isStatic && !accessUrl.trim() && !entryPoint.trim()) {
      setError('Static HTML project requires an Access URL or Entry Point');
      return;
    }

    if (!isStatic && !runCommand.trim()) {
      setError('Run command is required for dynamic projects');
      return;
    }

    if (!isStatic && !runCommand.includes('{host}') && !runCommand.includes('docker compose')) {
      setError('Run command must include {host} placeholder for loopback binding security');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        type,
        github_repo: githubRepo.trim() || undefined,
        local_path: localPath.trim() || undefined,
        entry_point: entryPoint.trim() || undefined,
        run_command: isStatic ? undefined : runCommand.trim(),
        access_url: isStatic ? accessUrl.trim() || undefined : undefined,
        always_on: alwaysOn,
        exposure: isStatic ? undefined : exposure,
        notes: notes.trim() || undefined,
        quick_links: quickLinks
      };

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to register project');
      }

      if (data.cloneWarning) {
        alert(`Project registered with warning: ${data.cloneWarning}`);
      }

      if (onProjectRegistered) {
        onProjectRegistered(data.project);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Plus size={20} className="text-accent" /> Register New Project</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {error && (
          <div className="modal-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Project Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. my-awesome-app"
                required
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="dashboard">Dashboard</option>
                <option value="trading">Trading</option>
                <option value="agent">Agent</option>
                <option value="research">Research</option>
                <option value="medical">Medical</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Project Type *</label>
              <select value={type} onChange={(e) => handleTypeChange(e.target.value)}>
                <option value="python-streamlit">Python (Streamlit)</option>
                <option value="python-fastapi">Python (FastAPI / Uvicorn)</option>
                <option value="node-nextjs">Node.js (Next.js / Express)</option>
                <option value="static-html">Static HTML</option>
              </select>
            </div>

            <div className="form-group">
              <label>GitHub Repository / URL</label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGitBranchRepo(e.target.value)}
                placeholder="e.g. emdoc119/my-repo or full GitHub URL"
              />
              <span className="form-hint"><GitBranch size={12} /> If repository does not exist locally, it will be cloned automatically.</span>
            </div>

            <div className="form-group form-group-full">
              <label>Local Path</label>
              <input
                type="text"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="Default: /Users/choo/.gemini/antigravity/scratch/[name]"
              />
              <span className="form-hint"><Folder size={12} /> Absolute path on local filesystem</span>
            </div>

            {isStatic ? (
              <>
                <div className="form-group form-group-full">
                  <label>Access URL</label>
                  <input
                    type="url"
                    value={accessUrl}
                    onChange={(e) => setAccessUrl(e.target.value)}
                    placeholder="https://emdoc119.github.io/my-repo/"
                  />
                </div>
                <div className="form-group">
                  <label>Entry Point (relative to app dir)</label>
                  <input
                    type="text"
                    value={entryPoint}
                    onChange={(e) => setEntryPoint(e.target.value)}
                    placeholder="e.g. index.html"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-group form-group-full">
                  <label>Run Command *</label>
                  <input
                    type="text"
                    value={runCommand}
                    onChange={(e) => setRunCommand(e.target.value)}
                    placeholder="e.g. source venv/bin/activate && streamlit run app.py --server.address {host} --server.port {port}"
                  />
                  <span className="form-hint"><Terminal size={12} /> Must include <code>&#123;host&#125;</code> placeholder for loopback binding (unless docker compose)</span>
                </div>

                <div className="form-group">
                  <label>Entry Point</label>
                  <input
                    type="text"
                    value={entryPoint}
                    onChange={(e) => setEntryPoint(e.target.value)}
                    placeholder="e.g. app.py or src/main.py"
                  />
                </div>

                <div className="form-group">
                  <label>Exposure</label>
                  <select value={exposure} onChange={(e) => setExposure(e.target.value)}>
                    <option value="loopback">loopback (127.0.0.1)</option>
                  </select>
                </div>

                <div className="form-group form-checkbox">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={alwaysOn}
                      onChange={(e) => setAlwaysOn(e.target.checked)}
                    />
                    <span>Always On (Auto-start & Watchdog Auto-restart)</span>
                  </label>
                </div>
              </>
            )}

            <div className="form-group form-group-full">
              <label>Notes & Description</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or details about this project..."
              />
            </div>

            <div className="form-group form-group-full">
              <label>Quick Links</label>
              <div className="quick-link-input-row">
                <input
                  type="text"
                  placeholder="Link Title (e.g. Documentation)"
                  value={quickLinkLabel}
                  onChange={(e) => setQuickLinkLabel(e.target.value)}
                />
                <input
                  type="url"
                  placeholder="URL (https://...)"
                  value={quickLinkUrl}
                  onChange={(e) => setQuickLinkUrl(e.target.value)}
                />
                <button type="button" className="btn-secondary" onClick={handleAddQuickLink}>
                  Add Link
                </button>
              </div>
              {quickLinks.length > 0 && (
                <div className="quick-links-preview">
                  {quickLinks.map((link, idx) => (
                    <span key={idx} className="quick-link-chip">
                      {link.label}
                      <button type="button" onClick={() => handleRemoveQuickLink(idx)}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Registering...
                </>
              ) : (
                'Register Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterProjectModal;
