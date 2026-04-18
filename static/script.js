/* ═══════════════════════════════════════════════════════════════
   GHOST WORKSPACE — script.js  (Premium Edition)
   All backend routes, IDs, and API hooks are preserved.
═══════════════════════════════════════════════════════════════ */

'use strict';

// ── State ─────────────────────────────────────────────────────────
const state = {
  currentFolder: null,
  allFiles:      [],
};

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initDragDrop();
  initTheme();
  // Content loads only after performLogin()
});

// ═══════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════
function initTheme() {
  const saved = localStorage.getItem('ghost-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const html    = document.documentElement;
  const isDark  = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('ghost-theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
  lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════
let sidebarOpen = true;

function toggleSidebar() {
  const sb      = document.getElementById('sidebar');
  const wrapper = document.getElementById('main-wrapper');

  if (window.innerWidth <= 900) {
    // Mobile: slide in/out
    sb.classList.toggle('mobile-open');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) backdrop.style.display = sb.classList.contains('mobile-open') ? 'block' : 'none';
  } else {
    // Desktop: collapse/expand
    sidebarOpen = !sidebarOpen;
    sb.classList.toggle('collapsed', !sidebarOpen);
    if (wrapper) wrapper.classList.toggle('sidebar-collapsed', !sidebarOpen);
    localStorage.setItem('ghost-sidebar', sidebarOpen ? 'open' : 'collapsed');
  }
}

function setActiveNav(btn) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  btn.classList.add('active');
}

// ── View switching ─────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.add('active');

  if (name === 'folders') {
    loadFolders();
  } else if (name === 'recent') {
    loadRecentFiles();
  }
}

function goHome() {
  state.currentFolder = null;
  const uploadBtn = document.getElementById('upload-btn');
  if (uploadBtn) uploadBtn.style.display = 'none';
  setBreadcrumb(null);
  setActiveNav(document.querySelector('.nav-item'));
  showView('folders');
}

function setBreadcrumb(folderName) {
  const bc = document.getElementById('breadcrumb');
  if (!bc) return;
  if (!folderName) {
    bc.innerHTML = `<span class="crumb active" onclick="goHome()">Home</span>`;
  } else {
    bc.innerHTML = `
      <span class="crumb" onclick="goHome()">Home</span>
      <span class="crumb-sep">/</span>
      <span class="crumb active">${esc(folderName)}</span>`;
  }
  lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════
// API HELPER
// ═══════════════════════════════════════════════════════════════
async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res  = await fetch(path, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json;
}

// ═══════════════════════════════════════════════════════════════
// LOGIN / LOGOUT
// ═══════════════════════════════════════════════════════════════
async function performLogin() {
  const passEl = document.getElementById('login-pass');
  const btn    = document.querySelector('.login-btn');

  if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }

  try {
    const result = await api('POST', '/api/login', { password: passEl.value });
    if (result.status === 'success') {
      const screen = document.getElementById('login-screen');
      screen.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      screen.style.opacity    = '0';
      screen.style.transform  = 'scale(1.03)';
      setTimeout(() => { screen.style.display = 'none'; }, 400);
      toast('Welcome to Ghost Workspace', 'success');
      loadFolders();
    }
  } catch {
    toast('Invalid access key', 'error');
    passEl.value = '';
    passEl.focus();
    // Shake animation
    passEl.style.animation = 'none';
    passEl.offsetHeight;  // reflow
    passEl.style.animation = 'shake 0.4s ease';
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

async function performLogout() {
  try {
    await api('POST', '/api/logout', {});
  } catch {}
  window.location.reload();
}

// ═══════════════════════════════════════════════════════════════
// FOLDERS
// ═══════════════════════════════════════════════════════════════
async function loadFolders() {
  try {
    const res     = await api('GET', '/api/folders');
    const folders = res.data.folders || [];
    renderFolderGrid(folders);

    const sub = document.getElementById('folder-subtitle');
    if (sub) sub.textContent = `${folders.length} folder${folders.length !== 1 ? 's' : ''} in cloud`;

    // Update nav badge
    const badge = document.getElementById('nav-folder-count');
    if (badge) badge.textContent = folders.length || '';

    // Update storage widget from all files
    updateStorageWidget();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderFolderGrid(folders) {
  const grid  = document.getElementById('folder-grid');
  const empty = document.getElementById('folders-empty');
  if (!grid) return;

  if (!folders.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    lucide.createIcons();
    return;
  }
  if (empty) empty.style.display = 'none';

  grid.innerHTML = folders.map((f, i) => `
    <div class="folder-card" onclick="openFolder('${esc(f.name)}')"
         style="animation-delay:${i * 0.05}s">
      <div class="folder-card-actions">
        <button class="btn-card-action"
          onclick="event.stopPropagation(); deleteFolderNow('${esc(f.name)}')"
          title="Delete folder">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
      <div class="folder-card-icon">
        <i data-lucide="folder"></i>
      </div>
      <div class="folder-card-name" title="${esc(f.name)}">${esc(f.name)}</div>
      <div class="folder-card-meta">
        <span>${f.file_count !== undefined ? f.file_count + ' file' + (f.file_count !== 1 ? 's' : '') : ''}</span>
        ${f.created_human ? `<span>· ${esc(f.created_human)}</span>` : ''}
      </div>
    </div>`).join('');

  lucide.createIcons();
}

// ─── Create Folder ────────────────────────────────────────────
function openCreateFolderModal() {
  document.getElementById('folder-name-input').value = '';
  openModal('modal-create-folder');
  setTimeout(() => document.getElementById('folder-name-input').focus(), 80);
}

async function submitCreateFolder() {
  const name = document.getElementById('folder-name-input').value.trim();
  if (!name) { toast('Folder name cannot be empty', 'error'); return; }
  try {
    await api('POST', '/api/folders', { name });
    closeModal('modal-create-folder');
    toast(`Folder "${name}" created`, 'success');
    loadFolders();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function deleteFolderNow(name) {
  if (!confirm(`Delete folder "${name}" and all its files? This cannot be undone.`)) return;
  try {
    await api('DELETE', `/api/folders/${encodeURIComponent(name)}`);
    toast(`Folder "${name}" deleted`, 'success');
    if (state.currentFolder === name) goHome();
    else loadFolders();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function confirmDeleteFolder() {
  if (state.currentFolder) deleteFolderNow(state.currentFolder);
}

// ─── Open a folder & list its files ───────────────────────────
async function openFolder(name) {
  state.currentFolder = name;
  setBreadcrumb(name);

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-files').classList.add('active');

  document.getElementById('files-view-title').textContent    = name;
  document.getElementById('files-view-subtitle').textContent = 'Loading…';

  const uploadBtn = document.getElementById('upload-btn');
  if (uploadBtn) uploadBtn.style.display = 'flex';

  // Update drop overlay folder label
  const dropLabel = document.getElementById('drop-folder-name');
  if (dropLabel) dropLabel.textContent = `→ ${name}`;

  try {
    const res   = await api('GET', `/api/folders/${encodeURIComponent(name)}`);
    const files = res.data.files || [];
    renderFileList(files, 'file-list', 'files-empty', name);
    document.getElementById('files-view-subtitle').textContent =
      `${files.length} file${files.length !== 1 ? 's' : ''}`;
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── Render file rows ──────────────────────────────────────────
function renderFileList(files, listId, emptyId, folder) {
  const list  = document.getElementById(listId);
  const empty = document.getElementById(emptyId);
  if (!list) return;

  if (!files.length) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    lucide.createIcons();
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = files.map((f, i) => `
    <div class="file-row" style="animation-delay:${i * 0.03}s">
      <div class="file-icon-wrap ${extToClass(f.ext)}">${(f.ext || '—').toUpperCase().slice(0,4)}</div>
      <div class="file-name" title="${esc(f.name)}">${esc(f.name)}</div>
      <div class="file-mime">${esc(f.mime || '')}</div>
      <div class="file-size">${esc(f.size_human)}</div>
      <div class="file-date">${esc(f.modified_human)}</div>
      <div class="file-actions">
        <button class="btn-file-action download" title="Download"
          onclick="downloadFile('${esc(folder)}','${esc(f.name)}')">
          <i data-lucide="download"></i>
        </button>
        <button class="btn-file-action delete" title="Delete"
          onclick="deleteFile('${esc(folder)}','${esc(f.name)}')">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>`).join('');

  lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════
// FILES — upload, download, delete
// ═══════════════════════════════════════════════════════════════
function triggerUpload() {
  if (!state.currentFolder) { toast('Open a folder first', 'error'); return; }
  document.getElementById('file-input').click();
}

async function handleFileUpload(input) {
  const files = Array.from(input.files || []);
  if (!files.length || !state.currentFolder) return;
  input.value = '';

  const panel    = document.getElementById('upload-panel');
  const progList = document.getElementById('upload-progress-list');
  panel.style.display = 'block';
  progList.innerHTML  = '';
  lucide.createIcons();

  for (const file of files) {
    const itemId = 'up-' + Date.now() + Math.random().toString(36).slice(2);
    progList.innerHTML += `
      <div class="upload-item" id="${itemId}">
        <div class="upload-item-name">${esc(file.name)}</div>
        <div class="upload-bar-track">
          <div class="upload-bar-fill" id="${itemId}-bar" style="width:0%"></div>
        </div>
        <div class="upload-status" id="${itemId}-status">Uploading to cloud…</div>
      </div>`;
    await uploadSingleFile(file, itemId, state.currentFolder);
  }

  await openFolder(state.currentFolder);
  setTimeout(() => { panel.style.display = 'none'; }, 2200);
}

function uploadSingleFile(file, itemId, folder) {
  return new Promise(resolve => {
    const fd = new FormData();
    fd.append('folder', folder);
    fd.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        const bar = document.getElementById(`${itemId}-bar`);
        if (bar) bar.style.width = pct + '%';
      }
    });

    xhr.addEventListener('load', () => {
      const status = document.getElementById(`${itemId}-status`);
      if (xhr.status === 201) {
        if (status) status.textContent = '✓ Ghosted to cloud!';
        toast(`"${file.name}" uploaded`, 'success');
      } else {
        try {
          const r = JSON.parse(xhr.responseText);
          if (status) status.textContent = 'Error: ' + r.message;
          toast(r.message, 'error');
        } catch {
          if (status) status.textContent = 'Upload failed';
          toast('Upload failed', 'error');
        }
      }
      resolve();
    });

    xhr.addEventListener('error', () => { toast('Network error during upload', 'error'); resolve(); });
    xhr.send(fd);
  });
}

function downloadFile(folder, filename) {
  window.location.href = `/api/download/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
  toast(`Downloading "${filename}"…`, 'info');
}

async function deleteFile(folder, filename) {
  if (!confirm(`Delete "${filename}"?`)) return;
  try {
    await api('DELETE', `/api/delete/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`);
    toast(`"${filename}" deleted`, 'success');
    await openFolder(folder);
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// STORAGE WIDGET
// ═══════════════════════════════════════════════════════════════
async function updateStorageWidget() {
  try {
    const res   = await api('GET', '/api/files');
    const files = res.data.files || [];

    const circle     = document.getElementById('storage-ring-circle');
    const pctEl      = document.getElementById('storage-pct');
    const usedEl     = document.getElementById('storage-used-label');
    const countEl    = document.getElementById('storage-file-count');

    // Estimate total bytes from size strings — best-effort
    let totalBytes = 0;
    files.forEach(f => {
      const raw = f.size_human || '';
      const num = parseFloat(raw);
      if (isNaN(num)) return;
      if (raw.includes('GB'))      totalBytes += num * 1073741824;
      else if (raw.includes('MB')) totalBytes += num * 1048576;
      else if (raw.includes('KB')) totalBytes += num * 1024;
      else                         totalBytes += num;
    });

    const LIMIT  = 1073741824; // 1 GB display limit for ring
    const pct    = Math.min((totalBytes / LIMIT) * 100, 100);
    const offset = 113 - (113 * pct / 100);

    if (circle)  circle.style.strokeDashoffset = offset.toFixed(2);
    if (pctEl)   pctEl.textContent   = Math.round(pct) + '%';
    if (usedEl)  usedEl.textContent  = humanSize(totalBytes) + ' used';
    if (countEl) countEl.textContent = files.length + ' file' + (files.length !== 1 ? 's' : '');
  } catch {}
}

function humanSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return bytes.toFixed(1) + ' ' + units[i];
}

// ═══════════════════════════════════════════════════════════════
// RECENT FILES
// ═══════════════════════════════════════════════════════════════
async function loadRecentFiles() {
  try {
    const res   = await api('GET', '/api/files');
    const files = res.data.files || [];
    files.sort((a, b) => (b.modified_human > a.modified_human ? 1 : -1));

    const list  = document.getElementById('recent-list');
    const empty = document.getElementById('recent-empty');

    if (!files.length) {
      if (list)  list.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      lucide.createIcons();
      return;
    }
    if (empty) empty.style.display = 'none';

    list.innerHTML = files.map((f, i) => `
      <div class="file-row" style="animation-delay:${i * 0.03}s">
        <div class="file-icon-wrap ${extToClass(f.ext)}">${(f.ext || '—').toUpperCase().slice(0,4)}</div>
        <div>
          <div class="file-name">${esc(f.name)}</div>
          <div class="file-size" style="display:block;font-size:11px;color:var(--text-3);margin-top:2px">${esc(f.folder || '')}</div>
        </div>
        <div class="file-mime">${esc(f.mime || '')}</div>
        <div class="file-size">${esc(f.size_human)}</div>
        <div class="file-date">${esc(f.modified_human)}</div>
        <div class="file-actions">
          <button class="btn-file-action download" title="Download"
            onclick="downloadFile('${esc(f.folder)}','${esc(f.name)}')">
            <i data-lucide="download"></i>
          </button>
          <button class="btn-file-action delete" title="Delete"
            onclick="deleteFile('${esc(f.folder)}','${esc(f.name)}')">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>`).join('');

    lucide.createIcons();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════
async function handleSearch(query) {
  document.getElementById('search-clear').style.display = query ? 'flex' : 'none';
  if (!query.trim()) { loadFolders(); return; }

  try {
    const res     = await api('GET', '/api/files');
    const results = (res.data.files || []).filter(f =>
      f.name.toLowerCase().includes(query.toLowerCase())
    );

    const grid  = document.getElementById('folder-grid');
    const empty = document.getElementById('folders-empty');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-folders').classList.add('active');

    const sub = document.getElementById('folder-subtitle');
    if (sub) sub.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`;

    if (!results.length) {
      grid.innerHTML = `<div style="grid-column:1/-1">
        <div class="empty-state" style="display:flex">
          <div class="empty-icon"><i data-lucide="search-x"></i></div>
          <h3>No results</h3><p>Try a different search term.</p>
        </div></div>`;
      if (empty) empty.style.display = 'none';
      lucide.createIcons();
      return;
    }

    if (empty) empty.style.display = 'none';
    grid.innerHTML = `<div style="grid-column:1/-1">
      <div class="file-list">
        ${results.map((f, i) => `
        <div class="file-row" style="animation-delay:${i * 0.03}s">
          <div class="file-icon-wrap ${extToClass(f.ext)}">${(f.ext || '—').toUpperCase().slice(0,4)}</div>
          <div>
            <div class="file-name">${esc(f.name)}</div>
            <div class="file-size" style="display:block;font-size:11px;color:var(--text-3);margin-top:2px">${esc(f.folder || '')}</div>
          </div>
          <div class="file-mime">${esc(f.mime || '')}</div>
          <div class="file-size">${esc(f.size_human)}</div>
          <div class="file-date">${esc(f.modified_human)}</div>
          <div class="file-actions">
            <button class="btn-file-action download" title="Download"
              onclick="downloadFile('${esc(f.folder)}','${esc(f.name)}')">
              <i data-lucide="download"></i>
            </button>
            <button class="btn-file-action delete" title="Delete"
              onclick="deleteFile('${esc(f.folder)}','${esc(f.name)}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>`).join('')}
      </div></div>`;
    lucide.createIcons();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function clearSearch() {
  const input = document.getElementById('search-input');
  input.value = '';
  document.getElementById('search-clear').style.display = 'none';
  loadFolders();
}

// ═══════════════════════════════════════════════════════════════
// DRAG & DROP
// ═══════════════════════════════════════════════════════════════
function initDragDrop() {
  let dragCounter = 0;

  document.addEventListener('dragenter', e => {
    e.preventDefault();
    dragCounter++;
    if (state.currentFolder)
      document.getElementById('drop-overlay').classList.add('active');
  });

  document.addEventListener('dragleave', e => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      document.getElementById('drop-overlay').classList.remove('active');
    }
  });

  document.addEventListener('dragover', e => e.preventDefault());

  document.addEventListener('drop', e => {
    e.preventDefault();
    dragCounter = 0;
    document.getElementById('drop-overlay').classList.remove('active');
    if (!state.currentFolder) {
      toast('Open a folder before dropping files', 'error');
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    uploadDroppedFiles(files);
  });
}

async function uploadDroppedFiles(files) {
  const panel    = document.getElementById('upload-panel');
  const progList = document.getElementById('upload-progress-list');
  panel.style.display = 'block';
  progList.innerHTML  = '';
  lucide.createIcons();

  for (const file of files) {
    const itemId = 'drop-' + Date.now() + Math.random().toString(36).slice(2);
    progList.innerHTML += `
      <div class="upload-item" id="${itemId}">
        <div class="upload-item-name">${esc(file.name)}</div>
        <div class="upload-bar-track">
          <div class="upload-bar-fill" id="${itemId}-bar" style="width:0%"></div>
        </div>
        <div class="upload-status" id="${itemId}-status">Uploading…</div>
      </div>`;
    await uploadSingleFile(file, itemId, state.currentFolder);
  }

  await openFolder(state.currentFolder);
  setTimeout(() => { panel.style.display = 'none'; }, 2200);
}

// ═══════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════
function openModal(id)  {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
  lucide.createIcons();
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function closeModalOnBackdrop(e) {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
});

// ═══════════════════════════════════════════════════════════════
// TOASTS
// ═══════════════════════════════════════════════════════════════
function toast(message, type = 'info') {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const icons = { success: 'check-circle', error: 'x-circle', info: 'info' };
  const el    = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><span>${esc(message)}</span>`;
  stack.appendChild(el);
  lucide.createIcons();
  setTimeout(() => {
    el.classList.add('toast-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 3500);
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extToClass(ext) {
  const e = (ext || '').toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg'].includes(e)) return 'ext-img';
  if (e === 'pdf')                                          return 'ext-pdf';
  if (['doc','docx','odt','rtf'].includes(e))               return 'ext-doc';
  if (['xls','xlsx','csv'].includes(e))                     return 'ext-xls';
  if (['mp4','mov','avi','mkv','webm'].includes(e))         return 'ext-vid';
  if (['zip','rar','7z','tar','gz'].includes(e))            return 'ext-zip';
  if (['txt','md','log'].includes(e))                       return 'ext-txt';
  if (['js','ts','py','java','go','rs','html','css','json'].includes(e)) return 'ext-code';
  if (['mp3','wav','ogg','flac'].includes(e))               return 'ext-aud';
  return 'ext-gen';
}