document.addEventListener('DOMContentLoaded', () => {
  const statusIndicator = document.querySelector('.status-indicator');
  const statusText = document.getElementById('status-text');
  
  const tailscaleIp = '100.67.149.56';
  const port = '3001';
  const apiUrl = `http://${tailscaleIp}:${port}/api/projects`;
  
  async function checkServerStatus() {
    try {
      // AbortController to timeout the fetch quickly if Tailscale is off
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // If we reach here, the network connection succeeded.
      // (Even if it returns 401 Unauthorized because of Basic Auth, it means the server is reachable!)
      if (response.ok || response.status === 401) {
        statusIndicator.className = 'status-indicator online';
        statusText.textContent = 'Server Online (Tailscale Connected)';
        statusText.style.color = 'var(--success)';
      } else {
        throw new Error('Server returned an unexpected error');
      }
      
    } catch (error) {
      statusIndicator.className = 'status-indicator offline';
      statusText.textContent = 'Server Offline (Please turn on Tailscale)';
      statusText.style.color = 'var(--error)';
    }
  }

  // Check immediately on load
  checkServerStatus();
  
  // Optionally, check every 10 seconds
  setInterval(checkServerStatus, 10000);
});
