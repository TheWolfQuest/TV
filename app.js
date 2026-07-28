(()=>{'use strict';
const DEFAULT_PROFILES=['Keith','Debby','Sara','Kevin','John','Glenn'];
const STORAGE_KEY='wolftv-1.0';
const AUTO_BACKUP_KEY='wolftv-auto-backups-v1';
const MAX_AUTO_BACKUPS=10;
const $=id=>document.getElementById(id);
let state=loadState(),currentPage='library',sort={key:'title',dir:1};
function loadState(){
  const seed=(window.WOLFTV_SEED||[]).map(x=>({...x}));
  try{
    const s=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(s&&Array.isArray(s.catalog)){
      s.profiles=s.profiles||DEFAULT_PROFILES;
      s.active=s.active||'Keith';
      s.personal=s.personal||{};
      s.timeline=s.timeline||{};
      s.feedback=s.feedback||[];
      s.deletedIds=Array.isArray(s.deletedIds)?s.deletedIds:[];
      const catalogIds=new Set(s.catalog.map(x=>x.id));
      const seedIds=seed.map(x=>x.id);
      if(!Array.isArray(s.knownSeedIds)){
        // First migration: seed rows missing from the saved catalog were deleted by the user.
        s.deletedIds=[...new Set([...s.deletedIds,...seedIds.filter(id=>!catalogIds.has(id))])];
        s.knownSeedIds=[...seedIds];
      }else{
        const known=new Set(s.knownSeedIds);
        const deleted=new Set(s.deletedIds);
        // Only genuinely new seed rows are merged into an existing library.
        seed.forEach(show=>{if(!known.has(show.id)&&!deleted.has(show.id)&&!catalogIds.has(show.id)){s.catalog.push({...show});catalogIds.add(show.id)}});
        s.knownSeedIds=[...new Set([...s.knownSeedIds,...seedIds])];
      }
      const deleted=new Set(s.deletedIds);
      s.catalog=s.catalog.filter(x=>x&&x.id&&!deleted.has(x.id));
      s.schemaVersion=2;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(s));
      return s;
    }
  }catch{}
  return{schemaVersion:2,catalog:seed,knownSeedIds:seed.map(x=>x.id),deletedIds:[],profiles:[...DEFAULT_PROFILES],active:'Keith',personal:{},timeline:{},feedback:[],theme:'dark'}
}
function getAutoBackups(){try{return JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY))||[]}catch{return []}}
function saveAutoBackups(items){localStorage.setItem(AUTO_BACKUP_KEY,JSON.stringify(items.slice(0,MAX_AUTO_BACKUPS)))}
function createAutoBackup(){try{const current=localStorage.getItem(STORAGE_KEY);if(!current)return;const backups=getAutoBackups();if(backups[0]?.data===current)return;backups.unshift({at:new Date().toISOString(),data:current});saveAutoBackups(backups)}catch{}}
function save(){createAutoBackup();localStorage.setItem(STORAGE_KEY,JSON.stringify(state));updateBackupStatus()}
function updateBackupStatus(){const el=$('autoBackupStatus');if(!el)return;const backups=getAutoBackups();el.textContent=backups.length?`${backups.length} automatic backup${backups.length===1?'':'s'} saved on this device. Latest: ${new Date(backups[0].at).toLocaleString()}`:'No automatic backups yet. Your first backup is created when you make a change.'}
function restoreLatestAutoBackup(){const backups=getAutoBackups();if(!backups.length){alert('No automatic backup is available yet.');return}const latest=backups[0];if(!confirm(`Restore the automatic backup from ${new Date(latest.at).toLocaleString()}? Your current data will be saved as another automatic backup first.`))return;createAutoBackup();try{state=JSON.parse(latest.data);localStorage.setItem(STORAGE_KEY,latest.data);toast('Automatic backup restored');setTimeout(()=>location.reload(),500)}catch{alert('That automatic backup could not be restored.')}}
function clearAutoBackups(){if(confirm('Delete all automatic backups stored on this device?')){localStorage.removeItem(AUTO_BACKUP_KEY);updateBackupStatus();toast('Automatic backups cleared')}}
function personal(){return state.personal[state.active]||(state.personal[state.active]={})}
function record(id){return personal()[id]||(personal()[id]={status:'',season:0,episode:0,rating:'',favorite:false,notes:''})}
function merged(show){const r=record(show.id);return{...show,status:r.status||show.status||'Watch',season:+r.season||0,episode:+r.episode||0,rating:r.rating||'',favorite:!!r.favorite,notes:r.notes||show.notes||''}}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dateValue(v){const d=new Date(v);return Number.isNaN(d.getTime())?null:d}
function isSoon(x){const d=dateValue(x.when);if(!d)return false;const t=new Date();t.setHours(0,0,0,0);return d>=t}
function isAvailable(x){const d=dateValue(x.when);return /now/i.test(x.when||'')||(d&&d<new Date())}
function progress(s,e){return s||e?`S${s||1} E${e||0}`:''}
function parseProgress(v){const m=String(v).trim().match(/^S?\s*(\d+)\s*E?\s*(\d+)$/i)||String(v).trim().match(/^(\d+)\s*[xX]\s*(\d+)$/);return m?{season:+m[1],episode:+m[2]}:null}
function nextProgress(x){return `S${x.season||1} E${(x.episode||0)+1}`}
function stars(n){return n?'★'.repeat(+n):'☆'}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1600)}
function addTimeline(id,action){(state.timeline[state.active]||(state.timeline[state.active]=[])).unshift({id,action,at:new Date().toISOString()});state.timeline[state.active]=state.timeline[state.active].slice(0,300)}
function setPage(n){currentPage=n;document.querySelectorAll('.page').forEach(e=>e.classList.toggle('active',e.id===n));document.querySelectorAll('nav button').forEach(e=>e.classList.toggle('active',e.dataset.page===n));if(n==='dashboard')renderDashboard();if(n==='library')renderTable();if(n==='timeline')renderTimeline();if(n==='settings')renderSettings()}
function renderProfiles(){state.profiles.forEach(n=>{if(!state.personal[n])state.personal[n]={}});$('profile').innerHTML=state.profiles.map(n=>`<option${n===state.active?' selected':''}>${esc(n)}</option>`).join('');$('profileName').textContent=state.active.toUpperCase()}
function renderDashboard(){const all=state.catalog.map(merged),watching=all.filter(x=>x.status==='Watching'),soon=all.filter(isSoon),favorites=all.filter(x=>x.favorite),watched=all.filter(x=>x.status==='Watched');$('statWatching').textContent=watching.length;$('statSoon').textContent=soon.length;$('statFavorites').textContent=favorites.length;$('statWatched').textContent=watched.length;$('statAvailable').textContent=all.filter(isAvailable).length;$('statTotal').textContent=all.length;const list=(items,type)=>items.slice(0,7).map(x=>`<div class="compactitem"><div><b>${esc(x.title)}</b><br><small>${esc(x.network||'Service unknown')}${progress(x.season,x.episode)?` · ${progress(x.season,x.episode)}`:''}</small></div>${type==='watch'?`<button class="mini nextbtn" data-next="${x.id}">${nextProgress(x)}</button>`:`<small>${esc(x.when||'')}</small>`}</div>`).join('')||'<p>No shows here yet.</p>';$('continueList').innerHTML=list(watching,'watch');$('soonList').innerHTML=list(soon.sort((a,b)=>(dateValue(a.when)||0)-(dateValue(b.when)||0)),'soon');const tl=(state.timeline[state.active]||[]).slice(0,7);$('recentList').innerHTML=tl.map(t=>{const s=state.catalog.find(x=>x.id===t.id);return `<div class="compactitem"><div><b>${esc(s?.title||'Deleted show')}</b><br><small>${esc(t.action)}</small></div><small>${new Date(t.at).toLocaleDateString()}</small></div>`}).join('')||'<p>No watch history yet.</p>';bindNextButtons()}
function filteredShows(){let items=state.catalog.map(merged),q=$('search').value.trim().toLowerCase();if(q)items=items.filter(x=>[x.title,x.network,x.when,x.status,x.notes,progress(x.season,x.episode),nextProgress(x)].join(' ').toLowerCase().includes(q));if($('service').value)items=items.filter(x=>x.network===$('service').value);if($('status').value)items=items.filter(x=>x.status===$('status').value);const quick=$('quick').value;if(quick==='soon')items=items.filter(isSoon);if(quick==='available')items=items.filter(isAvailable);if(quick==='favorite')items=items.filter(x=>x.favorite);items.sort((a,b)=>String(a[sort.key]||'').localeCompare(String(b[sort.key]||''),undefined,{numeric:true})*sort.dir);return items}
function editInput(id,field,value,cls=''){return `<input class="cell-edit ${cls}" data-id="${id}" data-field="${field}" value="${esc(value||'')}">`}
function renderTable(){const items=filteredShows();$('resultCount').textContent=`${items.length} of ${state.catalog.length} shows`;$('rows').innerHTML=items.map(x=>`<tr data-row="${x.id}">
<td>${editInput(x.id,'title',x.title,'title-input')}</td>
<td>${editInput(x.id,'network',x.network)}</td>
<td><select class="cell-select" data-id="${x.id}" data-field="status">${['Watch','Watching','Watched','Very Good','Okay','No Good'].map(v=>`<option${v===x.status?' selected':''}>${v}</option>`).join('')}</select></td>
<td>${editInput(x.id,'watched',progress(x.season,x.episode),'progress-input')}</td>
<td><button class="mini nextbtn" data-next="${x.id}">${nextProgress(x)}</button></td>
<td><button class="mini ratingbtn" data-rating="${x.id}" title="Click to change rating">${stars(x.rating)}</button></td>
<td><button class="mini fav" data-fav="${x.id}" title="Favorite">${x.favorite?'★':'☆'}</button></td>
<td>${editInput(x.id,'when',x.when)}</td>
<td>${editInput(x.id,'notes',x.notes)}</td>
<td><button class="mini danger deletebtn" data-delete="${x.id}" aria-label="Delete ${esc(x.title)}">🗑</button></td>
</tr>`).join('');bindInline();bindNextButtons()}
function commitInline(el){const id=el.dataset.id,field=el.dataset.field,base=state.catalog.find(x=>x.id===id),r=record(id);if(!base)return;if(field==='title'||field==='network'||field==='when')base[field]=el.value.trim();else if(field==='notes')r.notes=el.value.trim();else if(field==='watched'){const p=parseProgress(el.value);if(!el.value.trim()){r.season=0;r.episode=0}else if(p){r.season=p.season;r.episode=p.episode;r.status='Watching';addTimeline(id,`Set watched to ${progress(r.season,r.episode)}`)}else{toast('Use S2 E4 format');el.value=progress(r.season,r.episode);return}}save();if(field==='network')populateServices();toast('Saved')}
function bindInline(){document.querySelectorAll('.cell-edit').forEach(el=>{el.addEventListener('change',()=>commitInline(el));el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitInline(el);el.blur()}if(e.key==='Escape'){renderTable()}})});document.querySelectorAll('.cell-select').forEach(el=>el.onchange=()=>{record(el.dataset.id).status=el.value;addTimeline(el.dataset.id,`Status changed to ${el.value}`);save();toast('Saved')});document.querySelectorAll('[data-fav]').forEach(el=>el.onclick=()=>{const r=record(el.dataset.fav);r.favorite=!r.favorite;save();renderTable()});document.querySelectorAll('[data-rating]').forEach(el=>el.onclick=()=>{const r=record(el.dataset.rating);r.rating=String(((+r.rating||0)+1)%6||'');save();renderTable()});document.querySelectorAll('[data-delete]').forEach(el=>el.onclick=()=>deleteShow(el.dataset.delete))}
function bindNextButtons(){document.querySelectorAll('[data-next]').forEach(el=>el.onclick=()=>{const r=record(el.dataset.next);if(!r.season)r.season=1;r.episode=(+r.episode||0)+1;r.status='Watching';const show=state.catalog.find(x=>x.id===el.dataset.next);addTimeline(el.dataset.next,`Watched ${progress(r.season,r.episode)}`);save();toast(`${show?.title||'Show'}: ${progress(r.season,r.episode)}`);currentPage==='dashboard'?renderDashboard():renderTable()})}
function deleteShow(id){const s=state.catalog.find(x=>x.id===id);if(!s||!confirm(`Delete "${s.title}" from the shared catalog?`))return;state.deletedIds=Array.isArray(state.deletedIds)?state.deletedIds:[];if(!state.deletedIds.includes(id))state.deletedIds.push(id);state.catalog=state.catalog.filter(x=>x.id!==id);Object.values(state.personal).forEach(p=>delete p[id]);save();populateServices();renderTable();toast('Show deleted permanently for future updates')}
function renderTimeline(){const items=state.timeline[state.active]||[];$('timelineList').innerHTML=items.map(t=>{const s=state.catalog.find(x=>x.id===t.id);return `<div class="timeitem"><time>${new Date(t.at).toLocaleString()}</time><div><b>${esc(s?.title||'Deleted show')}</b><br>${esc(t.action)}</div></div>`}).join('')||'<p>No timeline entries yet.</p>'}
function renderSettings(){updateBackupStatus();$('profiles').innerHTML=state.profiles.map(n=>`<div class="profileline"><span>${esc(n)}${n===state.active?' (active)':''}</span>${n==='Keith'?'':`<button class="mini" data-remove-profile="${esc(n)}">Remove</button>`}</div>`).join('');$('feedbackList').innerHTML=state.feedback.slice().reverse().map(f=>`<div class="feedbackitem"><span>${esc(f.text)}<br><small>${new Date(f.at).toLocaleString()}</small></span></div>`).join('');document.querySelectorAll('[data-remove-profile]').forEach(el=>el.onclick=()=>{state.profiles=state.profiles.filter(x=>x!==el.dataset.removeProfile);delete state.personal[el.dataset.removeProfile];delete state.timeline[el.dataset.removeProfile];save();renderProfiles();renderSettings()})}
function populateServices(){const selected=$('service').value;$('service').innerHTML='<option value="">All services</option>'+[...new Set(state.catalog.map(x=>x.network).filter(Boolean))].sort().map(x=>`<option>${esc(x)}</option>`).join('');$('service').value=selected}
function csv(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function download(name,text,type){const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}

document.querySelectorAll('nav button').forEach(e=>e.onclick=()=>setPage(e.dataset.page));document.querySelectorAll('[data-page-link]').forEach(e=>e.onclick=()=>setPage(e.dataset.pageLink));document.querySelectorAll('[data-open-library]').forEach(e=>e.onclick=()=>{$('quick').value=e.dataset.openLibrary==='all'?'all':e.dataset.openLibrary;setPage('library')});document.querySelectorAll('.cards button').forEach(e=>e.onclick=()=>{$('quick').value=e.dataset.filter;setPage('library')});
$('profile').onchange=()=>{state.active=$('profile').value;save();renderProfiles();setPage(currentPage)};$('theme').onclick=()=>{state.theme=state.theme==='light'?'dark':'light';document.body.classList.toggle('light',state.theme==='light');save()};['search','service','status','quick'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',renderTable));$('clearSearch').onclick=()=>{$('search').value='';renderTable();$('search').focus()};document.querySelectorAll('th[data-sort]').forEach(th=>th.onclick=()=>{sort=sort.key===th.dataset.sort?{key:sort.key,dir:-sort.dir}:{key:th.dataset.sort,dir:1};renderTable()});
$('addShow').onclick=()=>{$('addForm').reset();$('addDialog').showModal()};$('cancelAdd').onclick=()=>$('addDialog').close();$('addForm').onsubmit=e=>{e.preventDefault();const id=`user-${Date.now()}`,base={id,title:$('addTitle').value.trim(),network:$('addNetwork').value.trim(),when:$('addWhen').value.trim(),status:$('addStatus').value,notes:''};state.catalog.push(base);const r=record(id);r.status=base.status;r.notes=$('addNotes').value.trim();save();populateServices();$('addDialog').close();renderTable();toast('Show added')};
$('clearTimeline').onclick=()=>{if(confirm(`Clear ${state.active}'s timeline?`)){state.timeline[state.active]=[];save();renderTimeline()}};$('addProfile').onclick=()=>{const n=$('newProfile').value.trim();if(n&&!state.profiles.includes(n)){state.profiles.push(n);$('newProfile').value='';save();renderProfiles();renderSettings()}};$('saveFeedback').onclick=()=>{const text=$('feedbackText').value.trim();if(text){state.feedback.push({text,at:new Date().toISOString()});$('feedbackText').value='';save();renderSettings();toast('Feedback saved')}};
$('restoreLatestAuto').onclick=restoreLatestAutoBackup;$('clearAutoBackups').onclick=clearAutoBackups;$('backup').onclick=()=>download('WolfTV-backup.json',JSON.stringify(state,null,2),'application/json');$('restore').onclick=()=>$('restoreFile').click();$('restoreFile').onchange=async e=>{try{const incoming=JSON.parse(await e.target.files[0].text());if(!incoming.catalog)throw new Error();state=incoming;save();location.reload()}catch{alert('That is not a valid WolfTV backup.')}};$('exportCsv').onclick=()=>{const h=['Title','Network','Release','Status'],rows=state.catalog.map(x=>[x.title,x.network,x.when,x.status].map(csv).join(','));download('WolfTV-catalog.csv',[h.join(','),...rows].join('\n'),'text/csv')};$('importCsv').onclick=()=>$('csvFile').click();$('csvFile').onchange=async e=>{const lines=(await e.target.files[0].text()).split(/\r?\n/).filter(Boolean);if(lines.length<2)return;const parse=line=>{const out=[];line.replace(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g,(_,v)=>out.push(v.replace(/^"|"$/g,'').replace(/""/g,'"')));return out};lines.slice(1).forEach((line,i)=>{const [title,network,when,status]=parse(line);if(title)state.catalog.push({id:`csv-${Date.now()}-${i}`,title,network,when,status:status||'Watch',notes:''})});save();populateServices();renderTable();toast('CSV imported')};

document.body.classList.toggle('light',state.theme==='light');renderProfiles();populateServices();setPage('library');
if('serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!sessionStorage.getItem('wolftv-reloaded')){sessionStorage.setItem('wolftv-reloaded','1');location.reload()}})}
})();
