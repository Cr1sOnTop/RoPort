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
function openAddModal(prefillLink){
  srvName.value = '';
  srvOwner.value = '';
  srvLink.value = prefillLink || '';
  modalBackdrop.classList.add('open');
  (prefillLink ? srvName : srvName).focus();
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
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape' && modalBackdrop.classList.contains('open')) closeAddModal();
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
  serverList.innerHTML = servers.map((s, i)=>`
    <div class="server-card">
      <div class="server-top">
        <span class="server-name">${esc(s.name || 'Unnamed server')}</span>
        ${s.owner ? `<span class="server-owner">${esc(s.owner)}</span>` : ''}
      </div>
      <div class="server-link">${esc(s.link)}</div>
      <div class="server-actions">
        <button type="button" data-act="copy" data-i="${i}">Copy</button>
        <a class="btn" href="${esc(s.link)}" target="_top" rel="noopener" data-act="open" data-i="${i}">Open ↗</a>
        <button type="button" class="btn-danger" data-act="del" data-i="${i}">Delete</button>
      </div>
    </div>
  `).join('');
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
});

srvAddBtn.addEventListener('click', ()=>{
  const name = srvName.value.trim();
  const owner = srvOwner.value.trim();
  const linkRaw = srvLink.value.trim();
  if(!linkRaw){
    srvLink.focus();
    return;
  }
  const link = toDeepLinkIfPossible(linkRaw);
  servers.unshift({ name, owner, link });
  srvName.value = '';
  srvOwner.value = '';
  srvLink.value = '';
  persistServers();
  closeAddModal();
});

loadServers();

render();
