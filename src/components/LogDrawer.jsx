import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Download, ArrowDown } from 'lucide-react';

const LogDrawer = ({ projectName, isOpen, onClose }) => {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalLines, setTotalLines] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lineCount, setLineCount] = useState(100);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !projectName) return;
    let active = true;
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectName}/logs?lines=${lineCount}`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setLines(data.lines || []);
            setTotalLines(data.totalLines || 0);
          }
        }
      } catch { /* ignore */ }
      if (active) setLoading(false);
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [isOpen, projectName, lineCount]);

  useEffect(() => {
    if (autoScroll && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  if (!isOpen) return null;

  const highlightLine = (line) => {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('traceback') || lower.includes('fatal') || lower.includes('exception')) {
      return 'log-line error';
    }
    if (lower.includes('warn') || lower.includes('warning')) {
      return 'log-line warn';
    }
    if (lower.includes('info')) {
      return 'log-line info';
    }
    return 'log-line';
  };

  const handleDownload = () => {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${projectName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`log-drawer ${isOpen ? 'open' : ''}`}>
      <div className="log-drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{projectName}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {totalLines > 0 ? `${lines.length} of ${totalLines} lines` : 'No logs'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <select
            value={lineCount}
            onChange={e => setLineCount(Number(e.target.value))}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-main)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.75rem'
            }}
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={200}>200 lines</option>
            <option value={500}>500 lines</option>
          </select>
          <button
            className="icon-btn"
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
            style={{
              backgroundColor: autoScroll ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.05)',
              borderColor: autoScroll ? '#38bdf8' : 'rgba(255,255,255,0.1)'
            }}
          >
            <ArrowDown size={14} color={autoScroll ? '#38bdf8' : 'var(--text-muted)'} />
          </button>
          <button className="icon-btn" onClick={handleDownload} title="Download logs">
            <Download size={14} color="var(--text-muted)" />
          </button>
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={14} color="var(--text-muted)" />
          </button>
        </div>
      </div>
      <div className="log-drawer-content" ref={contentRef}>
        {loading && lines.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
            <RefreshCw size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
            Loading logs...
          </div>
        ) : lines.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
            No log entries found.
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className={highlightLine(line)}>{line}</div>
          ))
        )}
      </div>
    </div>
  );
};

export default LogDrawer;
