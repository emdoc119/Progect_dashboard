import React from 'react';
import { ExternalLink, Bookmark, GitBranch, Server, FileText, Globe } from 'lucide-react';

const defaultLinks = [
  { label: 'GitHub Repositories', url: 'https://github.com/emdoc119', icon: GitBranch },
  { label: 'System Status API', url: '/api/system', icon: Server },
  { label: 'Project Registry', url: '/api/projects', icon: FileText },
  { label: 'ER Schedule Site', url: 'https://emdoc119.github.io/auto_ER_schedule/', icon: Globe }
];

const QuickLinks = ({ customLinks = [] }) => {
  return (
    <div className="quick-links-bar">
      <div className="quick-links-header">
        <Bookmark size={16} className="text-accent" />
        <span>Quick Links</span>
      </div>
      <div className="quick-links-items">
        {defaultLinks.map((link, idx) => {
          const Icon = link.icon;
          return (
            <a
              key={idx}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="quick-link-item"
            >
              <Icon size={14} />
              <span>{link.label}</span>
              <ExternalLink size={12} className="link-arrow" />
            </a>
          );
        })}
        {customLinks.map((link, idx) => (
          <a
            key={`custom-${idx}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link-item custom-link"
          >
            <Globe size={14} />
            <span>{link.label}</span>
            <ExternalLink size={12} className="link-arrow" />
          </a>
        ))}
      </div>
    </div>
  );
};

export default QuickLinks;
