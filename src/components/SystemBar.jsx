import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, MemoryStick, Server } from 'lucide-react';

const formatUptime = (sec) => {
  if (!sec || sec < 0) return '0s';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(val < 10 ? 1 : 0)} ${units[i]}`;
};

const Gauge = ({ label, percent, icon: Icon, color, detail }) => {
  const barColor = percent > 90 ? '#ef4444' : percent > 75 ? '#f59e0b' : color;
  return (
    <div className="system-gauge">
      <div className="gauge-header">
        <Icon size={14} color={barColor} />
        <span className="gauge-label">{label}</span>
        <span className="gauge-value" style={{ color: barColor }}>{percent}%</span>
      </div>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: barColor }} />
      </div>
      {detail && <div className="gauge-detail">{detail}</div>}
    </div>
  );
};

const SystemBar = () => {
  const [sys, setSys] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchSys = async () => {
      try {
        const res = await fetch('/api/system');
        if (res.ok) {
          const data = await res.json();
          if (active) setSys(data);
        }
      } catch { /* ignore */ }
    };
    fetchSys();
    const interval = setInterval(fetchSys, 10000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  if (!sys) return null;

  const memPercent = sys.memory?.percent || 0;
  const diskPercent = sys.disk?.percent || 0;
  const cpuPercent = sys.cpuUsage || 0;

  return (
    <div className="system-bar">
      <div className="system-info">
        <Server size={16} />
        <span className="system-hostname">{sys.hostname}</span>
        <span className="system-uptime">up {formatUptime(sys.uptimeSec)}</span>
      </div>
      <div className="system-gauges">
        <Gauge label="CPU" percent={cpuPercent} icon={Cpu} color="#38bdf8"
               detail={`${sys.cpuCount} cores`} />
        <Gauge label="RAM" percent={memPercent} icon={MemoryStick} color="#a78bfa"
               detail={`${formatBytes(sys.memory?.used)} / ${formatBytes(sys.memory?.total)}`} />
        <Gauge label="Disk" percent={diskPercent} icon={HardDrive} color="#34d399"
               detail={`${formatBytes(sys.disk?.used)} / ${formatBytes(sys.disk?.total)}`} />
      </div>
    </div>
  );
};

export default SystemBar;
