import React from 'react';

const StatusBadge = ({ status }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case 'running':
      case 'deployed':
        return {
          bg: 'rgba(34, 197, 94, 0.15)',
          color: '#22c55e',
          border: 'rgba(34, 197, 94, 0.3)',
          dotClass: 'status-dot pulse'
        };
      case 'crashed':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: 'rgba(239, 68, 68, 0.3)',
          dotClass: 'status-dot none'
        };
      case 'backoff':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          border: 'rgba(245, 158, 11, 0.3)',
          dotClass: 'status-dot ping'
        };
      case 'starting':
      case 'stopping':
        return {
          bg: 'rgba(56, 189, 248, 0.15)',
          color: 'var(--accent)',
          border: 'rgba(56, 189, 248, 0.3)',
          dotClass: 'status-dot pulse'
        };
      default: // stopped
        return {
          bg: 'rgba(148, 163, 184, 0.1)',
          color: 'var(--text-muted)',
          border: 'rgba(255, 255, 255, 0.1)',
          dotClass: 'status-dot none'
        };
    }
  };

  const style = getBadgeStyle();

  return (
    <div 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '999px',
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        fontSize: '0.75rem',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        boxShadow: `0 0 10px ${style.bg}`
      }}
    >
      <span 
        className={style.dotClass}
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: style.color,
          boxShadow: `0 0 4px ${style.color}`
        }}
      />
      {status}
    </div>
  );
};

export default StatusBadge;
