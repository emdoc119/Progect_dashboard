document.addEventListener('DOMContentLoaded', () => {
  const statusIndicator = document.querySelector('.status-indicator');
  const statusText = document.getElementById('status-text');
  
  // 브라우저의 보안 정책(Mixed Content)으로 인해 HTTPS 사이트(GitHub Pages)에서
  // HTTP 주소(Tailscale IP)로의 백그라운드 상태 확인(fetch)이 차단됩니다.
  // 따라서 상태 확인은 삭제하고 클릭 유도로 변경합니다.
  
  statusIndicator.className = 'status-indicator';
  statusIndicator.style.backgroundColor = 'var(--primary)';
  statusIndicator.style.boxShadow = '0 0 10px var(--primary)';
  statusText.textContent = 'Ready (Click below to open Dashboard)';
  statusText.style.color = 'var(--primary)';
});
