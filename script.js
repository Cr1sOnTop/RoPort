const urlIn = document.getElementById('urlIn');
const clearBtn = document.getElementById('clearBtn');
const pasteBtn = document.getElementById('pasteBtn');
const anatomyPanel = document.getElementById('anatomyPanel');
const anatomy = document.getElementById('anatomy');
const urlOut = document.getElementById('urlOut');
const status = document.getElementById('status');
const copyBtn = document.getElementById('copyBtn');
const openBtn = document.getElementById('openBtn');
const saveServerBtn = document.getElementById('saveServerBtn');

const tabConvertBtn = document.getElementById('tabConvertBtn');
const tabServersBtn = document.getElementById('tabServersBtn');
const viewConvert = document.getElementById('viewConvert');
const viewServers = document.getElementById('viewServers');
const srvName = document.getElementById('srvName');
const srvOwner = document.getElementById('srvOwner');
const srvLink = document.getElementById('srvLink');
const srvAddBtn = document.getElementById('srvAddBtn');
const serverList = document.getElementById('serverList');
const srvStatus = document.getElementById('srvStatus');
const openAddModalBtn = document.getElementById('openAddModalBtn');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const gameInfoEl = document.getElementById('gameInfo');
const infoModalBackdrop = document.getElementById('infoModalBackdrop');
const infoModalCloseBtn = document.getElementById('infoModalCloseBtn');
const infoModalCancelBtn = document.getElementById('infoModalCancelBtn');
const infoRows = document.getElementById('infoRows');
const infoCopyBtn = document.getElementById('infoCopyBtn');

function esc(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function parse(raw){
  raw = raw.trim();
  if(!raw) return null;
  let u;
  try{
    u = new URL(raw);
  }catch(e){
    return {error:'not a valid URL'};
  }
  const code = u.searchParams.get('code');
  const type = u.searchParams.get('type');
  if(!code || !type){
    return {error:'missing code and/or type param', url:u};
  }
  return {code, type, url:u};
}

// --- game name/icon lookup (via /api/resolve serverless function) ---
// Only works once deployed (e.g. on Vercel) — the browser can't fetch
// Roblox's pages directly due to CORS, so this needs a same-origin backend.
// Fails silently (returns null) if the endpoint isn't there, e.g. when
// previewed as a plain artifact/local file.
async function resolveGameInfo(rawUrl){
  try{
    const resp = await fetch('/api/resolve?url=' + encodeURIComponent(rawUrl));
    if(!resp.ok) return null;
    const data = await resp.json();
    if(data && data.gameName) return { gameName: data.gameName, gameImage: data.gameImage || null };
    return null;
  }catch(err){
    return null;
  }
}

let currentGameInfo = null;
let convertLookupTimer = null;
let convertLookupToken = 0;

function hideGameInfo(){
  clearTimeout(convertLookupTimer);
  convertLookupToken++;
  gameInfoEl.style.display = 'none';
  gameInfoEl.textContent = '';
  currentGameInfo = null;
}

function scheduleGameLookup(rawUrl){
  clearTimeout(convertLookupTimer);
  if(!/^https?:/i.test(rawUrl)){
    hideGameInfo();
    return;
  }
  convertLookupTimer = setTimeout(async ()=>{
    const token = ++convertLookupToken;
    gameInfoEl.style.display = 'block';
    gameInfoEl.textContent = 'Looking up game…';
    const info = await resolveGameInfo(rawUrl);
    if(token !== convertLookupToken) return; // input changed since this lookup started
    if(info){
      currentGameInfo = info;
      gameInfoEl.textContent = `Game: ${info.gameName}`;
    }else{
      currentGameInfo = null;
      gameInfoEl.style.display = 'none';
      gameInfoEl.textContent = '';
    }
  }, 500);
}

function render(){
  const raw = urlIn.value;
  const result = parse(raw);

  clearBtn.style.display = raw ? 'flex' : 'none';

  if(!raw.trim()){
    anatomyPanel.style.display = 'none';
    urlOut.innerHTML = 'roblox://navigation/share_links?code=&amp;type=';
    status.textContent = 'waiting for input';
    status.className = 'status';
    copyBtn.disabled = true;
    saveServerBtn.disabled = true;
    openBtn.setAttribute('aria-disabled','true');
    openBtn.removeAttribute('href');
    hideGameInfo();
    return;
  }

  if(!result || result.error === 'not a valid URL'){
    anatomyPanel.style.display = 'none';
    status.textContent = 'not a valid URL';
    status.className = 'status err';
    copyBtn.disabled = true;
    saveServerBtn.disabled = true;
    openBtn.setAttribute('aria-disabled','true');
    openBtn.removeAttribute('href');
    hideGameInfo();
    return;
  }

  const u = result.url;
  anatomyPanel.style.display = 'block';
  const host = esc(u.host);
  const path = esc(u.pathname);
  let paramsHtml = '';
  u.searchParams.forEach((v,k)=>{
    const cls = k==='code' ? 'seg-code' : (k==='type' ? 'seg-type' : 'seg-key');
    paramsHtml += `<span class="seg-key">&amp;</span><span class="seg-key">${esc(k)}=</span><span class="seg ${cls}">${esc(v)}</span>`;
  });
  anatomy.innerHTML =
    `<span class="seg seg-host">${host}</span>` +
    `<span class="seg seg-path">${path}</span>` +
    `<span class="seg-key">?</span>` + paramsHtml.replace(/^<span class="seg-key">&amp;<\/span>/,'');

  if(result.error === 'missing code and/or type param'){
    status.textContent = 'no code/type param found';
    status.className = 'status err';
    urlOut.innerHTML = 'roblox://navigation/share_links?code=&amp;type=';
    copyBtn.disabled = true;
    saveServerBtn.disabled = true;
    openBtn.setAttribute('aria-disabled','true');
    openBtn.removeAttribute('href');
    hideGameInfo();
    return;
  }

  const deepLink = `roblox://navigation/share_links?code=${encodeURIComponent(result.code)}&type=${encodeURIComponent(result.type)}`;
  urlOut.innerHTML = `<span class="k">roblox://navigation/share_links?</span>` +
    `<span class="k">code=</span><span class="v">${esc(result.code)}</span>` +
    `<span class="k">&amp;type=</span><span class="v">${esc(result.type)}</span>`;
  status.textContent = 'converted';
  status.className = 'status ok';
  copyBtn.disabled = false;
  saveServerBtn.disabled = false;
  openBtn.removeAttribute('aria-disabled');
  openBtn.setAttribute('href', deepLink);
  copyBtn.dataset.link = deepLink;
  saveServerBtn.dataset.link = deepLink;
  scheduleGameLookup(raw.trim());
}

urlIn.addEventListener('input', render);

urlIn.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    urlIn.blur();
  }
});

clearBtn.addEventListener('click', (e)=>{
  e.stopPropagation();
  urlIn.value = '';
  urlIn.focus();
  render();
});

pasteBtn.addEventListener('click', async (e)=>{
  e.stopPropagation();
  try{
    const text = await navigator.clipboard.readText();
    if(text){
      urlIn.value = text.trim();
      render();
    }
  }catch(err){
    const original = pasteBtn.textContent;
    pasteBtn.textContent = 'blocked — long-press to paste';
    setTimeout(()=>{ pasteBtn.innerHTML = original; }, 1800);
  }
});

// --- tabs ---
const TAB_KEY = 'roport:active-tab';

function showTab(which, skipSave){
  const onConvert = which === 'convert';
  tabConvertBtn.classList.toggle('active', onConvert);
  tabServersBtn.classList.toggle('active', !onConvert);
  viewConvert.classList.toggle('active', onConvert);
  viewServers.classList.toggle('active', !onConvert);
  if(!skipSave){
    try{ localStorage.setItem(TAB_KEY, which); }catch(err){ /* ignore */ }
  }
}
tabConvertBtn.addEventListener('click', ()=>showTab('convert'));
tabServersBtn.addEventListener('click', ()=>showTab('servers'));

// Restore last-open tab on load
(function restoreTab(){
  let saved = null;
  try{ saved = localStorage.getItem(TAB_KEY); }catch(err){ /* ignore */ }
  if(saved === 'servers') showTab('servers', true);
})();

saveServerBtn.addEventListener('click', ()=>{
  const link = saveServerBtn.dataset.link;
  if(!link) return;
  showTab('servers');
  openAddModal(link);
});

// --- add-server modal ---
let pendingGameInfo = null;

function openAddModal(prefillLink){
  srvName.value = '';
  srvOwner.value = '';
  srvLink.value = prefillLink || '';
  pendingGameInfo = prefillLink ? currentGameInfo : null;
  modalBackdrop.classList.add('open');
  srvName.focus();
}
function closeAddModal(){
  modalBackdrop.classList.remove('open');
}
openAddModalBtn.addEventListener('click', ()=>openAddModal());
modalCloseBtn.addEventListener('click', closeAddModal);
modalCancelBtn.addEventListener('click', closeAddModal);
modalBackdrop.addEventListener('click', (e)=>{
  if(e.target === modalBackdrop) closeAddModal();
});

// --- server-info modal ---
let infoModalLink = null;

function openInfoModal(s){
  infoModalLink = s.link;
  infoRows.innerHTML = `
    <div class="info-row"><label>Server name</label><div class="value">${esc(s.name || 'Unnamed server')}</div></div>
    <div class="info-row"><label>Game</label><div class="value">${esc(s.gameName || 'Unknown')}</div></div>
    <div class="info-row"><label>Owner</label><div class="value">${esc(s.owner || '—')}</div></div>
    <div class="info-row"><label>Link</label><div class="value">${esc(s.link)}</div></div>
  `;
  infoModalBackdrop.classList.add('open');
}
function closeInfoModal(){
  infoModalBackdrop.classList.remove('open');
}
infoModalCloseBtn.addEventListener('click', closeInfoModal);
infoModalCancelBtn.addEventListener('click', closeInfoModal);
infoModalBackdrop.addEventListener('click', (e)=>{
  if(e.target === infoModalBackdrop) closeInfoModal();
});
infoCopyBtn.addEventListener('click', async ()=>{
  if(!infoModalLink) return;
  try{
    await navigator.clipboard.writeText(infoModalLink);
    const original = infoCopyBtn.textContent;
    infoCopyBtn.textContent = 'Copied ✓';
    setTimeout(()=>{ infoCopyBtn.textContent = original; }, 1400);
  }catch(err){ /* ignore */ }
});

document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    if(modalBackdrop.classList.contains('open')) closeAddModal();
    if(infoModalBackdrop.classList.contains('open')) closeInfoModal();
  }
});

document.addEventListener('click', (e)=>{
  if(e.target !== urlIn){
    urlIn.blur();
  }
});

openBtn.addEventListener('click', (e)=>{
  if(openBtn.hasAttribute('aria-disabled')) return;
  const link = openBtn.getAttribute('href');
  if(!link) return;
  try{
    // Force a top-level navigation; plain anchor clicks can be swallowed
    // inside a sandboxed preview iframe that blocks custom URI schemes.
    (window.top || window).location.href = link;
  }catch(err){
    window.location.href = link;
  }
});

copyBtn.addEventListener('click', async ()=>{
  const link = copyBtn.dataset.link;
  if(!link) return;
  try{
    await navigator.clipboard.writeText(link);
    const original = copyBtn.textContent;
    copyBtn.textContent = 'Copied ✓';
    setTimeout(()=>{ copyBtn.textContent = original; }, 1400);
  }catch(e){
    copyBtn.textContent = 'Copy failed';
    setTimeout(()=>{ copyBtn.textContent = 'Copy link'; }, 1400);
  }
});

// --- saved servers persistence ---
// Uses the artifact storage API when available (persists across sessions
// inside Claude). If deployed standalone (Vercel, GitHub Pages, etc.) where
// window.storage doesn't exist, falls back to localStorage, which works
// fine there since it's a real origin, not a sandboxed iframe. If neither
// is available, falls back to an in-memory list (this session only).
let servers = [];
const hasArtifactStorage = !!(window.storage && window.storage.get && window.storage.set);
let hasLocalStorage = false;
if(!hasArtifactStorage){
  try{
    const testKey = '__test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    hasLocalStorage = true;
  }catch(err){ hasLocalStorage = false; }
}
const storageAvailable = hasArtifactStorage || hasLocalStorage;
const LOCAL_KEY = 'roblox-link-converter:saved-servers';

async function loadServers(){
  if(hasArtifactStorage){
    try{
      const result = await window.storage.get('saved-servers', false);
      servers = result && result.value ? JSON.parse(result.value) : [];
    }catch(err){
      servers = [];
    }
  }else if(hasLocalStorage){
    try{
      const raw = localStorage.getItem(LOCAL_KEY);
      servers = raw ? JSON.parse(raw) : [];
    }catch(err){
      servers = [];
    }
  }else{
    srvStatus.textContent = 'session only (no persistence)';
  }
  renderServerList();
}

async function persistServers(){
  if(hasArtifactStorage){
    try{
      await window.storage.set('saved-servers', JSON.stringify(servers), false);
    }catch(err){
      srvStatus.textContent = 'save failed';
    }
  }else if(hasLocalStorage){
    try{
      localStorage.setItem(LOCAL_KEY, JSON.stringify(servers));
    }catch(err){
      srvStatus.textContent = 'save failed';
    }
  }
  renderServerList();
}

function toDeepLinkIfPossible(raw){
  raw = raw.trim();
  if(raw.startsWith('roblox://')) return raw;
  const parsed = parse(raw);
  if(parsed && !parsed.error){
    return `roblox://navigation/share_links?code=${encodeURIComponent(parsed.code)}&type=${encodeURIComponent(parsed.type)}`;
  }
  return raw;
}

function renderServerList(){
  if(!servers.length){
    serverList.innerHTML = '<div class="empty-note">No saved servers yet — add one above.</div>';
    if(storageAvailable) srvStatus.textContent = '';
    return;
  }
  if(storageAvailable) srvStatus.textContent = `${servers.length} saved`;
  serverList.innerHTML = servers.map((s, i)=>{
    const iconHtml = s.gameImage
      ? `<img class="server-icon" src="${esc(s.gameImage)}" alt="" loading="lazy">`
      : `<div class="server-icon server-icon-placeholder">?</div>`;
    return `
    <div class="server-card">
      <div class="server-card-top">
        <div class="server-card-info">
          <div class="server-name">${esc(s.name || 'Unnamed server')}</div>
          ${s.owner ? `<div class="server-owner">${esc(s.owner)}</div>` : ''}
        </div>
        ${iconHtml}
      </div>
      <div class="server-actions">
        <button type="button" data-act="copy" data-i="${i}">Copy</button>
        <a class="btn" href="${esc(s.link)}" target="_top" rel="noopener" data-act="open" data-i="${i}">Open ↗</a>
        <button type="button" class="btn-icon" data-act="info" data-i="${i}" aria-label="Server info">i</button>
        <button type="button" class="btn-danger" data-act="del" data-i="${i}">Delete</button>
      </div>
    </div>
  `;
  }).join('');
}

serverList.addEventListener('click', async (e)=>{
  const btn = e.target.closest('[data-act]');
  if(!btn) return;
  const i = parseInt(btn.dataset.i, 10);
  const s = servers[i];
  if(!s) return;

  if(btn.dataset.act === 'copy'){
    try{
      await navigator.clipboard.writeText(s.link);
      const original = btn.textContent;
      btn.textContent = 'Copied ✓';
      setTimeout(()=>{ btn.textContent = original; }, 1400);
    }catch(err){ /* ignore */ }
  }

  if(btn.dataset.act === 'open'){
    e.preventDefault();
    try{
      (window.top || window).location.href = s.link;
    }catch(err){
      window.location.href = s.link;
    }
  }

  if(btn.dataset.act === 'del'){
    servers.splice(i, 1);
    persistServers();
  }

  if(btn.dataset.act === 'info'){
    openInfoModal(s);
  }
});

srvAddBtn.addEventListener('click', async ()=>{
  const name = srvName.value.trim();
  const owner = srvOwner.value.trim();
  const linkRaw = srvLink.value.trim();
  if(!linkRaw){
    srvLink.focus();
    return;
  }

  const link = toDeepLinkIfPossible(linkRaw);

  let gameInfo = pendingGameInfo;
  if(!gameInfo && /^https?:/i.test(linkRaw)){
    const original = srvAddBtn.textContent;
    srvAddBtn.disabled = true;
    srvAddBtn.textContent = 'Adding…';
    gameInfo = await resolveGameInfo(linkRaw);
    srvAddBtn.disabled = false;
    srvAddBtn.textContent = original;
  }

  servers.unshift({
    name,
    owner,
    link,
    gameName: gameInfo ? gameInfo.gameName : null,
    gameImage: gameInfo ? gameInfo.gameImage : null,
  });
  pendingGameInfo = null;
  srvName.value = '';
  srvOwner.value = '';
  srvLink.value = '';
  persistServers();
  closeAddModal();
});

loadServers();

render();
