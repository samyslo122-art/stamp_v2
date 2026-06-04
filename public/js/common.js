/**
 * common.js — Shared utilities for all pages
 */
const AppUI = {
  toast(msg, type = 'info', duration = 3500) {
    const wrap = document.getElementById('toast-wrap');
    if (!wrap) return;
    const colors = {
      success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      error: 'bg-red-50 text-red-800 border-red-200',
      info: 'bg-blue-50 text-blue-800 border-blue-200',
    };
    const el = document.createElement('div');
    el.className = `rounded-xl border-2 p-3.5 text-sm font-semibold shadow-lg mb-2 transition-all duration-300 ${colors[type] || colors.info}`;
    el.style.minWidth = '280px';
    el.style.textAlign = 'center';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    el.textContent = msg;
    wrap.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-12px) scale(0.96)';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  async apiFetch(url, opts = {}) {
    const separator = url.includes('?') ? '&' : '?';
    const finalUrl = `${url}${separator}_t=${Date.now()}`;
    const res = await fetch(finalUrl, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
};
