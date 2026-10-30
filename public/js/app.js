(() => {
  const API = '/api';
  const STORAGE_KEY = 'kaveesha_inbox';

  let state = {
    email: null,
    token: null,
    expiresAt: null,
    messages: [],
    selectedId: null,
    pollTimer: null,
    countdownTimer: null,
    expirationMinutes: 10
  };

  // DOM
  const $ = (sel) => document.querySelector(sel);
  const emailEl = $('#email-address');
  const timerValue = $('#timer-value');
  const statusText = $('#status-text');
  const msgCount = $('#msg-count');
  const inboxList = $('#inbox-list');
  const emptyState = $('#empty-state');
  const viewerContent = $('#viewer-content');
  const btnCopyOtp = $('#btn-copy-otp');
  const toast = $('#toast');

  // ---------- Helpers ----------
  function showToast(msg, type = '') {
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.add('hidden'), 2800);
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatCountdown(ms) {
    if (ms <= 0) return '00:00';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      email: state.email,
      token: state.token,
      expiresAt: state.expiresAt,
      expirationMinutes: state.expirationMinutes
    }));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data.email || !data.token || !data.expiresAt) return false;
      if (Date.now() > data.expiresAt) {
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }
      state.email = data.email;
      state.token = data.token;
      state.expiresAt = data.expiresAt;
      state.expirationMinutes = data.expirationMinutes || 10;
      return true;
    } catch {
      return false;
    }
  }

  // ---------- API ----------
  async function generateEmail(minutes) {
    statusText.textContent = 'Generating…';
    emailEl.textContent = 'Generating…';
    try {
      const res = await fetch(`${API}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expirationMinutes: minutes || state.expirationMinutes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      state.email = data.email;
      state.token = data.token;
      state.expiresAt = data.expiresAt;
      state.messages = [];
      state.selectedId = null;
      saveState();
      renderEmail();
      renderInbox();
      startCountdown();
      startPolling();
      showToast('New temporary email ready', 'success');
    } catch (err) {
      statusText.textContent = 'Error generating email';
      showToast(err.message || 'Generation failed');
      console.error(err);
    }
  }

  async function fetchInbox() {
    if (!state.email || !state.token) return;
    try {
      const res = await fetch(
        `${API}/inbox?email=${encodeURIComponent(state.email)}&token=${encodeURIComponent(state.token)}`
      );
      const data = await res.json();

      if (res.status === 410 || res.status === 404) {
        // Expired
        clearSession();
        showToast('Inbox expired. Generating new one…');
        await generateEmail();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Fetch failed');

      const prevCount = state.messages.length;
      state.messages = data.messages || [];
      state.expiresAt = data.expiresAt;
      renderInbox();
      msgCount.textContent = `${state.messages.length} message${state.messages.length !== 1 ? 's' : ''}`;
      statusText.textContent = 'Live';

      if (state.messages.length > prevCount) {
        showToast('New email received!', 'success');
      }
    } catch (err) {
      statusText.textContent = 'Connection issue';
      console.error(err);
    }
  }

  async function fetchMessage(id) {
    if (!state.email || !state.token) return;
    viewerContent.innerHTML = '<div class="viewer-placeholder"><span class="spinner"></span></div>';
    try {
      const res = await fetch(
        `${API}/message?email=${encodeURIComponent(state.email)}&token=${encodeURIComponent(state.token)}&id=${id}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      state.selectedId = id;
      renderViewer(data);
      // highlight active
      document.querySelectorAll('.message-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
      });
    } catch (err) {
      viewerContent.innerHTML = `<div class="viewer-placeholder">${err.message}</div>`;
    }
  }

  async function deleteMessage(id) {
    try {
      const res = await fetch(`${API}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: state.email,
          token: state.token,
          messageId: id
        })
      });
      if (!res.ok) throw new Error('Delete failed');
      state.messages = state.messages.filter(m => m.id !== id);
      if (state.selectedId === id) {
        state.selectedId = null;
        viewerContent.innerHTML = '<div class="viewer-placeholder">Select an email to read</div>';
        btnCopyOtp.classList.add('hidden');
      }
      renderInbox();
      showToast('Message deleted');
    } catch (err) {
      showToast(err.message);
    }
  }

  async function deleteAll() {
    if (!confirm('Delete all messages and this inbox?')) return;
    try {
      const res = await fetch(`${API}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: state.email,
          token: state.token,
          deleteAll: true
        })
      });
      if (!res.ok) throw new Error('Delete failed');
      clearSession();
      showToast('Inbox deleted');
      await generateEmail();
    } catch (err) {
      showToast(err.message);
    }
  }

  // ---------- Render ----------
  function renderEmail() {
    emailEl.textContent = state.email || '—';
  }

  function renderInbox() {
    if (!state.messages.length) {
      inboxList.innerHTML = '';
      inboxList.appendChild(emptyState);
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');
    inboxList.innerHTML = state.messages.map(m => `
      <div class="message-item ${state.selectedId === m.id ? 'active' : ''}" data-id="${m.id}">
        <div class="from">${escapeHtml(m.from)}</div>
        <div class="subject">${escapeHtml(m.subject || '(no subject)')}</div>
        <div class="meta">
          <span>${formatTime(m.receivedAt)}</span>
          ${m.otp ? `<span class="otp-badge">OTP</span>` : ''}
        </div>
      </div>
    `).join('');

    inboxList.querySelectorAll('.message-item').forEach(el => {
      el.addEventListener('click', () => fetchMessage(el.dataset.id));
    });
  }

  function renderViewer(msg) {
    let otpBlock = '';
    if (msg.otp) {
      otpBlock = `
        <div class="otp-highlight">
          <span>${escapeHtml(msg.otp)}</span>
        </div>`;
      btnCopyOtp.classList.remove('hidden');
      btnCopyOtp.onclick = () => {
        navigator.clipboard.writeText(msg.otp);
        showToast('OTP copied', 'success');
      };
    } else {
      btnCopyOtp.classList.add('hidden');
    }

    const body = msg.html
      ? `<div class="viewer-body">${msg.html}</div>`
      : `<div class="viewer-body"><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(msg.text || '')}</pre></div>`;

    viewerContent.innerHTML = `
      <div class="viewer-header">
        <div class="subject">${escapeHtml(msg.subject || '(no subject)')}</div>
        <div class="from-line">From: ${escapeHtml(msg.from)} · ${formatTime(msg.receivedAt)}</div>
      </div>
      ${otpBlock}
      ${body}
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- Timers ----------
  function startCountdown() {
    clearInterval(state.countdownTimer);
    const tick = () => {
      const left = state.expiresAt - Date.now();
      timerValue.textContent = formatCountdown(left);
      if (left <= 0) {
        clearInterval(state.countdownTimer);
        statusText.textContent = 'Expired';
        showToast('Inbox expired');
        clearSession();
        generateEmail();
      }
    };
    tick();
    state.countdownTimer = setInterval(tick, 1000);
  }

  function startPolling() {
    clearInterval(state.pollTimer);
    fetchInbox();
    state.pollTimer = setInterval(fetchInbox, 5000);
  }

  function clearSession() {
    clearInterval(state.pollTimer);
    clearInterval(state.countdownTimer);
    state.email = null;
    state.token = null;
    state.expiresAt = null;
    state.messages = [];
    state.selectedId = null;
    localStorage.removeItem(STORAGE_KEY);
    emailEl.textContent = '—';
    timerValue.textContent = '00:00';
    msgCount.textContent = '0 messages';
    viewerContent.innerHTML = '<div class="viewer-placeholder">Select an email to read</div>';
    btnCopyOtp.classList.add('hidden');
    renderInbox();
  }

  // ---------- Events ----------
  $('#btn-copy').addEventListener('click', () => {
    if (!state.email) return;
    navigator.clipboard.writeText(state.email).then(() => {
      emailEl.classList.add('copied');
      showToast('Email copied', 'success');
      setTimeout(() => emailEl.classList.remove('copied'), 1500);
    });
  });

  $('#btn-generate').addEventListener('click', () => generateEmail());

  $('#btn-refresh').addEventListener('click', () => {
    statusText.textContent = 'Refreshing…';
    fetchInbox();
  });

  $('#btn-delete-all').addEventListener('click', deleteAll);

  $('#btn-close-viewer').addEventListener('click', () => {
    state.selectedId = null;
    viewerContent.innerHTML = '<div class="viewer-placeholder">Select an email to read</div>';
    btnCopyOtp.classList.add('hidden');
    document.querySelectorAll('.message-item').forEach(el => el.classList.remove('active'));
  });

  // Settings
  $('#btn-settings').addEventListener('click', () => {
    $('#expiration-select').value = state.expirationMinutes;
    $('#settings-modal').classList.remove('hidden');
  });
  $('#btn-close-settings').addEventListener('click', () => $('#settings-modal').classList.add('hidden'));
  $('#settings-modal .modal-backdrop').addEventListener('click', () => $('#settings-modal').classList.add('hidden'));
  $('#btn-apply-settings').addEventListener('click', () => {
    state.expirationMinutes = parseInt($('#expiration-select').value, 10);
    $('#settings-modal').classList.add('hidden');
    generateEmail(state.expirationMinutes);
  });

  // Privacy
  $('#btn-privacy').addEventListener('click', () => $('#privacy-modal').classList.remove('hidden'));
  $('#btn-close-privacy').addEventListener('click', () => $('#privacy-modal').classList.add('hidden'));
  $('#privacy-modal .modal-backdrop').addEventListener('click', () => $('#privacy-modal').classList.add('hidden'));

  // ---------- Init ----------
  async function init() {
    if (loadState()) {
      renderEmail();
      startCountdown();
      startPolling();
      statusText.textContent = 'Restored session';
    } else {
      await generateEmail();
    }
  }

  init();
})();