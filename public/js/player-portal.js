/**
 * player-portal.js — Socket.IO-powered live updates for the player portal
 * IN-PLACE UPDATE VERSION: Updates the DOM surgically without page refresh.
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Player Portal: Initializing Socket.IO updates...');
  
  const uniqueId = document.body.dataset.playerId;
  if (!uniqueId) return;

  // Tab switching logic
  window.switchTab = function switchTab(tab) {
    const indicator = document.getElementById('tab-indicator');
    const stampsBtn = document.getElementById('tab-stamps');
    const qrBtn = document.getElementById('tab-qr');
    const stampsContent = document.getElementById('content-stamps');
    const qrContent = document.getElementById('content-qr');

    if (tab === 'stamps') {
      if (indicator) indicator.style.transform = 'translateX(0)';
      stampsBtn?.classList.add('text-slate-900');
      stampsBtn?.classList.remove('text-slate-500');
      qrBtn?.classList.add('text-slate-500');
      qrBtn?.classList.remove('text-slate-900');
      stampsContent?.classList.remove('hidden');
      qrContent?.classList.add('hidden');
    } else {
      if (indicator) indicator.style.transform = 'translateX(100%)';
      qrBtn?.classList.add('text-slate-900');
      qrBtn?.classList.remove('text-slate-500');
      stampsBtn?.classList.add('text-slate-500');
      stampsBtn?.classList.remove('text-slate-900');
      qrContent?.classList.remove('hidden');
      stampsContent?.classList.add('hidden');
    }
  };

  // Socket.IO connection
  const socket = io({
    query: { uniqueId }
  });

  socket.on('connect', () => {
    console.log('Player Portal: WebSocket connection established.');
    updateConnectionStatus(true);
  });

  socket.on('stamp:issued', async (eventData) => {
    console.log('Event [stamp:issued]:', eventData);
    try {
      // If round auto-renewed, we must reload because the entire grid resets
      if (eventData.autoRenewed) {
        AppUI.toast(`Card Full! Round ${eventData.newRound} Started!`, 'success');
        setTimeout(() => window.location.reload(), 1500);
        return;
      }

      // Perform in-place update
      const data = await AppUI.apiFetch(`/api/player/${uniqueId}`);
      updatePassportUI(data.passport);
      updateStampCountUI(data.stampCount);
      
      AppUI.toast(`New stamp: ${eventData.boothName}`, 'success');
    } catch (err) {
      console.error('Update error:', err);
    }
  });

  socket.on('stamp:revoked', async () => {
    try {
      const data = await AppUI.apiFetch(`/api/player/${uniqueId}`);
      updatePassportUI(data.passport);
      updateStampCountUI(data.stampCount);
      AppUI.toast('A stamp was revoked.', 'info');
    } catch (err) { }
  });

  socket.on('student:update', async (eventData) => {
    console.log('Event [student:update]:', eventData);
    try {
      if (eventData.type === 'round_reset') {
        AppUI.toast(`New Round Started: ${eventData.newRound}`, 'success');
        setTimeout(() => window.location.reload(), 1000);
        return;
      }
      const data = await AppUI.apiFetch(`/api/player/${uniqueId}`);
      updatePassportUI(data.passport);
      updateStampCountUI(data.stampCount);
    } catch (err) { }
  });

  socket.on('disconnect', () => {
    console.warn('Player Portal: WebSocket disconnected.');
    updateConnectionStatus(false);
  });

  function updateStampCountUI(total) {
    const el = document.getElementById('stamp-count');
    if (el) el.textContent = total;
  }

  function updatePassportUI(passport) {
    if (!passport) return;
    
    passport.forEach(booth => {
      const card = document.querySelector(`[data-passport-booth="${booth.key}"]`);
      if (!card) return;

      const isCollected = booth.collected;
      const catClass = 'cat-' + booth.category.toLowerCase();

      // Update Card Container
      card.className = `stamp-card ${isCollected ? 'collected ' + catClass : 'pending'} rounded-xl border p-4 relative`;

      // Update Icon Container
      const iconWrap = card.querySelector('.rounded-full');
      if (iconWrap) {
        iconWrap.className = `flex h-11 w-11 items-center justify-center rounded-full ${isCollected ? 'bg-white/25' : 'bg-slate-100'}`;
        iconWrap.innerHTML = isCollected 
          ? '<svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>'
          : '<svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
      }

      // Update Text Colors
      const nameEl = card.querySelector('.text-sm.font-medium');
      if (nameEl) nameEl.className = `text-sm font-medium ${isCollected ? 'text-white' : 'text-slate-700'}`;
      
      const valEl = nameEl?.nextElementSibling;
      if (valEl) valEl.className = `text-xs ${isCollected ? 'text-white/80' : 'text-slate-500'}`;

      // Update Badge
      const badge = card.querySelector('.stamp-badge');
      if (badge) {
        badge.className = `stamp-badge inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isCollected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200'}`;
        badge.innerHTML = isCollected 
          ? '<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>Collected'
          : '<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Pending';
      }
    });

    // Update Category Completion Headers
    const categories = [...new Set(passport.map(b => b.category))];
    categories.forEach(catKey => {
      const header = document.querySelector(`[data-category-header="${catKey}"]`);
      if (header) {
        const catBooths = passport.filter(b => b.category === catKey);
        const collected = catBooths.filter(b => b.collected).length;
        header.textContent = `${collected}/${catBooths.length} completed`;
      }
    });
  }

  function updateConnectionStatus(online) {
    const dot = document.getElementById('sse-status-dot');
    const txt = document.getElementById('sse-status-text');
    if (dot) dot.className = `h-2 w-2 rounded-full ${online ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500 animate-pulse'}`;
    if (txt) txt.textContent = online ? 'Live' : 'Offline';
  }
});