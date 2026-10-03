
(function(){
"use strict";

/* ================= 常量 & 工具 ================= */
const DAYS   = ["周一","周二","周三","周四","周五","周六","周日"];
const DAYNUM = ["日","一","二","三","四","五","六"];
const wd     = n => DAYS[(((n-1)%7)+7)%7];        // 1=周一 … 7=周日
const PALETTE= ["#FBBF24","#F9A8D4","#86EFAC","#93C5FD","#C4B5FD","#FDBA74"];
const NCOLORS= ["c-yellow","c-pink","c-green","c-blue","c-purple","c-orange"];
const ROWH=64, GAP=6, NSEC=11;
const LS="wb-schedule-v2";
const LS_LEGACY="wb-schedule-v1";

const $  = s=>document.querySelector(s);
const $$ = s=>[...document.querySelectorAll(s)];
const pad= n=>String(n).padStart(2,"0");
const toMin=t=>{const[a,b]=t.split(":").map(Number);return a*60+b;};
const ymd = d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseD = s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);};
const midnight = d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const esc = s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const hours = (a,b)=>{const x=toMin(b)-toMin(a);return `${Math.floor(x/60)}小时${x%60?x%60+"分":""}`;};
const dayWord = p => p==="odd" ? "单周" : p==="even" ? "双周" : "每周";

function toast(msg){
  const d=document.createElement("div"); d.className="tst"; d.textContent=msg;
  $("#toast").appendChild(d); setTimeout(()=>{d.style.transition="opacity .3s";d.style.opacity=0;setTimeout(()=>d.remove(),320);},2100);
}

let activeModal=null, activeModalClose=null, activeModalReturnFocus=null;

function modalFocusable(modal){
  return [...modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
}

function modalKeydown(e){
  if(!activeModal) return;
  if(e.key==="Escape"){
    e.preventDefault();
    if(activeModalClose) activeModalClose();
    return;
  }
  if(e.key!=="Tab") return;
  const items=modalFocusable(activeModal);
  if(!items.length){ e.preventDefault(); return; }
  const first=items[0], last=items[items.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
}

function activateModal(modal, close){
  activeModal=modal;
  activeModalClose=close;
  activeModalReturnFocus=document.activeElement;
  document.body.classList.add("form-open");
  document.addEventListener("keydown", modalKeydown);
  setTimeout(()=>{ const first=modalFocusable(modal)[0]; if(first) first.focus(); },0);
}

function closeActiveModal(){
  if(!activeModal) return;
  const modal=activeModal;
  const returnFocus=activeModalReturnFocus;
  activeModal=null; activeModalClose=null; activeModalReturnFocus=null;
  document.removeEventListener("keydown", modalKeydown);
  modal.remove();
  document.body.classList.remove("form-open");
  if(returnFocus && typeof returnFocus.focus==="function") returnFocus.focus();
}

function closeFormDialog(){ closeActiveModal(); }

function formFieldHtml(field){
  const id="ff_"+field.name;
  const value=field.value==null ? "" : field.value;
  const cls=field.full ? "formfield full" : "formfield";
  const req=field.required ? " required" : "";
  const help=field.help ? `<small>${esc(field.help)}</small>` : "";
  let input="";
  if(field.type==="select"){
    const options=(field.options||[]).map(o=>Array.isArray(o)?o:[String(o),String(o)]);
    input=`<select id="${id}" name="${esc(field.name)}"${req}>${options.map(([v,t])=>`<option value="${esc(v)}"${String(v)===String(value)?" selected":""}>${esc(t)}</option>`).join("")}</select>`;
  }else if(field.type==="textarea"){
    input=`<textarea id="${id}" name="${esc(field.name)}" placeholder="${esc(field.placeholder||"")}"${req}>${esc(value)}</textarea>`;
  }else{
    const extra=[
      field.min!=null?`min="${esc(field.min)}"`:"",
      field.max!=null?`max="${esc(field.max)}"`:"",
      field.step!=null?`step="${esc(field.step)}"`:"" 
    ].filter(Boolean).join(" ");
    input=`<input id="${id}" name="${esc(field.name)}" type="${esc(field.type||"text")}" value="${esc(value)}" placeholder="${esc(field.placeholder||"")}"${extra?" "+extra:""}${req}>`;
  }
  return `<div class="${cls}"><label for="${id}">${esc(field.label)}</label>${input}${help}</div>`;
}

function openFormDialog(options){
  closeActiveModal();
  const fields=options.fields||[];
  const modal=document.createElement("div");
  modal.className="formmodal";
  modal.id="formModal";
  modal.innerHTML=`<div class="formcard" role="dialog" aria-modal="true" aria-labelledby="formModalTitle">
    <h3 id="formModalTitle">${esc(options.title||"填写信息")}</h3>
    ${options.description?`<div class="formdesc">${esc(options.description)}</div>`:""}
    <form id="formDialogForm">
      <div class="formgrid">${fields.map(formFieldHtml).join("")}</div>
      <div class="formerror" id="formError" role="alert"></div>
      <div class="formactions">
        <button type="button" class="formCancel">取消</button>
        <button type="submit" class="pri">${esc(options.submitText||"保存")}</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(modal);
  const form=modal.querySelector("form");
  const error=modal.querySelector("#formError");
  const close=()=>closeActiveModal();
  modal.querySelector(".formCancel").addEventListener("click", close);
  modal.addEventListener("mousedown", e=>{ if(e.target===modal) close(); });
  form.addEventListener("submit", async e=>{
    e.preventDefault();
    const values=Object.fromEntries(new FormData(form).entries());
    try{
      const message=options.onSubmit ? await options.onSubmit(values) : "";
      if(message){ error.textContent=message; return; }
      close();
    }catch(err){
      error.textContent=err && err.message ? err.message : "保存失败，请检查输入";
    }
  });
  activateModal(modal, close);
}

function shareUrl(){
  const csb=location.pathname.match(/\/(?:embed|p\/sandbox)\/([^/?#]+)/);
  if(location.hostname==="codesandbox.io" && csb) return `https://${csb[1]}.csb.app/`;
  if(location.hostname.endsWith(".csb.app")) return location.origin+"/#week";
  return location.href.split("#")[0] + "#week";
}

function copyText(text, successMessage){
  const fallback=()=>{
    const t=document.createElement("textarea");
    t.value=text; t.setAttribute("readonly",""); t.style.position="fixed"; t.style.opacity="0";
    document.body.appendChild(t); t.select();
    try{ document.execCommand("copy"); toast(successMessage); }catch(e){ toast("复制失败，请手动选择链接"); }
    t.remove();
  };
  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(text).then(()=>toast(successMessage)).catch(fallback);
  }else fallback();
}

function openShareDialog(){
  closeActiveModal();
  const url=shareUrl();
  const modal=document.createElement("div");
  modal.className="formmodal";
  modal.id="shareModal";
  modal.innerHTML=`<div class="formcard sharecard" role="dialog" aria-modal="true" aria-labelledby="shareTitle">
    <button type="button" class="shareclose" aria-label="关闭分享对话框">✕</button>
    <h3 id="shareTitle">分享课程表</h3>
    <div class="formdesc">二维码会根据当前访问地址动态生成，手机扫码即可打开。</div>
    <div id="qrcodeBox" class="qrbox" aria-label="课程表分享二维码"></div>
    <div class="shareurl" id="shareUrlText">${esc(url)}</div>
    <div class="formactions shareactions">
      <button type="button" id="shareCopy">复制链接</button>
      <button type="button" id="shareNative" class="pri">系统分享</button>
      <a class="btn pri shareopen" id="shareOpen" href="${esc(url)}" target="_blank" rel="noopener">打开链接</a>
    </div>
  </div>`;
  document.body.appendChild(modal);
  const qrBox=modal.querySelector("#qrcodeBox");
  if(window.QRCode){
    new QRCode(qrBox,{text:url,width:220,height:220,colorDark:"#111827",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});
  }else{
    qrBox.innerHTML=`<img alt="课程表二维码" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(url)}">`;
  }
  const close=()=>closeActiveModal();
  modal.querySelector(".shareclose").addEventListener("click", close);
  modal.addEventListener("mousedown", e=>{ if(e.target===modal) close(); });
  modal.querySelector("#shareCopy").addEventListener("click", ()=>copyText(url,"链接已复制"));
  modal.querySelector("#shareNative").addEventListener("click", async ()=>{
    if(navigator.share){
      try{ await navigator.share({title:"大数据二班的课表",text:"课程表 Web 应用",url}); }
      catch(e){ if(e && e.name!=="AbortError") copyText(url,"链接已复制"); }
    }else copyText(url,"链接已复制");
  });
  activateModal(modal, close);
}

/* ================= 管理员模式 ================= */
const ADMIN_KEY = "wb-schedule-admin-v1";
const ADMIN_SESSION_KEY = "wb-schedule-admin-session";
const DEFAULT_ADMIN = { username: "admin", password: "123456" };

function randomSalt(){
  const bytes = new Uint8Array(16);
  if(window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
  else for(let i=0;i<bytes.length;i++) bytes[i] = Math.floor(Math.random()*256);
  return [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function hashSecret(text){
  if(window.crypto && window.crypto.subtle && window.TextEncoder){
    const data = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }
  let hash = 2166136261;
  for(let i=0;i<text.length;i++){
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function loadAdminAccount(){
  try{
    const raw = localStorage.getItem(ADMIN_KEY);
    if(!raw) return null;
    const account = JSON.parse(raw);
    return account && account.username && account.salt && account.hash ? account : null;
  }catch(e){ return null; }
}

async function ensureAdminAccount(){
  let account = loadAdminAccount();
  if(account) return account;
  const salt = randomSalt();
  account = {
    username: DEFAULT_ADMIN.username,
    salt,
    hash: await hashSecret(DEFAULT_ADMIN.password + ":" + salt),
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  try{ localStorage.setItem(ADMIN_KEY, JSON.stringify(account)); }catch(e){}
  return account;
}

async function verifyAdmin(username, password){
  const account = await ensureAdminAccount();
  const hash = await hashSecret(String(password || "") + ":" + account.salt);
  return String(username || "").trim() === account.username && hash === account.hash;
}

async function changeAdminPassword(password){
  const account = await ensureAdminAccount();
  account.salt = randomSalt();
  account.hash = await hashSecret(password + ":" + account.salt);
  account.updatedAt = Date.now();
  localStorage.setItem(ADMIN_KEY, JSON.stringify(account));
}

function adminLoggedIn(){
  try{ return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1"; }catch(e){ return false; }
}

function setAdminSession(on){
  try{
    if(on) sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    else sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }catch(e){}
}

function openAdminDialog(){
  if(adminLoggedIn()) openAdminPanel();
  else openAdminLogin();
}

function openAdminLogin(){
  openFormDialog({
    title:"管理员登录",
    description:"初始账号：admin　初始密码：123456。登录只对当前浏览器会话有效，属于课程项目演示权限，不是服务器级安全认证。",
    fields:[
      {name:"username",label:"管理员账号",type:"text",value:"admin",required:true,full:true},
      {name:"password",label:"管理员密码",type:"password",required:true,full:true}
    ],
    submitText:"登录管理员模式",
    async onSubmit(values){
      if(!(await verifyAdmin(values.username, values.password))) return "账号或密码错误";
      setAdminSession(true);
      closeActiveModal();
      setTimeout(openAdminPanel, 0);
    }
  });
}

function adminInfoRows(){
  const account = loadAdminAccount() || {username:DEFAULT_ADMIN.username};
  const notes = state.notes || [];
  const leaves = state.leaves || [];
  const storage = (() => {
    try{ return (new Blob([localStorage.getItem(LS) || ""]).size / 1024).toFixed(1) + " KB"; }
    catch(e){ return "-"; }
  })();
  return [
    ["管理员账号", account.username],
    ["姓名", DATA.meta.studentName || "示例同学"],
    ["学号", DATA.meta.studentId || "-"],
    ["学期", DATA.meta.term || "-"],
    ["校区", DATA.meta.campus || "-"],
    ["便签数量", String(notes.length)],
    ["请假记录", String(leaves.length)],
    ["本地数据量", storage]
  ];
}

function openAdminPanel(){
  closeActiveModal();
  const notes = state.notes || [];
  const info = adminInfoRows().map(([k,v]) => `<div class="admininfoitem"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("");
  const noteHtml = notes.length ? notes.map(n => {
    const c = n.courseId ? course(n.courseId) : null;
    const when = n.updatedAt ? new Date(n.updatedAt).toLocaleString("zh-CN", {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "未编辑";
    return `<div class="adminnote" data-note-id="${esc(n.id)}">
      <div class="adminnotehead"><b>${c ? esc(c.name) : "随手记"}</b><span>${esc(when)}</span></div>
      <textarea data-admin-note="${esc(n.id)}" placeholder="便签内容">${esc(n.text||"")}</textarea>
      <div class="adminnotefoot"><button type="button" class="btn danger" data-admin-delete="${esc(n.id)}">删除此便签</button></div>
    </div>`;
  }).join("") : `<div class="empty adminempty"><div class="big">📌</div><div>当前还没有便签，可以先新建一张。</div></div>`;

  const modal = document.createElement("div");
  modal.className = "formmodal";
  modal.id = "adminModal";
  modal.innerHTML = `<div class="formcard admincard" role="dialog" aria-modal="true" aria-labelledby="adminTitle">
    <button type="button" class="shareclose" aria-label="关闭管理员模式">✕</button>
    <div class="adminhead">
      <div><h3 id="adminTitle">🛡️ 管理员模式</h3><div class="formdesc">可查看个人信息并集中更新便签。公开版展示的是脱敏数据。</div></div>
      <button type="button" class="btn" id="adminLogout">退出登录</button>
    </div>
    <h4 class="adminsecttl">个人信息</h4>
    <div class="admininfo">${info}</div>
    <div class="adminnotebar">
      <h4 class="adminsecttl">便签管理</h4>
      <div class="frow">
        <button type="button" class="btn" id="adminAddNote">新建便签</button>
        <button type="button" class="btn pri" id="adminSaveNotes">保存全部</button>
      </div>
    </div>
    <div class="adminnotes">${noteHtml}</div>
    <div class="adminaccountbox">
      <span>修改管理员密码</span>
      <button type="button" class="btn" id="adminChangePwd">修改密码</button>
    </div>
    <div class="formactions"><button type="button" class="btn pri" id="adminClose">关闭</button></div>
  </div>`;
  document.body.appendChild(modal);

  const close = ()=>closeActiveModal();
  modal.querySelector(".shareclose").addEventListener("click", close);
  modal.querySelector("#adminClose").addEventListener("click", close);
  modal.addEventListener("mousedown", e=>{ if(e.target===modal) close(); });
  modal.querySelector("#adminLogout").addEventListener("click", ()=>{ setAdminSession(false); close(); toast("已退出管理员模式"); });
  modal.querySelector("#adminSaveNotes").addEventListener("click", ()=>{
    modal.querySelectorAll("[data-admin-note]").forEach(ta=>{
      const note = state.notes.find(n=>n.id===ta.dataset.adminNote);
      if(note){ note.text = ta.value; note.updatedAt = Date.now(); }
    });
    saveLocal(); renderNotes(); renderTop(); toast("全部便签已更新");
    close(); setTimeout(openAdminPanel, 0);
  });
  modal.querySelectorAll("[data-admin-delete]").forEach(btn=>btn.addEventListener("click", ()=>{
    state.notes = state.notes.filter(n=>n.id!==btn.dataset.adminDelete);
    saveLocal(); renderNotes(); renderTop(); toast("便签已删除");
    close(); setTimeout(openAdminPanel, 0);
  }));
  modal.querySelector("#adminAddNote").addEventListener("click", ()=>{
    newNote({text:"",x:24,y:24});
    saveLocal(); renderNotes(); renderTop(); toast("已新建便签");
    close(); setTimeout(openAdminPanel, 0);
  });
  modal.querySelector("#adminChangePwd").addEventListener("click", ()=>{
    close();
    setTimeout(openAdminPasswordDialog, 0);
  });
  activateModal(modal, close);
}

function openAdminPasswordDialog(){
  openFormDialog({
    title:"修改管理员密码",
    description:"修改后只保存在当前浏览器，请妥善保管。",
    fields:[
      {name:"password",label:"新密码",type:"password",required:true,full:true},
      {name:"confirm",label:"确认新密码",type:"password",required:true,full:true}
    ],
    submitText:"更新密码",
    async onSubmit(values){
      const password = values.password || "";
      if(password.length < 6) return "新密码至少需要 6 位";
      if(password !== values.confirm) return "两次输入的密码不一致";
      await changeAdminPassword(password);
      closeActiveModal();
      setTimeout(openAdminPanel, 0);
      toast("管理员密码已更新");
    }
  });
}

/* ================= 状态 ================= */
const DEFAULTS = {
  meta:{semesterStart:"2026-09-07",totalWeeks:20,title:"大数据二班的课表"},
  timeSlots:[], courses:[], sessions:[]
};
let DATA = JSON.parse(JSON.stringify(DEFAULTS));
let state = { tab:"week", viewWeek:1, notes:[], leaves:[], settings:{} }

function loadLocal(){
  try{
    const raw = localStorage.getItem(LS) || localStorage.getItem(LS_LEGACY);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  }catch(e){ return null; }
}
function saveLocal(){
  try{
    const payload = {
      schemaVersion: 2,
      ...state,
      dataVersion: dataVersion(),
      data: {
        meta: DATA.meta,
        timeSlots: DATA.timeSlots,
        courses: DATA.courses,
        sessions: DATA.sessions
      }
    };
    localStorage.setItem(LS, JSON.stringify(payload));
  }catch(e){ toast("本地存储写入失败"); }
}

function applyBase(base){
  DATA = JSON.parse(JSON.stringify(base));
  if(!DATA.meta) DATA.meta={};
  if(!DATA.timeSlots || !DATA.timeSlots.length) DATA.timeSlots = defaultSlots();
  if(!DATA.courses) DATA.courses=[];
  if(!DATA.sessions) DATA.sessions=[];
  DATA.sessions.forEach(s=>{
    if(!s.id) s.id = "s"+(Math.random().toString(36).slice(2,8));
    s.day = Number(s.day); s.from=Number(s.from); s.to=Number(s.to);
    if(!Array.isArray(s.weeks)) s.weeks=[1, DATA.meta.totalWeeks||20];
    s.parity = s.parity||"all";
  });
}
function defaultSlots(){
  // 南海校区作息（每节 40 分钟；上午第 2 个课间 10:00–10:20 为 20 分钟，其余课间 10 分钟）
  const raw=[["08:30","09:10","上午"],["09:20","10:00","上午"],["10:20","11:00","上午"],["11:10","11:50","上午"],
             ["14:00","14:40","下午"],["14:50","15:30","下午"],["15:40","16:20","下午"],["16:30","17:10","下午"],
             ["19:00","19:40","晚上"],["19:50","20:30","晚上"],["20:40","21:20","晚上"]];
  return raw.map((r,i)=>({n:i+1,start:r[0],end:r[1],group:r[2]}));
}

/* ================= 学期 / 周次 ================= */
function semStart(){ return parseD(DATA.meta.semesterStart || "2026-09-07"); }
function totalWeeks(){ return Number(DATA.meta.totalWeeks)||20; }
function mondayOfWeek(w){ const d=semStart(); d.setDate(d.getDate()+(w-1)*7); return d; }
function weekOfDate(dt){
  const diff = Math.round((midnight(dt)-midnight(semStart()))/86400000);
  return Math.floor(diff/7)+1;
}
function dateOf(week,dayIdx){ const d=mondayOfWeek(week); d.setDate(d.getDate()+dayIdx); return d; }
function slot(n){ return DATA.timeSlots.find(x=>x.n===n) || {n,start:"--:--",end:"--:--"}; }
function timeRange(from,to){ const a=slot(from).start, b=slot(to).end; return `${a}-${b}`; }
function durationMin(from,to){ return toMin(slot(to).end)-toMin(slot(from).start); }
function course(id){ return DATA.courses.find(c=>c.id===id) || {id,name:"（已删除）",color:"#94a3b8",mark:"*"}; }
function sessionsOf(cid){ return DATA.sessions.filter(s=>s.courseId===cid); }
function activeIn(s,w){
  return w>=s.weeks[0] && w<=s.weeks[1] &&
    (s.parity==="all" || (s.parity==="odd" && w%2===1) || (s.parity==="even" && w%2===0));
}
function weeksDone(cid){ const set=new Set(); sessionsOf(cid).forEach(s=>{for(let w=s.weeks[0];w<=s.weeks[1];w++) if(activeIn(s,w)) set.add(w);}); return set; }

/* ================= 军训周 ================= */
const MILITARY_DEFAULT=[1,3];          // 第 1–3 周全天军训（可在设置里改）
function militaryRange(){
  const v=state.settings.militaryWeeks;
  return (Array.isArray(v)&&v.length===2&&v[1]>=v[0]) ? v : MILITARY_DEFAULT.slice();
}
function isMilitary(w){ const [a,b]=militaryRange(); return w>=a && w<=b; }
function militaryLabel(){ const [a,b]=militaryRange(); return a===b?`第 ${a} 周`:`第 ${a}–${b} 周`; }

/* ================= 法定节假日 ================= */
// 数据来源：《国务院办公厅关于 2026 年部分节假日安排的通知》（国办发明电〔2025〕7 号，2025-11-04）
// 只列出与本学期（2026-09-07 起 20 周）相关的假期，可在「设置 → 法定节假日」里增删改。
const HOLIDAY_DEFAULT = [
  {id:"h-midautumn", name:"中秋节", icon:"🌕", from:"2026-09-25", to:"2026-09-27",
   note:"9 月 25 日（周五）至 27 日（周日）放假，共 3 天"},
  {id:"h-national", name:"国庆节", icon:"🎆", from:"2026-10-01", to:"2026-10-07",
   note:"10 月 1 日（周四）至 7 日（周三）放假调休，共 7 天"},
  {id:"h-newyear",  name:"元旦",   icon:"🎊", from:"2027-01-01", to:"2027-01-03",
   note:"1 月 1 日（周五）至 3 日（周日）放假，共 3 天（正好落在周末，无需调休）"},
];
// 国办安排的「上班/上课」日（占用的周末）
// for = 这一天补周几的课（1=周一 … 7=周日）；0/null = 还没指定
// 2026 年：中秋 9/25（周五）–9/27（周日）本身连休；国庆 10/1（周四）–10/7（周三）
// 把 9/20（周日）和 10/10（周六）拉来上班/上课。2027 元旦 1/1（周五）–1/3（周日）落在周末，无需调休。
const MAKEUP_DEFAULT = [
  {date:"2026-09-20", note:"国办安排的调休上班日", for:0},
  {date:"2026-10-10", note:"国办安排的调休上班日", for:0},
];

function holidayList(){
  const v = state.settings.holidays;
  return Array.isArray(v) ? v : HOLIDAY_DEFAULT;
}
function makeupList(){
  const v = state.settings.makeupDays;
  return Array.isArray(v) ? v : MAKEUP_DEFAULT;
}
function holFrom(h){ return parseD(h.from); }
function holTo(h){ return parseD(h.to); }
function holidayLen(h){ return Math.max(1, Math.round((holTo(h)-holFrom(h))/86400000)+1); }
function holidayOfDate(dt){
  const t = midnight(dt).getTime();
  return holidayList().find(h=> t>=holFrom(h).getTime() && t<=holTo(h).getTime()) || null;
}
function holidayIndexOf(dt, h){ return Math.round((midnight(dt)-holFrom(h))/86400000)+1; }
function makeupOfDate(dt){ const k=ymd(dt); return makeupList().find(m=>m.date===k) || null; }
function makeupAsWorkday(){ return !!state.settings.makeupAsWorkday; }
/** 某周第 idx 天（0=周一）的日类型 */
function dayKind(w, idx){
  const dt = dateOf(w, idx);
  const h = holidayOfDate(dt);
  if(h) return {kind:"holiday", h, dt};
  const m = makeupOfDate(dt);
  if(m) return {kind:"makeup", m, dt};
  return {kind:"normal", dt};
}

/* ---------- 调休上班：这一天补周几的课 ---------- */
/** 把调休日设置落到本地（第一次改动时才写 state.settings.makeupDays） */
function ensureMkpLocal(){
  if(!Array.isArray(state.settings.makeupDays))
    state.settings.makeupDays = MAKEUP_DEFAULT.map(x=>Object.assign({}, x));
}
/** 该调休日「补周几」的课：返回 1–7，0 表示还没指定 */
function makeupFor(m){
  const n = m && Number(m.for);
  return (n>=1 && n<=7) ? n : 0;
}
/** 第 w 周第 idx 天（0=周一）这一格，实际按哪一天的课表上课（1–7） */
function cellDay(w, idx){
  const k = dayKind(w, idx);
  if(k.kind==="makeup"){ const f=makeupFor(k.m); if(f) return f; }
  return idx+1;
}
/** 这一格要上的课（含调休「补周几」的课）；法定假期当天不上课 */
function cellSessions(w, idx){
  const k = dayKind(w, idx);
  if(k.kind==="holiday") return [];
  const dd = cellDay(w, idx);
  if(k.kind==="makeup" && !makeupFor(k.m) && !makeupAsWorkday()) return [];
  return DATA.sessions.filter(s=>s.day===dd && activeIn(s,w));
}
/** 这一格是不是「借别的一天的课表」（调休补课） */
function isBorrowCell(w, idx){
  const k = dayKind(w, idx);
  return k.kind==="makeup" && makeupFor(k.m) && makeupFor(k.m)!==idx+1;
}
/** 设置某个调休日补周几的课（day 传 0 表示清除） */
function setMakeupFor(date, day){
  ensureMkpLocal();
  const list = state.settings.makeupDays;
  let m = list.find(x=>x.date===date);
  if(!m){ m = {date, note:"手动添加", for:0}; list.push(m); }
  m.for = (day>=1 && day<=7) ? day : 0;
  saveLocal();
  renderWeek(); renderToday(); renderFree(); renderLeave(); renderSettings();
  return m.for;
}
/** 本周所有调休上班日（含是否指定了「补周几」） */
function makeupCellsInWeek(w){
  const out=[];
  for(let i=0;i<7;i++){
    const k=dayKind(w,i);
    if(k.kind==="makeup") out.push({idx:i, dt:k.dt, m:k.m, for:makeupFor(k.m)});
  }
  return out;
}
/** 周课表表头上那颗橙色「调休」角标（点它能直接选补周几） */
function mkpTagHtml(m){
  const f = makeupFor(m);
  const lbl = f ? `⚠️ 调休 · 补${DAYS[f-1]}` : "⚠️ 调休 · 选补周几";
  const tip = (m.note ? m.note+"　" : "")
            + (f ? `这一天补${DAYS[f-1]}的课` : "点一下选择这一天补周几的课")
            + "　（快捷键 M）";
  return `<span class="ghtag mkp${f?" set":""}" data-mkp="${esc(m.date)}" title="${esc(tip)}">${lbl}</span>`;
}

/* ---------- 「补周几」快捷填写气泡 ---------- */
let mkpPopDate=null;
function closeMkpPop(){
  const p=$("#mkpPop"); if(p) p.remove();
  mkpPopDate=null;
  document.removeEventListener("mousedown", mkpOutside, true);
}
function mkpOutside(e){
  const p=$("#mkpPop");
  if(p && !p.contains(e.target)) closeMkpPop();
}
function openMkpPop(date, anchor){
  closeMkpPop();
  mkpPopDate=date;
  const m  = makeupList().find(x=>x.date===date) || {date};
  const f  = makeupFor(m);
  const dt = parseD(date);
  const el = document.createElement("div");
  el.className="mkpop"; el.id="mkpPop";
  el.innerHTML = `
    <div class="mkph"><b>${esc(date)}</b><small>${esc(DAYS[(dt.getDay()+6)%7])}　${esc(m.note||"国办调休上班日")}</small></div>
    <div class="mkpl">这一天补周几的课？</div>
    <div class="mkpb">${DAYS.map((d,i)=>
      `<button data-d="${i+1}" class="${f===i+1?"on":""}"><kbd>${i+1}</kbd>${esc(d)}</button>`).join("")}
    </div>
    <div class="mkpf">
      <button class="clr" data-d="0">清除（不补课）</button>
      <span class="hint">按 <kbd>1</kbd>–<kbd>7</kbd> 直接选，<kbd>0</kbd> 清除，<kbd>Esc</kbd> 关闭</span>
    </div>`;
  document.body.appendChild(el);
  el.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
    const d=+b.dataset.d;
    setMakeupFor(date,d); closeMkpPop();
    toast(d ? `已设置：${date} 补${DAYS[d-1]}的课` : `已清除 ${date} 的补周几设置`);
  }));
  const r=anchor.getBoundingClientRect();
  const w=el.offsetWidth, h=el.offsetHeight;
  let left=Math.min(Math.max(8, r.left + r.width/2 - w/2), Math.max(8, innerWidth - w - 8));
  let top = r.bottom + 8;
  if(top + h > innerHeight - 8) top = Math.max(8, r.top - h - 8);
  el.style.left=left+"px"; el.style.top=top+"px";
  setTimeout(()=>document.addEventListener("mousedown", mkpOutside, true), 0);
}
/** 键盘快捷键：M 打开填框；填框打开时 1–7 直接选、0/Backspace 清除、Esc 关闭 */
function bindMkpKeys(){
  document.addEventListener("keydown",e=>{
    if(e.metaKey||e.ctrlKey||e.altKey) return;
    const t=e.target;
    if(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    const pop=$("#mkpPop");
    if(pop && mkpPopDate){
      const date=mkpPopDate;
      if(/^[1-7]$/.test(e.key)){
        const d=+e.key; setMakeupFor(date,d); closeMkpPop();
        toast(`已设置：${date} 补${DAYS[d-1]}的课`); e.preventDefault();
      } else if(e.key==="0"||e.key==="Backspace"||e.key==="Delete"){
        setMakeupFor(date,0); closeMkpPop(); toast(`已清除 ${date} 的补周几设置`); e.preventDefault();
      } else if(e.key==="Escape"){ closeMkpPop(); }
      return;
    }
    if(e.key==="m"||e.key==="M"){ quickMakeup(); e.preventDefault(); }
  });
}
/** 快捷键 M：直接弹出最近一个调休上班日的「补周几」填写框 */
function quickMakeup(){
  const list = makeupList().slice().sort((a,b)=> a.date<b.date ? -1 : 1);
  if(!list.length){ toast("本学期没有调休上班日"); return; }
  const todayStr = ymd(new Date());
  const m = list.find(x=>x.date >= todayStr) || list[list.length-1];
  const wk = weekOfDate(parseD(m.date));
  if(state.tab!=="week") switchTab("week");
  if(wk>=1 && wk<=totalWeeks() && wk!==state.viewWeek){
    state.viewWeek=wk; saveLocal(); renderTop(); renderWeek();
  }
  requestAnimationFrame(()=>{
    const tag=document.querySelector(`.ghtag.mkp[data-mkp="${m.date}"]`);
    if(tag) openMkpPop(m.date, tag);
    else toast("这一周没有调休上班日");
  });
}
/** 本周落在法定假期里的天（军训周不参与，因为整周都没常规课） */
function holidaysInWeek(w){
  if(isMilitary(w)) return [];
  const out=[];
  for(let i=0;i<7;i++){ const k=dayKind(w,i); if(k.kind==="holiday") out.push({idx:i, dt:k.dt, h:k.h}); }
  return out;
}
/** 下一个尚未结束的法定假期（含正在进行中的） */
function nextHoliday(){
  const now = midnight(new Date());
  const list = holidayList().map(h=>({h, from:holFrom(h), to:holTo(h)}))
    .filter(x=> x.to.getTime() >= now.getTime())
    .sort((a,b)=> a.from-b.from);
  if(!list.length) return null;
  const x=list[0];
  const ongoing = now.getTime()>=x.from.getTime() && now.getTime()<=x.to.getTime();
  return {
    h:x.h, from:x.from, to:x.to, ongoing,
    startInDays: Math.max(0, Math.round((x.from-now)/86400000)),
    endInDays:   Math.max(0, Math.round((x.to-now)/86400000)),
  };
}
/* ================= 请假 ================= */
function isLeave(sid,w){ return (state.leaves||[]).some(x=>x.sid===sid && x.week===w); }
function leaveOf(sid,w){ return (state.leaves||[]).find(x=>x.sid===sid && x.week===w); }
function toggleLeave(sid,w,info){
  state.leaves = state.leaves || [];
  const i = state.leaves.findIndex(x=>x.sid===sid && x.week===w);
  if(i>=0) state.leaves.splice(i,1);
  else state.leaves.push(Object.assign({id:"lv"+Date.now()+Math.random().toString(36).slice(2,5), sid, week:w, createdAt:Date.now(), reason:"", kind:"事假"}, info||{}));
  saveLocal();
  return isLeave(sid,w);
}
function leavesOfWeek(w){ return (state.leaves||[]).filter(x=>x.week===w); }
function sessionById(sid){ return DATA.sessions.find(s=>s.id===sid); }
/** 本周（含指定周）被请假的时段明细，按时间排序 */
function leaveList(){
  return (state.leaves||[]).map(x=>{
    const s=sessionById(x.sid);
    return s ? {x, s, c:course(s.courseId)} : null;
  }).filter(Boolean).sort((a,b)=> b.x.week-a.x.week || a.s.day-b.s.day || a.s.from-b.s.from);
}

/* ================= 考核信息 ================= */
function assessOf(id){
  const c=course(id);
  const base=c.assess||null;
  const ov=(state.settings.assess||{})[id];
  if(!ov) return base;
  const merged=Object.assign({}, base||{}, ov, {edited:true});
  if(!merged.kind) merged.kind = merged.raw==="考查" ? "review" : "exam";
  if(!merged.src) merged.src = "pdf";
  return merged;
}
function assessWord(a){ return a.kind==="exam" ? "考试" : "考查"; }
/** 周课表用的小标签：教务明确写了的加粗实心，推断的带 ? */
function assessBadge(id){
  const a=assessOf(id);
  if(!a) return "";
  const label=assessWord(a);
  const tip=(a.src==="pdf"||a.edited)
    ? `教务标注：${a.raw}｜形式：${a.form}`
    : `教务未标注，按课程性质参考推断：${a.form}（可点击课程自行修改）`;
  return `<span class="aset ${a.kind}" title="${esc(tip)}">${a.kind==="exam"?"📝":"📄"} ${label}${a.src==="pdf"?"":"?"}</span>`;
}

/* ================= 空闲时间 ================= */
const FREE_MIN = 25;                   // 小于 25 分钟的空隙视作课间/赶路，不计入空闲
                                       // （南海校区课间 10 分钟、上午第 2 个课间 20 分钟，均不算空闲）
const EVE_FROM = ()=>toMin(slot(9).start);   // 晚上从第 9 节开始
function pad2m(m){ return pad(Math.floor(m/60))+":"+pad(m%60); }
function fmtHM(mins){
  const h=Math.floor(mins/60), m=mins%60;
  if(!h) return m+" 分";
  return h+" 小时"+(m?" "+m+" 分":"");
}
function fmtHMshort(mins){
  const h=Math.floor(mins/60), m=mins%60;
  return (h?h+"h":"")+(m?(h?" ":"")+m+"m":"");
}
function partOf(min){
  if(min<12*60) return {key:"am", name:"上午", icon:"🌅"};
  if(min<18*60) return {key:"pm", name:"下午", icon:"☀️"};
  return {key:"eve", name:"晚上", icon:"🌙"};
}
/** 某天（第 w 周）的忙 / 空闲分布 */
function dayPlan(w, day){
  const dd = cellDay(w, day-1);                     // 调休日可能按「补周几」的课表走
  const all=DATA.sessions.filter(s=>s.day===dd && activeIn(s,w));
  const off=all.filter(s=>isLeave(s.id,w));          // 已请假的时段：课不上了，时间释放为空闲
  const list=all.filter(s=>!isLeave(s.id,w))
    .map(s=>({s, a:toMin(slot(s.from).start), b:toMin(slot(s.to).end)}))
    .sort((x,y)=>x.a-y.a);
  const busy=[];
  list.forEach(x=>{
    const last=busy[busy.length-1];
    if(last && x.a<=last.b) last.b=Math.max(last.b, x.b);
    else busy.push({a:x.a, b:x.b});
  });
  const A=toMin(slot(1).start), B=toMin(slot(NSEC).end);
  const free=[]; let cur=A;
  busy.forEach(g=>{
    if(g.a-cur>=FREE_MIN) free.push({a:cur, b:g.a, mins:g.a-cur, part:partOf(cur)});
    cur=Math.max(cur, g.b);
  });
  if(B-cur>=FREE_MIN) free.push({a:cur, b:B, mins:B-cur, part:partOf(cur)});
  const eveA=EVE_FROM(), eveB=B;
  const eveBusy=list.some(x=>x.b>eveA && x.a<eveB);
  return {
    list, off, busy, free, A, B,
    totalFree: free.reduce((s,x)=>s+x.mins,0),
    longest: free.reduce((m,x)=>Math.max(m,x.mins),0),
    freeMin: list.reduce((s,x)=>s+(x.b-x.a),0),
    eveBusy, eveFree: eveBusy?0:(eveB-eveA),
  };
}

/* ================= 顶栏 ================= */
function renderTop(){
  const w = state.viewWeek, tot=totalWeeks(), now=weekOfDate(new Date());
  const rawTitle = String(DATA.meta.title || "课表").trim();
  $("#tTitle").textContent = rawTitle.includes("课表") ? rawTitle : rawTitle + "的课表";
  $("#tSub").textContent = `${DATA.meta.term||""} · 学号 ${DATA.meta.studentId||"-"} · ${DATA.meta.campus||""}校区`;
  const a=mondayOfWeek(w), b=dateOf(w,6);
  $("#wkLabel").innerHTML = `第 ${w} 周${w===now?" <span style='color:#ef4444'>· 本周</span>":""}
    <small>${a.getMonth()+1}.${a.getDate()} - ${b.getMonth()+1}.${b.getDate()}</small>`;
  $("#noteBadge").textContent = state.notes.length;
  $("#noteBadge").style.display = state.notes.length? "" : "none";
}

/* ================= 周课表 ================= */
function sectionsToRender(){
  if(state.settings.showAllSections) return Array.from({length:NSEC},(_,i)=>i+1);
  if(isMilitary(state.viewWeek)) return Array.from({length:8},(_,i)=>i+1);  // 军训周铺满白天
  const used = DATA.sessions.map(s=>s.to);
  const maxUsed = used.length ? Math.max(...used) : 8;
  const max = Math.min(NSEC, Math.max(maxUsed, 4));
  return Array.from({length:max},(_,i)=>i+1);
}
function renderWeek(){
  const grid = $("#grid");
  grid.innerHTML = "";
  const w = state.viewWeek, today = new Date();
  const todayIdx = (today.getDay()+6)%7;                 // 0=周一
  const isThisWeek = (w === weekOfDate(today));
  const secs = sectionsToRender();
  const R = n => { const i = secs.indexOf(n); return i<0 ? 0 : i; };

  const corner=document.createElement("div");
  corner.className="gcorner"; corner.textContent="节次"; corner.style.gridArea="1/1";
  grid.appendChild(corner);

  for(let d=0; d<7; d++){
    const el=document.createElement("div");
    const k = dayKind(w,d);
    el.className="gh"+(isThisWeek&&d===todayIdx?" today":"")
      +(k.kind==="holiday"?" hol":"")+(k.kind==="makeup"?" mkp":"");
    const dt=dateOf(w,d);
    el.innerHTML=`<b>${DAYS[d]}</b><small>${dt.getMonth()+1}/${dt.getDate()}</small>`
      + (k.kind==="holiday" ? `<span class="ghtag hol" title="${esc(k.h.note||"法定节假日")}">${k.h.icon} ${esc(k.h.name)}</span>` : "")
      + (k.kind==="makeup"  ? mkpTagHtml(k.m) : "");
    el.style.gridArea=`1/${d+2}`;
    grid.appendChild(el);
  }
  // 点「调休」角标 → 直接选这一天补周几的课
  $$("#grid .ghtag.mkp").forEach(t=>t.addEventListener("click",e=>{
    e.stopPropagation(); openMkpPop(t.dataset.mkp, t);
  }));

  secs.forEach((n,i)=>{
    const s=slot(n);
    const el=document.createElement("div");
    el.className="sec"+(n>=9?" eve":"")+(n>=5&&n<=8?" after":"");
    el.innerHTML=`<b>${n}</b><small>${s.start}</small>`;
    el.title=`第${n}节 ${s.start}-${s.end}`;
    el.style.gridArea=`${i+2}/1`;
    grid.appendChild(el);
  });

  // 空白格
  for(let d=0;d<7;d++) secs.forEach((n,i)=>{
    const el=document.createElement("div");
    el.className="slot"+(isThisWeek&&d===todayIdx?" todaycol":"");
    el.style.gridArea=`${i+2}/${d+2}`;
    grid.appendChild(el);
  });

  // 课程块
  const showOff = !!state.settings.showOff;
  for(let d=0;d<7;d++){
    const dd = cellDay(w,d);                        // 调休日按「补周几」取课
    const all = DATA.sessions.filter(s=>s.day===dd);
    const list = showOff ? all : all.filter(s=>activeIn(s,w));
    if(!list.length) continue;
    const bor = isBorrowCell(w,d);
    const {items} = layoutLanes(list);
    items.forEach(({s,lane,lanes})=>{
      const c = course(s.courseId);
      const on = activeIn(s,w);
      const onLeave = isLeave(s.id, w);
      const isHol = dayKind(w,d).kind==="holiday";
      const el=document.createElement("div");
      el.className="ev"+(on?"":" off")+(onLeave?" leave":"")+(isHol?" hol":"")+(bor?" borrow":"")+(lanes>1?" narrow":"");
      el.dataset.sid = s.id;
      el.style.setProperty("--c", c.color);
      el.style.gridArea = `${R(s.from)+2}/${d+2}/${R(s.to)+3}/${d+3}`;
      if(lanes>1){
        const p = 100/lanes;
        el.style.marginLeft = `calc(${lane*p}% + ${lane?3:0}px)`;
        el.style.width = `calc(${p}% - 3px)`;
      }
      const mins = durationMin(s.from,s.to);
      const as = assessOf(c.id);
      el.title = `${c.name}　${s.from}-${s.to}节 ${timeRange(s.from,s.to)}　📍${s.room||""} ${s.teacher||""}`
               + (as?`　考核：${assessWord(as)}（${as.form}）`:"")
               + (bor?`　⚠️ 调休补课：补${DAYS[dd-1]}的课`:"");
      el.innerHTML = `
        <div class="nm">${esc(c.name)}</div>
        <div class="meta"><span class="pill">${s.from}-${s.to}节</span><span class="hideable">${timeRange(s.from,s.to)} · ${mins}′</span></div>
        <div class="loc" title="${esc(s.room||"待定")}"><span class="pin">📍</span><span>${esc(s.room||"待定")}</span></div>
        <div class="meta">${assessBadge(c.id)}<span class="hideable">${esc(s.teacher||"")}</span></div>
        <div class="meta"><span class="wk">第${s.weeks[0]}-${s.weeks[1]}周${s.parity!=="all"?"·"+dayWord(s.parity):""}</span><span class="hideable">${on?"":" · 本周停课"}</span>${bor?`<span class="pill borp">补${esc(DAYS[dd-1])}课</span>`:""}</div>
        <button class="lv" title="给这节课打便签">📌</button>
        <button class="lvask" title="标记这节课请假">🙋</button>`;
      el.querySelector(".lv").addEventListener("click", ev=>{
        ev.stopPropagation(); quickNote(c, s, w);
      });
      el.querySelector(".lvask").addEventListener("click", ev=>{
        ev.stopPropagation(); pickLeave(s.id, w);
      });
      el.addEventListener("click", ()=>openDrawer(c.id));
      grid.appendChild(el);
    });
  }

  // 军训周：整周铺一层「全天军训」
  if(isMilitary(w)){
    const el=document.createElement("div");
    el.className="warmask";
    el.style.gridArea = `2/2/${secs.length+2}/9`;
    el.innerHTML = `<div class="wtxt">
      <b>🎖 全天军训</b>
      <small>军事技能训练 · ${militaryLabel()}（本周为第 ${w} 周）</small>
      <small>本周没有常规课程，作息以连队通知为准</small>
    </div>`;
    grid.appendChild(el);
  }

  // 法定假期：整列铺淡纹 + 顶部卡片，明确「这天上不了课」
  // （放在军训覆盖层之后，军训周里也能看到假期的列标记）
  for(let d=0; d<7; d++){
    const k = dayKind(w,d);
    if(k.kind!=="holiday") continue;
    const el=document.createElement("div");
    el.className="holmask"+(isMilitary(w)?" compact":"");
    el.style.gridArea = `2/${d+2}/${secs.length+2}/${d+3}`;
    el.title = k.h.note||"";
    el.innerHTML = `<div class="holcard"><span class="hi">${k.h.icon}</span>
      <b>${esc(k.h.name)}假期</b>
      <small>第 ${holidayIndexOf(dateOf(w,d), k.h)} / ${holidayLen(k.h)} 天 · 不上课</small></div>`;
    grid.appendChild(el);
  }

  // 当前时间线
  if(isThisWeek){
    const now=new Date(), nowM=now.getHours()*60+now.getMinutes();
    let n=-1, frac=0;
    for(let i=1;i<=NSEC;i++){
      const a=toMin(slot(i).start), b=toMin(slot(i).end);
      if(nowM>=a && nowM<=b){ n=i; frac=(nowM-a)/(b-a); break; }
      if(nowM < a){ n=i; frac=0; break; }
    }
    if(n===-1){ n=NSEC; frac=1; }
    const idx = secs.indexOf(n);
    let top;
    if(idx>=0) top = idx*(ROWH+GAP) + frac*ROWH;
    else if(n < secs[0]) top = 0;
    else top = secs.length*ROWH + (secs.length-1)*GAP;
    const ln=document.createElement("div");
    ln.className="nowline"; ln.style.gridArea=`2/${todayIdx+2}/${secs.length+2}/${todayIdx+3}`;
    const bar=document.createElement("i");
    bar.style.top = top+"px";
    ln.appendChild(bar); grid.appendChild(ln);
  }

  // 今日进度
  if(isThisWeek) markLive();
}

function layoutLanes(list){
  const sorted=[...list].sort((a,b)=> a.from-b.from || b.to-a.to);
  // 先按「传递重叠」切成若干组，组内再分车道；各组独立计算宽度，避免整列被压窄
  const groups=[]; let cur=[], curMax=0;
  for(const s of sorted){
    if(cur.length && s.from >= curMax){ groups.push(cur); cur=[]; curMax=0; }
    cur.push(s); curMax=Math.max(curMax, s.to);
  }
  if(cur.length) groups.push(cur);

  const items=[];
  groups.forEach(g=>{
    const lanesOf=[];
    const placed=[];
    for(const s of g){
      let li=lanesOf.findIndex(end=> end < s.from);
      if(li===-1){ lanesOf.push(s.to); li=lanesOf.length-1; } else lanesOf[li]=s.to;
      placed.push({s, lane:li});
    }
    const n=lanesOf.length;
    placed.forEach(p=>items.push({s:p.s, lane:p.lane, lanes:n}));
  });
  return { items, lanes: items.reduce((a,i)=>Math.max(a,i.lanes),1) };
}

function markLive(){
  const now=new Date(), nowM=now.getHours()*60+now.getMinutes();
  const d=(now.getDay()+6)%7+1;
  DATA.sessions.filter(s=>s.day===d && activeIn(s,state.viewWeek)).forEach(s=>{
    const el = document.querySelector('#grid > .ev[data-sid="'+s.id+'"]');
    if(!el) return;
    const a=toMin(slot(s.from).start), b=toMin(slot(s.to).end);
    el.classList.remove("live","done");
    const old=el.querySelector(".progbar"); if(old) old.remove();
    if(nowM>=a && nowM<b){
      el.classList.add("live");
      const bar=document.createElement("div"); bar.className="progbar";
      bar.innerHTML=`<i style="width:${((nowM-a)/(b-a)*100).toFixed(1)}%"></i>`;
      el.appendChild(bar);
    } else if(nowM>=b) el.classList.add("done");
  });
}

/* ================= 今日 ================= */
function nextSession(){
  const now=new Date(), w=weekOfDate(now), d=(now.getDay()+6)%7+1;
  const nowM=now.getHours()*60+now.getMinutes();
  for(let k=0;k<10;k++){
    const abs=d-1+k, dayIdx=(abs%7)+1, wk=w+Math.floor(abs/7);
    if(wk<1 || wk>totalWeeks()) continue;
    if(holidayOfDate(dateOf(wk, dayIdx-1))) continue;   // 法定节假日当天不排课
    const dd=cellDay(wk, dayIdx-1);                     // 调休上班日：按「补周几」的课表找
    const list=DATA.sessions.filter(s=>s.day===dd && activeIn(s,wk)).sort((a,b)=>a.from-b.from);
    for(const s of list){
      if(k===0 && toMin(slot(s.to).end) <= nowM) continue;
      const dt=dateOf(wk, dayIdx-1), sm=toMin(slot(s.from).start);
      dt.setHours(Math.floor(sm/60), sm%60, 0, 0);
      return {s, dt, dayIdx, week:wk, minutes: Math.max(0, Math.round((dt-now)/60000))};
    }
  }
  return null;
}
function humanGap(m){
  if(m<60) return m+" 分钟";
  if(m<1440) return Math.floor(m/60)+" 小时 "+(m%60?m%60+" 分":"");
  return Math.floor(m/1440)+" 天 "+Math.floor((m%1440)/60)+" 小时";
}
function renderToday(){
  const now=new Date(), w=weekOfDate(now), d=(now.getDay()+6)%7+1;
  const nowM=now.getHours()*60+now.getMinutes();

  const war = isMilitary(w);
  const plan = dayPlan(w, d);

  const dk  = dayKind(w, d-1);
  const hol = dk.kind==="holiday" ? dk.h : null;
  const mkp = dk.kind==="makeup"  ? dk.m : null;

  $("#hDate").textContent = hol
    ? `${hol.icon} ${hol.name}假期`
    : (war ? "全天军训" : `${now.getMonth()+1} 月 ${now.getDate()} 日 · 周${DAYNUM[now.getDay()]}`);
  $("#hWeek").textContent = hol
    ? `第 ${w} 周 · 法定节假日（第 ${holidayIndexOf(now, hol)} / ${holidayLen(hol)} 天）${war?" · 本周亦为军训周":""}`
    : (war ? `第 ${w} 周 · ${militaryLabel()}军事技能训练，无常规课程`
           : `${DATA.meta.term||""} · 第 ${w} 周${w<1?"（未开学）":""}`);
  $(".hero").classList.toggle("war", war && !hol);
  $(".hero").classList.toggle("hol", !!hol);

  const today = DATA.sessions.filter(s=>s.day===d && activeIn(s,w))
    .sort((a,b)=>a.from-b.from);
  const cur = today.find(s=> nowM>=toMin(slot(s.from).start) && nowM<toMin(slot(s.to).end));
  const nx = nextSession();

  const chips=[];
  if(hol){
    chips.push(`${hol.icon} 法定节假日 · 放假 ${holidayLen(hol)} 天`);
    chips.push(`假期第 ${holidayIndexOf(now, hol)} 天`);
    chips.push("本日不排课");
    if(war) chips.push("⚠️ 军训周叠加假期");
  } else if(war){
    chips.push("🎖 军事技能训练");
    chips.push(`${militaryLabel()} · 本周无常规课程`);
  } else {
    chips.push(`今日 ${today.length} 节课`);
    chips.push(`上课 ${fmtHMshort(plan.freeMin)}`);
    chips.push(`空闲 ${fmtHMshort(plan.totalFree)}`);
    if(cur) chips.push(`正在上：${course(cur.courseId).name}`);
  }
  if(mkp && !hol){
    const f=makeupFor(mkp);
    chips.push(f ? `⚠️ 调休上班 · 补${DAYS[f-1]}的课` : "⚠️ 国办调休上班日（还没指定补周几的课）");
  }
  $("#hChips").innerHTML = chips.map(t=>`<span class="chip">${esc(t)}</span>`).join("");

  const nc = $("#nextCard");
  if(hol){
    const nx2 = nextSession();
    nc.innerHTML=`<div class="lbl">${hol.icon} ${esc(hol.name)}假期</div>
      <div class="cd">放假 ${holidayLen(hol)} 天</div>
      <div class="nm">本日不排课</div>
      <div class="m">${esc(hol.note||"")}</div>
      ${nx2?`<div class="m">假期后第一节课：${wd(nx2.dayIdx)} ${slot(nx2.s.from).start} · ${esc(course(nx2.s.courseId).name)}</div>`:""}
      <div class="m">节假日离校：提前 3 天在「智慧学工」办线上离校申请</div>`;
  } else if(war){
    nc.innerHTML=`<div class="lbl">🎖 全天军训</div>
      <div class="cd">第 ${w} 周</div>
      <div class="nm">军事技能训练</div>
      <div class="m">${militaryLabel()}全天军训，没有常规课程</div>
      <div class="m">作息以连队 / 辅导员通知为准 · 注意防晒补水</div>`;
  } else if(cur){
    const a=toMin(slot(cur.from).start), b=toMin(slot(cur.to).end), c=course(cur.courseId);
    const left=b-nowM;
    nc.innerHTML=`<div class="lbl">🔴 正在上课</div>
      <div class="cd">还有 ${humanGap(left)} 下课</div>
      <div class="nm">${esc(c.name)}</div>
      <div class="m">${esc(cur.room||"")} · ${esc(cur.teacher||"")} · ${cur.from}-${cur.to}节</div>
      <div style="height:8px;border-radius:8px;background:var(--panel2);overflow:hidden;margin-top:8px">
        <div style="height:100%;width:${((nowM-a)/(b-a)*100).toFixed(1)}%;background:linear-gradient(90deg,${c.color},#8b5cf6)"></div>
      </div>`;
  } else if(nx){
    const c=course(nx.s.courseId);
    const when = nx.dayIdx===d && nx.week===w
      ? "今天 " + slot(nx.s.from).start
      : `${wd(nx.dayIdx)} ${slot(nx.s.from).start}`;
    nc.innerHTML=`<div class="lbl">⏭ 下一节课</div>
      <div class="cd">${humanGap(nx.minutes)}后</div>
      <div class="nm">${esc(c.name)}</div>
      <div class="m">${when} · ${esc(nx.s.room||"")} · ${esc(nx.s.teacher||"")} · 第${nx.week}周</div>`;
  } else {
    nc.innerHTML=`<div class="lbl">🎉 全部课程已结束</div>
      <div class="cd">好好休息</div>
      <div class="m">本学期暂无后续课程</div>`;
  }

  // 下一节课 → 发送到本地（桌面通知 / 复制 / 导出日历）
  {
    const bar = document.createElement("div");
    bar.className = "remact";
    bar.innerHTML = `<button class="p" id="nxSend">📤 发送到本地</button>`
      + `<button id="nxCopy">📋 复制信息</button>`
      + `<button id="nxIcs">📅 导出日历 .ics</button>`;
    nc.appendChild(bar);
    bar.querySelector("#nxSend").onclick = ()=>{ notifyAsk().then(()=>pushNext(true)); };
    bar.querySelector("#nxCopy").onclick = copyNext;
    bar.querySelector("#nxIcs").onclick  = exportIcs;
  }

  // 时间线
  const box=$("#todayList");
  if(hol){
    box.innerHTML = `
      <div class="holbanner">
        <h3>${hol.icon} ${esc(hol.name)}假期</h3>
        <p>${esc(hol.note||"")}　今天是假期第 ${holidayIndexOf(now, hol)} 天（共 ${holidayLen(hol)} 天）。法定节假日不排课，也没有考勤 —— 休息、回家或者出去玩都行。</p>
        <div class="hbchips">
          <span class="hbchip">📅 ${ymd(holFrom(hol))} → ${ymd(holTo(hol))}</span>
          <span class="hbchip">🎌 离校走「智慧学工」线上离校申请</span>
          ${war?`<span class="hbchip">⚠️ 本周也是军训周，军训是否放假以连队通知为准</span>`:""}
        </div>
      </div>
      <div class="fnotice" style="border-left-color:#e11d48">
        <b>🎌 节假日请假提醒</b><br>
        重大节假日离校要<b>提前 3 天</b>在「智慧学工 → 学工应用 → 全日制学生节假日离校报备」提交申请，
        【请假类型】选【节假日申请】，再点右上角「办理」。具体放假与调课安排以学校 / 辅导员通知为准。
      </div>
      <div class="statrow">
        <div class="stat"><b>${holidayLen(hol)} 天</b><small>本次假期长度</small></div>
        <div class="stat"><b>${holidayIndexOf(now, hol)}/${holidayLen(hol)}</b><small>今天是第几天</small></div>
        <div class="stat"><b>0</b><small>今日课程节数</small></div>
        <div class="stat"><b>法定</b><small>假期性质</small></div>
        <div class="stat"><b>${state.notes.length}</b><small>便签总数</small></div>
      </div>`;
    return;
  }
  if(war){
    box.innerHTML = `
      <div class="fnotice" style="border-left-color:#64748b;margin-bottom:16px">
        <b>🎖 ${militaryLabel()}为全天军训</b><br>
        军训期间没有常规课程表，因此不参与「空闲时间」统计。<br>
        日程以连队 / 辅导员通知为准 —— 记得带水、涂防晒，晚上早点休息 💪
      </div>
      <div class="statrow">
        <div class="stat"><b>全天</b><small>今日安排</small></div>
        <div class="stat"><b>军训</b><small>第 ${w} 周状态</small></div>
        <div class="stat"><b>0</b><small>今日课程节数</small></div>
        <div class="stat"><b>—</b><small>今日空闲</small></div>
        <div class="stat"><b>${state.notes.length}</b><small>便签总数</small></div>
      </div>`;
    return;
  }

  if(!today.length){
    const hint = nx ? `下一节课：${DAYS[nx.dayIdx-1]} ${slot(nx.s.from).start} · ${esc(course(nx.s.courseId).name)}` : "";
    box.innerHTML=`<div class="empty"><div class="big">🌤</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:6px">今天没有课</div>
      <div style="font-size:13px">第 ${w} 周 · 周${DAYNUM[now.getDay()]}</div>
      ${hint?`<div style="font-size:13px;margin-top:8px;color:var(--accent);font-weight:600">${hint}</div>`:""}
      <div style="font-size:13px;margin-top:10px">去便签墙记点想法吧 📌</div></div>`;
  } else {
    box.innerHTML = `<div class="timeline">` + today.map(s=>{
      const c=course(s.courseId);
      const a=toMin(slot(s.from).start), b=toMin(slot(s.to).end);
      const st = nowM>=b ? ["done","已结束"] : (nowM>=a? ["live","进行中"] : ["next","待上课"]);
      const off = isLeave(s.id, w);
      return `<div class="tlitem${off?" onleave":""}" style="--c:${c.color}" data-cid="${c.id}">
        <div class="t"><b>${slot(s.from).start}</b><small>${s.from}-${s.to}节</small><small>${slot(s.to).end} 结束</small></div>
        <div class="b">
          <span class="st ${off?"off":st[0]}">${off?"已请假":st[1]}</span>
          <h4>${esc(c.name)} <span style="font-weight:400;color:var(--muted);font-size:12px">${s.parity!=="all"?"（"+dayWord(s.parity)+"）":""}</span></h4>
          <div class="tloc">📍 ${esc(s.room||"待定")}</div>
          <p>${assessBadge(c.id)}👤 ${esc(s.teacher||"-")}　⏱ ${durationMin(s.from,s.to)} 分钟</p>
        </div>
      </div>`;
    }).join("")+`</div>`;
    $$("#todayList .tlitem").forEach(el=>el.addEventListener("click",()=>openDrawer(el.dataset.cid)));
  }

  // 今日空闲
  const freeChips = plan.free.map(f=>{
    const ev = f.part.key==="eve";
    return `<span class="fchip${ev?" eve":""}">${f.part.icon} ${pad2m(f.a)}–${pad2m(f.b)} · ${fmtHMshort(f.mins)}</span>`;
  }).join("");
  const eveChip = plan.eveBusy
    ? `<span class="fchip none">🌙 晚上有课（19:00 后）</span>`
    : `<span class="fchip good">🌙 晚上（19:00 后）无课</span>`;
  box.insertAdjacentHTML("beforeend", `
    <div class="fnotice" style="margin-top:16px;border-left-color:#10b981">
      <b>🌤 今日空闲 ${plan.totalFree?fmtHM(plan.totalFree):"0 分钟"}</b>
      ${plan.free.length?`　最长一段 ${fmtHM(plan.longest)}`:`　今天课程排满，没有可用空档`}
      <div class="fchips" style="margin-top:9px">${freeChips}${eveChip}</div>
      <div style="font-size:11.5px;color:var(--muted);margin-top:8px">
        按作息表 ${slot(1).start}–${slot(NSEC).end} 计算；不足 ${FREE_MIN} 分钟的空档视作课间赶路，不计入
      </div>
    </div>`);

  // 统计
  const ws = new Set(); let mins=0;
  DATA.sessions.filter(s=>activeIn(s,w)).forEach(s=>{ ws.add(s.courseId); mins+=durationMin(s.from,s.to); });
  box.insertAdjacentHTML("beforeend", `<div class="statrow">
    <div class="stat"><b>${DATA.courses.length}</b><small>本学期课程</small></div>
    <div class="stat"><b>${ws.size}</b><small>第 ${w} 周涉及课程</small></div>
    <div class="stat"><b>${(mins/60).toFixed(1)}</b><small>第 ${w} 周课时（小时）</small></div>
    <div class="stat"><b>${state.notes.length}</b><small>便签总数</small></div>
    <div class="stat"><b>${DATA.sessions.filter(s=>activeIn(s,w)).length}</b><small>第 ${w} 周上课时段</small></div>
  </div>`);
}

/** 最近的法定假期卡片（请假页顶部） */
function renderHolNext(){
  const box = $("#holNext"); if(!box) return;
  const nh = nextHoliday();
  if(!nh){ box.innerHTML = ""; return; }
  const h = nh.h, w0 = weekOfDate(nh.from), w1 = weekOfDate(nh.to);
  box.innerHTML = `<div class="holnext">
    <span class="ico">${h.icon}</span>
    <div class="tt">
      <b>${esc(h.name)}：${ymd(nh.from)} – ${ymd(nh.to)}，共 ${holidayLen(h)} 天</b>
      <small>${esc(h.note||"")}<br>
        ${nh.ongoing ? "假期正在进行中" : `距离放假还有 ${nh.startInDays} 天`}，落在第 ${w0}${w0===w1?"":("–"+w1)} 周。
        重大节假日离校要<b>提前 3 天</b>在「智慧学工 → 学工应用 → 全日制学生节假日离校报备」提交，
        【请假类型】选【节假日申请】，再点右上角「办理」。
      </small>
    </div>
    <div class="cd">${nh.ongoing ? nh.endInDays : nh.startInDays}
      <small>${nh.ongoing ? "天后收假" : "天后放假"}</small></div>
  </div>`;
}
/** 第一次编辑假期表时，把官方默认值落成可编辑的副本 */
function ensureHolLocal(){
  if(!Array.isArray(state.settings.holidays))
    state.settings.holidays = HOLIDAY_DEFAULT.map(x=>Object.assign({}, x));
}

/* ================= 空闲 ================= */
function busyColorOf(day, a, b, w){
  const dd=cellDay(w, day-1);
  const s=DATA.sessions.find(x=> x.day===dd && activeIn(x,w) && !isLeave(x.id,w)
    && toMin(slot(x.from).start)<b && toMin(slot(x.to).end)>a);
  return s ? course(s.courseId).color : "#94a3b8";
}
function renderFree(){
  const w=state.viewWeek, today=new Date(), wToday=weekOfDate(today);
  const todayIdx=(today.getDay()+6)%7;
  const a=mondayOfWeek(w), b=dateOf(w,6);
  $("#freeWkLabel").innerHTML = `第 ${w} 周${w===wToday?" <span style='color:#ef4444'>· 本周</span>":""}
    <small>${a.getMonth()+1}.${a.getDate()} - ${b.getMonth()+1}.${b.getDate()}</small>`;

  const days = Array.from({length:7},(_,i)=>{
    const k = dayKind(w,i);
    return { day:i+1, idx:i, date:k.dt, plan:dayPlan(w, i+1),
             hol: k.kind==="holiday"?k.h:null, mkp: k.kind==="makeup"?k.m:null };
  });
  const grid=$("#freeGrid"), top=$("#freeTop"), notice=$("#freeNotice");

  if(isMilitary(w)){
    top.innerHTML = "";
    const milHol = holidayList().filter(h=>{
      const a=holFrom(h), b=holTo(h), m1=mondayOfWeek(w), m2=dateOf(w,6);
      return b>=m1 && a<=m2;
    });
    notice.innerHTML = `<b>🎖 ${militaryLabel()}为全天军训</b><br>
      军训期间没有常规课程，也就谈不上「没课的时间」——日程以连队 / 辅导员通知为准，本页暂不统计。${
      milHol.length?`<br>${milHol[0].icon} 本周还包含 <b>${esc(milHol[0].name)}</b> 法定假期，军训是否放假以连队通知为准。`:""}`;
    grid.innerHTML = days.map(d=>{
      const isToday=(w===wToday && d.idx===todayIdx);
      return `<div class="fday isOff${isToday?" isToday":""}">
        <div class="fn"><b>${DAYS[d.idx]}</b>
          <small>${d.date.getMonth()+1}/${d.date.getDate()}</small>${isToday?`<span class="tt">今天</span>`:""}</div>
        <div class="fmain"><div class="fbar" style="display:grid;place-items:center">
          <span style="font-size:12.5px;font-weight:700;color:var(--muted)">🎖 全天军训</span></div></div>
        <div class="fsum"><b class="none">军训</b><small>无常规课程</small></div>
      </div>`;
    }).join("");
    return;
  }

  // 汇总（法定假期整天不计入统计，否则会虚增一大截「空闲」）
  const act = days.filter(d=>!d.hol);
  const holDays = days.filter(d=>d.hol);
  const base = act.length ? act : days;
  const busyTotal = base.reduce((s,d)=>s+d.plan.freeMin,0);
  const tot = base.reduce((s,d)=>s+d.plan.totalFree,0);
  const freeDays = base.filter(d=>d.plan.list.length===0).length;
  const eveFree = base.filter(d=>!d.plan.eveBusy);
  const emptiest = base.reduce((m,d)=> d.plan.freeMin<m.plan.freeMin?d:m, base[0]);
  const leaveCnt = days.reduce((s,d)=>s+d.plan.off.length,0);
  let bestFree=null, bestDay=null;
  base.forEach(d=>d.plan.free.forEach(f=>{ if(!bestFree||f.mins>bestFree.mins){ bestFree=f; bestDay=d; } }));

  top.innerHTML = `
    <div class="fcard"><b>${(tot/60).toFixed(1)}<span style="font-size:14px;font-weight:600;color:var(--muted)"> h</span></b><small>总空闲${holDays.length?`（不含假期 ${act.length} 天）`:""}</small></div>
    <div class="fcard"><b>${fmtHMshort(Math.round(tot/Math.max(1,act.length)))}</b><small>平均每天空闲</small></div>
    <div class="fcard"><b>${bestFree?fmtHMshort(bestFree.mins):"—"}</b><small>最长一段 · ${bestDay?wd(bestDay.day):"—"}</small></div>
    <div class="fcard"><b>${freeDays} 天</b><small>整天没有课</small></div>
    <div class="fcard"><b>${eveFree.length} 天</b><small>晚上（19:00 后）无课</small></div>
    ${holDays.length?`<div class="fcard" style="border-color:#fca5a5"><b style="color:#e11d48">${holDays.length} 天</b><small>${esc(holDays[0].hol.name)}假期 · 不计入</small></div>`:""}`;

  // 规则化小结
  const eveNames = eveFree.map(d=>wd(d.day));
  const ratio = (busyTotal+tot) ? Math.round(tot/(busyTotal+tot)*100) : 0;
  let txt = `<b>📌 第 ${w} 周空闲小结</b><br>
    上课 ${fmtHM(busyTotal)}，空闲 ${fmtHM(tot)}，空闲占比约 <b>${ratio}%</b>。<br>
    课程最少的是 <b>${wd(emptiest.day)}</b>（仅 ${emptiest.plan.list.length} 节课，空闲 ${fmtHM(emptiest.plan.totalFree)}）`;
  if(bestFree) txt += `；最长的一段连续空闲在 <b>${wd(bestDay.day)} ${pad2m(bestFree.a)}–${pad2m(bestFree.b)}</b>，整整 ${fmtHM(bestFree.mins)}，适合安排整块自习、实验或社团活动`;
  txt += `。<br>`;
  txt += eveFree.length
    ? `🌙 晚上（19:00 后）没有课的有 ${eveFree.length} 天：${eveNames.join("、")}。`
    : `🌙 本周 7 天晚上都有课，注意别熬夜。`;
  if(freeDays) txt += ` 其中${base.filter(d=>d.plan.list.length===0).map(d=>wd(d.day)).join("、")}整天没有课。`;
  if(leaveCnt) txt += `<br>🙋 本周已标记 ${leaveCnt} 个请假时段，这些时间已计入空闲。`;
  if(holDays.length){
    const h0 = holDays[0].hol;
    txt += `<br>${h0.icon} 本周含 <b>${esc(h0.name)}</b> 假期 ${holDays.length} 天（${holDays.map(d=>wd(d.day)).join("、")}），已从上表的统计里剔除 —— 假期整天本来就没课，硬算成「空闲」会把数字撑虚。`;
  }
  const mkps = days.filter(d=>d.mkp);
  if(mkps.length) txt += `<br>⚠️ ${mkps.map(d=>{
    const k=dayKind(w,d.day-1), f=k.kind==="makeup"?makeupFor(k.m):0;
    return wd(d.day)+"（"+(d.date.getMonth()+1)+"/"+d.date.getDate()+"）"
      + (f ? `补${DAYS[f-1]}的课` : "是国办安排的调休上班日，还没指定补周几的课");
  }).join("、")}${mkps.some(d=>makeupFor(dayKind(w,d.day-1).m))?"（按补课那天的课表统计）":"，以校历 / 学院通知为准"}`;
  notice.innerHTML = txt;

  // 每天
  grid.innerHTML = days.map(d=>{
    const p=d.plan, isToday=(w===wToday && d.idx===todayIdx);
    if(d.hol){
      return `<div class="fday isHol${isToday?" isToday":""}">
        <div class="fn"><b>${DAYS[d.idx]}</b>
          <small>${d.date.getMonth()+1}/${d.date.getDate()} · 法定假期</small>${isToday?`<span class="tt">今天</span>`:""}</div>
        <div class="fmain"><div class="fbar holbar" style="display:grid;place-items:center">
          <span style="font-size:12.5px;font-weight:700;color:#e11d48">${d.hol.icon} ${esc(d.hol.name)}假期 · 不上课</span></div></div>
        <div class="fsum"><b style="color:#e11d48">放假</b><small>不计入统计</small></div>
      </div>`;
    }
    const wid=Math.max(1, p.B-p.A);
    const segs = p.busy.map(g=>{
      const left=(g.a-p.A)/wid*100, pc=(g.b-g.a)/wid*100;
      return `<div class="seg busy" style="left:${left}%;width:${pc}%;--c:${busyColorOf(d.day,g.a,g.b,w)}">${pc>11?"上课":""}</div>`;
    }).join("");
    const fsegs = p.free.map(f=>{
      const left=(f.a-p.A)/wid*100, pc=(f.b-f.a)/wid*100;
      return `<div class="seg free" style="left:${left}%;width:${pc}%">${pc>13?fmtHMshort(f.mins):""}</div>`;
    }).join("");
    const chips = p.free.length
      ? p.free.map(f=>`<span class="fchip${f.part.key==="eve"?" eve":""}">${f.part.icon} ${pad2m(f.a)}–${pad2m(f.b)} · ${fmtHMshort(f.mins)}</span>`).join("")
      : `<span class="fchip none">从早排到晚</span>`;
    const eve = p.eveBusy
      ? `<span class="fchip none">🌙 晚上有课</span>`
      : `<span class="fchip good">🌙 晚上无课</span>`;
    const off = p.off.length ? `<span class="fchip none">🙋 请假 ${p.off.length} 节</span>` : "";
    return `<div class="fday${isToday?" isToday":""}">
      <div class="fn">
        <b>${DAYS[d.idx]}</b>
        <small>${d.date.getMonth()+1}/${d.date.getDate()} · ${p.list.length} 节课${d.mkp?" · ⚠️调休":""}</small>
        ${isToday?`<span class="tt">今天</span>`:""}
      </div>
      <div class="fmain">
        <div class="fbar">${fsegs}${segs}</div>
        <div class="fchips">${chips}${off}${eve}</div>
      </div>
      <div class="fsum">
        <b class="${p.totalFree?"":"none"}">${p.totalFree?fmtHMshort(p.totalFree):"—"}</b>
        <small>${p.totalFree?"空闲时长":"无空档"}</small>
      </div>
    </div>`;
  }).join("");

  $("#freeHint").textContent = `作息 ${slot(1).start}–${slot(NSEC).end}｜不足 ${FREE_MIN} 分钟的空档不计`;
}

/* 依据《国际商学院 2026 级本科生请假流程》整理 */
const LEAVE_GUIDE = [
  {
    title:"日常请假 · 有课程",
    scope:"请假期限 3 天内，且有课程",
    icon:"📘", color:"#3B82F6",
    steps:[
      {h:"Step1 · 获得任课老师同意证明",
       t:"告知任课老师、辅导员请假缘由、时间、去处。任课老师同意之后才能进行下一步。"},
      {h:"Step2 · 到辅导员办公室领取请假条",
       t:"向辅导员提供相关证明材料（医生证明病假条、考试证明、由家长和辅导员证实的事假等），再领取并填写假条，个人信息要填好。辅导员签署「情况属实」后，交由任课老师审批签名。"},
      {h:"Step3 · 处理请假条",
       t:"纸质版请假条交给班级副班长保存记录。副班长收集好假条之后，每周五 22:00 前汇总好信息，并把假条交给纪检副级长。"},
    ],
    tip:"课程请假必须拿到任课老师审批签名才算「成功请假」。课程开始之后才要请假的，请先联系任课老师取得同意证明，再来找辅导员拿假条请假。",
  },
  {
    title:"日常外出 · 外出期限内无课程",
    scope:"外出期限内无课程，且需离开佛山市内 / 在校外过夜（比如周末回家）",
    icon:"🏙", color:"#F59E0B",
    steps:[
      {h:"Step1 · 告知辅导员 / 兼辅",
       t:"说明请假缘由、时间、去处。"},
      {h:"Step2 · 填写问卷星",
       t:"按辅导员要求填写问卷星。得到审批后才算「成功」。"},
    ],
    tip:"只要外出涉及课程，就一律走上面「日常请假 · 有课程」的流程，不要走这条。",
  },
  {
    title:"重大节假日（如国庆、元旦、寒暑假）",
    scope:"法定节假日期间离校，走线上离校申请",
    icon:"🎌", color:"#EF4444",
    steps:[
      {h:"Step1 · 上「智慧学工」办线上离校申请",
       t:"提前 3 天申请，预留时间审核。"},
    ],
    extra:"附操作：点击【学工应用】→【全日制学生节假日离校报备】→【请假类型】选择【节假日申请】→ 根据自身实际情况如实填写信息 → 最后点击右上角「办理」按钮。",
    tip:"节假日离校走的是线上离校报备入口，和日常请假的入口不同，别走错。",
  },
];

function renderLeave(){
  const w=state.viewWeek, today=new Date(), wToday=weekOfDate(today);
  const todayIdx=(today.getDay()+6)%7;

  // 本周可请假的时段（按天分组；法定假期整天不上课，不列为可请假时段）
  const byDay = {};
  for(let d=1; d<=7; d++){
    const k=dayKind(w,d-1);
    if(k.kind==="holiday") continue;
    if(isBorrowCell(w,d-1)) continue;   // 调休补课的课按它本来的周几列，别重复列一遍
    const list=cellSessions(w,d-1).sort((a,b)=>a.from-b.from);
    if(list.length) byDay[d]=list;
  }
  const holDaysHere = holidaysInWeek(w);
  const mkpDaysHere = makeupCellsInWeek(w);

  const active = (state.leaves||[]).filter(x=>x.week===w);
  $("#leaveHint").textContent = `第 ${w} 周共 ${Object.values(byDay).reduce((s,l)=>s+l.length,0)} 个上课时段，已请假 ${active.length} 个`
    + (holDaysHere.length ? `　·　含 ${holDaysHere[0].h.name}假期 ${holDaysHere.length} 天（不上课，无需请假）` : "")
    + (mkpDaysHere.length ? `　·　${mkpDaysHere.map(x=>`${x.dt.getMonth()+1}/${x.dt.getDate()}${x.for?"补"+DAYS[x.for-1]+"的课":"（未指定补周几）"}`).join("、")} 调休上班` : "");

  // 本周时段选择
  $("#leavePick").innerHTML = Object.keys(byDay).length ? Object.entries(byDay).map(([d,list])=>{
    const isToday=(w===wToday && +d-1===todayIdx);
    return `<div class="lpday">
      <div class="lpdh"><b>${wd(+d)}</b><small>${dateOf(w,+d-1).getMonth()+1}/${dateOf(w,+d-1).getDate()}${isToday?" · 今天":""}</small></div>
      <div class="lplist">
        ${list.map(s=>{
          const c=course(s.courseId), on=isLeave(s.id,w);
          return `<button class="lpitem${on?" on":""}" data-sid="${s.id}" style="--c:${c.color}">
            <span class="lpn">${esc(c.name)}</span>
            <span class="lpm">${s.from}-${s.to} 节 · ${timeRange(s.from,s.to)} · 📍${esc(s.room||"待定")}</span>
            <span class="lpflag">${on?"已请假 ✕ 撤销":"选择请假"}</span>
          </button>`;
        }).join("")}
      </div>
    </div>`;
  }).join("") : `<div class="empty"><div class="big">🎉</div><div style="font-weight:700">第 ${w} 周没有需要上课的时段</div><div style="font-size:13px;margin-top:6px">不用请假，好好休息</div></div>`;

  $$("#leavePick .lpitem").forEach(b=>b.addEventListener("click",()=>pickLeave(b.dataset.sid, w)));

  // 请假指引
  renderHolNext();

  $("#leaveGuide").innerHTML = LEAVE_GUIDE.map(g=>`
    <div class="lgcard" style="--g:${g.color}">
      <h4><span class="lgi">${g.icon}</span>${esc(g.title)}</h4>
      <div class="lgscope">适用：${esc(g.scope)}</div>
      <ol>${g.steps.map(s=>`<li><span class="lgh">${esc(s.h)}</span>${esc(s.t)}</li>`).join("")}</ol>
      ${g.extra?`<div class="lgextra">${esc(g.extra)}</div>`:""}
      <div class="lgtip">💡 ${esc(g.tip)}</div>
    </div>`).join("");

  // 我的请假记录
  const all = leaveList();
  $("#leaveLog").innerHTML = all.length ? all.map(({x,s,c})=>{
    const d=dateOf(x.week, s.day-1);
    return `<div class="ljitem" style="--c:${c.color}">
      <div class="ljl">
        <b>${esc(c.name)}</b>
        <small>第 ${x.week} 周 · ${wd(s.day)}（${d.getMonth()+1}/${d.getDate()}）· ${s.from}-${s.to} 节 ${timeRange(s.from,s.to)}</small>
      </div>
      <div class="ljr">
        <span class="ljk">${esc(x.kind||"事假")}</span>
        ${x.reason?`<span class="ljrs">${esc(x.reason)}</span>`:""}
        <button class="btn" data-del="${x.id}" style="padding:4px 10px;font-size:12px">撤销</button>
      </div>
    </div>`;
  }).join("") : `<div class="hint">还没有请假记录。在上面的时段里点一下「选择请假」就能标记。</div>`;

  $$("#leaveLog [data-del]").forEach(b=>b.addEventListener("click",()=>{
    state.leaves=(state.leaves||[]).filter(x=>x.id!==b.dataset.del);
    saveLocal(); renderLeave(); renderWeek(); renderTop(); toast("已撤销该请假标记");
  }));
}

function pickLeave(sid, w){
  if(isLeave(sid, w)){ toggleLeave(sid, w); renderLeave(); renderWeek(); toast("已撤销请假标记"); return; }
  openFormDialog({
    title:"标记请假",
    description:"这里只做个人课表标记，正式请假仍需到「智慧学工」提交申请。原因只保存在当前浏览器。",
    fields:[
      {name:"kind",label:"请假类型",type:"select",value:"事假",options:["事假","病假","公假","其他"]},
      {name:"reason",label:"请假原因（可留空）",type:"textarea",placeholder:"例如：身体不适 / 学院活动 / 家中有事"}
    ],
    submitText:"确认标记",
    onSubmit(values){
      toggleLeave(sid, w, {kind:values.kind,reason:(values.reason||"").trim()});
      renderLeave(); renderWeek(); renderTop();
      const s=sessionById(sid);
      if(s && $("#drawer").classList.contains("on")) openDrawer(s.courseId);
      toast("已标记请假 · 记得去「智慧学工」正式申请");
    }
  });
}

/* ================= 便签 ================= */
function boardSize(){
  const board=$("#board");
  const maxY=state.notes.reduce((a,n)=>Math.max(a,(n.y||0)+190),0);
  board.style.minHeight=Math.max(660,maxY+40)+"px";
}
function renderNotes(){
  const board=$("#board"); board.innerHTML="";
  if(!state.notes.length){
    board.innerHTML=`<div class="empty" style="margin:60px auto;max-width:460px">
      <div class="big">📌</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:6px">还没有便签</div>
      <div style="font-size:13px">点「新建便签」随手记点什么，也可以拖到任意位置。<br>课程右上角的 📌 能直接给某节课打便签。</div></div>`;
    return;
  }
  state.notes.forEach(n=>{
    const el=document.createElement("div");
    el.className="note "+(n.color||NCOLORS[0]);
    el.dataset.id=n.id;
    el.style.left=(n.x||0)+"px"; el.style.top=(n.y||0)+"px";
    const c = n.courseId ? course(n.courseId) : null;
    el.innerHTML=`
      <div class="nh">
        <span class="tag">${c?esc(c.name):"随手记"}</span>
        <button class="x" title="删除">✕</button>
      </div>
      <textarea placeholder="写点什么…">${esc(n.text||"")}</textarea>
      <div class="nf">
        ${NCOLORS.map((k,i)=>`<span class="sw ${n.color===k?"on":""}" data-color="${k}" style="background:${PALETTE[i]}"></span>`).join("")}
        <span class="when">${n.updatedAt? new Date(n.updatedAt).toLocaleDateString("zh-CN",{month:"numeric",day:"numeric"}):""}</span>
      </div>`;
    const ta=el.querySelector("textarea");
    ta.addEventListener("input",()=>{ n.text=ta.value; n.updatedAt=Date.now(); saveLocal(); });
    ta.addEventListener("pointerdown",e=>e.stopPropagation());
    el.querySelector(".x").addEventListener("click",e=>{
      e.stopPropagation();
      state.notes=state.notes.filter(x=>x.id!==n.id); saveLocal(); renderNotes(); renderTop();
    });
    el.querySelectorAll(".sw").forEach(sw=>sw.addEventListener("pointerdown",e=>e.stopPropagation()));
    el.querySelectorAll(".sw").forEach(sw=>sw.addEventListener("click",e=>{
      e.stopPropagation(); n.color=sw.dataset.color; n.updatedAt=Date.now(); saveLocal(); renderNotes();
    }));
    board.appendChild(el);
  });
  bindDrag();
  boardSize();
  $("#noteHint").textContent = state.notes.length ? `共 ${state.notes.length} 张便签` : "";
}
function bindDrag(){
  const board=$("#board");
  board.onpointerdown = e=>{
    const el=e.target.closest(".note"); if(!el) return;
    if(e.target.closest("textarea,button,.sw")) return;
    const n=state.notes.find(x=>x.id===el.dataset.id); if(!n) return;
    const sx=e.clientX, sy=e.clientY, ox=n.x||0, oy=n.y||0;
    el.classList.add("dragging");
    const move=ev=>{
      n.x=Math.max(0, ox+ev.clientX-sx); n.y=Math.max(0, oy+ev.clientY-sy);
      el.style.left=n.x+"px"; el.style.top=n.y+"px";
    };
    const up=()=>{
      el.classList.remove("dragging"); saveLocal(); boardSize(); renderNotes();
      document.removeEventListener("pointermove",move); document.removeEventListener("pointerup",up);
    };
    document.addEventListener("pointermove",move); document.addEventListener("pointerup",up);
    e.preventDefault();
  };
}
function newNote(opts){
  const n=Object.assign({
    id:"n"+Date.now()+Math.random().toString(36).slice(2,5),
    text:"", color:NCOLORS[state.notes.length%NCOLORS.length],
    x:30+ (state.notes.length%5)*40, y:30+(state.notes.length%4)*44,
    courseId:null, updatedAt:Date.now()
  }, opts||{});
  state.notes.push(n); saveLocal(); renderNotes(); renderTop();
  return n;
}
function quickNote(c,s,w){
  state.tab="notes"; switchTab("notes");
  const n=newNote({courseId:c.id, text:""});
  setTimeout(()=>{ const el=document.querySelector(`.note[data-id="${n.id}"] textarea`); if(el) el.focus(); },320);
  toast("已为「"+c.name+"」新建便签");
}

/* ================= 课程 ================= */
function renderCourses(){
  const q=($("#cs").value||"").trim().toLowerCase();
  const list=DATA.courses.filter(c=>{
    if(!q) return true;
    const hay=[c.name,c.className,c.classCode,...sessionsOf(c.id).map(s=>s.teacher+" "+s.room)].join(" ").toLowerCase();
    return hay.includes(q);
  });
  $("#csHint").textContent = `${list.length} / ${DATA.courses.length} 门课程`;
  $("#courseList").innerHTML = list.map(c=>{
    const ss=sessionsOf(c.id);
    const teachers=[...new Set(ss.map(s=>s.teacher).filter(Boolean))];
    const rooms=[...new Set(ss.map(s=>s.room).filter(Boolean))];
    const done=weeksDone(c.id).size;
    const as=assessOf(c.id);
    return `<div class="ccard" style="--c:${c.color}" data-cid="${c.id}">
      <h4><span class="mk">${({ "*":"理论","#":"实践","&":"实验"})[c.mark]||"课程"}</span>${esc(c.name)}
        ${as?`<span style="margin-left:auto">${assessBadge(c.id)}</span>`:""}</h4>
      <div class="rows">
        ${ss.map(s=>`<div><span>🗓</span><em>${wd(s.day)}</em><span>${s.from}-${s.to}节 · ${timeRange(s.from,s.to)}</span>
          <span style="color:var(--muted)">第${s.weeks[0]}-${s.weeks[1]}周${s.parity!=="all"?"·"+dayWord(s.parity):""}</span></div>`).join("")}
        ${rooms.length?`<div class="locrow"><span>📍</span><span>${esc(rooms.join(" / "))}</span></div>`:""}
        ${teachers.length?`<div><span>👤</span><span>${esc(teachers.join(" / "))}</span></div>`:""}
        ${as?`<div><span>🎯</span><span>${esc(assessWord(as))}${as.form?" · "+esc(as.form):""}</span></div>`:""}
        ${c.credits?`<div><span>🎓</span><span>${esc(c.credits)} 学分</span></div>`:""}
      </div>
      <div class="wkstrip">${Array.from({length:totalWeeks()},(_,i)=>{
        const w=i+1, on=weeksDone(c.id).has(w);
        return `<i class="${on?"on":""}${w===weekOfDate(new Date())?" cur":""}" title="第${w}周">${w}</i>`;
      }).join("")}</div>
      <div class="foot">
        <span class="tagx">共 ${done} 周有课</span>
        ${c.weekHours?`<span class="tagx">周学时 ${esc(c.weekHours)}</span>`:""}
        ${c.totalHours?`<span class="tagx">总学时 ${esc(c.totalHours)}</span>`:""}
      </div>
    </div>`;
  }).join("") || `<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div>没有匹配的课程</div>`;

  $$("#courseList .ccard").forEach(el=>el.addEventListener("click",()=>openDrawer(el.dataset.cid)));

  renderConflicts();

  const other=(DATA.meta.otherCourses||[]);
  $("#otherWrap").innerHTML = other.length ? `<h3 style="font-size:14px;margin:0 0 10px;color:var(--muted)">其他课程（无固定课时安排）</h3>
    <div class="courses">${other.map(o=>`<div class="ccard" style="--c:#94a3b8;cursor:default">
      <h4><span class="mk">${({ "*":"理论","#":"实践","&":"实验"})[o.mark]||"课程"}</span>${esc(o.name)}</h4>
      <div class="rows"><div><span>👤</span><span>${esc(o.teacher||"-")}</span></div>
      <div><span>🗓</span><span>${esc(o.weeks||"")} · 共 ${o.totalWeeks} 周</span></div></div>
    </div>`).join("")}</div>` : "";
}

function renderConflicts(){
  const box=$("#conflictBox");
  if(!box) return;
  const conflicts=ScheduleCore.findConflicts(DATA.sessions);
  if(!conflicts.length){
    box.innerHTML=`<h3>⚠️ 课程冲突检测</h3><div class="conflictok">未发现课程冲突。新增课程后会自动重新检测。</div>`;
    return;
  }
  box.innerHTML=`<h3>⚠️ 课程冲突检测</h3>${conflicts.map(({a,b,week})=>{
    const ca=course(a.courseId), cb=course(b.courseId);
    const weeks=[];
    for(let w=1;w<=totalWeeks();w++) if(ScheduleCore.activeIn(a,w)&&ScheduleCore.activeIn(b,w)) weeks.push(w);
    const range=weeks.length>1 ? `${weeks[0]}-${weeks[weeks.length-1]} 周` : `第 ${week} 周`;
    return `<div class="conflictitem">
      <b>${wd(a.day)} 第 ${a.from}-${a.to} 节 · ${range}</b>
      <div>${esc(ca.name)}${a.room?` · ${esc(a.room)}`:""}　↔　${esc(cb.name)}${b.room?` · ${esc(b.room)}`:""}</div>
      <div class="conflictmeta">这两个时段在同一天、同一时间段并且至少有一周同时有课，请检查是否需要调整。</div>
    </div>`;
  }).join("")}`;
}
/* ================= 抽屉 ================= */
function openDrawer(cid){
  const c=course(cid);
  const ss=sessionsOf(cid).sort((a,b)=>a.day-b.day||a.from-b.from);
  $("#dSwatch").style.background=c.color;
  $("#dName").textContent=c.name;
  $("#dSub").textContent = `第${Math.min(...ss.map(s=>s.weeks[0]))}-${Math.max(...ss.map(s=>s.weeks[1]))}周 · 每周 ${ss.length} 次`;
  const teachers=[...new Set(ss.map(s=>s.teacher).filter(Boolean))].join(" / ");

  const a = assessOf(cid);
  const APAL = ["#4f6ef7","#f59e0b","#10b981","#ec4899","#8b5cf6","#06b6d4"];
  const assessHTML = a ? `
    <div class="dsec">
      <h5>考核方式</h5>
      <div class="asbig">
        <div class="asicon">${a.kind==="exam"?"📝":"📄"}</div>
        <div style="flex:1;min-width:0">
          <div class="astitle">${esc(assessWord(a))}${a.form?` · ${esc(a.form)}`:""}</div>
          <div class="assub">${esc(a.tip||"")}</div>
        </div>
        <span class="aseal ${a.src==="pdf"&&!a.edited?"pdf":"ref"}">${a.edited?"已自定义":(a.src==="pdf"?"教务标注":"参考推断")}</span>
      </div>
      ${(a.parts&&a.parts.length) ? `
        <div class="asbar">${a.parts.map((p,i)=>`<i style="width:${p.pct}%;background:${APAL[i%APAL.length]}" title="${esc(p.name)} ${p.pct}%"></i>`).join("")}</div>
        <div class="aslegend">${a.parts.map((p,i)=>`<span><em style="background:${APAL[i%APAL.length]}"></em>${esc(p.name)}<b>${p.pct}%</b></span>`).join("")}</div>
      ` : `<div class="hint" style="margin-bottom:8px">暂无成绩构成信息。</div>`}
      <div class="hint" style="margin-bottom:10px">
        ${a.edited
          ? "此项由你自己填写，仅保存在本机浏览器里。"
          : (a.src==="pdf"
              ? "「考试 / 考查」来自教务课表原文；具体形式与成绩比例是按课程性质给出的参考，请以任课老师公布的教学大纲为准。"
              : "教务课表未标注这门课的考核方式。以上类型、形式与比例均为按课程性质给出的参考（标了 ?），请务必向任课老师确认后再照此准备。")}
      </div>
      <button class="btn" id="dEditAssess">✎ 修改考核方式</button>
    </div>` : "";

  $("#dBody").innerHTML = `
    <div class="dsec">
      <h5>上课安排</h5>
      ${ss.map(s=>`<div class="session" style="--c:${c.color}">
        <div class="l1">
          <span class="badge2">${wd(s.day)}</span>
          <span>${s.from}-${s.to} 节</span>
          <span style="font-weight:400;color:var(--muted)">${timeRange(s.from,s.to)}</span>
          ${isLeave(s.id, state.viewWeek)?`<span class="st off">本周已请假</span>`:""}
        </div>
        <div class="dloc">📍 ${esc(s.room||"待定")}</div>
        <div class="l2">
          第 ${s.weeks[0]}-${s.weeks[1]} 周${s.parity!=="all"?"（"+dayWord(s.parity)+"）":"（每周）"} ·
          每次 ${durationMin(s.from,s.to)} 分钟 · 👤 ${esc(s.teacher||"-")}
        </div>
        <button class="btn" style="padding:5px 11px;font-size:12px;margin-top:8px" data-leave="${s.id}">
          ${isLeave(s.id,state.viewWeek)?"↩ 撤销请假":"🙋 本周请假"}
        </button>
      </div>`).join("")}
    </div>

    ${assessHTML}

    <div class="dsec">
      <h5>学期周次分布</h5>
      <div class="wkstrip" style="--c:${c.color}">
        ${Array.from({length:totalWeeks()},(_,i)=>{const w=i+1;
          return `<i class="${weeksDone(cid).has(w)?"on":""}${w===weekOfDate(new Date())?" cur":""}" title="第${w}周">${w}</i>`;}).join("")}
      </div>
      <div class="hint" style="margin-top:8px">共 ${weeksDone(cid).size} 周有课 · 红框为当前周</div>
    </div>

    <div class="dsec">
      <h5>课程信息</h5>
      <dl class="kv">
        <dt>类型</dt><dd>${({ "*":"理论","#":"实践","&":"实验"})[c.mark]||"-"}</dd>
        <dt>教师</dt><dd>${esc(teachers||"-")}</dd>
        <dt>学分</dt><dd>${esc(c.credits||"-")}</dd>
        <dt>教务标注</dt><dd>${esc(c.assessment||"未安排")}</dd>
        <dt>周学时</dt><dd>${esc(c.weekHours||"-")}</dd>
        <dt>总学时</dt><dd>${esc(c.totalHours||"-")}</dd>
        <dt>学时组成</dt><dd>${esc(c.hoursBreakdown||"-")}</dd>
        <dt>教学班</dt><dd style="font-size:11.5px;font-weight:400;line-height:1.5">${esc(c.className||"-")}</dd>
        <dt>课程代码</dt><dd style="font-size:11.5px;font-weight:400">${esc(c.classCode||"-")}</dd>
      </dl>
    </div>

    <div class="dsec">
      <h5>便签（${state.notes.filter(n=>n.courseId===cid).length}）</h5>
      <div id="dNotes"></div>
      <div class="noteinput">
        <textarea id="dNewNote" placeholder="记点什么：作业 / 疑问 / 考试重点…"></textarea>
        <button class="btn pri" id="dAddNote">添加</button>
      </div>
    </div>

    <div class="dsec">
      <button class="btn" id="dQuickBoard">📌 去便签墙</button>
    </div>`;

  const dn=$("#dNotes");
  const related=state.notes.filter(n=>n.courseId===cid);
  dn.innerHTML = related.length ? related.map(n=>`
    <div class="session" style="--c:${c.color};border-left-width:4px">
      <div style="font-size:12.5px;white-space:pre-wrap;line-height:1.6">${esc(n.text||"（空白便签）")}</div>
      <div class="hint" style="margin-top:6px">${n.updatedAt?new Date(n.updatedAt).toLocaleString("zh-CN"):""}
        <button class="btn" style="padding:2px 8px;font-size:11px;margin-left:6px" data-del="${n.id}">删除</button></div>
    </div>`).join("") : `<div class="hint">还没有便签，在下面写一条吧。</div>`;

  dn.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>{
    state.notes=state.notes.filter(x=>x.id!==b.dataset.del); saveLocal(); openDrawer(cid); renderTop();
  }));

  $("#dAddNote").onclick=()=>{
    const t=$("#dNewNote").value.trim();
    if(!t){ toast("先写点内容吧"); return; }
    newNote({courseId:cid, text:t});
    openDrawer(cid); toast("便签已保存");
  };
  $("#dQuickBoard").onclick=()=>{ closeDrawer(); switchTab("notes"); };

  $$("#dBody [data-leave]").forEach(b=>b.addEventListener("click",()=>{
    pickLeave(b.dataset.leave, state.viewWeek);
    openDrawer(cid);
  }));
  const ea=$("#dEditAssess");
  if(ea) ea.onclick=()=>editAssess(cid);

  $("#mask").classList.add("on");
  $("#drawer").classList.add("on");
}

/** 手动修改某门课的考核方式 */
/** 手动修改某门课的考核方式 */
function editAssess(cid){
  const a=assessOf(cid)||{};
  const c=course(cid);
  openFormDialog({
    title:`编辑考核方式 · ${c.name}`,
    description:"修改后只影响当前浏览器中的课表显示，不会改动服务器或示例数据。",
    fields:[
      {name:"kind",label:"考核类型",type:"select",value:a.kind==="review"?"考查":"考试",options:["考试","考查"]},
      {name:"form",label:"具体考核形式",type:"text",value:a.form||"",placeholder:"例如：闭卷笔试 / 课程论文 / 上机考试",full:true},
      {name:"parts",label:"成绩构成",type:"text",value:(a.parts||[]).map(p=>p.name+":"+p.pct).join(","),placeholder:"平时作业:30,期末考试:70",help:"用逗号分隔，每项写成「项目:百分比」。",full:true},
      {name:"tip",label:"备注",type:"textarea",value:a.tip||"",placeholder:"补充说明，可留空",full:true}
    ],
    submitText:"保存考核方式",
    onSubmit(values){
      const kind=values.kind||"考试";
      const parts=(values.parts||"").split(/[,，;；]/).map(x=>{
        const m=x.split(/[:：]/);
        const n=(m[0]||"").trim(), v=parseInt(m[1],10);
        return (n && !isNaN(v)) ? {name:n, pct:v} : null;
      }).filter(Boolean);
      const isReview = kind.indexOf("考查")>=0;
      state.settings.assess = state.settings.assess || {};
      state.settings.assess[cid] = {
        kind: isReview?"review":"exam", raw: isReview?"考查":"考试",
        src:"pdf", edited:true, form:(values.form||"").trim(), parts, tip:(values.tip||"").trim(),
      };
      saveLocal(); openDrawer(cid); renderWeek(); renderCourses();
      toast("已保存 · 只影响本页显示");
    }
  });
}
function closeDrawer(){ $("#mask").classList.remove("on"); $("#drawer").classList.remove("on"); }

/* ================= 设置 ================= */
function bindRemind(){
  const cfg = remCfg();
  $("#remOn").checked    = cfg.on;
  $("#remDesk").checked  = cfg.desk;
  $("#remSound").checked = cfg.sound;
  $("#remTitle").checked = cfg.title;
  $("#remMin").value     = String(cfg.min);

  const set = (k, el)=>{ el.onchange = ()=>{ state.settings[k] = el.checked; saveLocal(); }; };
  set("remindOn",    $("#remOn"));
  set("remindDesk",  $("#remDesk"));
  set("remindSound", $("#remSound"));
  set("remindTitle", $("#remTitle"));
  $("#remMin").onchange = ()=>{
    state.settings.remindMin = Number($("#remMin").value) || 15;
    saveLocal(); toast(`已设为提前 ${state.settings.remindMin} 分钟提醒`);
  };
  $("#remTest").onclick = ()=>{ notifyAsk().then(()=>pushNext(true)); };
  $("#remIcs").onclick  = exportIcs;

  const why = notifyWhy();
  const p = notifyPerm();
  const dot = p === "granted" ? "🟢" : p === "denied" ? "🔴" : "🟡";
  $("#remHint").innerHTML =
    `${dot} 桌面通知：<b>${p === "granted" ? "已授权" : p === "denied" ? "不可用" : "待授权"}</b>`
    + (why ? `<div class="remwarn">${esc(why)}</div>` : "")
    + `<div class="remnote">页面必须<b>保持打开</b>才会自动提醒 —— 浏览器标签页被完全关掉后网页就停了。`
    + `想要关掉网页也提醒，用上面的「导出日历 .ics」：下载后双击导入系统日历，Windows 与手机都会到点弹系统通知。</div>`;
}

function renderSettings(){
  $("#semStart").value = DATA.meta.semesterStart||"";
  $("#totWeeks").value = totalWeeks();
  const [mA,mB]=militaryRange();
  $("#milA").value=mA; $("#milB").value=mB;
  $("#slotBody").innerHTML = DATA.timeSlots.map(s=>`<tr>
    <td><b>${s.n}</b></td>
    <td><input type="time" data-n="${s.n}" data-k="start" value="${s.start}"></td>
    <td><input type="time" data-n="${s.n}" data-k="end" value="${s.end}"></td>
    <td><span class="hint">${esc(s.group||"")}</span></td>
  </tr>`).join("");
  $$("#slotBody input").forEach(inp=>inp.addEventListener("change",()=>{
    const s=DATA.timeSlots.find(x=>x.n==inp.dataset.n); s[inp.dataset.k]=inp.value;
    state.settings.timeSlots=DATA.timeSlots; saveLocal(); renderWeek(); renderToday(); toast("作息已更新");
  }));
  // 法定节假日
  $("#holRows").innerHTML = holidayList().map((h,i)=>`<div class="holrow">
    <span class="hi">${h.icon||"🎌"}</span>
    <input type="text" data-i="${i}" data-k="name" value="${esc(h.name)}" placeholder="假期名称">
    <button class="del" data-del="${i}" title="删除这个假期">🗑</button>
    <span class="dates">
      <input type="date" data-i="${i}" data-k="from" value="${h.from}">
      <span>→</span>
      <input type="date" data-i="${i}" data-k="to" value="${h.to}">
      ${h.note?`<span style="color:var(--muted)">${esc(h.note)}</span>`:""}
    </span>
  </div>`).join("") || `<div class="hint">还没有任何假期，点下面的按钮添加。</div>`;
  $$("#holRows input").forEach(inp=>inp.addEventListener("change",()=>{
    ensureHolLocal();
    const h = state.settings.holidays[+inp.dataset.i]; if(!h) return;
    h[inp.dataset.k] = inp.value.trim();
    if(h.from > h.to) h.to = h.from;
    h.note = h.note && h.note!=="手动添加" ? h.note : "手动添加";
    saveLocal(); renderSettings(); renderWeek(); renderToday(); renderFree();
    toast("假期已更新");
  }));
  $$("#holRows .del").forEach(b=>b.addEventListener("click",()=>{
    ensureHolLocal();
    state.settings.holidays.splice(+b.dataset.del,1);
    saveLocal(); renderSettings(); renderWeek(); renderToday(); renderFree();
    toast("已删除该假期");
  }));
  $("#holAdd").onclick=()=>{
    ensureHolLocal();
    const t = ymd(new Date());
    state.settings.holidays.push({id:"h"+Date.now(), name:"新假期", icon:"🎌", from:t, to:t, note:"手动添加"});
    saveLocal(); renderSettings(); renderWeek(); renderToday(); renderFree();
    toast("已添加，记得改名称和日期");
  };
  $("#holReset").onclick=()=>{
    state.settings.holidays = null;
    saveLocal(); renderSettings(); renderWeek(); renderToday(); renderFree();
    toast("已恢复官方默认假期");
  };
  $("#mkpWork").checked = makeupAsWorkday();
  $("#mkpWork").onchange = ()=>{
    state.settings.makeupAsWorkday = $("#mkpWork").checked;
    saveLocal(); renderWeek(); renderToday(); renderFree(); renderLeave();
    toast(state.settings.makeupAsWorkday ? "未指定的调休日将按当天课表上课" : "未指定的调休日不排课");
  };

  // 调休上班日 → 补周几的课
  const mkpRender = ()=>{
    renderSettings(); renderWeek(); renderToday(); renderFree(); renderLeave();
  };
  $("#mkpRows").innerHTML = makeupList().length ? makeupList().map((m,i)=>{
    const f = makeupFor(m), dt = parseD(m.date);
    return `<div class="mkprow">
      <span class="mkpd"><b>${esc(m.date)}</b><small>${esc(DAYS[(dt.getDay()+6)%7])}</small></span>
      <select data-i="${i}" title="这一天补周几的课">
        <option value="0"${f?"":" selected"}>— 未指定（不补课）—</option>
        ${DAYS.map((d,ix)=>`<option value="${ix+1}"${f===ix+1?" selected":""}>补${esc(d)}的课</option>`).join("")}
      </select>
      <span class="mkpquick">
        ${DAYS.map((d,ix)=>`<button data-i="${i}" data-d="${ix+1}" class="${f===ix+1?"on":""}" title="${esc(d)}">${ix+1}</button>`).join("")}
        <button data-i="${i}" data-d="0" class="clr" title="清除">✕</button>
      </span>
      <span class="hint">${esc(m.note||"")}</span>
    </div>`;
  }).join("") : `<div class="hint">本学期没有调休上班日。</div>`;
  $$("#mkpRows select").forEach(sel=>sel.addEventListener("change",()=>{
    ensureMkpLocal();
    const m=state.settings.makeupDays[+sel.dataset.i]; if(!m) return;
    m.for = +sel.value || 0; saveLocal(); mkpRender();
    toast(m.for ? `${m.date} 补${DAYS[m.for-1]}的课` : `已清除 ${m.date} 的补周几`);
  }));
  $$("#mkpRows .mkpquick button").forEach(b=>b.addEventListener("click",()=>{
    ensureMkpLocal();
    const m=state.settings.makeupDays[+b.dataset.i]; if(!m) return;
    const d=+b.dataset.d; m.for = (d>=1&&d<=7) ? d : 0; saveLocal(); mkpRender();
    toast(m.for ? `${m.date} 补${DAYS[m.for-1]}的课` : `已清除 ${m.date} 的补周几`);
  }));

  const mkpSet = makeupList().filter(m=>makeupFor(m)).length;
  $("#mkpHint").innerHTML = "国办安排的调休上班日：" +
    makeupList().map(m=>{
      const f=makeupFor(m);
      return `<b>${esc(m.date)}</b>${f?`　补${esc(DAYS[f-1])}的课`:"（未指定）"}`;
    }).join("、") +
    `。<br>已指定 ${mkpSet} / ${makeupList().length} 个。具体补哪天的课<b>以学院通知为准</b> —— 学校的调休方案和国办不一定完全一致。<br>
     2027 年的放假安排通常要等 2026 年 11 月前后才公布，届时如果多出调休日，可以回来手动加一条。`;

  bindRemind();
  $("#srcInfo").innerHTML = `
    <dt>姓名</dt><dd>${esc(DATA.meta.studentName || (DATA.meta.title||"").replace(/(的)?课表$/,""))}</dd>
    <dt>学号</dt><dd>${esc(DATA.meta.studentId||"-")}</dd>
    <dt>学期</dt><dd>${esc(DATA.meta.term||"-")}</dd>
    <dt>校区</dt><dd>${esc(DATA.meta.campus||"-")}校区</dd>
    <dt>原始文件</dt><dd>${esc(DATA.meta.source||"-")}</dd>
    <dt>导出时间</dt><dd>${esc(DATA.meta.printDate||"-")}</dd>
    <dt>课程/时段</dt><dd>${DATA.courses.length} 门 / ${DATA.sessions.length} 个时段</dd>`;
}

/* ================= 校园地图（真实地理底图） ================= */
/* 底图不是手绘示意图了，而是从真实地理数据来的：校园边界、每一栋楼的轮廓、
   水面（黄迳洞水库与校内河塘）、林地草坡、道路网络，全部按 OpenStreetMap
   矢量要素以约 0.55 m/px 逐像素提取轮廓并简化，再用 ArcGIS World Imagery
   卫星影像交叉校对。
   坐标单位一律「米」，原点在视图左上角，Y 轴向下（南），视图边长 GEO_M.view 米。
   所以校园是它本来的不规则形状、楼是各自的真实轮廓，没有任何方盒子。 */

const GEO_M = {"view":1240,"campus":[[911,300],[890,297],[856,319],[827,375],[776,362],[755,389],[731,398],[695,395],[669,371],[498,368],[466,346],[366,360],[358,466],[344,495],[355,544],[387,573],[386,600],[365,619],[352,661],[374,734],[375,787],[322,906],[326,939],[536,940],[567,895],[594,876],[617,860],[671,820],[696,797],[771,759],[814,750],[854,737],[854,727],[864,724],[870,693],[880,688],[900,651],[912,642],[918,566]],"water":[{"o":[[1224,1146],[1149,1180],[1147,1194],[1151,1202],[1196,1226],[1216,1219],[1237,1206],[1240,1205],[1240,1143]],"i":[]},{"o":[[623,1077],[622,1088],[674,1133],[685,1122],[681,1088],[660,1067],[651,1049],[639,1044]],"i":[]},{"o":[[228,930],[226,1036],[215,1071],[168,1119],[135,1139],[124,1160],[99,1185],[30,1192],[0,1206],[0,1240],[412,1240],[436,1148],[417,1135],[377,1151],[372,1169],[350,1182],[340,1168],[324,1157],[300,1129],[270,1076],[262,959],[248,975],[238,924]],"i":[]},{"o":[[567,897],[543,928],[543,962],[513,996],[504,1022],[560,1072],[565,1063],[563,1040],[512,1001],[515,998],[563,1034],[572,1034],[581,1019],[581,965],[606,932],[627,913],[593,877]],"i":[]},{"o":[[632,908],[640,901],[607,867],[599,873]],"i":[]},{"o":[[1108,782],[1077,765],[1068,764],[1046,803],[1044,817],[1053,834],[1058,859],[1053,871],[1057,882],[1067,886],[1088,877],[1094,861],[1160,818],[1171,799],[1170,780]],"i":[]},{"o":[[321,592],[294,639],[285,663],[266,666],[272,677],[283,736],[305,776],[300,797],[342,801],[355,797],[369,750],[341,716],[327,686],[327,641],[355,587],[335,584]],"i":[]},{"o":[[1021,352],[1016,382],[1003,420],[964,482],[943,530],[912,642],[900,651],[880,688],[870,693],[864,724],[854,727],[854,737],[814,750],[771,759],[696,797],[671,820],[617,860],[648,893],[680,864],[722,858],[723,851],[734,847],[764,799],[778,789],[781,780],[805,772],[809,763],[844,766],[872,759],[894,739],[933,730],[966,756],[984,756],[996,737],[960,691],[963,669],[981,657],[972,628],[941,624],[933,607],[954,562],[961,528],[1000,450],[1045,402],[1053,356],[1034,337]],"i":[]},{"o":[[125,76],[191,68],[274,84],[342,105],[400,136],[426,184],[461,194],[518,161],[515,118],[375,55],[290,3],[288,0],[90,0]],"i":[]}],"green":[{"o":[[876,1177],[815,1170],[807,1176],[800,1212],[784,1227],[789,1240],[860,1240],[881,1230],[898,1197],[896,1172]]},{"o":[[696,944],[675,965],[699,1029],[722,1063],[709,1088],[747,1102],[800,1109],[819,1103],[839,1073],[818,1110],[804,1173],[818,1111],[832,1092],[846,1058],[899,1004],[857,1041],[860,1029],[820,1058],[789,1051],[754,1006],[735,959],[789,924],[786,917]]},{"o":[[505,1222],[552,1160],[572,1175],[576,1192],[594,1188],[592,1171],[574,1172],[555,1157],[590,1110],[639,1137],[591,1108],[622,1027],[653,976],[696,940],[787,913],[833,889],[854,912],[776,954],[765,971],[766,985],[775,998],[783,1000],[766,986],[776,954],[855,913],[821,936],[844,976],[873,958],[885,946],[845,975],[822,936],[858,916],[885,935],[908,1002],[935,1028],[909,1070],[900,1099],[898,1120],[906,1169],[930,1227],[945,1240],[950,1240],[930,1226],[906,1169],[899,1123],[909,1071],[936,1028],[933,1023],[965,1030],[1008,1016],[1051,1011],[1083,986],[1093,964],[1076,956],[1055,989],[933,1019],[944,1010],[943,998],[924,1003],[943,999],[944,1010],[931,1016],[911,991],[938,983],[942,991],[940,982],[909,988],[942,979],[943,984],[942,978],[909,986],[894,946],[954,931],[971,922],[998,900],[954,931],[892,943],[952,928],[995,898],[1006,870],[1008,875],[1005,814],[1012,872],[1008,814],[1023,820],[1015,810],[1032,824],[1043,916],[1032,823],[1017,809],[1051,765],[1029,792],[1009,801],[1025,790],[1049,750],[1044,747],[1021,785],[998,800],[902,802],[860,831],[851,816],[855,806],[893,787],[856,805],[849,816],[853,803],[892,784],[853,802],[846,815],[800,838],[849,820],[856,836],[825,872],[780,898],[678,931],[606,849],[608,856],[602,854],[658,909],[673,936],[665,943],[648,926],[644,930],[660,949],[628,986],[567,1119],[494,1208],[488,1240],[501,1240]]},{"o":[[347,889],[329,965],[349,1024],[329,994],[338,1014],[350,1029],[365,1044],[383,1052],[365,1043],[354,1029],[370,1042],[397,1050],[397,1037],[421,1030],[436,1009],[469,1001],[489,942],[471,923],[474,871],[414,889],[356,873],[384,815],[390,786],[384,815],[334,911],[331,922]]},{"o":[[890,434],[860,435],[822,478],[760,478],[743,545],[745,687],[799,682],[843,668],[801,681],[745,686],[744,545],[760,480],[823,478],[862,435],[908,440],[918,480],[899,478],[890,489],[868,481],[849,490],[831,481],[826,524],[807,535],[808,597],[820,609],[813,640],[849,618],[865,622],[868,641],[849,663],[869,641],[884,616],[911,546],[919,482],[908,438]]},{"o":[[774,402],[772,425],[763,434],[760,475],[825,471],[851,440],[842,429],[843,387]]},{"o":[[495,487],[564,488],[565,379],[497,378]]},{"o":[[940,334],[937,392],[915,392],[911,437],[917,452],[960,452],[1001,384],[1010,335]]},{"o":[[898,318],[881,318],[863,332],[846,384],[845,428],[853,437],[860,431],[908,434],[911,390],[933,389],[936,332]]},{"o":[[940,330],[1014,333],[1014,344],[1014,342],[1014,332],[1005,330],[1006,294],[996,272],[964,257],[942,254],[922,264],[898,290],[912,317],[897,314]]},{"o":[[1089,413],[1040,444],[1016,494],[1018,574],[1049,680],[1055,680],[1024,573],[1022,495],[1046,447],[1094,418],[1114,431],[1124,434],[1139,432],[1116,431],[1095,418],[1116,427],[1098,415],[1111,401],[1118,366],[1080,258],[1087,239],[1117,226],[1103,225],[1078,242],[1074,223],[1068,222],[1077,247],[1071,257],[1060,222],[1054,221],[1101,370],[1095,394],[1031,440]]},{"o":[[748,66],[712,88],[690,178],[707,236],[695,302],[764,306],[813,281],[878,232],[874,126],[824,64]]},{"o":[[50,92],[76,103],[136,111],[72,0],[56,0],[1,41],[0,41],[0,113]]},{"o":[[1078,54],[1087,55],[1078,59],[1079,161],[1085,179],[1105,194],[1240,219],[1240,108],[1210,109],[1155,153],[1130,160],[1126,142],[1111,136],[1104,120],[1109,94],[1101,4],[1104,0],[1078,0]]}],"building":[{"o":[[630,1240],[642,1240],[642,1240],[645,1238],[647,1240],[668,1240],[642,1222]],"a":332,"c":"out"},{"o":[[620,1189],[623,1185],[617,1187],[609,1183],[590,1211],[589,1208],[557,1202],[544,1200],[542,1203],[536,1202],[532,1210],[531,1224],[594,1237],[596,1228],[602,1230],[627,1193]],"a":2521,"c":"out"},{"o":[[949,1200],[966,1200],[967,1208],[1060,1208],[1059,1188],[967,1187],[965,1181],[948,1182]],"a":2235,"c":"out"},{"o":[[877,1226],[892,1196],[878,1189],[866,1212],[832,1230],[823,1214],[827,1181],[812,1180],[807,1220],[816,1221],[822,1233],[809,1240],[847,1240]],"a":2041,"c":"out"},{"o":[[642,1209],[686,1238],[692,1228],[657,1204],[664,1195],[698,1218],[706,1208],[663,1179]],"a":1397,"c":"out"},{"o":[[769,1218],[769,1193],[792,1194],[793,1181],[742,1177],[741,1190],[764,1192],[765,1205],[720,1211],[722,1224]],"a":1388,"c":"out"},{"o":[[1017,1172],[1079,1173],[1078,1156],[1017,1156]],"a":1021,"c":"out"},{"o":[[936,1166],[967,1166],[969,1175],[1012,1176],[1011,1155],[975,1151],[971,1144],[937,1143]],"a":1734,"c":"out"},{"o":[[821,1150],[888,1158],[888,1146],[823,1138]],"a":802,"c":"out"},{"o":[[581,1150],[589,1155],[587,1159],[617,1180],[638,1179],[641,1174],[639,1172],[638,1178],[620,1176],[618,1178],[617,1174],[618,1171],[638,1172],[639,1169],[634,1169],[633,1167],[629,1170],[617,1168],[618,1163],[636,1162],[618,1162],[617,1157],[619,1154],[625,1155],[592,1133],[586,1139]],"a":1065,"c":"out"},{"o":[[808,1151],[809,1138],[749,1132],[748,1145]],"a":776,"c":"out"},{"o":[[1015,1139],[1074,1140],[1074,1134],[1077,1133],[1078,1122],[1015,1122]],"a":1073,"c":"out"},{"o":[[826,1127],[882,1133],[884,1120],[827,1114]],"a":719,"c":"out"},{"o":[[747,1120],[812,1126],[813,1113],[748,1107]],"a":875,"c":"out"},{"o":[[532,1105],[498,1152],[490,1179],[472,1198],[439,1240],[439,1240],[470,1240],[470,1238],[499,1191],[508,1163],[526,1144],[551,1124],[545,1095]],"a":3090,"c":"out"},{"o":[[939,1096],[930,1096],[920,1112],[933,1119],[944,1096],[941,1094]],"a":310,"c":"out"},{"o":[[839,1093],[885,1105],[888,1093],[842,1081]],"a":620,"c":"out"},{"o":[[927,1087],[932,1091],[940,1090],[949,1071],[938,1065]],"a":290,"c":"out"},{"o":[[1030,1071],[1037,1075],[1037,1077],[1033,1081],[1026,1078],[1021,1088],[1028,1092],[1027,1096],[1025,1098],[1020,1094],[1017,1096],[1013,1104],[1021,1108],[1026,1102],[1039,1108],[1045,1095],[1034,1088],[1036,1087],[1048,1092],[1054,1080],[1042,1073],[1046,1065],[1036,1060]],"a":844,"c":"out"},{"o":[[977,1048],[956,1092],[960,1096],[949,1117],[963,1125],[974,1102],[969,1099],[992,1052],[980,1046]],"a":1186,"c":"out"},{"o":[[987,1098],[991,1101],[980,1123],[989,1129],[1002,1105],[997,1102],[1030,1035],[1019,1029]],"a":1212,"c":"out"},{"o":[[887,1020],[868,1041],[871,1043],[865,1053],[856,1050],[852,1061],[853,1063],[892,1078],[898,1062],[905,1053],[897,1044],[905,1039],[896,1028],[905,1021],[900,1012]],"a":1792,"c":"out"},{"o":[[787,1026],[789,1018],[792,1017],[789,1015],[794,1013],[798,1015],[798,1025],[814,1022],[810,1008],[793,1011],[779,1006],[773,1020]],"a":466,"c":"out"},{"o":[[1214,996],[1201,1046],[1199,1090],[1191,1090],[1192,1100],[1211,1100],[1214,1047],[1226,998]],"a":1378,"c":"out"},{"o":[[816,1004],[822,1015],[846,1002],[839,991]],"a":348,"c":"out"},{"o":[[1106,981],[1103,982],[1099,990],[1105,995],[1104,998],[1100,1000],[1094,998],[1090,1003],[1088,1007],[1094,1011],[1092,1016],[1095,1018],[1089,1022],[1087,1018],[1083,1021],[1076,1014],[1065,1022],[1068,1027],[1066,1031],[1062,1024],[1050,1030],[1056,1044],[1065,1038],[1070,1047],[1073,1047],[1096,1034],[1099,1024],[1103,1027],[1114,1010],[1111,1007],[1112,1002],[1118,1001],[1109,994],[1113,986]],"a":1533,"c":"out"},{"o":[[753,995],[766,995],[767,998],[764,1000],[763,998],[761,997],[764,999],[758,1006],[769,1016],[776,1007],[765,992],[763,978],[750,980]],"a":383,"c":"out"},{"o":[[849,984],[860,1007],[887,994],[883,984],[870,991],[869,989],[868,993],[863,995],[859,989],[879,978],[875,970]],"a":624,"c":"out"},{"o":[[758,951],[756,949],[750,955],[747,954],[741,958],[738,962],[741,968],[747,967],[753,962],[746,960],[749,956],[754,956],[756,961],[764,956],[761,950]],"a":199,"c":"other"},{"o":[[787,959],[791,968],[795,967],[803,984],[831,970],[826,960],[823,962],[815,945]],"a":895,"c":"other"},{"o":[[780,935],[779,933],[770,940],[769,938],[763,941],[760,946],[764,952],[770,951],[777,946],[770,946],[770,940],[775,940],[774,944],[781,945],[787,940],[782,934]],"a":224,"c":"other"},{"o":[[831,937],[840,952],[837,955],[842,964],[870,950],[860,934],[864,930],[859,922]],"a":886,"c":"other"},{"o":[[807,916],[800,922],[798,920],[792,924],[793,926],[790,928],[793,935],[804,929],[798,927],[799,923],[806,923],[807,928],[813,926],[816,923],[813,916]],"a":193,"c":"other"},{"o":[[1223,906],[1218,918],[1227,920],[1229,924],[1227,926],[1217,921],[1211,932],[1222,940],[1219,943],[1208,939],[1205,949],[1215,955],[1214,958],[1212,962],[1202,956],[1197,967],[1207,972],[1204,980],[1213,983],[1217,974],[1212,972],[1216,964],[1235,972],[1240,954],[1240,936],[1237,935],[1240,929],[1240,922],[1237,920],[1238,916],[1235,914],[1237,910],[1226,905]],"a":1713,"c":"out"},{"o":[[995,916],[999,927],[997,928],[1014,928],[1014,935],[994,935],[992,929],[980,934],[979,939],[978,935],[976,937],[966,939],[970,952],[968,954],[956,957],[954,960],[940,962],[938,968],[946,978],[949,1008],[952,1005],[963,1006],[1011,992],[1025,991],[1055,983],[1062,962],[1044,950],[1039,921],[1032,919],[1033,915],[1038,915],[1034,901]],"a":7054,"c":"out"},{"o":[[836,901],[833,900],[828,902],[829,904],[818,908],[816,913],[819,919],[831,912],[824,910],[826,906],[828,909],[828,906],[833,908],[832,912],[842,906],[839,907],[836,902],[837,900]],"a":180,"c":"other"},{"o":[[1154,890],[1155,895],[1149,898],[1152,905],[1146,908],[1145,913],[1123,925],[1127,930],[1118,935],[1121,939],[1114,944],[1120,954],[1112,958],[1121,972],[1129,968],[1126,963],[1132,959],[1129,953],[1136,949],[1137,945],[1143,941],[1142,938],[1151,932],[1152,928],[1166,921],[1162,914],[1170,908],[1165,902],[1171,900],[1169,896],[1174,893],[1168,883]],"a":1728,"n":"人工智能学院","ic":"🤖","c":"learn"},{"o":[[864,870],[877,870],[878,876],[862,876],[860,887],[863,891],[875,902],[888,902],[905,918],[903,921],[915,931],[919,932],[928,920],[901,891],[902,880],[899,873],[893,867],[883,864],[866,867]],"a":1849,"c":"other"},{"o":[[1137,862],[1134,859],[1127,863],[1125,860],[1122,860],[1111,866],[1114,873],[1107,878],[1109,885],[1077,905],[1071,905],[1067,908],[1064,904],[1061,906],[1067,917],[1077,913],[1080,916],[1086,912],[1090,915],[1115,900],[1114,894],[1123,888],[1128,894],[1133,891],[1136,889],[1130,879],[1135,877],[1140,880],[1145,876],[1146,878],[1156,872],[1146,857]],"a":1700,"c":"out"},{"o":[[785,854],[787,852],[796,853],[800,851],[804,842],[848,820],[802,841],[799,838],[815,829],[813,817],[806,819],[807,825],[805,827],[793,815],[787,821],[799,834],[788,831],[786,838],[798,844],[778,847]],"a":625,"c":"other"},{"o":[[1227,795],[1234,809],[1240,806],[1240,788]],"a":174,"c":"out"},{"o":[[410,814],[402,815],[402,826],[411,827],[411,849],[395,850],[395,860],[487,860],[488,880],[494,881],[494,889],[485,890],[485,922],[497,922],[498,912],[508,912],[508,877],[492,877],[491,861],[511,860],[512,848],[492,848],[491,831],[509,831],[509,826],[513,826],[516,830],[524,830],[524,818],[500,818],[486,807],[486,773],[476,773],[474,780],[410,779]],"a":8265,"n":"商科楼","ic":"🏛","c":"learn","d":"国际商学院"},{"o":[[1186,777],[1191,789],[1188,791],[1189,794],[1174,799],[1177,806],[1180,808],[1182,815],[1191,813],[1196,830],[1180,834],[1183,844],[1205,837],[1209,842],[1214,840],[1217,843],[1226,841],[1224,832],[1230,829],[1217,795],[1218,791],[1215,779],[1210,780],[1206,771]],"a":2343,"c":"out"},{"o":[[937,755],[936,760],[910,761],[910,768],[916,769],[916,783],[929,783],[929,776],[922,774],[923,768],[937,768],[938,773],[941,769],[946,769],[945,755]],"a":487,"c":"out"},{"o":[[584,748],[563,769],[562,788],[574,788],[574,777],[569,777],[569,772],[579,768],[576,767],[578,761],[585,762],[595,752],[596,744],[622,746],[621,752],[614,754],[614,784],[626,784],[625,760],[632,759],[632,734],[584,733]],"a":1498,"n":"北斗研究院","ic":"🔬","c":"learn"},{"o":[[1073,742],[1235,765],[1237,744],[1209,716],[1108,700],[1076,719]],"a":6651,"c":"out"},{"o":[[818,703],[818,687],[803,687],[802,690],[785,690],[784,698],[772,698],[771,693],[756,692],[756,709],[760,709],[763,713],[760,729],[743,730],[742,733],[741,730],[724,730],[724,709],[722,709],[721,734],[775,735],[775,729],[780,726],[784,728],[785,726],[788,728],[810,728],[812,719],[825,720],[825,704]],"a":2550,"n":"学生活动中心","ic":"🎭","c":"life"},{"o":[[399,687],[412,688],[412,725],[420,725],[420,720],[424,718],[425,720],[422,724],[426,724],[426,721],[427,725],[432,725],[433,716],[470,716],[470,670],[433,670],[432,662],[398,662]],"a":3363,"n":"图书馆","ic":"📚","c":"learn"},{"o":[[1008,658],[1007,664],[988,670],[987,669],[984,672],[980,671],[978,673],[983,692],[989,688],[992,694],[994,691],[1006,691],[1022,687],[1017,667],[1025,664],[1021,658],[1022,655]],"a":1041,"c":"out"},{"o":[[615,649],[615,668],[612,670],[610,668],[582,668],[581,715],[634,716],[634,699],[650,698],[654,690],[650,681],[630,679],[631,649]],"a":3071,"n":"信息楼","ic":"🖥","c":"learn"},{"o":[[860,646],[860,629],[837,629],[836,645],[843,645],[844,647]],"a":395,"n":"学术交流中心B座","ic":"🏨","c":"learn"},{"o":[[819,649],[819,666],[830,665],[832,662],[845,663],[842,660],[831,661],[828,658],[830,654],[844,655],[844,650]],"a":266,"n":"学术交流中心B座","ic":"🏨","c":"learn"},{"o":[[748,642],[758,643],[758,666],[812,666],[812,654],[803,652],[803,603],[747,603]],"a":3345,"n":"学生公寓1座","ic":"🛏","c":"life"},{"o":[[986,571],[977,588],[967,593],[958,608],[956,606],[962,595],[956,592],[952,598],[949,597],[946,603],[950,605],[941,623],[943,624],[948,620],[984,620],[984,616],[992,612],[988,599],[999,578]],"a":1377,"c":"out"},{"o":[[602,636],[602,630],[598,629],[571,629],[571,614],[596,612],[602,615],[602,602],[576,602],[575,575],[570,575],[569,568],[553,568],[552,564],[537,564],[527,564],[526,569],[512,569],[511,575],[504,575],[503,602],[477,601],[477,614],[509,614],[510,629],[465,632],[465,644],[501,644],[502,663],[518,663],[518,644],[522,643],[522,629],[518,628],[518,616],[522,615],[522,601],[518,600],[519,588],[525,582],[534,586],[550,585],[551,581],[557,581],[557,586],[562,587],[562,601],[560,602],[561,605],[560,614],[563,615],[563,628],[560,629],[560,636],[562,638],[560,639],[560,642],[562,642],[561,662],[577,661],[578,643],[603,642],[600,639],[603,636],[613,638],[615,635]],"a":4975,"n":"教学楼A/B/C座","ic":"🏫","c":"learn","lx":540,"ly":551,"sub":[["A座",538,578],["B座",498,608],["C座",582,608]]},{"o":[[694,558],[697,557],[701,562],[694,563],[699,567],[697,571],[694,571],[694,580],[703,581],[702,579],[704,576],[718,576],[722,582],[720,590],[694,590],[694,640],[705,642],[697,651],[696,662],[700,670],[706,674],[718,676],[727,671],[732,662],[731,651],[721,641],[730,640],[730,575],[725,574],[725,570],[713,569],[713,571],[709,571],[706,568],[705,557],[710,556],[710,559],[713,559],[712,557],[715,559],[716,556],[716,559],[719,559],[719,556],[722,560],[726,561],[728,557],[735,556],[735,551],[718,546],[716,551],[710,551],[709,547],[695,547]],"a":3686,"n":"学生食堂 · 生活商业街","ic":"🍚","c":"life"},{"o":[[749,575],[802,576],[803,539],[750,538]],"a":1982,"n":"学生公寓2座","ic":"🛏","c":"life"},{"o":[[771,512],[774,515],[774,521],[780,521],[781,524],[825,524],[826,486],[771,486]],"a":2037,"n":"学生公寓3座","ic":"🛏","c":"life"},{"o":[[693,541],[734,541],[736,525],[747,521],[747,484],[693,484]],"a":2842,"n":"学生公寓4座","ic":"🛏","c":"life"},{"o":[[928,478],[938,479],[939,458],[928,458]],"a":217,"n":"学术交流中心A座","ic":"🏨","c":"learn"},{"o":[[844,477],[866,450],[859,451],[859,444],[864,446],[878,444],[880,449],[891,448],[893,450],[910,478],[917,470],[898,437],[873,436],[873,441],[866,441],[866,436],[864,436],[835,470]],"a":1091,"n":"菜鸟驿站","ic":"📦","c":"life"},{"o":[[365,429],[365,450],[374,451],[376,512],[380,530],[395,562],[451,534],[437,508],[436,430]],"a":7743,"n":"工科楼","ic":"🔧","c":"learn"},{"o":[[747,403],[746,408],[691,408],[690,472],[750,473],[750,420],[752,418],[768,418],[768,404]],"a":4121,"n":"学生公寓5座","ic":"🛏","c":"life"},{"o":[[782,401],[782,424],[770,428],[769,448],[772,451],[772,474],[818,472],[818,454],[830,452],[830,429],[837,418],[837,400]],"a":3910,"n":"学生公寓6座","ic":"🛏","c":"life"},{"o":[[596,478],[646,477],[645,412],[633,411],[632,382],[595,383]],"a":4431,"n":"体育馆","ic":"🏀","c":"sport","d":"室内篮球 / 羽毛球 / 乒乓球"},{"o":[[372,417],[391,417],[392,382],[421,381],[422,416],[441,416],[441,362],[372,362]],"a":2727,"n":"学生公寓9座","ic":"🛏","c":"life"},{"o":[[458,500],[476,501],[476,357],[458,356]],"a":2454,"n":"学生公寓8座","ic":"🛏","c":"life"},{"o":[[858,372],[852,374],[852,419],[905,420],[905,374],[931,373],[932,342],[858,342]],"a":4800,"n":"学生公寓7座","ic":"🛏","c":"life"},{"o":[[941,337],[940,392],[936,394],[920,393],[920,448],[961,448],[962,417],[982,415],[982,399],[991,398],[996,381],[996,355],[1006,354],[1007,337]],"a":6059,"c":"out"},{"o":[[0,344],[0,379],[31,362],[31,359],[40,353],[27,329]],"a":1184,"c":"out"},{"o":[[1048,291],[1049,292],[1045,295],[1021,292],[1017,292],[1017,298],[1050,304],[1052,293]],"a":281,"c":"out"},{"o":[[1027,288],[1030,279],[1038,283],[1040,279],[1044,279],[1046,274],[1037,270],[1037,266],[1022,264],[1020,279],[1022,280],[1025,279],[1027,284],[1018,287]],"a":351,"c":"out"},{"o":[[595,253],[652,263],[657,238],[599,227]],"a":1507,"c":"out"},{"o":[[519,240],[576,250],[581,225],[524,214]],"a":1499,"c":"out"},{"o":[[610,191],[651,198],[656,172],[616,164]],"a":1088,"c":"out"},{"o":[[555,181],[598,188],[603,163],[560,155]],"a":1143,"c":"out"},{"o":[[638,148],[656,151],[659,134],[641,130]],"a":324,"c":"out"},{"o":[[612,142],[630,145],[634,129],[616,125]],"a":316,"c":"out"},{"o":[[588,138],[606,142],[609,124],[591,121]],"a":322,"c":"out"},{"o":[[563,133],[580,136],[584,118],[566,115]],"a":322,"c":"out"},{"o":[[646,113],[663,117],[667,98],[649,94]],"a":351,"c":"out"},{"o":[[619,106],[637,109],[640,92],[622,88]],"a":318,"c":"out"},{"o":[[596,102],[613,105],[617,88],[599,85]],"a":318,"c":"out"},{"o":[[571,98],[589,102],[592,84],[574,81]],"a":322,"c":"out"},{"o":[[764,40],[766,56],[784,53],[782,37]],"a":290,"c":"out"},{"o":[[793,38],[795,53],[814,51],[812,35]],"a":296,"c":"out"},{"o":[[822,34],[827,50],[844,45],[841,29]],"a":294,"c":"out"},{"o":[[863,66],[865,62],[871,63],[871,68],[865,68],[869,72],[878,72],[878,77],[872,78],[883,92],[892,86],[900,94],[900,157],[916,157],[918,142],[930,142],[931,150],[947,150],[968,145],[1003,144],[1005,137],[1017,137],[1031,121],[1031,100],[968,101],[957,89],[946,98],[948,102],[946,104],[955,115],[954,124],[918,124],[916,94],[931,81],[943,97],[956,87],[904,23],[900,24],[902,27],[858,59]],"a":8768,"c":"out"},{"o":[[852,22],[862,35],[875,23],[865,11]],"a":280,"c":"out"},{"o":[[982,2],[1010,2],[1011,15],[982,16],[982,42],[1011,42],[1013,56],[982,57],[981,81],[1012,81],[1014,93],[1025,93],[1026,0],[982,0]],"a":2857,"c":"out"}],"road":[[[206,1007],[187,942],[164,747],[178,496]],[[239,446],[441,358],[479,351],[518,348],[691,383]],[[764,398],[832,405],[879,397],[1013,295],[1083,275],[1118,278]],[[278,1459],[316,1402],[318,1383],[282,1363],[236,1367],[188,1417],[183,1444],[191,1524],[229,1524]],[[484,671],[463,678],[452,697],[449,728],[471,786],[472,844],[417,966],[407,1026]],[[510,322],[432,333],[182,445]],[[765,745],[743,730],[682,628],[660,614],[580,625],[521,699]],[[551,308],[618,217],[625,184],[619,140],[632,118],[761,114]],[[412,1048],[433,1085],[463,1109],[523,1103],[564,1063],[617,937]],[[1106,1343],[1016,1281],[992,1223],[986,1155],[1022,1084]],[[708,360],[829,378],[868,372],[980,288]],[[166,818],[159,699],[168,525]],[[302,1461],[317,1434],[355,1416],[561,1346]],[[1322,833],[1351,843],[1373,908],[1236,1010]],[[983,67],[928,116],[969,169],[983,286]],[[1022,388],[1096,390],[1096,404],[1087,440],[1046,509],[1002,510]],[[1180,1018],[1202,979],[1265,916],[1316,900],[1307,840]],[[1001,510],[997,602],[970,673],[935,720]],[[1188,359],[1233,394],[1246,458],[1240,476],[1223,486],[1182,473]],[[866,1283],[884,1325],[966,1288],[984,1253],[981,1226]],[[983,66],[927,51],[792,103]],[[752,1335],[824,1229],[888,1231]],[[1138,19],[1139,210]],[[993,1178],[1027,1264],[1105,1322]],[[842,532],[759,532],[759,441]],[[1238,277],[1404,322]],[[199,1008],[168,842]],[[1238,277],[1405,302]],[[927,1034],[876,1057],[853,1041],[862,1011],[904,991]],[[1306,826],[1146,810]],[[1054,1088],[1140,1067],[1169,1043],[1179,1019]],[[740,1068],[754,1067],[775,1115],[766,1127],[747,1107],[739,1068]],[[0,556],[136,496]],[[928,441],[857,457],[843,532]],[[1022,387],[965,372],[942,393],[929,441]],[[698,860],[746,820],[764,782],[766,747]],[[279,1110],[272,1116],[249,1088],[200,1009]],[[1010,1093],[981,1156],[987,1225]],[[1099,868],[1115,881],[1131,993]],[[698,860],[664,859],[633,880],[620,897],[617,937]],[[539,490],[542,567],[570,611]],[[1159,1011],[1140,1043],[1052,1066]],[[866,1283],[822,1317],[753,1335]],[[279,1109],[238,1067],[206,1007]],[[1316,705],[1293,690],[1234,701],[1227,740]],[[556,329],[679,354]],[[1022,388],[1020,446],[998,447],[994,492]],[[827,622],[828,744]],[[984,1062],[943,1098],[913,1156]],[[986,1062],[1006,1088],[984,1122],[974,1167]],[[1156,122],[1155,3]],[[999,1213],[990,1166],[1015,1104]],[[993,1177],[1019,1108],[1054,1088]],[[1081,954],[1037,985],[978,999]],[[987,283],[1097,255]],[[94,1047],[199,1009]],[[165,637],[170,525]],[[937,496],[906,532],[843,532]]],"poi":[{"x":509,"y":588,"n":"康有为铜像","ic":"🗿","c":"other"},{"x":536,"y":458,"n":"田径场","ic":"🏃","c":"sport","track":[104,172]},{"x":429,"y":299,"n":"北门（桃园路）","ic":"🚪","c":"other","gate":1},{"x":739,"y":884,"n":"校内桥 · 南出口","ic":"🚪","c":"other","gate":1}]};

/** [[x,y],...] → SVG 路径（默认闭合） */
function ptPath(pts, close){
  if(!pts || pts.length < 2) return "";
  let d = "M" + pts[0][0] + " " + pts[0][1];
  for(let i = 1; i < pts.length; i++) d += "L" + pts[i][0] + " " + pts[i][1];
  return close === false ? d : d + "Z";
}
/** 多边形面积（m²） */
function polyArea(pts){
  let s = 0;
  for(let i = 0; i < pts.length; i++){
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s / 2);
}
/** 面积加权质心（比顶点平均更贴近楼体的"重心"，标签就用它） */
function polyCentroid(pts){
  let a = 0, cx = 0, cy = 0;
  for(let i = 0; i < pts.length; i++){
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const f = p[0] * q[1] - q[0] * p[1];
    a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f;
  }
  if(Math.abs(a) < 1e-6){
    const n = pts.length || 1;
    return { x: pts.reduce((t, p) => t + p[0], 0) / n, y: pts.reduce((t, p) => t + p[1], 0) / n };
  }
  a *= 3;
  return { x: cx / a, y: cy / a };
}
function pointInPoly(pt, poly){
  let inside = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if(((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
/** 楼名/角标的落点：面积质心若落在楼体之外（凹形楼很常见），
    改用「离楼体边界最远的内部点」—— 保证文字永远压在这栋楼上 */
function polyLabel(pts){
  const c = polyCentroid(pts);
  if(pointInPoly(c, pts)) return { x: c.x, y: c.y };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for(const p of pts){
    if(p[0] < x0) x0 = p[0];
    if(p[0] > x1) x1 = p[0];
    if(p[1] < y0) y0 = p[1];
    if(p[1] > y1) y1 = p[1];
  }
  let best = null, bestD = -1;
  const N = 20;
  for(let i = 1; i < N; i++){
    for(let j = 1; j < N; j++){
      const pt = { x: x0 + (x1 - x0) * i / N, y: y0 + (y1 - y0) * j / N };
      if(!pointInPoly(pt, pts)) continue;
      const d = distToPoly(pt, pts);
      if(d > bestD){ bestD = d; best = pt; }
    }
  }
  return best || { x: c.x, y: c.y };
}

/** 点到线段距离（米），用于"我离哪栋楼近" */
function distToPoly(pt, poly){
  let best = Infinity;
  for(let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((pt.x - a[0]) * dx + (pt.y - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + t * dx, py = a[1] + t * dy;
    best = Math.min(best, Math.hypot(pt.x - px, pt.y - py));
  }
  return best;
}
/** 折线长度（米） */
function lineLen(pts){
  let t = 0;
  for(let i = 1; i < pts.length; i++) t += Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]);
  return t;
}

/* ---------- 取景框（米制矩形；null = 全景） ---------- */
/* ---------- 只画校园界内：校外建筑扔掉、校外道路裁掉 ---------- */
let CAM_ROAD_LEN0 = null;      // 裁剪后每条路的「原来长度」，用来定路宽分级
const CAM_CUT = (() => {
  const CP = GEO_M.campus;
  const inC = p => pointInPoly(p, CP);
  const bboxOf = pts => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for(const p of pts){
      if(p[0] < x0) x0 = p[0];  if(p[0] > x1) x1 = p[0];
      if(p[1] < y0) y0 = p[1];  if(p[1] > y1) y1 = p[1];
    }
    return [x0, y0, x1, y1];
  };
  const segCross = (a, b, c, d) => {
    const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
    return ((cr(c, d, a) > 0) !== (cr(c, d, b) > 0)) &&
           ((cr(a, b, c) > 0) !== (cr(a, b, d) > 0));
  };
  /** 多边形有多少落在校园里（0 = 完全在外） */
  function inRatio(poly){
    const n = poly.length;
    let vin = 0;
    for(const p of poly) if(inC(p)) vin++;
    const r = vin / n;
    if(r >= .34) return r;
    let cx = 0, cy = 0;
    for(const p of poly){ cx += p[0]; cy += p[1]; }
    if(inC({ x: cx / n, y: cy / n })) return 1;
    const a = bboxOf(poly), b = bboxOf(CP);
    if(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]) return r;
    for(let i = 0; i < n; i++){
      const p1 = poly[i], p2 = poly[(i + 1) % n];
      for(let j = 0; j < CP.length; j++)
        if(segCross(p1, p2, CP[j], CP[(j + 1) % CP.length])) return .5;
    }
    return r;
  }
  /** 线段裁到校园内 → 若干子段（凹多边形也正确） */
  function clipSeg(P, Q){
    const dx = Q[0] - P[0], dy = Q[1] - P[1];
    if(!dx && !dy) return [];
    const ts = [0, 1];
    for(let j = 0; j < CP.length; j++){
      const A = CP[j], B = CP[(j + 1) % CP.length];
      const ex = B[0] - A[0], ey = B[1] - A[1];
      const det = dy * ex - dx * ey;
      if(Math.abs(det) < 1e-9) continue;
      const wx = A[0] - P[0], wy = A[1] - P[1];
      const t = (ex * wy - ey * wx) / det;
      const u = (dx * wy - dy * wx) / det;
      if(t > 1e-6 && t < 1 - 1e-6 && u > -1e-6 && u < 1 + 1e-6) ts.push(t);
    }
    ts.sort((a, b) => a - b);
    const out = [];
    for(let i = 0; i + 1 < ts.length; i++){
      const t0 = ts[i], t1 = ts[i + 1];
      if(t1 - t0 < 1e-7) continue;
      const tm = (t0 + t1) / 2;
      if(!inC({ x: P[0] + dx * tm, y: P[1] + dy * tm })) continue;
      out.push([[+(P[0] + dx * t0).toFixed(1), +(P[1] + dy * t0).toFixed(1)],
                [+(P[0] + dx * t1).toFixed(1), +(P[1] + dy * t1).toFixed(1)]]);
    }
    return out;
  }

  const b0 = GEO_M.building.length;
  GEO_M.building = GEO_M.building.filter(b => inRatio(b.o) >= .34);

  const r0 = GEO_M.road.length, lens = [], kept = [];
  GEO_M.road.forEach(line => {
    const raw0 = lineLen(line);
    const segs = [];
    for(let i = 0; i + 1 < line.length; i++) segs.push(...clipSeg(line[i], line[i + 1]));
    if(!segs.length) return;
    const chains = [];
    for(const sg of segs){
      const last = chains[chains.length - 1];
      if(last && Math.hypot(last[last.length - 1][0] - sg[0][0],
                            last[last.length - 1][1] - sg[0][1]) < .8) last.push(sg[1]);
      else chains.push([sg[0], sg[1]]);
    }
    for(const c of chains){
      if(lineLen(c) < 4) continue;
      kept.push(c); lens.push(raw0);
    }
  });
  GEO_M.road = kept; CAM_ROAD_LEN0 = lens;

  const w0 = GEO_M.water.length, g0 = GEO_M.green.length;
  GEO_M.water = GEO_M.water.filter(w => inRatio(w.o) > 0);
  GEO_M.green = GEO_M.green.filter(g => inRatio(g.o) > 0);

  // 校门本来就贴在界上，投影到最近的校园边界点，免得标记飘到界外
  GEO_M.poi.forEach(p => {
    if(inC(p)) return;
    let best = Infinity, bx = p.x, by = p.y;
    for(let j = 0; j < CP.length; j++){
      const A = CP[j], B = CP[(j + 1) % CP.length];
      const ex = B[0] - A[0], ey = B[1] - A[1], L2 = ex * ex + ey * ey || 1;
      let t = ((p.x - A[0]) * ex + (p.y - A[1]) * ey) / L2;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      const d = Math.hypot(p.x - (A[0] + t * ex), p.y - (A[1] + t * ey));
      if(d < best){ best = d; bx = A[0] + t * ex; by = A[1] + t * ey; }
    }
    p.x = +bx.toFixed(1); p.y = +by.toFixed(1);
  });

  return { 建筑: b0 + "→" + GEO_M.building.length,
           道路: r0 + "→" + GEO_M.road.length,
           水面: w0 + "→" + GEO_M.water.length,
           绿地: g0 + "→" + GEO_M.green.length };
})();

/* 田径场外形（胶囊形）：既当占位体让道路绕开，也用来拦住树木 */
const CAM_TRACK = (() => {
  const tk = GEO_M.poi.find(p => p.track);
  if(!tk) return null;
  const [w, h] = tk.track, r = w / 2, cx = tk.x, cy = tk.y;
  const top = cy - h / 2 + r, bot = cy + h / 2 - r;
  const poly = [];
  for(let a = 180; a <= 360; a += 20)
    poly.push([+(cx + r * Math.cos(a * Math.PI / 180)).toFixed(1),
               +(top + r * Math.sin(a * Math.PI / 180)).toFixed(1)]);
  for(let a = 0; a <= 180; a += 20)
    poly.push([+(cx + r * Math.cos(a * Math.PI / 180)).toFixed(1),
               +(bot + r * Math.sin(a * Math.PI / 180)).toFixed(1)]);
  return { poi: tk, poly };
})();

const CAM_VIEWS = {
  all:    { x: 245, y: 245, w: 750, h: 750 },
  campus: { x: 275, y: 275, w: 690, h: 690 },
  learn:  { x: 388, y: 468, w: 384, h: 384 },
  sport:  { x: 398, y: 340, w: 304, h: 304 },
  life:   { x: 688, y: 358, w: 324, h: 324 },
};
let camView = CAM_VIEWS.all;
let camCat = null;      // 图例筛选：只看某一类建筑
let CAM_SCALE_PX = 1;   // 1 米 ≈ 多少屏幕像素（camSvg 每帧刷新）
function camViewRect(){
  const V = GEO_M.view;
  return camView || { x: 0, y: 0, w: V, h: V };
}
/** 比例尺：挑一个整数米数，让它约占当前视角宽度的 22% */
function camScaleBar(v, ts){
  const targetM = 0.22 * v.w;
  const nice = [10, 20, 25, 50, 75, 100, 150, 200, 300, 500];
  let m = nice[0];
  for(const n of nice) if(n <= targetM) m = n;
  const u = m, x0 = v.x + v.w - u - 20 * ts, y0 = v.y + v.h - 26 * ts;
  return `<g>
    <rect x="${x0 - 9 * ts}" y="${y0 - 18 * ts}" width="${u + 18 * ts}" height="${30 * ts}" rx="${8 * ts}"
      fill="var(--m-zone)" opacity=".92"/>
    <rect x="${x0}" y="${y0 + 5 * ts}" width="${u}" height="${3 * ts}" fill="var(--m-sub)"/>
    <rect x="${x0}" y="${y0}" width="${2.5 * ts}" height="${11 * ts}" fill="var(--m-sub)"/>
    <rect x="${x0 + u - 2.5 * ts}" y="${y0}" width="${2.5 * ts}" height="${11 * ts}" fill="var(--m-sub)"/>
    <text x="${x0 + u / 2}" y="${y0 - 4 * ts}" text-anchor="middle" font-size="${10 * ts}" font-weight="800"
      fill="var(--m-sub)" paint-order="stroke" stroke="var(--m-zone)" stroke-width="${3 * ts}">${m} m</text>
  </g>`;
}

/* ---------- 各楼栋的文字资料 ---------- */
const PLACE_INFO = {
  "图书馆": {
    d: "教学楼西侧那栋带蓝色屋顶的大楼，地上 5 层 + 负一层，约 1800 个座位，有独立自习室；一楼有打印室。",
    f: "课表之外的多数自习时间最后都交代在这里 —— 有空调、有插座、还有能趴着睡的沙发。",
  },
  "信息楼": {
    d: "教学楼 C 座的东侧、图书馆斜对面，内设大型阶梯教室和计算机室 —— 上机课、级会、讲座多半安排在这栋。",
    f: "机房在这里，期末上机考试前一天来熟悉一下环境不亏。",
  },
  "教学楼A/B/C座": {
    d: "教学楼一共三栋，围着康有为铜像呈 U 形排开：北面是 A 座，西侧是 B 座，东侧是 C 座。课表上的「教A / 教B / 教C」就是这三栋 —— 教室号首字母告诉你是在哪一栋。",
    f: "从宿舍去教学楼最省太阳的走法：先穿过东侧生活区边缘的路，再切进 C 座，能少晒大半段。",
  },
  "工科楼": {
    d: "工科类专业的实验与教学用房，靠校园西北、紧邻田径场。",
  },
  "人工智能学院": {
    d: "人工智能学院的院楼，与工科楼连成一片，在校园西侧。",
  },
  "商科楼": {
    d: "国际商学院（International Business College）的院楼，课表里「商B301 / 商C404 / 商C504」都是这里。辅导员办公室也在这栋楼里。",
    f: "商科楼在校园西南角、紧挨校内桥 —— 从宿舍过来是全校最远的一段路，赶早八要留够时间。",
  },
  "体育馆": {
    d: "室内篮球场、羽毛球场、乒乓球室、跆拳道室都在里面，迎新晚会等大型活动也在这里办。",
  },
  "学生活动中心": {
    d: "校区团工委、学生会、社联、青协等学生组织的办公点，二楼有多功能会议室。",
  },
  "学生食堂 · 生活商业街": {
    d: "食堂 + 商业街连成一片：一楼风味窗口（烧腊卤味、煎扒饭、煲仔饭、麻辣烫、粉面、糖水炖品），二楼自选，还有西饼屋；商业街以食品和日用品为主，可以叫外卖。",
    f: "华师素有「华南吃饭大学」之称，这里是南海校区的门面 —— 冬天限定煲仔菜别错过。",
  },
  "菜鸟驿站": {
    d: "取快递的地方，就在学生公寓 7、8 座南侧。",
  },
  "北斗研究院": {
    d: "北斗研究院，位于校园中轴南端、图书馆与商科楼之间。",
  },
  "学术交流中心A座": {
    d: "学术交流中心 A 座，靠万锦路一侧，是校园东南角的接待与会务用房。",
  },
  "学术交流中心B座": {
    d: "学术交流中心 B 座，紧邻学生活动中心，带停车场。",
  },
};
const DORM_INFO = {
  "学生公寓1座": "靠近生活商业街，楼下就是食堂和超市，最方便的一栋。",
  "学生公寓2座": "与 1 座、3 座相邻，同属生活区南段。",
  "学生公寓3座": "生活区中段，去食堂、商业街都在三五分钟。",
  "学生公寓4座": "生活区中段，紧邻校园二路，去教学楼方向最近。",
  "学生公寓5座": "生活区北段，靠近北门与体育馆。",
  "学生公寓6座": "生活区北段，和 5 座、7 座排在一起。",
  "学生公寓7座": "生活区最北端，紧邻北门，出门就是桃园路。",
  "学生公寓8座": "北侧公寓群的一员，旁边是菜鸟驿站。",
  "学生公寓9座": "校园西北角，紧邻工科楼和操场 —— 去上课方便，去食堂最远。",
};

/* ---------- 可点选的地点：真实轮廓建筑 + 点状地标 ---------- */
const CAM_DRAWN = new Set();     // 已被正式命名地点收编的建筑索引
const CAMPUS_PLACES = (() => {
  const out = [];
  const campus = GEO_M.campus;
  const seen = new Set();        // 同名楼只取面积最大的那块（OSM 里有的楼被切成两个多边形）
  GEO_M.building.forEach((b, i) => {
    if(!b.n || seen.has(b.n)) return;
    seen.add(b.n);
    CAM_DRAWN.add(i);
    const c = polyLabel(b.o);
    const info = PLACE_INFO[b.n] || {};
    const dorm = DORM_INFO[b.n];
    out.push({
      id: "g" + i, kind: "poly", name: b.n, icon: b.ic, cat: b.c,
      poly: b.o, area: b.a || polyArea(b.o), cx: c.x, cy: c.y,
      inCampus: pointInPoly({ x: c.x, y: c.y }, campus),
      lx: b.lx, ly: b.ly, sub: b.sub,
      desc: b.d || info.d || dorm || "校园里的常规用房。",
      fun: info.f || "",
      match: (b.n.indexOf("教学楼") === 0) ? ["教A", "教B", "教C"] :
             (b.n.indexOf("商科楼") === 0) ? ["商"] : [],
    });
  });
  GEO_M.poi.forEach((p, i) => {
    out.push({
      id: "p" + i, kind: p.track ? "track" : "dot", name: p.n, icon: p.ic, cat: p.c,
      x: p.x, y: p.y, cx: p.x, cy: p.y, track: p.track, gate: p.gate,
      inCampus: true,
      desc: p.n === "田径场"
        ? "400 米标准跑道 + 内场足球场（卫星影像实测外廓约 " + p.track[0] + "×" + p.track[1] + " m，南北向）。升旗、军训、体测和早锻都在这里。"
        : (p.n === "康有为铜像" ? "立在 A、B、C 三栋教学楼围成的广场中央，这一带因此被叫作「康有为广场」。"
           : (p.gate ? "校门。门口有公交站，去地铁广佛线祖庙站、坑口方向都在这里上车。" : "校园里的室外场地。")),
      fun: "",
      match: p.n.indexOf("篮球") >= 0 ? ["篮球场", "球场"] : [],
    });
  });
  return out;
})();
const CAMPUS_BY_ID = Object.fromEntries(CAMPUS_PLACES.map(p => [p.id, p]));

/** 校园内、但没有正式名称的用房：只画轮廓，不参与点选，用来填满地图细节 */
const CAM_FILLERS = (() => {
  const campus = GEO_M.campus, out = [];
  GEO_M.building.forEach((b, i) => {
    if(CAM_DRAWN.has(i)) return;
    const c = polyLabel(b.o);
    if(!pointInPoly({ x: c.x, y: c.y }, campus)) return;
    if((b.a || polyArea(b.o)) < 210) return;
    out.push(b.o);
  });
  return out;
})();

const CAM_LEGEND = [
  { cat: "learn", name: "教学 / 办公", color: "#7ea9f2" },
  { cat: "sport", name: "运动场地",   color: "#6fc481" },
  { cat: "life",  name: "生活 / 公寓", color: "#eeb166" },
  { cat: "other", name: "其他用房",   color: "#c2ccd8" },
  { name: "水面 · 黄迳洞水库", color: "#aed6ef" },
  { name: "林地草坡",   color: "#9ec98d" },
];

const CAM_NOTES = [
  { i: "🖥", t: "上机课在信息楼", d: "教学楼 C 座东侧那栋，大型阶梯教室和机房都在这儿，级会也常在这开。" },
  { i: "🍚", t: "食堂 + 商业街", d: "一楼风味窗口 + 西饼屋，商业街可以叫外卖（要加配送费）。" },
  { i: "🏀", t: "体育馆是全能选手", d: "室内篮球、羽毛球、乒乓球、跆拳道室都在里面，迎新晚会也在这办。" },
  { i: "🛏", t: "公寓从 1 排到 9", d: "官方编号是 A — H 栋：1 座 = A 栋、3 座 = C 栋，依次往后。1 — 3 座靠南挨着食堂，4 — 6 座居中，7 — 9 座在北侧靠北门。" },
  { i: "⏱", t: "校区小到能多睡一会儿", d: "校园东西不到 600 m，从最远的商科楼走到最北的公寓 7 座也就十分钟出头。" },
  { i: "🗿", t: "康有为铜像", d: "立在 A、B、C 三栋教学楼围成的广场中央，这一小片空地因此被叫作「康有为广场」。" },
  { i: "🌊", t: "三面环水不是虚的", d: "校园西南是黄迳洞水库，南边和东边被河涌围着，只有北侧桃园路是「陆地出口」。" },
  { i: "🚌", t: "出门的公交", d: "北门外就是「华南师范大学北门」公交站，桃园路从校区北侧经过（校外的路图上没画）。" },
  { i: "🚪", t: "校内桥", d: "校园南侧跨河的那座桥，通万锦路和学院市集，是去依云小镇最近的路。" },
  { i: "🧭", t: "今日路线怎么用", d: "点地图上方的「今日路线」，会按今天上课顺序从你的宿舍出发、下课再回宿舍画一条线，线路自动绕开楼体和操场；宿舍楼和是否往返都能在下面那一条里改。" },
];

let camScope="week", camSel=null, camOnlyMine=false, camRouteOn=false, camQ="";
let camDormName = "学生公寓3座";     // 我的宿舍（路线起点 / 返校终点）
let camRouteBack = true;             // 下课后是否回宿舍
let CAM_TRIP_CACHE = null;           // 今日行程折线缓存（按站点序列）

function camSessions(){
  const w=state.viewWeek;
  if(camScope==="all") return DATA.sessions.slice();
  // 本周口径：只算本周真正要上的课（法定假期当天的课不上，不计入）
  return DATA.sessions.filter(s=> activeIn(s,w) && dayKind(w, s.day-1).kind!=="holiday");
}
/** 教室号 → 楼栋 id（按前缀匹配，例如 教A207 → 教学楼 A 座） */
function placeOfRoom(room){
  const r=String(room||"").replace(/\s|（.*?）|\(.*?\)/g,"");
  if(!r) return null;
  const p=CAMPUS_PLACES.find(p=> (p.match||[]).some(m=> r.startsWith(m)));
  return p ? p.id : null;
}
function camPlace(id){ return CAMPUS_PLACES.find(p=>p.id===id) || null; }
function camCenter(p){ return {x:p.cx, y:p.cy}; }
/** { 楼栋id: [session...] } */
function camMine(){
  const m={};
  camSessions().forEach(s=>{ const pid=placeOfRoom(s.room); if(!pid) return; (m[pid]=m[pid]||[]).push(s); });
  return m;
}
function camTodayRoute(){
  const today=new Date(), w=weekOfDate(today), d=(today.getDay()+6)%7+1;
  const list=DATA.sessions.filter(s=>s.day===d && activeIn(s,w) && !isLeave(s.id,w)).sort((a,b)=>a.from-b.from);
  const seq=[]; let last=null;
  list.forEach(s=>{ const pid=placeOfRoom(s.room); if(pid && pid!==last){ seq.push(pid); last=pid; } });
  return seq;
}

/** 我的宿舍 */
function camDormPlace(){ return CAMPUS_PLACES.find(p=>p.name===camDormName) || null; }
/** 可作为出发地的宿舍楼 */
function camDorms(){ return CAMPUS_PLACES.filter(p=>/^学生公寓\d座$/.test(p.name)); }

/** 今日完整行程：宿舍（出发）→ 依次要去的楼 → 宿舍（返校） */
function camTrip(){
  const stops = camTodayRoute().map(camPlace).filter(Boolean);
  const dorm  = camDormPlace();
  const out = [];
  if(dorm) out.push({ p: dorm, tag: "出发" });
  stops.forEach(p=>{
    const last = out[out.length-1];
    if(last && last.p === p) return;          // 连着两节在同一栋楼，不重复画
    out.push({ p, tag: "" });
  });
  if(camRouteBack && dorm && stops.length){
    const last = out[out.length-1];
    if(!last || last.p !== dorm) out.push({ p: dorm, tag: "返校" });
  }
  return out;
}
/* ---------- 步行路径规划：栅格 A*，绕开楼体与田径场 ----------
   原来「两个楼心直连、挡住就插一个折点」的画法，在两栋宿舍之间（甚至横穿跑道）
   根本绕不开 —— 折线会直接从别的楼里穿过去。现在改成：
     1) 把校园内所有建筑轮廓 + 田径场栅格化成 5 m 的通行图（贴墙 1.4 m 一律不通）；
     2) 每段行程用 A* 在空闲格子上找路（压着路网走更「顺脚」）；
     3) 把栅格锯齿用「能一眼看到就跳过中间点」的方式拉直；
     4) 两端各接一小段「门口点 → 楼心」，所以线只进出发/到达那栋楼，不碰别的楼。
   路网与结果都缓存，切视角不会重算。                                    */

/** 路径规划用的占位体：校园内全部建筑轮廓（含没名字的小房）+ 田径场 */
const CAM_PATH_SOLIDS = (() => {
  const out = [];
  GEO_M.building.forEach(b => {
    if(!pointInPoly(polyLabel(b.o), GEO_M.campus)) return;
    out.push({ poly: b.o, bb: polyBBox(b.o) });
  });
  if(CAM_TRACK) out.push({ poly: CAM_TRACK.poly, bb: polyBBox(CAM_TRACK.poly) });
  return out;
})();
/** 点落在哪个「路径占位体」里（没有则 null） */
function hitPathSolid(pt){
  for(const s of CAM_PATH_SOLIDS) if(inSolidAt(pt, s)) return s;
  return null;
}
/** 线段是否一路干净（离所有楼体 ≥ clear 米）；allow 里的楼允许压着走（出发/到达那栋） */
function camSegClear(p, q, clear, allow){
  const L = Math.hypot(q.x - p.x, q.y - p.y);
  const n = Math.max(1, Math.ceil(L / 1.8));
  for(let k = 0; k <= n; k++){
    const pt = { x: p.x + (q.x - p.x) * k / n, y: p.y + (q.y - p.y) * k / n };
    for(const s of CAM_PATH_SOLIDS){
      if(allow && allow.has(s)) continue;
      const b = s.bb;
      if(pt.x < b[0] - clear || pt.x > b[2] + clear || pt.y < b[1] - clear || pt.y > b[3] + clear) continue;
      if(pointInPoly(pt, s.poly)) return false;
      if(clear > 0 && distToPoly(pt, s.poly) < clear) return false;
    }
  }
  return true;
}
/** 5 m 通行图：楼里/贴墙 → 不可走；压在路上 → 代价低一点 */
const CAM_GRID = (() => {
  const CELL = 5, CLR = 1.4, PAD = 10, RR = 9, R2 = RR * RR;
  const bb = polyBBox(GEO_M.campus);
  const x0 = bb[0] - PAD, y0 = bb[1] - PAD;
  const w = Math.ceil((bb[2] - bb[0] + PAD * 2) / CELL) + 1;
  const h = Math.ceil((bb[3] - bb[1] + PAD * 2) / CELL) + 1;
  const blocked = new Uint8Array(w * h), road = new Uint8Array(w * h);
  for(const s of CAM_PATH_SOLIDS){
    const b = s.bb;
    const gx0 = Math.max(0, Math.floor((b[0] - CLR - x0) / CELL)), gx1 = Math.min(w - 1, Math.ceil((b[2] + CLR - x0) / CELL));
    const gy0 = Math.max(0, Math.floor((b[1] - CLR - y0) / CELL)), gy1 = Math.min(h - 1, Math.ceil((b[3] + CLR - y0) / CELL));
    for(let gy = gy0; gy <= gy1; gy++)
      for(let gx = gx0; gx <= gx1; gx++){
        const i = gy * w + gx;
        if(blocked[i]) continue;
        const pt = { x: x0 + (gx + .5) * CELL, y: y0 + (gy + .5) * CELL };
        if(pointInPoly(pt, s.poly) || distToPoly(pt, s.poly) < CLR) blocked[i] = 1;
      }
  }
  for(const line of GEO_M.road){
    for(let k = 0; k + 1 < line.length; k++){
      const a = line[k], b = line[k + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.ceil(L / 2));
      for(let t = 0; t <= n; t++){
        const px = a[0] + (b[0] - a[0]) * t / n, py = a[1] + (b[1] - a[1]) * t / n;
        const gx0 = Math.max(0, Math.floor((px - RR - x0) / CELL)), gx1 = Math.min(w - 1, Math.floor((px + RR - x0) / CELL));
        const gy0 = Math.max(0, Math.floor((py - RR - y0) / CELL)), gy1 = Math.min(h - 1, Math.floor((py + RR - y0) / CELL));
        for(let gy = gy0; gy <= gy1; gy++)
          for(let gx = gx0; gx <= gx1; gx++){
            const qx = x0 + (gx + .5) * CELL, qy = y0 + (gy + .5) * CELL;
            if((qx - px) * (qx - px) + (qy - py) * (qy - py) <= R2) road[gy * w + gx] = 1;
          }
      }
    }
  }
  return { CELL, w, h, x0, y0, blocked, road };
})();
function camCellFree(gx, gy){
  const G = CAM_GRID;
  return gx >= 0 && gy >= 0 && gx < G.w && gy < G.h && !G.blocked[gy * G.w + gx];
}
/** 找「门口点」：干净的格点，且从楼心走过去只穿过自己这栋楼；toward = 想去的那头 */
function camDoor(cx, cy, toward, own){
  const G = CAM_GRID, R = 24;                       // 搜索半径 ≈ 120 m
  const gx0 = Math.floor((cx - G.x0) / G.CELL), gy0 = Math.floor((cy - G.y0) / G.CELL);
  const cand = [];
  for(let dy = -R; dy <= R; dy++)
    for(let dx = -R; dx <= R; dx++){
      const gx = gx0 + dx, gy = gy0 + dy;
      if(!camCellFree(gx, gy)) continue;
      const x = G.x0 + (gx + .5) * G.CELL, y = G.y0 + (gy + .5) * G.CELL;
      cand.push({ x, y, k: Math.hypot(x - cx, y - cy) + (toward ? Math.hypot(x - toward.x, y - toward.y) * .9 : 0) });
    }
  cand.sort((a, b) => a.k - b.k);
  const allow = own ? new Set([own]) : null, from = { x: cx, y: cy };
  for(let i = 0; i < cand.length && i < 200; i++)
    if(camSegClear(from, cand[i], .6, allow)) return [cand[i].x, cand[i].y];
  return cand.length ? [cand[0].x, cand[0].y] : [cx, cy];
}
/** 栅格 A*：返回一串坐标（米），首尾就是传入的两个点 */
function camAstar(A, B){
  const G = CAM_GRID, W = G.w, H = G.h, N = W * H, CELL = G.CELL;
  const cl = (v, hi) => v < 0 ? 0 : (v > hi ? hi : v);
  const sx = cl(Math.floor((A[0] - G.x0) / CELL), W - 1), sy = cl(Math.floor((A[1] - G.y0) / CELL), H - 1);
  const tx = cl(Math.floor((B[0] - G.x0) / CELL), W - 1), ty = cl(Math.floor((B[1] - G.y0) / CELL), H - 1);
  const sI = sy * W + sx, tI = ty * W + tx;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  const hk = new Float64Array(N * 6), hv = new Int32Array(N * 6);
  let hn = 0;
  const push = (k, i) => {
    let n = hn++; hk[n] = k; hv[n] = i;
    while(n > 0){ const p = (n - 1) >> 1; if(hk[p] <= hk[n]) break;
      const a = hk[p], b = hv[p]; hk[p] = hk[n]; hv[p] = hv[n]; hk[n] = a; hv[n] = b; n = p; }
  };
  const pop = () => {
    const top = hv[0]; hn--;
    if(hn > 0){
      hk[0] = hk[hn]; hv[0] = hv[hn];
      let n = 0;
      for(;;){ const l = n * 2 + 1, r = l + 1; let m = n;
        if(l < hn && hk[l] < hk[m]) m = l;
        if(r < hn && hk[r] < hk[m]) m = r;
        if(m === n) break;
        const a = hk[m], b = hv[m]; hk[m] = hk[n]; hv[m] = hv[n]; hk[n] = a; hv[n] = b; n = m; }
    }
    return top;
  };
  const hAt = i => {
    const gx = i % W, gy = (i - gx) / W;
    const dx = Math.abs(gx - tx), dy = Math.abs(gy - ty);
    return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  dist[sI] = 0; push(hAt(sI), sI);
  const NB = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
  while(hn){
    const cur = pop();
    if(done[cur]) continue;
    done[cur] = 1;
    if(cur === tI) break;
    const cx = cur % W, cy = (cur - cx) / W;
    const base = G.road[cur] ? 1 : 1.16;            // 离开路网稍微加点代价 → 贴着路走
    for(let k = 0; k < 8; k++){
      const dx = NB[k][0], dy = NB[k][1], nx = cx + dx, ny = cy + dy;
      if(nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if(G.blocked[ni] || done[ni]) continue;
      if(dx && dy && (!camCellFree(cx + dx, cy) || !camCellFree(cx, cy + dy))) continue;   // 不许切墙角
      const nd = dist[cur] + NB[k][2] * base;
      if(nd < dist[ni] - 1e-9){ dist[ni] = nd; prev[ni] = cur; push(nd + hAt(ni), ni); }
    }
  }
  if(!isFinite(dist[tI])) return [A, B];
  const cells = [];
  for(let i = tI; i !== -1; i = prev[i]) cells.push(i);
  cells.reverse();
  const out = [[A[0], A[1]]];
  for(const i of cells){
    const gx = i % W, gy = (i - gx) / W;
    out.push([G.x0 + (gx + .5) * CELL, G.y0 + (gy + .5) * CELL]);
  }
  out.push([B[0], B[1]]);
  return out;
}
/** 拉直：能一眼看到（中间不穿楼）就跳过中间那些格子，把锯齿抹平 */
function camSimplify(line, clear){
  if(line.length < 3) return line;
  const out = [line[0]], MAXJ = 16;
  let i = 0;
  while(i < line.length - 1){
    const hi = Math.min(line.length - 1, i + MAXJ);
    let j = hi;
    for(; j > i + 1; j--)
      if(camSegClear({ x: line[i][0], y: line[i][1] }, { x: line[j][0], y: line[j][1] }, clear, null)) break;
    out.push(line[j]);
    i = j;
  }
  return out;
}
/** 一段行程：楼心 → 门口 → A* → 门口 → 楼心 */
function camLeg(a, b){
  const A = { x: a.cx, y: a.cy }, B = { x: b.cx, y: b.cy };
  const dA = camDoor(A.x, A.y, B, hitPathSolid(A));
  const dB = camDoor(B.x, B.y, A, hitPathSolid(B));
  const pts = [], add = (x, y) => {
    const l = pts[pts.length - 1];
    if(l && Math.hypot(l[0] - x, l[1] - y) < 1.5) return;
    pts.push([+x.toFixed(1), +y.toFixed(1)]);
  };
  add(A.x, A.y);
  for(const p of camSimplify(camAstar(dA, dB), 1.0)) add(p[0], p[1]);
  add(B.x, B.y);
  return pts.length > 1 ? pts : [[A.x, A.y], [B.x, B.y]];
}
/** 今日行程的全部折线（按站点序列缓存） */
function camTripLines(){
  const trip = camTrip();
  const key = trip.map(t => t.p.id).join("|");
  if(CAM_TRIP_CACHE && CAM_TRIP_CACHE.key === key) return CAM_TRIP_CACHE.lines;
  const lines = [];
  for(let i = 1; i < trip.length; i++) lines.push(camLeg(trip[i-1].p, trip[i].p));
  CAM_TRIP_CACHE = { key, lines };
  return lines;
}
/** 行程分段：每段真实步行距离（米）+ 全程 */
function camTripStats(){
  const trip = camTrip(), lines = camTripLines(), legs = [];
  let total = 0;
  for(let i = 1; i < trip.length; i++){
    const a = trip[i-1].p, b = trip[i].p;
    const l = lines[i-1] || [[a.cx, a.cy], [b.cx, b.cy]];
    const d = lineLen(l);
    legs.push({ a, b, d });
    total += d;
  }
  return { trip, legs, total };
}

/** 今日上课路线（宿舍 → 各栋楼 → 宿舍，带序号，绕开楼体） */
function camRouteSvg(FP){
  if(!camRouteOn) return "";
  const trip = camTrip();
  if(trip.length < 2) return "";
  const d = camTripLines().map(l => ptPath(l, false)).join(" ");
  let no = 0;
  const marks = trip.map(t=>{
    const x = t.p.cx;
    // 楼名画在 (cx, cy)；标记往上挪一点，免得盖住楼名（教学楼的名字是外置标注，不用挪）
    const y = (t.p.ly != null) ? t.p.cy : t.p.cy - FP(28);
    if(t.tag){
      return `<g class="rmark"><circle cx="${x}" cy="${y}" r="${FP(9.5)}"/>
        <text x="${x}" y="${y + FP(3.4)}" text-anchor="middle" font-size="${FP(9.6)}">🏠</text></g>`;
    }
    no++;
    return `<g class="rmark"><circle cx="${x}" cy="${y}" r="${FP(7)}"/>
      <text x="${x}" y="${y + FP(3.6)}" text-anchor="middle" font-size="${FP(8.8)}"
        font-weight="800" fill="#fff">${no}</text></g>`;
  }).join("");
  return `<g class="route">
    <path class="rcase" style="stroke-width:${FP(6.6)}" d="${d}"/>
    <path class="rline" style="stroke-width:${FP(3.4)}" d="${d}"/>
    ${marks}
  </g>`;
}

/** 建筑的"屏幕尺度"（屏幕上大约多少像素宽） —— 决定要不要写名字 */
function camScreenSize(p, FP){
  return Math.sqrt(p.area || 1) * CAM_SCALE_PX;
}

/** 画一栋楼：真实轮廓多边形 + 标签 */
/** 多边形包围盒 */
function polyBBox(pts){
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for(const p of pts){
    if(p[0] < x0) x0 = p[0]; if(p[0] > x1) x1 = p[0];
    if(p[1] < y0) y0 = p[1]; if(p[1] > y1) y1 = p[1];
  }
  return [x0, y0, x1, y1];
}

/** 地图 defs：类别渐变（顶面高光 → 本体）、水面渐变、草地渐变、地面径向渐变、波纹与铺装图案 */
function camDefs(FP){
  const cats = ["learn", "sport", "life", "other"];
  const grads = cats.map(c => `<linearGradient id="cg-${c}" x1="0" y1="0" x2=".82" y2="1">
      <stop offset="0" stop-color="var(--m-${c}-hi)"/><stop offset="1" stop-color="var(--m-${c})"/>
    </linearGradient>`).join("");
  return `<defs>${grads}
    <linearGradient id="cg-water" x1="0" y1="0" x2=".55" y2="1">
      <stop offset="0" stop-color="var(--m-water-hi)"/><stop offset="1" stop-color="var(--m-water)"/></linearGradient>
    <linearGradient id="cg-grass" x1="0" y1="0" x2=".6" y2="1">
      <stop offset="0" stop-color="var(--m-grass)"/><stop offset="1" stop-color="var(--m-grass-2)"/></linearGradient>
    <radialGradient id="cg-ground" cx=".4" cy=".32" r=".95">
      <stop offset="0" stop-color="var(--m-bg-hi)"/><stop offset="1" stop-color="var(--m-bg)"/></radialGradient>
    <pattern id="cp-wave" width="${FP(13)}" height="${FP(9)}" patternUnits="userSpaceOnUse">
      <path d="M0 ${FP(4.6)} q ${FP(3.2)} ${-FP(2.8)} ${FP(6.4)} 0 t ${FP(6.4)} 0" fill="none"
        stroke="var(--m-water2)" stroke-width="${FP(.9)}" opacity=".62"/></pattern>
  </defs>`;
}

/** 点到折线的最短距离（米） */
function distToLine(pt, line){
  let best = 1e9;
  for(let i = 0; i + 1 < line.length; i++){
    const a = line[i], b = line[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy;
    let t = L2 ? ((pt.x - a[0]) * dx + (pt.y - a[1]) * dy) / L2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const d = Math.hypot(pt.x - (a[0] + t * dx), pt.y - (a[1] + t * dy));
    if(d < best) best = d;
  }
  return best;
}

/** 绿化点位：校园内的空地，避开建筑轮廓、水面与道路；全局只算一次，切视角不会跳动 */
let CAM_TREE_PTS = null;
function camTreePoints(){
  if(CAM_TREE_PTS) return CAM_TREE_PTS;
  const campus = GEO_M.campus, bb = polyBBox(campus), step = 14;
  let seed = 20260928 >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  // 楼体一律不许长树：用全部建筑轮廓（含没名字的小房），并留 4.5 m 净距，
  // 免得树冠/草床贴着楼边"糊"到楼上。
  const blocks = GEO_M.building.map(b => ({ o: b.o, bb: polyBBox(b.o) }));
  if(CAM_TRACK) blocks.push({ o: CAM_TRACK.poly, bb: polyBBox(CAM_TRACK.poly) });
  const waters = GEO_M.water.map(w => ({ o: w.o, bb: polyBBox(w.o) }));
  const roads  = GEO_M.road;
  const CLEAR  = 4.5;
  /** 点到楼体/水体的净距是否足够（先过包围盒） */
  const tooClose = (pt, box, need) => {
    const b = box.bb;
    if(pt.x < b[0] - need || pt.x > b[2] + need || pt.y < b[1] - need || pt.y > b[3] + need) return false;
    return pointInPoly(pt, box.o) || distToPoly(pt, box.o) < need;
  };
  const pts = [];
  for(let y = bb[1]; y <= bb[3]; y += step)
    for(let x = bb[0]; x <= bb[2]; x += step){
      const jx = x + (rnd() - .5) * step * .85, jy = y + (rnd() - .5) * step * .85;
      const pt = { x: jx, y: jy };
      if(!pointInPoly(pt, campus)) continue;
      let bad = false;
      for(const b of blocks) if(tooClose(pt, b, CLEAR)){ bad = true; break; }
      if(bad) continue;
      for(const w of waters) if(tooClose(pt, w, 2)){ bad = true; break; }
      if(bad) continue;
      // 路：让树离路面至少一个冠幅 + 半路宽，别长在马路中间
      for(const l of roads) if(distToLine(pt, l) < 11.5){ bad = true; break; }
      if(bad) continue;
      // 两重正弦叠加出「成片树林 / 留白空地」的密度场，比均匀撒点自然
      const dens = 0.5 + 0.34 * Math.sin(jx * 0.019) * Math.cos(jy * 0.023)
                       + 0.26 * Math.sin(jx * 0.041 + jy * 0.027);
      if(rnd() > dens * 1.18) continue;
      pts.push([+jx.toFixed(1), +jy.toFixed(1), rnd()]);
    }
  CAM_TREE_PTS = pts;
  return pts;
}

/** 画绿化：先铺一层柔和的绿地底色，再点树冠；都按真实尺度，缩放时自然变大 */
function camTrees(v){
  const pts = camTreePoints();
  if(!pts.length) return "";
  const r = 2.3;                                   // 树冠半径（米，约 4.6 m 冠幅）
  if(r * 900 / v.w < 0.85) return "";              // 缩得太小时整层略去，避免糊成一片
  const g = [[], [], []], bed = [];
  pts.forEach(p => {
    g[(p[2] * 3) | 0].push(`<circle cx="${p[0]}" cy="${p[1]}" r="${r}"/>`);
    bed.push(`<circle cx="${p[0]}" cy="${p[1]}" r="7"/>`);
  });
  const cols = ["var(--m-tree)", "var(--m-tree-2)", "var(--m-tree-s)"];
  return `<g class="cbed" fill="var(--m-grass-2)" opacity=".16">${bed.join("")}</g>`
    + g.map((arr, i) => arr.length
        ? `<g class="ctrees" fill="${cols[i]}" opacity=".62">${arr.join("")}</g>` : "").join("");
}

function camSvgPlace(p, mine, FP){
  const n = mine[p.id] ? mine[p.id].length : 0;
  const cls = "cplace" + (n ? " mine" : "") + (camSel === p.id ? " sel" : "")
            + (camOnlyMine && !n ? " dim" : "")
            + (camCat && p.cat !== camCat ? " catdim" : "");
  const fill = `url(#cg-${p.cat})`, stroke = `var(--m-${p.cat}-s)`;
  const spx = camScreenSize(p, FP);
  const title = `${p.name}${n ? `　本周 ${n} 次课` : ""}${p.area ? `　占地约 ${Math.round(p.area)} m²` : ""}`;

  let label = "";
  let nm = p.name;
  if(nm.length > 7 && spx < 78) nm = nm.replace("学生公寓", "公寓");
  if(nm === "教学楼A/B/C座" && spx < 118) nm = "教学楼A/B/C";
  const tx = (p.lx != null) ? p.lx : p.cx, ty = (p.ly != null) ? p.ly : p.cy;
  if(spx >= 62){
    label = `<text x="${tx}" y="${ty - FP(2)}" text-anchor="middle" font-size="${FP(12.5)}">${p.icon}</text>
      <text x="${tx}" y="${ty + FP(12)}" text-anchor="middle" font-size="${FP(10.4)}" font-weight="700"
      fill="var(--m-txt)" paint-order="stroke" stroke="var(--m-zone)" stroke-width="${FP(2.6)}">${esc(nm)}</text>`;
  } else if(spx >= 34){
    label = `<text x="${tx}" y="${ty + FP(3.6)}" text-anchor="middle" font-size="${FP(9.4)}" font-weight="700"
      fill="var(--m-txt)" paint-order="stroke" stroke="var(--m-zone)" stroke-width="${FP(2.4)}">${esc(nm)}</text>`;
  } else {
    label = `<text x="${tx}" y="${ty + FP(4)}" text-anchor="middle" font-size="${FP(11)}">${p.icon}</text>`;
  }
  // 楼内分区小标（例如教学楼 A / B / C 三栋）：放大到能看清时才画
  let subLbl = "";
  if(p.sub && spx >= 95){
    subLbl = p.sub.map(q => `<text x="${q[1]}" y="${q[2] + FP(3.2)}" text-anchor="middle"
      font-size="${FP(9.2)}" font-weight="700" fill="var(--m-txt)" fill-opacity=".8"
      paint-order="stroke" stroke="var(--m-zone)" stroke-width="${FP(2.4)}">${esc(q[0])}</text>`).join("");
  }

  // 本周有课的次数徽标：紧贴楼名左侧（小楼则贴图标右上），保证不脱离楼体
  let badge = "";
  if(n){
    let bxp, byp;
    if(spx >= 34){ bxp = tx - (nm.length * FP(10.4)) / 2 - FP(8); byp = ty + FP(8); }
    else         { bxp = tx + FP(11);                             byp = ty - FP(9); }
    badge = `<g class="cbadge">
      <circle cx="${bxp}" cy="${byp}" r="${FP(9.5)}"/>
      <text x="${bxp}" y="${byp + FP(3.6)}" font-size="${FP(10.5)}">${n}</text></g>`;
  }

  const dx = FP(2.2), dy = FP(3.0);
  return `<g class="${cls}" data-pid="${p.id}">
    <title>${esc(title)}</title>
    <path class="cshadow" d="${ptPath(p.poly)}" transform="translate(${dx},${dy})"
      fill="var(--m-shadow)" opacity=".28"/>
    <path class="cbody" d="${ptPath(p.poly)}" fill="${fill}" stroke="${stroke}" stroke-width="${FP(1.6)}"
      stroke-linejoin="round"/>${label}${subLbl}${badge}</g>`;
}

/** 画点状地标：田径场（跑道 + 内场）、铜像、校门 */
function camSvgPoi(p, mine, FP){
  const cls = "cplace poi" + (camSel === p.id ? " sel" : "")
            + (camCat && p.cat !== camCat ? " catdim" : "");
  if(p.kind === "track"){
    const [w, h] = p.track;
    const x = p.x - w / 2, y = p.y - h / 2;
    const iw = w * 0.62, ih = h - w * 0.72;          // 内场：跑道宽约 0.36w
    const lanes = [.90, .78, .66].map(k => `<rect x="${p.x - w * k / 2}" y="${p.y - h * k / 2}"
        width="${w * k}" height="${h * k}" rx="${w * k / 2}" fill="none" stroke="var(--m-zone)"
        stroke-width="${FP(.9)}" opacity=".55"/>`).join("");
    const pitch = `<rect x="${p.x - iw / 2}" y="${p.y - ih / 2}" width="${iw}" height="${ih}" rx="${FP(14)}"
        fill="var(--m-field)" stroke="var(--m-sport-s)" stroke-width="${FP(1.2)}"/>
      <line x1="${p.x - iw / 2}" y1="${p.y}" x2="${p.x + iw / 2}" y2="${p.y}" stroke="var(--m-zone)"
        stroke-width="${FP(.9)}" opacity=".6"/>
      <circle cx="${p.x}" cy="${p.y}" r="${Math.min(iw, ih) * .17}" fill="none" stroke="var(--m-zone)"
        stroke-width="${FP(.9)}" opacity=".6"/>`;
    return `<g class="${cls}" data-pid="${p.id}">
      <title>${esc(p.name)}　外廓约 ${w}×${h} m</title>
      <rect x="${x + FP(2)}" y="${y + FP(2.6)}" width="${w}" height="${h}" rx="${w / 2}"
        fill="var(--m-shadow)" opacity=".26"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="var(--m-track)"
        stroke="var(--m-sport-s)" stroke-width="${FP(1.4)}"/>${lanes}${pitch}
      <text x="${p.x}" y="${p.y - h / 2 + FP(13)}" text-anchor="middle" font-size="${FP(11.5)}">🏃</text>
    </g>`;
  }
  const r = p.gate ? 7 : 6;
  return `<g class="${cls}" data-pid="${p.id}">
    <title>${esc(p.name)}</title>
    <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="var(--m-zone)" stroke="var(--m-other-s)" stroke-width="${FP(1.4)}"/>
    <text x="${p.x}" y="${p.y + FP(4.4)}" text-anchor="middle" font-size="${FP(10.5)}">${p.icon}</text>
  </g>`;
}


/* ================= 防穿模：给建筑「占位」 =================
   OSM 提取的路网会直接穿过楼体（有的整段埋在楼里），直接画就成了
   「路从楼中间钻出来」。这里在渲染前把道路折线按 3 m 细分：
     · 落在楼里、但离边界不远的点 → 沿最近边界推到楼外（路贴着楼绕过去）
     · 深陷楼体中部（> 18 m）的点 → 直接丢弃，路在楼前自然断开
   结果只算一次并缓存，切视角不会重算。                          */
const CAM_SOLIDS = (() => {
  const out = [];
  GEO_M.building.forEach(b => {
    const c = polyLabel(b.o);
    if(!pointInPoly({ x: c.x, y: c.y }, GEO_M.campus)) return;   // 只管校园内的楼
    if((b.a || polyArea(b.o)) < 150) return;                     // 太小的棚房忽略
    out.push({ poly: b.o, bb: polyBBox(b.o) });
  });
  const tk = CAM_TRACK;
  if(tk) out.push({ poly: tk.poly, bb: polyBBox(tk.poly) });      // 跑道也算占位，路不许横穿
  return out;
})();

/** 点是否落在某栋楼里（先过包围盒，快） */
function inSolidAt(pt, s){
  const b = s.bb;
  if(pt.x < b[0] || pt.x > b[2] || pt.y < b[1] || pt.y > b[3]) return false;
  return pointInPoly(pt, s.poly);
}
/** 点到某栋楼边界的最近点 + 外法线 */
function solidEscape(pt, s){
  const poly = s.poly;
  let best = Infinity, bx = pt.x, by = pt.y, nx = 0, ny = -1;
  for(let i = 0; i < poly.length; i++){
    const a = poly[i], q = poly[(i + 1) % poly.length];
    const dx = q[0] - a[0], dy = q[1] - a[1], L2 = dx * dx + dy * dy;
    let t = L2 ? ((pt.x - a[0]) * dx + (pt.y - a[1]) * dy) / L2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const px = a[0] + t * dx, py = a[1] + t * dy;
    const d = Math.hypot(pt.x - px, pt.y - py);
    if(d < best){ best = d; bx = px; by = py; nx = -dy; ny = dx; }
  }
  const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
  if((pt.x - bx) * nx + (pt.y - by) * ny < 0){ nx = -nx; ny = -ny; }
  return { d: best, bx, by, nx, ny };
}
/** 点落在哪栋楼里（没有则 null） */
function hitSolidAt(pt){
  for(const s of CAM_SOLIDS) if(inSolidAt(pt, s)) return s;
  return null;
}
/** 一条折线避开所有建筑 → 返回若干段折线
    分三步：细分 → 把落在楼里的点推出去 → 仍然切进楼里的连线就地断开 */
function camClearLine(line, clear){
  const seg = 3, DEEP = 20, PUSH = clear + 2;
  // 1) 按 3 m 细分，保证不会"一步跨过"一栋楼
  const raw = [];
  for(let i = 1; i < line.length; i++){
    const a = line[i - 1], b = line[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / seg));
    for(let k = 0; k < n; k++)
      raw.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  raw.push([line[line.length - 1][0], line[line.length - 1][1]]);
  // 2) 逐个点推出楼体（最多 6 轮：凹进去的楼可能要绕几次）
  const moved = raw.map(p => {
    const pt = { x: p[0], y: p[1] };
    for(let pass = 0; pass < 6; pass++){
      const s = hitSolidAt(pt);
      if(!s) return pt;
      const e = solidEscape(pt, s);
      if(e.d > DEEP) return null;      // 深陷楼体中部：这段路不要了，让它在楼前断掉
      pt.x = e.bx - e.nx * PUSH;       // 沿最近边界向外推
      pt.y = e.by - e.ny * PUSH;
    }
    return hitSolidAt(pt) ? null : pt;
  });
  // 3) 重组：相邻两点的连线若还切进楼里，就在此处断开
  const out = [], cur = [];
  const flush = () => { if(cur.length > 1) out.push(cur.slice()); cur.length = 0; };
  for(const pt of moved){
    if(!pt){ flush(); continue; }
    const last = cur[cur.length - 1];
    if(last){
      const L = Math.hypot(pt.x - last[0], pt.y - last[1]);
      const n = Math.max(1, Math.ceil(L / 2.5));
      let cross = false;
      for(let k = 1; k < n; k++){
        const q = { x: last[0] + (pt.x - last[0]) * k / n, y: last[1] + (pt.y - last[1]) * k / n };
        if(hitSolidAt(q)){ cross = true; break; }
      }
      if(cross) flush();
    }
    const l2 = cur[cur.length - 1];
    if(!l2 || Math.hypot(pt.x - l2[0], pt.y - l2[1]) > 0.8) cur.push([+pt.x.toFixed(1), +pt.y.toFixed(1)]);
  }
  flush();
  return out.filter(a => a.length > 1);
}
let CAM_ROADS = null;
function camRoadParts(){
  if(CAM_ROADS) return CAM_ROADS;
  CAM_ROADS = GEO_M.road.map((l, i) => ({
    len: (CAM_ROAD_LEN0 && CAM_ROAD_LEN0[i]) || lineLen(l),
    parts: camClearLine(l, 6.5),
  }));
  return CAM_ROADS;
}

function camSvg(){
  const mine = camMine();
  const v = camViewRect();
  const FP = px => +(px * v.w / 900).toFixed(2);       // 屏幕像素 → 当前视角的坐标单位
  CAM_SCALE_PX = 900 / v.w;                            // 1 米 ≈ 多少屏幕像素
  const ts = v.w / 900;

  // 图层：校外底 → 林地草坡 → 校园地面（渐变+铺装）→ 树 → 水面 → 道路 → 楼块
  const greenSvg = GEO_M.green.map(g =>
    `<path d="${ptPath(g.o)}" fill="url(#cg-grass)" stroke="var(--m-grass-2)"
      stroke-width="${FP(.9)}" opacity=".62"/>`).join("");

  const campusD = ptPath(GEO_M.campus);
  const groundSvg = `<path d="${campusD}" fill="url(#cg-ground)"/>`;

  const waterSvg = GEO_M.water.map(w => {
    const d = ptPath(w.o) + w.i.map(r => ptPath(r)).join("");
    return `<path d="${d}" fill="url(#cg-water)" fill-rule="evenodd" stroke="var(--m-water2)"
        stroke-width="${FP(1.5)}" stroke-linejoin="round"/>
      <path d="${d}" fill="url(#cp-wave)" fill-rule="evenodd" opacity=".55"/>`;
  }).join("");

  const roadSvg = camRoadParts().map(rd => {
    const wm = rd.len > 900 ? 11 : (rd.len > 420 ? 8 : (rd.len > 180 ? 6 : 4));   // 真实路宽（米）
    const w  = Math.max(wm, +FP(3.4).toFixed(2));                                 // 缩太小时保底可见
    return rd.parts.map(seg => {
      const d = ptPath(seg, false);
      return `<path d="${d}" fill="none" stroke="var(--m-road-c)" stroke-width="${(w + FP(2.4)).toFixed(2)}"
        stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>
      <path d="${d}" fill="none" stroke="var(--m-road)" stroke-width="${w}"
        stroke-linecap="round" stroke-linejoin="round"/>`
      + (wm >= 8 ? `<path d="${d}" fill="none" stroke="var(--m-road-dash)" stroke-width="${FP(1)}"
        stroke-dasharray="${FP(7)} ${FP(6)}" opacity=".8"/>` : "");
    }).join("");
  }).join("");

  const fillerSvg = CAM_FILLERS.map(pl => {
    const dx = FP(1.6), dy = FP(2.2);
    return `<path d="${ptPath(pl)}" transform="translate(${dx},${dy})" fill="var(--m-shadow)" opacity=".2"/>
      <path d="${ptPath(pl)}" fill="var(--m-other)" stroke="var(--m-other-s)"
        stroke-width="${FP(1.1)}" stroke-linejoin="round" opacity=".78"/>`;
  }).join("");

  const polys = CAMPUS_PLACES.filter(p => p.kind === "poly");
  const pois  = CAMPUS_PLACES.filter(p => p.kind !== "poly");

  return `<svg viewBox="${v.x} ${v.y} ${v.w} ${v.h}" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="华南师范大学佛山南海校区地图（只画校园界内）">
    ${camDefs(FP)}
    <clipPath id="camClip"><path d="${campusD}"/></clipPath>
    <rect x="${v.x - 2}" y="${v.y - 2}" width="${v.w + 4}" height="${v.h + 4}" fill="var(--m-land)"/>
    <path class="chalo" d="${campusD}" transform="translate(${FP(2)},${FP(3.4)})" fill="none"
      stroke="var(--m-shadow)" stroke-width="${FP(4.5)}" opacity=".15"/>
    <g clip-path="url(#camClip)">
    ${greenSvg}
    ${groundSvg}
    ${waterSvg}
    ${fillerSvg}
    ${camTrees(v)}
    ${roadSvg}
    ${polys.map(p => camSvgPlace(p, mine, FP)).join("")}
    </g>
    ${pois.map(p => camSvgPoi(p, mine, FP)).join("")}
    <path d="${campusD}" fill="none" stroke="var(--m-edge)" stroke-width="${FP(2.6)}"
      stroke-dasharray="${FP(11)} ${FP(6)}" stroke-linejoin="round" opacity=".9"/>
    ${camRouteSvg(FP)}
    ${camScaleBar(v, ts)}
    <g transform="translate(${v.x + v.w - FP(36)},${v.y + FP(36)})">
      <circle r="${FP(19)}" fill="var(--m-zone)" opacity=".92" stroke="var(--m-line)" stroke-width="${FP(1.3)}"/>
      <circle r="${FP(14)}" fill="none" stroke="var(--m-line)" stroke-width="${FP(.7)}" opacity=".7"/>
      <path d="M0 ${-FP(13)} L${FP(4.8)} ${FP(2.8)} L0 0 L${-FP(4.8)} ${FP(2.8)} Z" fill="#ef4444"/>
      <text y="${FP(28)}" text-anchor="middle" font-size="${FP(8.5)}" font-weight="800" fill="var(--m-sub)">N</text>
    </g>
    <g transform="translate(${v.x + FP(12)},${v.y + FP(16)})">
      <rect x="0" y="0" width="${FP(154)}" height="${FP(34)}" rx="${FP(9)}"
        fill="var(--m-zone)" opacity=".9" stroke="var(--m-line)" stroke-width="${FP(.9)}"/>
      <text x="${FP(11)}" y="${FP(15)}" font-size="${FP(11.5)}" font-weight="800"
        fill="var(--m-sub)">华南师范大学 · 南海校区</text>
      <text x="${FP(11)}" y="${FP(27)}" font-size="${FP(9)}" fill="var(--m-sub)" opacity=".8"
        >真实地理形状 · 米制 1:1 · 只画校园界内</text>
    </g>
  </svg>`;
}

function camStatCards(){
  const mine=camMine();
  const ids=Object.keys(mine);
  const sess=ids.reduce((n,k)=>n+mine[k].length,0);
  const cs=new Set(); ids.forEach(k=>mine[k].forEach(s=>cs.add(s.courseId)));
  return `<div><b>${ids.length}</b><small>我有课的楼</small></div>
    <div><b>${sess}</b><small>${camScope==="all"?"本学期时段":"第 "+state.viewWeek+" 周时段"}</small></div>
    <div><b>${cs.size}</b><small>涉及课程</small></div>
    <div><b>${CAMPUS_PLACES.length}</b><small>标注建筑</small></div>`;
}
function camHeroChips(){
  const w=state.viewWeek;
  const hs=holidaysInWeek(w);
  const out=["西南教学区 · 西北运动区 · 东侧生活区","三面环水（黄迳洞水库）",
             "占地 473.23 亩 ≈ 31.5 万 m²","真实轮廓 · 米制 1:1","点图例可按类别筛选"];
  if(hs.length) out.push(`${hs[0].h.icon} 本周有${hs[0].h.name}假期`);
  return out.map(t=>`<span class="chip">${esc(t)}</span>`).join("");
}

function camSideList(){
  const mine=camMine();
  const ids=Object.keys(mine);
  const box=$("#camSide");
  if(!ids.length){
    box.innerHTML=`<h4>🗺 校园一览</h4>
      <div class="cempty">${camScope==="all"?"":"第 "+state.viewWeek+" 周"}没有匹配到教室 —— 课表里的上课地点还没填，或者本周停课。<br><br>
      下面是校区所有标注点，点地图或列表任意一栋都能看详情。</div>
      <div class="plist">${CAMPUS_PLACES.map(p=>`
        <div class="pitem" data-pid="${p.id}">
          <span class="pi">${p.icon}</span>
          <span class="pn"><b>${esc(p.name)}</b><small>${esc(camZoneOf(p))}</small></span>
        </div>`).join("")}</div>`;
    camBindList(); return;
  }
  const list=ids.map(id=>({p:camPlace(id), ss:mine[id]}))
    .sort((a,b)=>b.ss.length-a.ss.length);
  box.innerHTML=`<h4>✨ 我上课常去的楼</h4>
    <div class="sub">${camScope==="all"?"本学期":("第 "+state.viewWeek+" 周")}一共要去 <b>${ids.length}</b> 栋楼，共 <b>${ids.reduce((n,k)=>n+mine[k].length,0)}</b> 个上课时段。点一下看详情和路线提示。</div>
    <div class="plist">${list.map(({p,ss})=>`
      <div class="pitem" data-pid="${p.id}">
        <span class="pi">${p.icon}</span>
        <span class="pn"><b>${esc(p.name)}</b><small>${ss.length} 次 · ${[...new Set(ss.map(s=>s.room))].join(" / ")}</small></span>
        <span class="pc">${ss.length}×</span>
      </div>`).join("")}</div>
    ${camRouteOn?`<div class="sec"><b>🧭 今日路线</b>${
      camTodayRoute().length>1
        ? camTodayRoute().map((id,i)=>`<div class="srow" style="--c:${course((DATA.sessions.find(s=>placeOfRoom(s.room)===id)||{}).courseId||"").color}"><b>${i+1}. ${esc(camPlace(id).name)}</b></div>`).join("")
        : `<div class="cempty">今天没有需要跑楼的课。</div>`}</div>`:""}
    <div class="sec"><b>其他标注点</b></div>
    <div class="plist">${CAMPUS_PLACES.filter(p=>!mine[p.id]).map(p=>`
      <div class="pitem" data-pid="${p.id}">
        <span class="pi">${p.icon}</span>
        <span class="pn"><b>${esc(p.name)}</b><small>${esc(camZoneOf(p))}</small></span>
      </div>`).join("")}</div>`;
  camBindList();
}
/** 位置描述：按楼体质心在校园里的相对方位判断 */
function camZoneOf(p){
  if(p.id === "p0") return "校园中轴 · 教学楼前";
  if(!p.inCampus) return "校园周边";
  const b = GEO_M.campus.reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]),
                                           Math.max(a[2], q[0]), Math.max(a[3], q[1])], [1e9, 1e9, -1e9, -1e9]);
  const rx = (p.cx - b[0]) / (b[2] - b[0]), ry = (p.cy - b[1]) / (b[3] - b[1]);
  if(ry < 0.30) return "校园北部 · 运动区";
  if(rx < 0.42 && ry > 0.52) return "校园西南 · 教学区";
  if(rx > 0.72 && ry > 0.36) return "校园东部 · 生活区";
  if(ry > 0.74) return "校园南部 · 临河";
  return "校园中部";
}
function camSidePlace(id){
  const p=camPlace(id); if(!p) return camSideList();
  const mine=camMine()[id]||[];
  const groups={};
  mine.forEach(s=>{ const k=s.courseId; (groups[k]=groups[k]||[]).push(s); });
  $("#camSide").innerHTML=`
    <button class="cback" id="camBack">‹ 返回我的楼栋</button>
    <h4>${p.icon} ${esc(p.name)}</h4>
    <div class="sub">${esc(camZoneOf(p))}${p.area?`　·　占地约 ${Math.round(p.area)} m²`:""}　·　${mine.length?`本周 ${mine.length} 次课`:"本周没有安排"}</div>
    <div class="cempty">${esc(p.desc)}</div>
    ${p.fun?`<div class="cfun">💬 ${esc(p.fun)}</div>`:""}
    ${mine.length?`<div class="sec"><b>我在这里的课</b>${Object.keys(groups).map(cid=>{
      const c=course(cid);
      return groups[cid].sort((a,b)=>a.day-b.day||a.from-b.from).map(s=>`
        <div class="srow" style="--c:${c.color}">
          <b>${esc(c.name)}</b>
          <small>${wd(s.day)} ${s.from}-${s.to} 节 · ${timeRange(s.from,s.to)} · 📍${esc(s.room||"")}</small><br>
          <small>第 ${s.weeks[0]}-${s.weeks[1]} 周${s.parity!=="all"?"（"+dayWord(s.parity)+"）":""} · 👤${esc(s.teacher||"-")}</small>
        </div>`).join("");
    }).join("")}</div>`:`<div class="sec"><b>本周没有安排</b><div class="cempty">第 ${state.viewWeek} 周不用来这里。</div></div>`}
    ${camNearHint(id)}`;
  $("#camBack").onclick=()=>{ camSel=null; renderCampus(); };
}
/** 简单的相邻楼提示（纯按图上坐标算，用于估「要不要赶路」） */
function camNearHint(id){
  const p=camPlace(id); const c=camCenter(p);
  const others=CAMPUS_PLACES.filter(x=>x.id!==id && (camMine()[x.id]||[]).length)
    .map(x=>{
      const meters = distToPoly({x:c.x, y:c.y}, x.poly || [[x.cx, x.cy]]);   // 真实米
      return {p:x, m:Math.round(meters), d:Math.max(1, Math.round(meters/80))};  // 步行约 80 m/分钟
    })
    .sort((a,b)=>a.d-b.d).slice(0,3);
  if(!others.length) return "";
  return `<div class="sec"><b>离我其他常去的楼</b>${others.map(o=>`
    <div class="srow" style="--c:#94a3b8"><b>${esc(o.p.name)}</b><small>直线约 ${o.m} m · 步行约 ${o.d} 分钟（按校内 80 m/分钟估算，仅供赶课参考）</small></div>
  `).join("")}</div>`;
}
function camBindList(){
  $$("#camSide .pitem").forEach(el=>el.addEventListener("click",()=>{ camSel=el.dataset.pid; renderCampus(); }));
}

function renderCampus(){
  const mine=camMine();
  $("#camChips").innerHTML=camHeroChips();
  $("#camStat").innerHTML=camStatCards();
  $$("#camScope button").forEach(b=>b.classList.toggle("on", b.dataset.scope===camScope));
  $$("#camZoom button").forEach(b=>b.classList.toggle("on", (CAM_VIEWS[b.dataset.view]||null)===camView));
  $("#camRoom").value=camQ;
  $("#camMine").style.borderColor = camOnlyMine ? "var(--accent)" : "";
  $("#camMine").style.color      = camOnlyMine ? "var(--accent)" : "";
  $("#camRoute").style.borderColor = camRouteOn ? "var(--accent)" : "";
  $("#camRoute").style.color       = camRouteOn ? "var(--accent)" : "";
  $("#camRoute").textContent = camRouteOn ? "🧭 关闭今日路线" : "🧭 今日路线";
  const rq = camTodayRoute();
  const bar = $("#camRouteBar");
  if(bar) bar.hidden = !camRouteOn;
  if(camRouteOn) renderRouteBar();
  if(camScope==="all"){
    $("#camHint").textContent = "统计口径：本学期全部上课时段";
  } else if(camRouteOn){
    const st = camTripStats();
    $("#camHint").textContent = st.total
      ? `今日行程 ${st.trip.length} 站 · 约 ${Math.round(st.total)} m`
      : "今天不用赶路 🎉";
  } else {
    $("#camHint").textContent = `统计口径：第 ${state.viewWeek} 周（法定假期当天的课不计入）`;
  }

  $("#campusMap").innerHTML = camSvg() + `<div class="camlegend">
    ${CAM_LEGEND.map(z => z.cat
        ? `<span class="lgc${camCat===z.cat?" on":""}" data-cat="${z.cat}" title="点击只看这一类，再点一次取消"><i style="background:linear-gradient(150deg,${z.color},${z.color}b0)"></i>${esc(z.name)}</span>`
        : `<span><i style="background:linear-gradient(150deg,${z.color},${z.color}b0)"></i>${esc(z.name)}</span>`).join("")}
    <span><i style="background:#ef4444;border-radius:50%"></i>角标数字 = ${camScope==="all"?"本学期":("第 "+state.viewWeek+" 周")}要去这栋楼的次数</span>
    <span><i style="background:linear-gradient(135deg,#cbe4f5,#aed6ef)"></i>水面（黄迳洞水库 · 三面环水）</span>
  </div>`;
  $$("#campusMap .cplace").forEach(g=>{
    g.addEventListener("click",()=>{ camSel=g.dataset.pid; renderCampus(); });
  });
  $$("#campusMap .camlegend span.lgc").forEach(sp=>{
    sp.addEventListener("click", e=>{
      e.stopPropagation();
      camCat = (camCat === sp.dataset.cat) ? null : sp.dataset.cat;
      renderCampus();
    });
  });
  const lgd = $("#campusMap .camlegend");
  if(lgd && camCat){
    const z = CAM_LEGEND.find(x => x.cat === camCat);
    const n = CAMPUS_PLACES.filter(p => p.cat === camCat).length;
    lgd.insertAdjacentHTML("afterend",
      `<div class="catbar">🔎 正在只看 <b>${esc(z ? z.name : camCat)}</b> · ${n} 个地点
        <button id="camCatOff">显示全部</button></div>`);
    $("#camCatOff").onclick = ()=>{ camCat = null; renderCampus(); };
  }
  $("#camNotes").innerHTML=CAM_NOTES.map(n=>`<div class="camnote">
      <b><span class="ci">${n.i}</span>${esc(n.t)}</b><p>${esc(n.d)}</p></div>`).join("");

  if(camSel) camSidePlace(camSel); else camSideList();
  if(camQ && !placeOfRoom(camQ)){
    $("#camHint").textContent = `「${camQ}」没有匹配到已标注的楼栋（试试 教A207 / 教B316 / 教C101 / 商C404 / 篮球场1）`;
  }
}
/** 路线条：出发地 / 往返开关 / 行程明细 */
function renderRouteBar(){
  const st = camTripStats();
  const sel = $("#camDorm");
  if(sel && sel.value !== camDormName) sel.value = camDormName;
  const back = $("#camBack");
  if(back) back.checked = camRouteBack;
  const chain = [];
  let no = 0;
  st.trip.forEach(t=>{
    if(t.tag) chain.push(`<i>🏠</i> ${esc(t.p.name.replace("学生公寓","公寓"))}<small>（${t.tag}）</small>`);
    else     chain.push(`<i>${++no}</i> ${esc(t.p.name)}`);
  });
  const mins = Math.max(1, Math.round(st.total / 75));
  $("#camTripText").innerHTML = st.total
    ? chain.join(' <span class="arw">→</span> ') +
      `<br>全程约 <b>${Math.round(st.total)} m</b>（沿路走、自动绕开楼体与操场），按步行 4.5 km/h 算约 <b>${mins} 分钟</b>。`
    : "今天没有要去的教学楼。";
}

function bindCampus(){
  $$("#camScope button").forEach(b=>b.addEventListener("click",()=>{ camScope=b.dataset.scope; renderCampus(); }));
  $$("#camZoom button").forEach(b=>b.addEventListener("click",()=>{
    camView = CAM_VIEWS[b.dataset.view] || null; renderCampus();
  }));
  $("#camRoom").addEventListener("input",e=>{
    camQ=e.target.value.trim();
    if(camQ){ const pid=placeOfRoom(camQ); if(pid) camSel=pid; }
    renderCampus();
    if(camQ) $("#camRoom").focus();
  });
  $("#camMine").addEventListener("click",()=>{ camOnlyMine=!camOnlyMine; renderCampus(); });
  $("#camRoute").addEventListener("click",()=>{
    camRouteOn=!camRouteOn; CAM_TRIP_CACHE=null; renderCampus();
    if(camRouteOn && camTodayRoute().length===0) toast("今天没课，不用赶路 🎉");
  });
  if($("#camDorm")){
    $("#camDorm").innerHTML = camDorms().map(p =>
      `<option value="${esc(p.name)}">${esc(p.name.replace("学生公寓","公寓"))}</option>`).join("");
    $("#camDorm").addEventListener("change", e=>{
      camDormName = e.target.value; CAM_TRIP_CACHE = null;
      state.settings.camDorm = camDormName; saveLocal(); renderCampus();
    });
    $("#camBack").addEventListener("change", e=>{
      camRouteBack = e.target.checked; CAM_TRIP_CACHE = null;
      state.settings.camBack = camRouteBack; saveLocal(); renderCampus();
    });
  }
}
/* ================= 标签切换 ================= */
const TABS=["week","today","free","leave","notes","courses","campus","settings"];
function switchTab(t){
  if(!TABS.includes(t)) t="week";
  state.tab=t;
  try{ history.replaceState(null,"","#"+t); }catch(e){}
  $$(".tab").forEach(b=>{
    const on=b.dataset.tab===t;
    b.classList.toggle("on",on);
    b.setAttribute("aria-selected",on?"true":"false");
    b.tabIndex=on?0:-1;
  });
  TABS.forEach(k=>{
    const v=$("#v-"+k); if(v) v.classList.toggle("hidden", k!==t);
  });
  const v=$("#v-"+t); if(v){ v.classList.remove("fade"); void v.offsetWidth; v.classList.add("fade"); }
  if(t==="week") renderWeek();
  if(t==="today") renderToday();
  if(t==="free") renderFree();
  if(t==="leave") renderLeave();
  if(t==="notes") renderNotes();
  if(t==="courses") renderCourses();
  if(t==="campus") renderCampus();
  if(t==="settings") renderSettings();
  window.scrollTo({top:0,behavior:"smooth"});
}

function setupPwa(){
  const syncOffline=()=>document.body.classList.toggle("offline", !navigator.onLine);
  window.addEventListener("online", syncOffline);
  window.addEventListener("offline", syncOffline);
  syncOffline();
  if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)){
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
}
/* ================= 启动 ================= */
function boot(){
  const saved = loadLocal();
  const savedData = (saved && saved.data && saved.data.courses) ? saved.data : null;
  const base = savedData || ((SCHEDULE && SCHEDULE.courses) ? SCHEDULE : DEFAULTS);

  applyBase(base);
  state.notes = (saved && saved.notes) || [];
  state.leaves = (saved && saved.leaves) || [];
  state.settings = (saved && saved.settings) || {};
  if(state.settings.camDorm) camDormName = state.settings.camDorm;
  if(typeof state.settings.camBack === "boolean") camRouteBack = state.settings.camBack;
  if(state.settings.semesterStart) DATA.meta.semesterStart = state.settings.semesterStart;
  if(state.settings.totalWeeks) DATA.meta.totalWeeks = state.settings.totalWeeks;
  if(state.settings.timeSlots && state.settings.timeSlots.length) DATA.timeSlots = state.settings.timeSlots;
  const savedWeek = (saved && saved.dataVersion === dataVersion()) ? saved.viewWeek : null;
  const thisWeek  = weekOfDate(new Date());
  state.viewWeek  = savedWeek || thisWeek;
  let jumped = 0;
  // 军训周本身有内容（全天军训），不要把它当作「空白周」跳过
  if(!savedWeek && !isMilitary(state.viewWeek) && !DATA.sessions.some(s=>activeIn(s,state.viewWeek))){
    for(let k=state.viewWeek+1;k<=totalWeeks();k++){
      if(DATA.sessions.some(s=>activeIn(s,k))){ jumped=k; state.viewWeek=k; break; }
    }
  }

  renderTop();
  bindUI();
  const hash=(location.hash||"").replace("#","");
  const defaultTab = matchMedia("(max-width: 600px)").matches ? "today" : "week";
  switchTab(TABS.includes(hash)?hash:defaultTab);
  if(jumped) setTimeout(()=>toast(`第 ${thisWeek} 周暂时没课，已跳到第 ${jumped} 周 🎒`), 400);
  window.addEventListener("hashchange",()=>{
    const h=(location.hash||"").replace("#","");
    if(h && h!==state.tab) switchTab(h);
  });

  // 基础课表由 schedule.js 提供；设置页可手动从 schedule.json 重新加载。
  setInterval(()=>{ if(state.tab==="week") renderWeek(); if(state.tab==="today") renderToday(); }, 60000);

  $("#btnRemind").onclick = ()=>{ notifyAsk().then(()=>pushNext(true)); };
  setupPwa();
  startRemind();
}
function dataVersion(){
  return (DATA.courses.map(c=>c.id+c.name).join("|") + DATA.sessions.length).length + ":" + DATA.sessions.length;
}

function bindUI(){
  $$(".tab").forEach(b=>{
    b.addEventListener("click",()=>switchTab(b.dataset.tab));
    b.addEventListener("keydown",e=>{
      const keys=["ArrowLeft","ArrowRight","Home","End"];
      if(!keys.includes(e.key)) return;
      e.preventDefault();
      const tabs=$$(".tab");
      const i=tabs.indexOf(b);
      let next=i;
      if(e.key==="ArrowLeft") next=(i-1+tabs.length)%tabs.length;
      if(e.key==="ArrowRight") next=(i+1)%tabs.length;
      if(e.key==="Home") next=0;
      if(e.key==="End") next=tabs.length-1;
      switchTab(tabs[next].dataset.tab); tabs[next].focus();
    });
  });
  // 切周后同步刷新当前所在页面
  const afterWeek=()=>{
    saveLocal(); renderTop();
    if(state.tab==="free") renderFree();
    else if(state.tab==="leave") renderLeave();
    else renderWeek();
  };
  const goWeek=n=>{ state.viewWeek=Math.min(totalWeeks(),Math.max(1,n)); afterWeek(); };
  $("#prevW").onclick=()=>goWeek(state.viewWeek-1);
  if($("#btnShare")) $("#btnShare").onclick=openShareDialog;
  if($("#btnAdmin")) $("#btnAdmin").onclick=openAdminDialog;
  if($("#btnAdminSettings")) $("#btnAdminSettings").onclick=openAdminDialog;

  $("#nextW").onclick=()=>goWeek(state.viewWeek+1);
  $("#btnToday").onclick=()=>{ goWeek(weekOfDate(new Date())); toast("已回到第 "+state.viewWeek+" 周"); };
  $("#btnNotes").onclick=()=>switchTab("notes");
  bindCampus();
  $("#prevWF").onclick=()=>goWeek(state.viewWeek-1);
  $("#nextWF").onclick=()=>goWeek(state.viewWeek+1);
  $("#btnFreeToday").onclick=()=>{ goWeek(weekOfDate(new Date())); toast("已回到第 "+state.viewWeek+" 周"); };

  // 军训周设置
  const setMil=()=>{
    let a=Math.max(0,Number($("#milA").value)||0), b=Math.max(0,Number($("#milB").value)||0);
    if(b<a){ const t=a; a=b; b=t; }
    state.settings.militaryWeeks=[a,b]; saveLocal();
    renderWeek(); renderToday(); if(state.tab==="free") renderFree();
    toast(a===0&&b===0 ? "已关闭军训标注" : `已把第 ${a}–${b} 周标为全天军训`);
  };
  $("#milA").onchange=setMil; $("#milB").onchange=setMil;

  const setTheme=t=>{
    document.documentElement.dataset.theme=t;
    $("#btnTheme").textContent = t==="dark" ? "☀️" : "🌙";
    state.settings.theme=t; saveLocal();
  };
  setTheme(state.settings.theme || "light");
  $("#btnTheme").onclick=()=>setTheme(document.documentElement.dataset.theme==="dark"?"light":"dark");

  $("#dClose").onclick=closeDrawer;
  $("#mask").onclick=closeDrawer;
  document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeDrawer(); });
  bindMkpKeys();
  $("#btnMkp").onclick=()=>quickMakeup();

  $("#addNote").onclick=()=>{ const n=newNote({}); setTimeout(()=>{const t=document.querySelector(`.note[data-id="${n.id}"] textarea`); t&&t.focus();},60); };
  $("#tidyNotes").onclick=()=>{
    state.notes.forEach((n,i)=>{ n.x=24+(i%4)*236; n.y=24+Math.floor(i/4)*186; });
    saveLocal(); renderNotes(); toast("已整理");
  };
  $("#clearNotes").onclick=()=>{
    if(!adminLoggedIn()){ openAdminDialog(); toast("请先登录管理员模式"); return; }
    if(!state.notes.length) return;
    if(confirm("确定清空全部 "+state.notes.length+" 张便签？此操作不可恢复。")){
      state.notes=[]; saveLocal(); renderNotes(); renderTop(); toast("已清空");
    }
  };
  $("#cs").oninput=renderCourses;
  $("#addCourse").onclick=addCourseFlow;

  const syncToggle=()=>{
    const on = !!state.settings.showOff, all = !!state.settings.showAllSections;
    $("#toggleOff").textContent = (on?"🙈 隐藏":"👁 显示") + "本周停课";
    $("#toggleOff").style.color = on ? "var(--accent)" : "";
    $("#toggleOff").setAttribute("aria-pressed",on?"true":"false");
    $("#toggleSec").textContent = all ? "↕ 展开全部" : "↕ 折叠空节次";
    $("#toggleSec").style.color = all ? "var(--accent)" : "";
    $("#toggleSec").setAttribute("aria-pressed",all?"true":"false");
  };
  $("#toggleOff").onclick=()=>{
    state.settings.showOff=!state.settings.showOff; saveLocal(); syncToggle(); renderWeek();
  };
  $("#toggleSec").onclick=()=>{
    state.settings.showAllSections=!state.settings.showAllSections; saveLocal(); syncToggle(); renderWeek();
  };
  syncToggle();

  $("#semStart").onchange=()=>{ DATA.meta.semesterStart=$("#semStart").value; state.settings.semesterStart=DATA.meta.semesterStart; saveLocal(); renderTop(); switchTab("week"); };
  $("#totWeeks").onchange=()=>{ DATA.meta.totalWeeks=Number($("#totWeeks").value)||20; state.settings.totalWeeks=DATA.meta.totalWeeks; saveLocal(); renderTop(); switchTab("week"); };

  $("#btnExport").onclick=()=>{
    const blob=new Blob([JSON.stringify({meta:DATA.meta,timeSlots:DATA.timeSlots,courses:DATA.courses,sessions:DATA.sessions,notes:state.notes,leaves:state.leaves,settings:state.settings},null,2)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`课表备份-${ymd(new Date())}.json`; a.click();
    toast("已导出备份");
  };
  $("#btnImport").onclick=()=>$("#fileJson").click();
  $("#fileJson").onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{
      const j=JSON.parse(rd.result);
      if(j.courses){ applyBase(j); if(j.notes) state.notes=j.notes; if(j.leaves) state.leaves=j.leaves; }
      else if(j.data && j.data.courses){ applyBase(j.data); if(j.notes) state.notes=j.notes; if(j.leaves) state.leaves=j.leaves; }
      else throw new Error("格式不对");
      saveLocal(); renderTop(); switchTab("week"); toast("导入成功");
    }catch(err){ toast("导入失败：文件格式不正确"); } };
    rd.readAsText(f); e.target.value="";
  };
  $("#btnReload").onclick=()=>{
    fetch("schedule.json?t="+Date.now()).then(r=>{ if(!r.ok) throw 0; return r.json(); })
      .then(j=>{ applyBase(j); saveLocal(); renderTop(); switchTab("week"); toast("已读取 schedule.json"); })
      .catch(()=>toast("读取失败：请用本地服务器打开，或用「导入 JSON」"));
  };
  $("#btnReset").onclick=()=>{
    if(!confirm("将清除全部便签与自定义设置，恢复课表原始数据。确定？")) return;
    localStorage.removeItem(LS); localStorage.removeItem(LS_LEGACY);
    location.reload();
  };
}

function addCourseFlow(){
  const maxWeek=totalWeeks();
  openFormDialog({
    title:"手动添加课程",
    description:"如果课程名称已经存在，会把新的上课时段合并到已有课程中。",
    fields:[
      {name:"name",label:"课程名称",type:"text",required:true,placeholder:"例如：Python程序设计及应用",full:true},
      {name:"day",label:"星期",type:"select",value:"1",options:DAYS.map((d,i)=>[String(i+1),d])},
      {name:"parity",label:"单双周",type:"select",value:"all",options:[["all","每周"],["odd","单周"],["even","双周"]]},
      {name:"from",label:"开始节次",type:"number",value:"1",min:1,max:NSEC,step:1},
      {name:"to",label:"结束节次",type:"number",value:"2",min:1,max:NSEC,step:1},
      {name:"weekFrom",label:"起始周",type:"number",value:"1",min:1,max:maxWeek,step:1},
      {name:"weekTo",label:"结束周",type:"number",value:String(maxWeek),min:1,max:maxWeek,step:1},
      {name:"room",label:"教室",type:"text",placeholder:"例如：商C504"},
      {name:"teacher",label:"教师",type:"text",placeholder:"可留空"}
    ],
    submitText:"添加课程",
    onSubmit(values){
      const name=(values.name||"").trim();
      const day=Number(values.day), from=Number(values.from), to=Number(values.to);
      const weekFrom=Number(values.weekFrom), weekTo=Number(values.weekTo);
      if(!name) return "请填写课程名称";
      if(!Number.isInteger(day) || day<1 || day>7) return "星期必须是 1-7";
      if(!Number.isInteger(from) || !Number.isInteger(to) || from<1 || to>NSEC || from>to) return "节次范围应为 1-11，且结束节次不能早于开始节次";
      if(!Number.isInteger(weekFrom) || !Number.isInteger(weekTo) || weekFrom<1 || weekTo>maxWeek || weekFrom>weekTo) return `周次范围应为 1-${maxWeek}`;
      let c=DATA.courses.find(x=>x.name===name);
      if(!c){
        c={id:"u"+Date.now(),name,mark:"*",color:PALETTE[DATA.courses.length%PALETTE.length],
           credits:"",assessment:"",classCode:"",className:"",hoursBreakdown:"",weekHours:"",totalHours:"",note:""};
        DATA.courses.push(c);
      }
      DATA.sessions.push({
        id:"us"+Date.now(), courseId:c.id, day, from, to, weeks:[weekFrom,weekTo],
        parity:values.parity||"all", room:(values.room||"").trim(), teacher:(values.teacher||"").trim(),
        campus:DATA.meta.campus||""
      });
      saveLocal(); renderCourses(); renderWeek();
      const count=ScheduleCore.findConflicts(DATA.sessions).length;
      toast(count ? "课程已添加 · 检测到课程冲突" : "课程已添加 · 未发现冲突");
    }
  });
}
/* ================= 下一节课 · 发送到本地 =================
   四条通道，任何一条能用都能收到：
   ① 系统桌面通知（Notification API）  ② 页面顶部提醒条 + 提示音
   ③ 浏览器标签页标题倒计时            ④ 导出 .ics 日历（交给系统日历推送） */
const BASE_TITLE = document.title;
const REM_FIRED  = "wb-sched-remind-fired";

function remCfg(){
  const s = state.settings || {};
  return {
    on:    s.remindOn    !== false,
    desk:  s.remindDesk  !== false,
    sound: s.remindSound !== false,
    title: s.remindTitle !== false,
    min:   (Number.isFinite(+s.remindMin) && +s.remindMin > 0) ? +s.remindMin : 15
  };
}
function notifySupported(){ return typeof Notification !== "undefined"; }
function notifyPerm(){ return notifySupported() ? Notification.permission : "unsupported"; }
function notifyAsk(){
  if(!notifySupported()) return Promise.resolve("unsupported");
  if(Notification.permission !== "default") return Promise.resolve(Notification.permission);
  try{ return Notification.requestPermission().then(p=>p).catch(()=>"denied"); }
  catch(e){ return Promise.resolve("denied"); }
}
function notifyWhy(){
  if(!notifySupported()) return "这个浏览器不支持桌面通知";
  const p = Notification.permission;
  if(p === "granted") return "";
  if(p === "denied")
    return location.protocol === "file:"
      ? "浏览器禁止本地网页发通知（用线上版或导出日历）"
      : "通知权限已被拒绝，去浏览器地址栏左侧 🔒 里改回「允许」";
  return "还没授权通知，点一下页面任意处就会弹出授权";
}

/** 把 nextSession() 的结果整理成一段可直接展示的信息 */
function nextInfo(nx){
  if(!nx) return null;
  const c = course(nx.s.courseId) || {name:"课程", color:"#4f6ef7"};
  const a = slot(nx.s.from), b = slot(nx.s.to);
  const todayIdx = (new Date().getDay()+6)%7+1;
  return {
    name: c.name, color: c.color,
    room: nx.s.room || "", teacher: nx.s.teacher || "",
    span: a.start+"-"+b.end,
    sec:  nx.s.from === nx.s.to ? "第"+nx.s.from+"节" : "第"+nx.s.from+"-"+nx.s.to+"节",
    week: nx.week, day: wd(nx.dayIdx),
    when: (nx.dayIdx === todayIdx && nx.week === weekOfDate(new Date())) ? "今天" : wd(nx.dayIdx),
    minutes: nx.minutes, dt: nx.dt, sid: nx.s.id
  };
}
function nextText(nx){
  const i = nextInfo(nx);
  if(!i) return "本学期没有后续课程了 🎉";
  return [`【下一节课】${i.name}`,
    `时间：${i.when} ${i.span}（${i.sec}）`,
    `地点：${i.room || "待定"}`,
    `教师：${i.teacher || "—"}`,
    `周次：第 ${i.week} 周 ${i.day}`,
    `倒计时：${i.minutes<=0 ? "正在上课" : humanGap(i.minutes)+"后"}`].join("\n");
}

/* ---- 已触发记录：同一节课同一天只自动提醒一次 ---- */
function firedGet(){ try{ return JSON.parse(localStorage.getItem(REM_FIRED) || "{}"); }catch(e){ return {}; } }
function firedHas(k){ return !!firedGet()[k]; }
function firedSet(k){
  const o = firedGet(), cut = Date.now() - 4*864e5;
  Object.keys(o).forEach(x=>{ if(o[x] < cut) delete o[x]; });
  o[k] = Date.now();
  try{ localStorage.setItem(REM_FIRED, JSON.stringify(o)); }catch(e){}
}
const firedKey = nx => nx.s.id + "|" + ymd(nx.dt);

/* ---- 提示音（WebAudio 现场合成，不需要任何外部文件） ---- */
let _actx = null;
function beep(){
  try{
    _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
    if(_actx.state === "suspended") _actx.resume();
    [[0,784],[0.16,1047],[0.32,784]].forEach(([t,f])=>{
      const o = _actx.createOscillator(), g = _actx.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t0 = _actx.currentTime + t;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.16, t0+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0+0.20);
      o.connect(g); g.connect(_actx.destination);
      o.start(t0); o.stop(t0+0.22);
    });
  }catch(e){}
}

/* ---- 页面顶部提醒条 ---- */
let _remTimer = null;
function hideRemBar(){ const b = $("#remBar"); if(b) b.classList.remove("on"); }
function showRemBar(i, manual){
  const bar = $("#remBar"); if(!bar) return;
  bar.innerHTML =
    `<div class="ri">🔔</div>
     <div class="rb">
       <div class="rt">${manual ? "下一节课 · 已发送到本地" : "马上要上课"}　${esc(i.name)}</div>
       <div class="rs">${esc(i.when)} ${esc(i.span)}（${esc(i.sec)}）　📍${esc(i.room || "待定")}${i.teacher ? "　👤"+esc(i.teacher) : ""}<br>
         第 ${i.week} 周 ${esc(i.day)}　·　${i.minutes<=0 ? "正在上课" : humanGap(i.minutes)+"后"}</div>
       <div class="remact">
         <button class="p" data-a="copy">📋 复制信息</button>
         <button data-a="again">🔁 再发一次</button>
         <button data-a="ics">📅 导出日历</button>
       </div>
     </div>
     <div class="rx"><button data-a="close" title="关闭">✕</button></div>`;
  bar.classList.add("on");
  bar.querySelectorAll("button").forEach(b=>b.onclick=()=>{
    const a = b.dataset.a;
    if(a === "copy")  copyNext();
    if(a === "again") pushNext(true);
    if(a === "ics")   exportIcs();
    if(a === "close") hideRemBar();
  });
  clearTimeout(_remTimer);
  _remTimer = setTimeout(hideRemBar, manual ? 12000 : 30000);
}

/** 核心：把「下一节课」送到本地。manual=true 表示用户手动点的 */
function pushNext(manual){
  const nx = nextSession();
  if(!nx){ toast("本学期没有后续课程了 🎉"); return null; }
  const i = nextInfo(nx), cfg = remCfg();
  let sent = false, why = "";

  if(cfg.desk && notifySupported() && Notification.permission === "granted"){
    try{
      const n = new Notification(
        `${i.minutes<=0 ? "🔴 正在上课" : "⏭ " + humanGap(i.minutes) + "后"} · ${i.name}`,
        { body:`${i.when} ${i.span}（${i.sec}）\n📍${i.room || "待定"}${i.teacher ? "　👤"+i.teacher : ""}\n第 ${i.week} 周 ${i.day}`,
          tag:"wb-next-class", silent:!cfg.sound }
      );
      n.onclick = ()=>{ try{ window.focus(); }catch(e){} switchTab("today"); n.close(); };
      sent = true;
    }catch(e){ why = "通知创建失败"; }
  } else {
    why = cfg.desk ? notifyWhy() : "桌面通知已关闭";
  }
  if(cfg.sound) beep();
  showRemBar(i, manual);
  toast(sent ? "已发送到系统通知 🔔" : (why ? "页面内提醒已弹出（" + why + "）" : "已提醒"));
  return i;
}

function copyNext(){
  const nx = nextSession();
  if(!nx){ toast("没有下一节课可复制"); return; }
  const t = nextText(nx), ok = ()=>toast("已复制到剪贴板 📋");
  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(t).then(ok).catch(()=>copyFallback(t, ok));
  } else copyFallback(t, ok);
}
function copyFallback(t, ok){
  const ta = document.createElement("textarea");
  ta.value = t; ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.appendChild(ta); ta.focus(); ta.select();
  let done = false;
  try{ done = document.execCommand("copy"); }catch(e){}
  ta.remove();
  done ? ok() : toast("复制失败，请手动选中文字");
}

/* ---- .ics 日历导出：交给系统日历做真正的本地推送 ---- */
const _p2 = n => String(n).padStart(2, "0");
function icsStamp(d){ return d.getFullYear()+_p2(d.getMonth()+1)+_p2(d.getDate())+"T"+_p2(d.getHours())+_p2(d.getMinutes())+"00"; }
function icsEsc(v){ return String(v == null ? "" : v).replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n"); }
function buildIcs(){
  const L = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//WorkBuddy//ClassSchedule//CN",
             "CALSCALE:GREGORIAN","METHOD:PUBLISH",
             "X-WR-CALNAME:"+icsEsc(DATA.meta.title || "我的课表"),
             "X-WR-TIMEZONE:Asia/Shanghai"];
  const lead = remCfg().min;
  let cnt = 0;
  for(let w = 1; w <= totalWeeks(); w++){
    if(isMilitary(w)) continue;                       // 军训周不排课
    for(let d = 1; d <= 7; d++){
      const dt = dateOf(w, d-1);
      if(holidayOfDate(dt)) continue;                 // 法定节假日不排课
      const dd = cellDay(w, d-1);                     // 调休上班日 → 用「补周几」的课表
      DATA.sessions.filter(s => s.day === dd && activeIn(s, w)).forEach(s=>{
        const c = course(s.courseId); if(!c) return;
        const a = toMin(slot(s.from).start), b = toMin(slot(s.to).end);
        const st = new Date(dt); st.setHours(Math.floor(a/60), a%60, 0, 0);
        const en = new Date(dt); en.setHours(Math.floor(b/60), b%60, 0, 0);
        const lv = isLeave(s.id, w);
        L.push("BEGIN:VEVENT",
          "UID:" + s.id + "-" + ymd(dt) + "@wb-schedule",
          "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,""),
          "DTSTART:" + icsStamp(st),
          "DTEND:"   + icsStamp(en),
          "SUMMARY:" + icsEsc((lv ? "[已请假] " : "") + c.name),
          "LOCATION:" + icsEsc(s.room || ""),
          "DESCRIPTION:" + icsEsc([s.teacher ? "教师："+s.teacher : "",
             "第 "+w+" 周 "+wd(d),
             s.from === s.to ? "第 "+s.from+" 节" : "第 "+s.from+"-"+s.to+" 节",
             lv ? "已请假" : ""].filter(Boolean).join("\n")),
          "BEGIN:VALARM","ACTION:DISPLAY","TRIGGER:-PT"+lead+"M",
          "DESCRIPTION:" + icsEsc("上课提醒：" + c.name),
          "END:VALARM","END:VEVENT");
        cnt++;
      });
    }
  }
  L.push("END:VCALENDAR");
  return { text: L.join("\r\n"), count: cnt };
}
function exportIcs(){
  const r = buildIcs();
  if(!r.count){ toast("没有可导出的课程"); return; }
  const blob = new Blob(["\ufeff" + r.text], {type:"text/calendar;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `课表日历-${ymd(new Date())}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
  toast(`已导出 ${r.count} 节课（提前 ${remCfg().min} 分钟提醒）`);
}

/* ---- 标签页标题倒计时 ---- */
function titleTick(){
  const cfg = remCfg();
  if(!cfg.title){ if(document.title !== BASE_TITLE) document.title = BASE_TITLE; return; }
  const nx = nextSession();
  if(!nx){ document.title = BASE_TITLE; return; }
  const i = nextInfo(nx);
  const t = i.minutes <= 0 ? "🔴 " + i.name + " 上课中" : "⏭ " + humanGap(i.minutes) + "后 " + i.name;
  const full = t + " · " + BASE_TITLE;
  if(document.title !== full) document.title = full;
}

/* ---- 定时巡检 ---- */
function remTick(){
  try{ titleTick(); }catch(e){}
  const cfg = remCfg();
  if(!cfg.on) return;
  const nx = nextSession(); if(!nx) return;
  if(nx.minutes > cfg.min) return;
  const k = firedKey(nx);
  if(firedHas(k)) return;
  firedSet(k);
  pushNext(false);
}
function startRemind(){
  remTick();
  setInterval(remTick, 20000);
  document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) remTick(); });
  let asked = false;
  const ask = ()=>{ if(asked) return; asked = true; notifyAsk(); };
  document.addEventListener("pointerdown", ask, {once:true});
  document.addEventListener("keydown", ask, {once:true});
}

window.__sched = {
  get data(){return DATA;}, get state(){return state;},
  open: openDrawer, select: switchTab,
  courseByName:(k)=>DATA.courses.find(c=>c.name.includes(k)),
  // 调试/自检用（也给外部小工具留个口子）
  render: { week:renderWeek, today:renderToday, free:renderFree, leave:renderLeave, campus:renderCampus, settings:renderSettings },
  setMakeupFor, quickMakeup, openMkpPop,
  get makeup(){ return makeupList().map(m=>({date:m.date, for:makeupFor(m)})); },
  camViews: CAM_VIEWS, camPlaces: CAMPUS_PLACES, geo: GEO_M,
  camTrip, camTripStats, camTripLines, camDorms, camLeg, camSegClear,
  setCamDorm(v){ camDormName = v; CAM_TRIP_CACHE = null; renderCampus(); },
  setCamRoute(v){ camRouteOn = !!v; CAM_TRIP_CACHE = null; renderCampus(); },
  setCamCat(c){ camCat = c || null; renderCampus(); },
  setCamView(k, sel){ camView = CAM_VIEWS[k] || null; camSel = sel || null; renderCampus(); },
  setWeek(w){ state.viewWeek=w; renderTop(); renderWeek(); },
  next: nextSession, nextInfo, nextText, pushNext, copyNext, exportIcs, buildIcs,
  remCfg, notifyPerm, notifyAsk, remTick, titleTick
};
document.addEventListener("DOMContentLoaded", boot);
})();

















