(()=>{'use strict';
const DEFAULT_PROFILES=['Keith','Debby','Sara','Kevin','John','Glenn'];
const STORAGE_KEY='wolftv-1.0';
const COLUMN_KEY='wolftv-column-widths-v12';
const $=id=>document.getElementById(id);
let state=loadState();
let currentPage='library';
let sort={key:'title',dir:1};

function loadState(){
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));if(saved&&Array.isArray(saved.catalog)){saved.profiles=saved.profiles||DEFAULT_PROFILES;return saved}}catch{}
  return{catalog:(window.WOLFTV_SEED||[]).map(x=>({...x})),profiles:[...DEFAULT_PROFILES],active:'Keith',personal:{},timeline:{},feedback:[],theme:'dark'};
}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function personal(){return state.personal[state.active]||(state.personal[state.active]={})}
function record(id){return personal()[id]||(personal()[id]={status:'',season:0,episode:0,rating:'',favorite:false,notes:''})}
function merged(show){const r=record(show.id);return{...show,status:r.status||show.status||'Watch',season:Number(r.season)||0,episode:Number(r.episode)||0,rating:r.rating||'',favorite:Boolean(r.favorite),notes:r.notes||show.notes||''}}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dateValue(v){const d=new Date(v);return Number.isNaN(d.getTime())?null:d}
function isSoon(show){const d=dateValue(show.when);if(!d)return false;const today=new Date();today.setHours(0,0,0,0);return d>=today}
function isAvailable(show){const d=dateValue(show.when);return /now/i.test(show.when||'')||(d&&d<new Date())}
function progress(season,episode){return season||episode?`S${season||1} E${episode||0}`:''}
function nextProgress(show){return `S${show.season||1} E${(show.episode||0)+1}`}
function stars(n){return n?'★'.repeat(Number(n)):''}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1800)}
function addTimeline(id,action){(state.timeline[state.active]||(state.timeline[state.active]=[])).unshift({id,action,at:new Date().toISOString()});state.timeline[state.active]=state.timeline[state.active].slice(0,300)}

function setPage(name){currentPage=name;document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===name));document.querySelectorAll('nav button').forEach(el=>el.classList.toggle('active',el.dataset.page===name));if(name==='dashboard')renderDashboard();if(name==='library')renderTable();if(name==='timeline')renderTimeline();if(name==='settings')renderSettings()}
function renderProfiles(){state.profiles.forEach(n=>{if(!state.personal[n])state.personal[n]={}});$('profile').innerHTML=state.profiles.map(n=>`<option${n===state.active?' selected':''}>${esc(n)}</option>`).join('');$('profileName').textContent=state.active.toUpperCase()}
function renderDashboard(){
  const all=state.catalog.map(merged),watching=all.filter(x=>x.status==='Watching'),soon=all.filter(isSoon),favorites=all.filter(x=>x.favorite),watched=all.filter(x=>x.status==='Watched');
  $('statWatching').textContent=watching.length;$('statSoon').textContent=soon.length;$('statFavorites').textContent=favorites.length;$('statWatched').textContent=watched.length;$('statAvailable').textContent=all.filter(isAvailable).length;$('statTotal').textContent=all.length;
  const list=(items,type)=>items.slice(0,7).map(x=>`<div class="compactitem"><div><b>${esc(x.title)}</b><br><small>${esc(x.network||'Service unknown')}${progress(x.season,x.episode)?` · ${progress(x.season,x.episode)}`:''}</small></div>${type==='watch'?`<button class="mini nextbtn" data-next="${x.id}">${nextProgress(x)}</button>`:`<small>${esc(x.when||'')}</small>`}</div>`).join('')||'<p>No shows here yet.</p>';
  $('continueList').innerHTML=list(watching,'watch');$('soonList').innerHTML=list(soon.sort((a,b)=>dateValue(a.when)-dateValue(b.when)),'soon');
  const timeline=(state.timeline[state.active]||[]).slice(0,7);$('recentList').innerHTML=timeline.map(t=>{const s=state.catalog.find(x=>x.id===t.id);return `<div class="compactitem"><div><b>${esc(s?.title||'Deleted show')}</b><br><small>${esc(t.action)}</small></div><small>${new Date(t.at).toLocaleDateString()}</small></div>`}).join('')||'<p>No watch history yet.</p>';
  bindNextButtons();
}
function filteredShows(){
  let items=state.catalog.map(merged);const q=$('search').value.trim().toLowerCase(),service=$('service').value,status=$('status').value,quick=$('quick').value;
  if(q)items=items.filter(x=>[x.title,x.network,x.when,x.status,x.notes,progress(x.season,x.episode),nextProgress(x)].join(' ').toLowerCase().includes(q));
  if(service)items=items.filter(x=>x.network===service);if(status)items=items.filter(x=>x.status===status);if(quick==='soon')items=items.filter(isSoon);if(quick==='available')items=items.filter(isAvailable);if(quick==='favorite')items=items.filter(x=>x.favorite);
  items.sort((a,b)=>String(a[sort.key]||'').localeCompare(String(b[sort.key]||''),undefined,{numeric:true})*sort.dir);return items;
}
function renderTable(){
  const items=filteredShows();$('resultCount').textContent=`${items.length} of ${state.catalog.length} shows`;
  $('rows').innerHTML=items.map(x=>`<tr>
    <td class="title" title="${esc(x.title)}">${esc(x.title)}</td>
    <td title="${esc(x.network)}">${esc(x.network)}</td>
    <td><select class="mini" data-status="${x.id}">${['Watch','Watching','Watched','Very Good','Okay','No Good'].map(v=>`<option${v===x.status?' selected':''}>${v}</option>`).join('')}</select></td>
    <td>${progress(x.season,x.episode)||'—'}</td>
    <td><button class="mini nextbtn" data-next="${x.id}">${nextProgress(x)}</button></td>
    <td>${stars(x.rating)}</td>
    <td><button class="mini fav" data-fav="${x.id}" title="Favorite">${x.favorite?'★':'☆'}</button></td>
    <td title="${esc(x.when)}">${esc(x.when)}</td>
    <td class="notes" title="${esc(x.notes)}">${esc(x.notes)}</td>
    <td><button class="mini" data-edit="${x.id}">Edit</button></td>
  </tr>`).join('');
  document.querySelectorAll('[data-status]').forEach(el=>el.onchange=()=>{record(el.dataset.status).status=el.value;addTimeline(el.dataset.status,`Status changed to ${el.value}`);save();renderDashboard()});
  document.querySelectorAll('[data-fav]').forEach(el=>el.onclick=()=>{const r=record(el.dataset.fav);r.favorite=!r.favorite;save();renderTable()});
  document.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>openEditor(el.dataset.edit));bindNextButtons();
}
function bindNextButtons(){document.querySelectorAll('[data-next]').forEach(el=>el.onclick=()=>{const r=record(el.dataset.next);if(!r.season)r.season=1;r.episode=(Number(r.episode)||0)+1;r.status='Watching';const show=state.catalog.find(x=>x.id===el.dataset.next);addTimeline(el.dataset.next,`Watched ${progress(r.season,r.episode)}`);save();toast(`${show?.title||'Show'}: ${progress(r.season,r.episode)}`);currentPage==='dashboard'?renderDashboard():renderTable()})}
function openEditor(id){const show=id?merged(state.catalog.find(x=>x.id===id)):{id:'',title:'',network:'',when:'',status:'Watch',season:0,episode:0,rating:'',favorite:false,notes:''};$('editId').value=show.id;$('editTitle').value=show.title;$('editNetwork').value=show.network;$('editWhen').value=show.when;$('editStatus').value=show.status;$('editSeason').value=show.season||'';$('editEpisode').value=show.episode||'';$('editRating').value=show.rating||'';$('editFavorite').value=String(show.favorite);$('editNotes').value=show.notes||'';$('deleteShow').style.display=id?'':'none';$('editor').showModal()}
function renderTimeline(){const items=state.timeline[state.active]||[];$('timelineList').innerHTML=items.map(t=>{const s=state.catalog.find(x=>x.id===t.id);return `<div class="timeitem"><time>${new Date(t.at).toLocaleString()}</time><div><b>${esc(s?.title||'Deleted show')}</b><br>${esc(t.action)}</div></div>`}).join('')||'<p>No timeline entries yet.</p>'}
function renderSettings(){$('profiles').innerHTML=state.profiles.map(n=>`<div class="profileline"><span>${esc(n)}${n===state.active?' (active)':''}</span>${n==='Keith'?'':`<button class="mini" data-remove-profile="${esc(n)}">Remove</button>`}</div>`).join('');$('feedbackList').innerHTML=state.feedback.slice().reverse().map(f=>`<div class="feedbackitem"><span>${esc(f.text)}<br><small>${new Date(f.at).toLocaleString()}</small></span></div>`).join('');document.querySelectorAll('[data-remove-profile]').forEach(el=>el.onclick=()=>{state.profiles=state.profiles.filter(x=>x!==el.dataset.removeProfile);delete state.personal[el.dataset.removeProfile];delete state.timeline[el.dataset.removeProfile];save();renderProfiles();renderSettings()})}
function populateServices(){const selected=$('service').value;$('service').innerHTML='<option value="">All services</option>'+[...new Set(state.catalog.map(x=>x.network).filter(Boolean))].sort().map(x=>`<option>${esc(x)}</option>`).join('');$('service').value=selected}
function setupColumnResizing(){
  const table=$('showTable'),cols=[...table.querySelectorAll('col[data-col]')],defaults={show:175,service:100,status:105,watched:82,next:82,rating:80,favorite:70,release:92,notes:155,actions:70};let saved={};try{saved=JSON.parse(localStorage.getItem(COLUMN_KEY)||'{}')}catch{}
  cols.forEach(col=>{const width=saved[col.dataset.col]||defaults[col.dataset.col];if(width)col.style.width=`${width}px`});
  table.querySelectorAll('th[data-col]').forEach(th=>{const handle=document.createElement('span');handle.className='resize-handle';handle.title='Drag to resize';th.appendChild(handle);const begin=e=>{e.preventDefault();e.stopPropagation();const col=table.querySelector(`col[data-col="${th.dataset.col}"]`),startX=(e.touches?e.touches[0]:e).clientX,startWidth=th.getBoundingClientRect().width;th.classList.add('resizing');const move=ev=>{ev.preventDefault?.();const x=(ev.touches?ev.touches[0]:ev).clientX;col.style.width=`${Math.max(55,Math.round(startWidth+x-startX))}px`};const end=()=>{th.classList.remove('resizing');document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',end);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);const out={};cols.forEach(c=>out[c.dataset.col]=Math.round(c.getBoundingClientRect().width));localStorage.setItem(COLUMN_KEY,JSON.stringify(out))};document.addEventListener('mousemove',move);document.addEventListener('mouseup',end);document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',end)};handle.addEventListener('mousedown',begin);handle.addEventListener('touchstart',begin,{passive:false});handle.ondblclick=e=>{e.preventDefault();e.stopPropagation();const col=table.querySelector(`col[data-col="${th.dataset.col}"]`);col.style.width=`${defaults[th.dataset.col]}px`}});
}
function csv(value){const s=String(value??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}

// Navigation and filters
document.querySelectorAll('nav button').forEach(el=>el.onclick=()=>setPage(el.dataset.page));document.querySelectorAll('[data-page-link]').forEach(el=>el.onclick=()=>setPage(el.dataset.pageLink));document.querySelectorAll('[data-open-library]').forEach(el=>el.onclick=()=>{$('quick').value=el.dataset.openLibrary==='all'?'all':el.dataset.openLibrary;setPage('library')});document.querySelectorAll('.cards button').forEach(el=>el.onclick=()=>{$('quick').value=el.dataset.filter;setPage('library')});
$('profile').onchange=()=>{state.active=$('profile').value;save();renderProfiles();setPage(currentPage)};$('theme').onclick=()=>{state.theme=state.theme==='light'?'dark':'light';document.body.classList.toggle('light',state.theme==='light');save()};
['search','service','status','quick'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',renderTable));$('clearSearch').onclick=()=>{$('search').value='';renderTable();$('search').focus()};
document.querySelectorAll('th[data-sort]').forEach(th=>th.onclick=e=>{if(e.target.classList.contains('resize-handle'))return;sort=sort.key===th.dataset.sort?{key:sort.key,dir:-sort.dir}:{key:th.dataset.sort,dir:1};renderTable()});
$('addShow').onclick=()=>openEditor();$('cancelEdit').onclick=()=>$('editor').close();
$('editForm').onsubmit=e=>{e.preventDefault();let id=$('editId').value;let base;if(id){base=state.catalog.find(x=>x.id===id)}else{id=`user-${Date.now()}`;base={id,title:'',network:'',when:'',status:'Watch',notes:''};state.catalog.push(base)}base.title=$('editTitle').value.trim();base.network=$('editNetwork').value.trim();base.when=$('editWhen').value.trim();const r=record(id);r.status=$('editStatus').value;r.season=Number($('editSeason').value)||0;r.episode=Number($('editEpisode').value)||0;r.rating=$('editRating').value;r.favorite=$('editFavorite').value==='true';r.notes=$('editNotes').value.trim();save();populateServices();$('editor').close();renderTable();toast('Show saved')};
$('deleteShow').onclick=()=>{const id=$('editId').value;if(id&&confirm('Delete this show from the shared catalog?')){state.catalog=state.catalog.filter(x=>x.id!==id);Object.values(state.personal).forEach(x=>delete x[id]);$('editor').close();save();renderTable();toast('Show deleted')}};
$('clearTimeline').onclick=()=>{if(confirm(`Clear ${state.active}'s timeline?`)){state.timeline[state.active]=[];save();renderTimeline()}};
$('addProfile').onclick=()=>{const n=$('newProfile').value.trim();if(n&&!state.profiles.includes(n)){state.profiles.push(n);$('newProfile').value='';save();renderProfiles();renderSettings()}};
$('saveFeedback').onclick=()=>{const text=$('feedbackText').value.trim();if(text){state.feedback.push({text,at:new Date().toISOString()});$('feedbackText').value='';save();renderSettings();toast('Feedback saved')}};
$('backup').onclick=()=>download('WolfTV-backup.json',JSON.stringify(state,null,2),'application/json');$('restore').onclick=()=>$('restoreFile').click();$('restoreFile').onchange=async e=>{try{const incoming=JSON.parse(await e.target.files[0].text());if(!incoming.catalog)throw new Error();state=incoming;save();location.reload()}catch{alert('That is not a valid WolfTV backup.')}};
$('exportCsv').onclick=()=>{const header=['Title','Network','Release','Status'];const rows=state.catalog.map(x=>[x.title,x.network,x.when,x.status].map(csv).join(','));download('WolfTV-catalog.csv',[header.join(','),...rows].join('\n'),'text/csv')};$('importCsv').onclick=()=>$('csvFile').click();$('csvFile').onchange=async e=>{const lines=(await e.target.files[0].text()).split(/\r?\n/).filter(Boolean);if(lines.length<2)return;const parse=line=>{const out=[];line.replace(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g,(_,v)=>out.push(v.replace(/^"|"$/g,'').replace(/""/g,'"')));return out};lines.slice(1).forEach((line,i)=>{const [title,network,when,status]=parse(line);if(title)state.catalog.push({id:`csv-${Date.now()}-${i}`,title,network,when,status:status||'Watch',notes:''})});save();populateServices();renderTable();toast('CSV imported')};

document.body.classList.toggle('light',state.theme==='light');renderProfiles();populateServices();setupColumnResizing();setPage('library');if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js?v=120').catch(()=>{});
})();
