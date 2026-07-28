(()=>{'use strict';
const DEFAULT_PROFILES=['Keith','Debby','Sara','Kevin','John','Glenn'];
const STORAGE_KEY='wolftv-1.0';
const $=id=>document.getElementById(id);
let state=loadState(),currentPage='library',sort={key:'title',dir:1},selectedId='';
const STATUSES=['Watch','Watching','Watched','Very Good','Okay','No Good'];

function loadState(){
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));if(saved&&Array.isArray(saved.catalog)){saved.profiles=saved.profiles||DEFAULT_PROFILES;saved.personal=saved.personal||{};saved.timeline=saved.timeline||{};saved.feedback=saved.feedback||[];saved.theme=saved.theme||'dark';return saved}}catch{}
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
function parseProgress(value){const m=String(value||'').trim().match(/^s?\s*(\d+)\s*(?:e|x|[- ])\s*(\d+)$/i);return m?{season:Number(m[1]),episode:Number(m[2])}:null}
function nextProgress(show){return `S${show.season||1} E${(show.episode||0)+1}`}
function stars(n){return n?'★'.repeat(Number(n)):''}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1600)}
function addTimeline(id,action){(state.timeline[state.active]||(state.timeline[state.active]=[])).unshift({id,action,at:new Date().toISOString()});state.timeline[state.active]=state.timeline[state.active].slice(0,300)}
function getBase(id){return state.catalog.find(x=>x.id===id)}
function updateBase(id,key,value){const base=getBase(id);if(base){base[key]=value;save()}}
function updatePersonal(id,key,value){record(id)[key]=value;save()}

function setPage(name){currentPage=name;document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===name));document.querySelectorAll('nav button').forEach(el=>el.classList.toggle('active',el.dataset.page===name));if(name==='dashboard')renderDashboard();if(name==='library')renderTable();if(name==='timeline')renderTimeline();if(name==='settings')renderSettings()}
function renderProfiles(){state.profiles.forEach(n=>{if(!state.personal[n])state.personal[n]={}});$('profile').innerHTML=state.profiles.map(n=>`<option${n===state.active?' selected':''}>${esc(n)}</option>`).join('');$('profileName').textContent=state.active.toUpperCase()}
function renderDashboard(){
  const all=state.catalog.map(merged),watching=all.filter(x=>x.status==='Watching'),soon=all.filter(isSoon),favorites=all.filter(x=>x.favorite),watched=all.filter(x=>x.status==='Watched');
  $('statWatching').textContent=watching.length;$('statSoon').textContent=soon.length;$('statFavorites').textContent=favorites.length;$('statWatched').textContent=watched.length;$('statAvailable').textContent=all.filter(isAvailable).length;$('statTotal').textContent=all.length;
  const list=(items,type)=>items.slice(0,7).map(x=>`<div class="compactitem"><div><b>${esc(x.title)}</b><br><small>${esc(x.network||'Service unknown')}${progress(x.season,x.episode)?` · ${progress(x.season,x.episode)}`:''}</small></div>${type==='watch'?`<button class="mini nextbtn" data-next="${x.id}">${nextProgress(x)}</button>`:`<small>${esc(x.when||'')}</small>`}</div>`).join('')||'<p>No shows here yet.</p>';
  $('continueList').innerHTML=list(watching,'watch');$('soonList').innerHTML=list(soon.sort((a,b)=>dateValue(a.when)-dateValue(b.when)),'soon');
  const timeline=(state.timeline[state.active]||[]).slice(0,7);$('recentList').innerHTML=timeline.map(t=>{const s=getBase(t.id);return `<div class="compactitem"><div><b>${esc(s?.title||'Deleted show')}</b><br><small>${esc(t.action)}</small></div><small>${new Date(t.at).toLocaleDateString()}</small></div>`}).join('')||'<p>No watch history yet.</p>';
  bindNextButtons();
}
function filteredShows(){
  let items=state.catalog.map(merged);const q=$('search').value.trim().toLowerCase(),service=$('service').value,status=$('status').value,quick=$('quick').value;
  if(q)items=items.filter(x=>[x.title,x.network,x.when,x.status,x.notes,progress(x.season,x.episode),nextProgress(x)].join(' ').toLowerCase().includes(q));
  if(service)items=items.filter(x=>x.network===service);if(status)items=items.filter(x=>x.status===status);if(quick==='soon')items=items.filter(isSoon);if(quick==='available')items=items.filter(isAvailable);if(quick==='favorite')items=items.filter(x=>x.favorite);
  items.sort((a,b)=>String(a[sort.key]||'').localeCompare(String(b[sort.key]||''),undefined,{numeric:true})*sort.dir);return items;
}
function textCell(id,field,value,scope='base',extra=''){return `<input class="cell-input ${extra}" data-id="${id}" data-field="${field}" data-scope="${scope}" value="${esc(value||'')}" aria-label="${field}">`}
function renderTable(){
  const items=filteredShows();$('resultCount').textContent=`${items.length} of ${state.catalog.length} shows`;
  $('rows').innerHTML=items.map(x=>`<tr data-row="${x.id}" class="${x.id===selectedId?'selected':''}">
    <td class="title">${textCell(x.id,'title',x.title,'base','title-input')}</td>
    <td>${textCell(x.id,'network',x.network,'base')}</td>
    <td><select class="cell-select" data-id="${x.id}" data-field="status" data-scope="personal">${STATUSES.map(v=>`<option${v===x.status?' selected':''}>${v}</option>`).join('')}</select></td>
    <td><input class="cell-input watched-input" data-id="${x.id}" data-field="watched" value="${esc(progress(x.season,x.episode))}" placeholder="S2 E4" aria-label="Watched"></td>
    <td><button class="nextbtn" data-next="${x.id}">${nextProgress(x)}</button></td>
    <td><button class="ratingbtn" data-rating="${x.id}" title="Click to change rating">${stars(x.rating)||'☆☆☆☆☆'}</button></td>
    <td><button class="fav" data-fav="${x.id}" title="Favorite">${x.favorite?'★':'☆'}</button></td>
    <td>${textCell(x.id,'when',x.when,'base')}</td>
    <td>${textCell(x.id,'notes',x.notes,'personal','notes-input')}</td>
  </tr>`).join('');
  bindTableEditing();bindNextButtons();updateDeleteButton();
}
function bindTableEditing(){
  document.querySelectorAll('tr[data-row]').forEach(row=>row.onclick=e=>{if(e.target.closest('button,input,select'))return;selectedId=row.dataset.row;document.querySelectorAll('tr[data-row]').forEach(r=>r.classList.toggle('selected',r.dataset.row===selectedId));updateDeleteButton()});
  document.querySelectorAll('.cell-input').forEach(input=>{
    input.onfocus=()=>{selectedId=input.dataset.id;document.querySelectorAll('tr[data-row]').forEach(r=>r.classList.toggle('selected',r.dataset.row===selectedId));updateDeleteButton();input.dataset.original=input.value};
    input.onchange=()=>commitInput(input);
    input.onkeydown=e=>{if(e.key==='Escape'){input.value=input.dataset.original||'';input.blur()}if(e.key==='Enter'){e.preventDefault();commitInput(input);moveVertical(input,1)}};
  });
  document.querySelectorAll('.cell-select').forEach(sel=>sel.onchange=()=>{updatePersonal(sel.dataset.id,sel.dataset.field,sel.value);addTimeline(sel.dataset.id,`Status changed to ${sel.value}`);renderDashboard();toast('Saved')});
  document.querySelectorAll('[data-rating]').forEach(btn=>btn.onclick=()=>{const r=record(btn.dataset.rating);r.rating=String(((Number(r.rating)||0)+1)%6);save();btn.textContent=stars(r.rating)||'☆☆☆☆☆';toast(r.rating?`${r.rating} star rating`:'Rating cleared')});
  document.querySelectorAll('[data-fav]').forEach(btn=>btn.onclick=()=>{const r=record(btn.dataset.fav);r.favorite=!r.favorite;save();btn.textContent=r.favorite?'★':'☆';renderDashboard()});
}
function commitInput(input){
  const id=input.dataset.id,field=input.dataset.field,value=input.value.trim();
  if(field==='watched'){
    if(!value){const r=record(id);r.season=0;r.episode=0;save();return}
    const parsed=parseProgress(value);if(!parsed){input.value=progress(record(id).season,record(id).episode);toast('Use format S2 E4');return}
    const r=record(id);r.season=parsed.season;r.episode=parsed.episode;r.status='Watching';input.value=progress(r.season,r.episode);addTimeline(id,`Watched set to ${input.value}`);save();return;
  }
  if(input.dataset.scope==='personal')updatePersonal(id,field,value);else updateBase(id,field,value);
  if(field==='network')populateServices();
}
function moveVertical(input,direction){const field=input.dataset.field;const rows=[...document.querySelectorAll('tr[data-row]')];const current=input.closest('tr');const index=rows.indexOf(current);const target=rows[index+direction]?.querySelector(`[data-field="${field}"]`);target?.focus();target?.select?.()}
function bindNextButtons(){document.querySelectorAll('[data-next]').forEach(el=>el.onclick=()=>{const r=record(el.dataset.next);if(!r.season)r.season=1;r.episode=(Number(r.episode)||0)+1;r.status='Watching';const show=getBase(el.dataset.next);addTimeline(el.dataset.next,`Watched ${progress(r.season,r.episode)}`);save();toast(`${show?.title||'Show'}: ${progress(r.season,r.episode)}`);currentPage==='dashboard'?renderDashboard():renderTable()})}
function updateDeleteButton(){$('deleteSelected').disabled=!selectedId}
function deleteSelected(){if(!selectedId)return;const show=getBase(selectedId);if(show&&confirm(`Delete “${show.title}” from the shared catalog?`)){state.catalog=state.catalog.filter(x=>x.id!==selectedId);Object.values(state.personal).forEach(x=>delete x[selectedId]);selectedId='';save();populateServices();renderTable();toast('Show deleted')}}
function renderTimeline(){const items=state.timeline[state.active]||[];$('timelineList').innerHTML=items.map(t=>{const s=getBase(t.id);return `<div class="timeitem"><time>${new Date(t.at).toLocaleString()}</time><div><b>${esc(s?.title||'Deleted show')}</b><br>${esc(t.action)}</div></div>`}).join('')||'<p>No timeline entries yet.</p>'}
function renderSettings(){$('profiles').innerHTML=state.profiles.map(n=>`<div class="profileline"><span>${esc(n)}${n===state.active?' (active)':''}</span>${n==='Keith'?'':`<button class="mini" data-remove-profile="${esc(n)}">Remove</button>`}</div>`).join('');$('feedbackList').innerHTML=state.feedback.slice().reverse().map(f=>`<div class="feedbackitem"><span>${esc(f.text)}<br><small>${new Date(f.at).toLocaleString()}</small></span></div>`).join('');document.querySelectorAll('[data-remove-profile]').forEach(el=>el.onclick=()=>{state.profiles=state.profiles.filter(x=>x!==el.dataset.removeProfile);delete state.personal[el.dataset.removeProfile];delete state.timeline[el.dataset.removeProfile];save();renderProfiles();renderSettings()})}
function populateServices(){const selected=$('service').value;$('service').innerHTML='<option value="">All services</option>'+[...new Set(state.catalog.map(x=>x.network).filter(Boolean))].sort().map(x=>`<option>${esc(x)}</option>`).join('');$('service').value=selected}
function csv(value){const s=String(value??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}

document.querySelectorAll('nav button').forEach(el=>el.onclick=()=>setPage(el.dataset.page));document.querySelectorAll('[data-page-link]').forEach(el=>el.onclick=()=>setPage(el.dataset.pageLink));document.querySelectorAll('[data-open-library]').forEach(el=>el.onclick=()=>{$('quick').value=el.dataset.openLibrary==='all'?'all':el.dataset.openLibrary;setPage('library')});document.querySelectorAll('.cards button').forEach(el=>el.onclick=()=>{$('quick').value=el.dataset.filter;setPage('library')});
$('profile').onchange=()=>{state.active=$('profile').value;selectedId='';save();renderProfiles();setPage(currentPage)};$('theme').onclick=()=>{state.theme=state.theme==='light'?'dark':'light';document.body.classList.toggle('light',state.theme==='light');save()};
['search','service','status','quick'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',renderTable));$('clearSearch').onclick=()=>{$('search').value='';renderTable();$('search').focus()};
document.querySelectorAll('th[data-sort]').forEach(th=>th.onclick=()=>{sort=sort.key===th.dataset.sort?{key:sort.key,dir:-sort.dir}:{key:th.dataset.sort,dir:1};renderTable()});
$('addShow').onclick=()=>{$('addForm').reset();$('addDialog').showModal()};$('cancelAdd').onclick=()=>$('addDialog').close();$('addForm').onsubmit=e=>{e.preventDefault();const id=`user-${Date.now()}`;state.catalog.push({id,title:$('addTitle').value.trim(),network:$('addNetwork').value.trim(),when:$('addWhen').value.trim(),status:$('addStatus').value,notes:''});save();populateServices();$('addDialog').close();renderTable();toast('Show added')};
$('deleteSelected').onclick=deleteSelected;document.addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&selectedId&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){deleteSelected()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();download('WolfTV-backup.json',JSON.stringify(state,null,2),'application/json');toast('Backup downloaded')}});
$('clearTimeline').onclick=()=>{if(confirm(`Clear ${state.active}'s timeline?`)){state.timeline[state.active]=[];save();renderTimeline()}};
$('addProfile').onclick=()=>{const n=$('newProfile').value.trim();if(n&&!state.profiles.includes(n)){state.profiles.push(n);$('newProfile').value='';save();renderProfiles();renderSettings()}};
$('saveFeedback').onclick=()=>{const text=$('feedbackText').value.trim();if(text){state.feedback.push({text,at:new Date().toISOString()});$('feedbackText').value='';save();renderSettings();toast('Feedback saved')}};
$('backup').onclick=()=>download('WolfTV-backup.json',JSON.stringify(state,null,2),'application/json');$('restore').onclick=()=>$('restoreFile').click();$('restoreFile').onchange=async e=>{try{const incoming=JSON.parse(await e.target.files[0].text());if(!incoming.catalog)throw new Error();state=incoming;save();location.reload()}catch{alert('That is not a valid WolfTV backup.')}};
$('exportCsv').onclick=()=>{const header=['Title','Network','Release','Status'];const rows=state.catalog.map(x=>[x.title,x.network,x.when,x.status].map(csv).join(','));download('WolfTV-catalog.csv',[header.join(','),...rows].join('\n'),'text/csv')};$('importCsv').onclick=()=>$('csvFile').click();$('csvFile').onchange=async e=>{const lines=(await e.target.files[0].text()).split(/\r?\n/).filter(Boolean);if(lines.length<2)return;const parse=line=>{const out=[];line.replace(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g,(_,v)=>out.push(v.replace(/^"|"$/g,'').replace(/""/g,'"')));return out};lines.slice(1).forEach((line,i)=>{const [title,network,when,status]=parse(line);if(title)state.catalog.push({id:`csv-${Date.now()}-${i}`,title,network,when,status:status||'Watch',notes:''})});save();populateServices();renderTable();toast('CSV imported')};

document.body.classList.toggle('light',state.theme==='light');renderProfiles();populateServices();setPage('library');if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js?v=200').catch(()=>{});
})();
