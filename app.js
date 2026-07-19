const STORAGE_KEY = "hopfenstand.entries.v2";
const LEGACY_KEY = "hopfenstand.entries.v1";
const SETTINGS_KEY = "hopfenstand.settings.v1";
const formatter = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long" });
const historyFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

const elements = Object.fromEntries(["todayCount","todayUnit","currentDate","monthCount","yearCount","weeklyAverage","weekTotal","weekChart","historyList","addBeer","undoBeer","exportButton","resetButton","resetDialog","toast","installButton","beerType","beerSize","beerLiquid","recapTitle","recapText","monthLiters","calendarTitle","calendarGrid","themeButton","themePicker"].map(id => [id, document.querySelector(`#${id}`)]));
let entries = loadEntries();
let settings = loadSettings();
let installPrompt;
let toastTimer;

function loadEntries() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(current)) return current.filter(validEntry);
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
    const migrated = legacy.filter(value => Number.isFinite(new Date(value).getTime())).map(date => ({ date, type: "Bier", size: .5 }));
    if (migrated.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch { return []; }
}
function validEntry(item) { return item && Number.isFinite(new Date(item.date).getTime()) && Number.isFinite(Number(item.size)); }
function loadSettings() { try { return { theme:"pub", type:"Pils", size:.5, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") }; } catch { return { theme:"pub", type:"Pils", size:.5 }; } }
function saveEntries() { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function dayKey(value) { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function showToast(message) { clearTimeout(toastTimer); elements.toast.textContent=message; elements.toast.classList.add("visible"); toastTimer=setTimeout(()=>elements.toast.classList.remove("visible"),1800); }
function countFor(prefix) { return entries.filter(item => dayKey(item.date).startsWith(prefix)).length; }
function litersFor(prefix) { return entries.filter(item => dayKey(item.date).startsWith(prefix)).reduce((sum,item)=>sum+Number(item.size),0); }

function render() {
  const now=new Date(), today=dayKey(now), month=today.slice(0,7), year=today.slice(0,4);
  const todayCount=countFor(today), monthCount=countFor(month), yearCount=countFor(year);
  elements.currentDate.textContent=formatter.format(now); elements.todayCount.textContent=todayCount;
  elements.monthCount.textContent=monthCount; elements.yearCount.textContent=yearCount;
  elements.weeklyAverage.textContent=(yearCount/Math.max(1,Math.ceil((now-new Date(now.getFullYear(),0,1))/604800000))).toLocaleString("de-DE",{maximumFractionDigits:1});
  elements.undoBeer.disabled=!entries.length; elements.beerLiquid.style.height=`${Math.min(90,42+todayCount*8)}%`;
  document.body.dataset.theme=settings.theme; elements.beerType.value=settings.type; elements.beerSize.value=String(settings.size);
  renderChart(now); renderCalendar(now); renderRecap(now,month,monthCount); renderHistory();
}

function renderChart(now) {
  const days=Array.from({length:7},(_,index)=>{ const date=new Date(now.getFullYear(),now.getMonth(),now.getDate()-(6-index)); return {date,count:countFor(dayKey(date))}; });
  const maximum=Math.max(1,...days.map(day=>day.count)), total=days.reduce((sum,day)=>sum+day.count,0); elements.weekTotal.textContent=`${total} gesamt`;
  elements.weekChart.innerHTML=days.map(({date,count})=>`<div class="bar-column" title="${count} Bier"><div class="bar-track"><div class="bar" data-value="${count}" style="height:${count?Math.max(18,count/maximum*100):3}%"></div></div><small>${new Intl.DateTimeFormat("de-DE",{weekday:"short"}).format(date).replace(".","")}</small></div>`).join("");
}
function renderCalendar(now) {
  const year=now.getFullYear(), month=now.getMonth(), first=new Date(year,month,1), last=new Date(year,month+1,0), offset=(first.getDay()+6)%7;
  elements.calendarTitle.textContent=monthFormatter.format(now);
  const blanks=Array.from({length:offset},()=>`<span class="calendar-day empty"></span>`);
  const days=Array.from({length:last.getDate()},(_,i)=>{ const date=new Date(year,month,i+1), count=countFor(dayKey(date)), level=count===0?0:count===1?1:count<=3?2:3; return `<span class="calendar-day${dayKey(date)===dayKey(now)?" today":""}" data-level="${level}" title="${i+1}.: ${count} Bier">${i+1}${count?`<b>${count}</b>`:""}</span>`; });
  elements.calendarGrid.innerHTML=[...blanks,...days].join("");
}
function renderRecap(now,month,count) {
  const activeDays=new Set(entries.filter(item=>dayKey(item.date).startsWith(month)).map(item=>dayKey(item.date))).size;
  const liters=litersFor(month); elements.recapTitle.textContent=monthFormatter.format(now); elements.monthLiters.textContent=`${liters.toLocaleString("de-DE",{maximumFractionDigits:2})} l`;
  elements.recapText.textContent=count?`${count} Bier an ${activeDays} ${activeDays===1?"Tag":"Tagen"} – ${activeDays? (count/activeDays).toLocaleString("de-DE",{maximumFractionDigits:1}):0} pro aktivem Tag.`:"Noch keine Einträge in diesem Monat.";
}
function renderHistory() {
  const groups=entries.reduce((result,item)=>{ const key=dayKey(item.date); (result[key]??=[]).push(item); return result; },{});
  const rows=Object.entries(groups).sort(([a],[b])=>b.localeCompare(a)).slice(0,12);
  elements.historyList.innerHTML=rows.length?rows.map(([key,items])=>{ const [year,month,day]=key.split("-").map(Number); const liters=items.reduce((sum,item)=>sum+Number(item.size),0); const types=[...new Set(items.map(item=>item.type))].join(", "); return `<div class="history-row"><div><p>${historyFormatter.format(new Date(year,month-1,day))}</p><small>${types} · ${liters.toLocaleString("de-DE",{maximumFractionDigits:2})} l</small></div><span class="history-count">${items.length}</span></div>`; }).join(""):`<p class="empty-state">Noch keine Einträge. Dein erstes Bier wartet auf einen Klick.</p>`;
}

elements.addBeer.addEventListener("click",()=>{ entries.push({date:new Date().toISOString(),type:elements.beerType.value,size:Number(elements.beerSize.value)}); saveEntries(); elements.addBeer.classList.remove("splash"); void elements.addBeer.offsetWidth; elements.addBeer.classList.add("splash"); render(); showToast(`${elements.beerType.value} eingetragen 🍺`); });
elements.undoBeer.addEventListener("click",()=>{ if(!entries.length)return; entries.sort((a,b)=>new Date(a.date)-new Date(b.date)).pop(); saveEntries(); render(); showToast("Letzten Eintrag entfernt"); });
[elements.beerType,elements.beerSize].forEach(control=>control.addEventListener("change",()=>{ settings.type=elements.beerType.value; settings.size=Number(elements.beerSize.value); saveSettings(); }));
elements.themeButton.addEventListener("click",()=>{ elements.themePicker.hidden=!elements.themePicker.hidden; });
elements.themePicker.addEventListener("click",event=>{ const button=event.target.closest("button[data-theme]"); if(!button)return; settings.theme=button.dataset.theme; saveSettings(); elements.themePicker.hidden=true; render(); showToast("Design gewechselt"); });
document.addEventListener("click",event=>{ if(!elements.themePicker.hidden&&!elements.themePicker.contains(event.target)&&event.target!==elements.themeButton) elements.themePicker.hidden=true; });
elements.exportButton.addEventListener("click",()=>{ const rows=["Datum,Uhrzeit,Sorte,Größe (Liter)",...entries.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).map(item=>{const date=new Date(item.date);return `${date.toLocaleDateString("de-DE")},${date.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})},${item.type},${String(item.size).replace(".",",")}`;})]; const url=URL.createObjectURL(new Blob(["\ufeff"+rows.join("\n")],{type:"text/csv;charset=utf-8"})); const link=document.createElement("a");link.href=url;link.download=`hopfenstand-${dayKey(new Date())}.csv`;link.click();URL.revokeObjectURL(url); });
elements.resetButton.addEventListener("click",()=>elements.resetDialog.showModal()); elements.resetDialog.addEventListener("close",()=>{if(elements.resetDialog.returnValue!=="confirm")return;entries=[];saveEntries();render();showToast("Alle Daten gelöscht");});
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;elements.installButton.hidden=false;}); elements.installButton.addEventListener("click",async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=undefined;elements.installButton.hidden=true;});
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js")); render();
