const LS_KEY = 'sb_leaderboard_v1';
let room = null;
let currentUser = null;
let myRecord = null;
const pageState = { tab: 'local', local: 0, global: 0 };
const PAGE_SIZE = 8;

function getLocalScores() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}
function saveLocalScores(arr) { localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
export function addLocalScore(score, clipUrl = null) {
  const arr = getLocalScores();
  arr.push({ score, at: Date.now(), clipUrl });
  arr.sort((a,b)=>b.score-a.score);
  saveLocalScores(arr.slice(0, 50));
  renderLocal();
}
function renderLocal() {
  const list = document.getElementById('local-scores'); if (!list) return;
  const arr = getLocalScores();
  const totalPages = Math.max(1, Math.ceil(arr.length / PAGE_SIZE));
  pageState.local = Math.min(pageState.local, totalPages - 1);
  const start = pageState.local * PAGE_SIZE;
  const pageItems = arr.slice().sort((a,b)=>b.score-a.score).slice(start, start + PAGE_SIZE);
  list.innerHTML = '';
  pageItems.forEach((e)=>{
    const li = document.createElement('li');
    const d = new Date(e.at);
    li.textContent = `${e.score} — ${d.toLocaleDateString()} ${d.toLocaleTimeString()} `;
    if (e.clipUrl) {
      const meta = { src: e.clipUrl, user: (currentUser?.username)||'you', score: e.score };
      li.appendChild(createReplayButton(meta));
    }
    list.appendChild(li);
  });
  updatePagination(totalPages, pageState.local);
}
function renderGlobalFromRecords(records) {
  const list = document.getElementById('global-scores'); if (!list) return;
  const items = [];
  for (const r of records) {
    try {
      const data = JSON.parse(r.data || '{}');
      if (typeof data.highScore === 'number') {
        items.push({ user: r.username, score: data.highScore, clip: data.lastReplayUrl || null });
      }
    } catch {}
  }
  items.sort((a,b)=>b.score-a.score);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  pageState.global = Math.min(pageState.global, totalPages - 1);
  const start = pageState.global * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);
  list.innerHTML = '';
  pageItems.forEach((e)=>{
    const li = document.createElement('li');
    li.textContent = '';
    const img = document.createElement('img'); img.className='lb-avatar'; img.alt=`${e.user} avatar`; img.src=`https://images.websim.com/avatar/${e.user}`;
    const name = document.createElement('span'); name.textContent = `${e.user}: ${e.score} `;
    li.appendChild(img); li.appendChild(name);
    if (e.clip) {
      li.appendChild(createReplayButton({ src: e.clip, user: e.user, score: e.score }));
    }
    list.appendChild(li);
  });
  updatePagination(totalPages, pageState.global);
}
async function ensureRoom() {
  try { if (!currentUser) currentUser = await (window.websim?.getUser?.() || window.websim?.getCurrentUser?.()); } catch {}
  if (typeof WebsimSocket === 'undefined' || !window.websim) { room = null; return; }
  if (!room) { try { room = new WebsimSocket(); } catch { room = null; } }
}
async function ensureMyRecord() {
  await ensureRoom();
  if (!room) return; // no global backend available
  const coll = room.collection('player_v1');
  // try a few times to avoid creating during initial empty getList
  for (let attempt = 0; attempt < 3 && !myRecord; attempt++) {
    const byId = coll.filter({ user_id: currentUser.id }).getList();
    if (byId.length) { myRecord = byId[0]; break; }
    const byName = coll.filter({ username: currentUser.username }).getList();
    if (byName.length) {
      byName.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
      myRecord = byName[0];
      try { await coll.update(myRecord.id, { user_id: currentUser.id }); } catch {}
      break;
    }
    await new Promise(r=>setTimeout(r, 250));
  }
  if (!myRecord) {
    myRecord = await coll.create({ user_id: currentUser.id, data: JSON.stringify({ highScore: 0, recent: [] }) });
  }
}
export async function submitScoreToDB(score, replayUrl) {
  try {
    await ensureMyRecord();
    if (!room || !myRecord) return; // gracefully bail when no backend
    if (window.__replayUploadPromise) { try { await window.__replayUploadPromise; } catch {} }
    const coll = room.collection('player_v1');
    let data = {};
    try { data = JSON.parse(myRecord.data || '{}'); } catch { data = {}; }
    const recent = Array.isArray(data.recent) ? data.recent : [];
    const clip = replayUrl || window.__lastReplayUrl || null;
    recent.unshift({ score, at: Date.now(), clipUrl: clip });
    const highScore = Math.max(Number(data.highScore||0), score);
    const newData = { highScore, recent: recent.slice(0, 50), lastReplayUrl: clip };
    await coll.update(myRecord.id, { data: JSON.stringify(newData) });
    // refresh myRecord
    const updated = coll.filter({ username: currentUser.username }).getList();
    myRecord = updated[0] || myRecord;
  } catch (e) {
    console.warn('Submit failed:', e);
  }
}
async function subscribeGlobal() {
  await ensureRoom();
  if (!room) {
    const list = document.getElementById('global-scores');
    if (list) list.innerHTML = '<li>Global leaderboard unavailable</li>';
    return;
  }
  try {
    const coll = room.collection('player_v1');
    coll.subscribe(renderGlobalFromRecords);
    renderGlobalFromRecords(coll.getList());
  } catch { 
    const list = document.getElementById('global-scores');
    if (list) list.innerHTML = '<li>Global leaderboard unavailable</li>';
  }
}
function bindModal() {
  const btn = document.getElementById('leaderboard-button');
  const modal = document.getElementById('leaderboard-modal');
  const close = document.getElementById('lb-close');
  if (btn && modal && close) {
    btn.addEventListener('click', ()=>{ pageState.tab='local'; pageState.local=0; renderLocal(); setActiveTab('local'); modal.classList.remove('hidden'); });
    close.addEventListener('click', ()=> {
      modal.classList.add('hidden');
      window.dispatchEvent(new CustomEvent('leaderboard:closed'));
    });
  }
}
function setActiveTab(which='local') {
  pageState.tab = which;
  const localBtn = document.getElementById('lb-tab-local');
  const globalBtn = document.getElementById('lb-tab-global');
  const localList = document.getElementById('local-scores');
  const globalList = document.getElementById('global-scores');
  if (!localBtn || !globalBtn || !localList || !globalList) return;
  localBtn.classList.toggle('is-active', which==='local');
  globalBtn.classList.toggle('is-active', which==='global');
  localList.classList.toggle('hidden', which!=='local');
  globalList.classList.toggle('hidden', which!=='global');
  // refresh pagination display for current tab
  if (which === 'local') renderLocal(); else subscribeGlobal();
}
function bindSubmit() {
  const submit = document.getElementById('submit-score-btn');
  submit?.addEventListener('click', async ()=>{
    submit.disabled = true;
    document.getElementById('skip-submit-btn')?.setAttribute('disabled','true');
    document.getElementById('submit-loading')?.classList.remove('hidden');
    const scoreText = document.getElementById('final-score')?.textContent || '0';
    const score = parseInt(scoreText, 10) || 0;
    await submitScoreToDB(score);
    document.getElementById('submit-loading')?.classList.add('hidden');
    document.getElementById('skip-submit-btn')?.removeAttribute('disabled');
    // open modal to show updated global
    document.getElementById('leaderboard-modal')?.classList.remove('hidden');
  });
}
function bindTabs() {
  document.getElementById('lb-tab-local')?.addEventListener('click', ()=>{ pageState.local=0; setActiveTab('local'); });
  document.getElementById('lb-tab-global')?.addEventListener('click', async ()=>{ pageState.global=0; await subscribeGlobal(); setActiveTab('global'); });
}
function updatePagination(totalPages, currentPage) {
  const indicator = document.getElementById('lb-page-indicator');
  const prev = document.getElementById('lb-prev');
  const next = document.getElementById('lb-next');
  if (!indicator || !prev || !next) return;
  indicator.textContent = `${Math.min(currentPage+1,totalPages)} / ${totalPages}`;
  prev.disabled = currentPage <= 0;
  next.disabled = currentPage >= totalPages - 1;
}
function bindPagination() {
  const prev = document.getElementById('lb-prev');
  const next = document.getElementById('lb-next');
  prev?.addEventListener('click', ()=>{
    if (pageState.tab==='local') { pageState.local = Math.max(0, pageState.local-1); renderLocal(); }
    else { pageState.global = Math.max(0, pageState.global-1); subscribeGlobal(); }
  });
  next?.addEventListener('click', ()=>{
    if (pageState.tab==='local') { pageState.local++; renderLocal(); }
    else { pageState.global++; subscribeGlobal(); }
  });
}
function createReplayButton(meta) {
  const btn = document.createElement('button');
  btn.className = 'lb-replay'; btn.type = 'button'; btn.setAttribute('aria-label','Watch replay');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" stroke="currentColor" stroke-width="0"/></svg>';
  btn.addEventListener('click', ()=> showReplayModal(meta));
  return btn;
}
function bindReplayModal() {
  const modal = document.getElementById('replay-modal');
  const closeBtn = document.getElementById('replay-close');
  closeBtn?.addEventListener('click', ()=> hideReplayModal());
  modal?.addEventListener('click', (e)=>{ if(e.target===modal) hideReplayModal(); });
}
function showReplayModal({ src, user, score }) {
  const modal = document.getElementById('replay-modal'); if (!modal) return;
  const v = document.getElementById('replay-video'); v.src = src || ''; v.currentTime = 0; v.play().catch(()=>{});
  const uname = user?.username || user?.name || user || 'You';
  const usernameEl = document.getElementById('replay-username'); usernameEl.textContent = `@${uname}`; usernameEl.href = `https://websim.com/@${uname}`;
  const avatarEl = document.getElementById('replay-avatar'); avatarEl.src = `https://images.websim.com/avatar/${uname}`;
  const scoreEl = document.getElementById('replay-score'); scoreEl.textContent = `Score: ${Number(score||0)}`;
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
}
function hideReplayModal() {
  const modal = document.getElementById('replay-modal'); const v = document.getElementById('replay-video');
  if (v) { try { v.pause(); } catch {} v.src=''; }
  modal?.classList.add('hidden'); modal?.setAttribute('aria-hidden','true');
}
window.addEventListener('DOMContentLoaded', () => {
  bindModal();
  bindSubmit();
  bindTabs();
  bindPagination();
  bindReplayModal();
  renderLocal();
  // remove auto global subscribe on load
  // subscribeGlobal();
});