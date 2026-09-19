const APP_KEY="gym_note_data";
const SESSION_KEY="gym_note_session_v4";
const AI_PIN_KEY="gym_note_ai_pin";
const VERSION=12;

const TEMPLATE={
  dataVersion:12,
  configured:true,
  goals:{weight:65,fat:null,muscle:null,restSeconds:60,calorieGoal:1900,dailyBurn:2300,bmr:1522,activityBurn:550},
  zeroi:[
    {id:"shoulder_elevation",name:"Shoulder Elevation",jp:"ショルダー・エレベーション",target:"背中上部・肩まわり",reps:10,icon:"🙆"},
    {id:"chest_extension",name:"Chest Extension",jp:"チェスト・エクステンション",target:"胸部・肩",reps:10,icon:"🫸"},
    {id:"adductor_extension",name:"Adductor Extension",jp:"アダクター・エクステンション",target:"股関節まわり",reps:10,icon:"🦵"},
    {id:"hip_flex",name:"Hip Flex",jp:"ヒップ・フレックス",target:"臀部・お尻",reps:10,icon:"🍑"}
  ],
  exercises:[
    {id:"legpress",name:"レッグプレス",icon:"🦵",weight:45,reps:10,sets:2,step:5,restSeconds:90,note:"脚・お尻。膝を伸ばし切らない。"},
    {id:"chest",name:"チェストプレス",icon:"💪",weight:20,reps:10,sets:2,step:2.5,restSeconds:90,note:"胸。肩をすくめずゆっくり。"},
    {id:"lat",name:"ラットプルダウン",icon:"↙️",weight:22.5,reps:10,sets:2,step:2.5,restSeconds:90,note:"背中。胸の上へ引く。"},
    {id:"row",name:"シーテッドロー",icon:"🚣",weight:22.5,reps:10,sets:2,step:2.5,restSeconds:90,note:"背中。肩甲骨を寄せる。"},
    {id:"legcurl",name:"レッグカール",icon:"🦿",weight:17.5,reps:10,sets:2,step:2.5,restSeconds:60,note:"もも裏。反動を使わない。"},
    {id:"abductor",name:"ヒップアブダクター",icon:"🍑",weight:22.5,reps:12,sets:2,step:2.5,restSeconds:60,note:"お尻の横。開いて1秒止める。"},
    {id:"abs",name:"アブドミナルクランチ",icon:"🔥",weight:17.5,reps:12,sets:2,step:2.5,restSeconds:60,note:"腹筋。首ではなく腹を丸める。"},
    {id:"rotary_torso",name:"ロータリートーソー",icon:"🔄",weight:12.5,reps:10,sets:2,step:2.5,restSeconds:60,note:"腹斜筋。左右それぞれ10回。勢いでねじらない。"},
    {id:"dumbbell_curl",name:"ダンベルカール",icon:"🏋️",weight:5,reps:10,sets:2,step:1,restSeconds:75,note:"上腕二頭筋。5kg/片手。肘を固定し、反動なし。"}
  ],
  body:[
    {date:"2026-09-09",weight:71.0,fat:24.9,muscle:29.8,waist:88.5,bmi:23.5,visceral:7,fatMass:17.7,bmr:1522,score:69}
  ],
  history:[],
  foods:[],
  ai:{endpoint:"",pin:""}
};

const MENU_DEFS={
  A:{name:"Aメニュー",subtitle:"脚＋胸＋背中",exerciseIds:["legpress","chest","row","abductor","dumbbell_curl"]},
  B:{name:"Bメニュー",subtitle:"脚裏＋背中＋お腹",exerciseIds:["legcurl","lat","abs","rotary_torso","legpress"]}
};

const $=id=>document.getElementById(id);
const clone=x=>JSON.parse(JSON.stringify(x));
const fmt=n=>n==null||Number.isNaN(Number(n))?"—":(Number.isInteger(Number(n))?String(Number(n)):Number(n).toFixed(1));
const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const localYM=iso=>{const d=new Date(iso);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`};
const dateLabel=iso=>{const d=new Date(iso);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}（${"日月火水木金土"[d.getDay()]}）`};
const timeLabel=iso=>{const d=new Date(iso);return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};

function migrate(x){
  const s=clone(TEMPLATE);
  if(!x||typeof x!=="object") return s;
  Object.assign(s,x);
  s.dataVersion=VERSION;
  s.goals=Object.assign({},TEMPLATE.goals,x.goals||{});
  // v5以前は「1日の消費目安」だけだったため、基礎代謝＋日常生活＋ジムに分離。
  if(x.goals?.bmr==null) s.goals.bmr=1522;
  if(x.goals?.activityBurn==null) s.goals.activityBurn=550;
  if(x.goals?.weight==null) s.goals.weight=65;
  s.zeroi=x.zeroi?.length?x.zeroi:clone(TEMPLATE.zeroi);

  // v5.4: 既存端末の重量変更などは保持しつつ、新しく追加した種目を自動で補う。
  const savedExercises=Array.isArray(x.exercises)?x.exercises:[];
  const defaultsById=new Map(TEMPLATE.exercises.map(e=>[e.id,e]));
  s.exercises=TEMPLATE.exercises.map(def=>Object.assign({},def,savedExercises.find(e=>e.id===def.id)||{}));
  savedExercises.filter(e=>!defaultsById.has(e.id)).forEach(e=>s.exercises.push(e));

  // 2026-09-09の体組成を基準値として保持。すでに同日のデータがあれば入力済み値を優先。
  s.body=Array.isArray(x.body)?x.body.map(b=>Object.assign({},b)):[];
  const baseline=clone(TEMPLATE.body[0]);
  const baselineIndex=s.body.findIndex(b=>String(b.date)===baseline.date);
  if(baselineIndex>=0) s.body[baselineIndex]=Object.assign({},baseline,s.body[baselineIndex]);
  else s.body.push(baseline);
  const latestBmr=[...s.body].filter(b=>b?.bmr!=null).sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1);
  if(latestBmr) s.goals.bmr=Number(latestBmr.bmr)||s.goals.bmr;
  s.foods=Array.isArray(x.foods)?x.foods:[];
  s.ai=Object.assign({},TEMPLATE.ai,x.ai||{});
  s.history=Array.isArray(x.history)?x.history.map(h=>{
    const hh=Object.assign({menu:"",zeroi:[],note:"",cardioMinutes:h.cardio?20:0,durationMinutes:0,gymCalories:0,gymBreakdown:null,workoutStartedAt:null,workoutEndedAt:null},h);
    hh.exercises=Array.isArray(h.exercises)?h.exercises.map(e=>{
      const out=Object.assign({setsDone:e.setsDone||0,reps:e.reps||10,effort:e.effort||""},e);
      if(!Array.isArray(out.setReps)) out.setReps=Array(Math.max(0,Number(out.setsDone)||0)).fill(Number(out.reps)||10);
      return out;
    }):[];
    return hh;
  }):[];
  if(x.configured!==undefined) s.configured=!!x.configured;
  else s.configured=true;
  return s;
}
function load(){
  try{const x=JSON.parse(localStorage.getItem(APP_KEY));return x?migrate(x):clone(TEMPLATE)}
  catch(e){return clone(TEMPLATE)}
}
function save(){localStorage.setItem(APP_KEY,JSON.stringify(state))}

let state=load();
let installPrompt=null;
let timerI=null;
let timerRemaining=0;
let timerName="";
let sessionWasRestored=false;

function suggestedMenu(){
  const last=(state.history||[]).find(h=>h.menu==="A"||h.menu==="B");
  return last?.menu==="A"?"B":last?.menu==="B"?"A":"A";
}
function menuDef(key=session?.menu){return MENU_DEFS[key]||MENU_DEFS.A}
function menuExercises(key=session?.menu){
  const ids=menuDef(key).exerciseIds;
  return ids.map(id=>state.exercises.find(e=>e.id===id)).filter(Boolean);
}
function exerciseRest(e){return Math.max(30,Number(e?.restSeconds)||Number(state.goals.restSeconds)||60)}

function blankSession(){
  const sets={},weights={},setReps={},zeroi={};
  state.exercises.forEach(e=>{sets[e.id]=Array(e.sets).fill(false);weights[e.id]=Number(e.weight)||0;setReps[e.id]=Array(e.sets).fill(Number(e.reps)||10)});
  state.zeroi.forEach(z=>zeroi[z.id]=false);
  return {
    date:todayKey(),
    startedAt:new Date().toISOString(),
    workoutStartedAt:null,
    menu:suggestedMenu(),sets,weights,setReps,zeroi,efforts:{},
    warmup:false,cardio:false,cardioType:"walk",cardioMinutes:25,
    vibration:false,note:""
  };
}
function sessionHasProgress(s){
  if(!s)return false;
  return !!s.workoutStartedAt || Object.values(s.sets||{}).flat().some(Boolean) ||
    Object.values(s.zeroi||{}).some(Boolean) ||
    s.warmup||s.cardio||s.vibration||String(s.note||"").trim().length>0;
}
function loadSession(){
  try{
    const s=JSON.parse(localStorage.getItem(SESSION_KEY));
    if(!s||s.date!==todayKey()) return blankSession();
    const fresh=blankSession();
    Object.assign(fresh,s);
    if(!MENU_DEFS[fresh.menu]) fresh.menu=suggestedMenu();
    if(!fresh.setReps||typeof fresh.setReps!=="object") fresh.setReps={};
    state.exercises.forEach(e=>{
      if(!Array.isArray(fresh.sets[e.id])) fresh.sets[e.id]=Array(e.sets).fill(false);
      while(fresh.sets[e.id].length<e.sets)fresh.sets[e.id].push(false);
      if(fresh.weights[e.id]==null) fresh.weights[e.id]=e.weight;
      if(!Array.isArray(fresh.setReps[e.id])) fresh.setReps[e.id]=Array(e.sets).fill(Number(e.reps)||10);
      while(fresh.setReps[e.id].length<e.sets)fresh.setReps[e.id].push(Number(e.reps)||10);
    });
    state.zeroi.forEach(z=>{if(fresh.zeroi[z.id]==null)fresh.zeroi[z.id]=false});
    sessionWasRestored=sessionHasProgress(fresh);
    return fresh;
  }catch(e){return blankSession()}
}
let session=loadSession();
function saveSession(){localStorage.setItem(SESSION_KEY,JSON.stringify(session))}
function clearSession(){localStorage.removeItem(SESSION_KEY)}

function toast(t){
  const x=$("toast");x.textContent=t;x.classList.add("show");
  setTimeout(()=>x.classList.remove("show"),1800);
}
function page(id){
  document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===id));
  document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===id));
  window.scrollTo(0,0);
  if(id==="food")renderFood();
  if(id==="history")renderHistory();
  if(id==="body")renderBody();
  if(id==="settings")renderSettings();
}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>page(b.dataset.page));
document.querySelectorAll("[data-page-go]").forEach(b=>b.onclick=()=>page(b.dataset.pageGo));

function latestBody(){
  return [...state.body].sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1)||null;
}

// ---------- 消費カロリー v5.2 ----------
function userWeight(){
  const b=latestBody();
  return Number(b?.weight)||71;
}
function metKcal(met,minutes,weight=userWeight()){
  // 基礎代謝を別に足すため、運動分は「安静時1METを除いた追加消費」として計算。
  return Math.max(0,(Number(met)||0)-1)*3.5*Math.max(30,Number(weight)||71)/200*Math.max(0,Number(minutes)||0);
}
function completedSets(s=session){
  return Object.values(s?.sets||{}).flat().filter(Boolean).length;
}
function completedZeroi(s=session){
  return Object.values(s?.zeroi||{}).filter(Boolean).length;
}
function ensureWorkoutStarted(){
  if(!session.workoutStartedAt){
    session.workoutStartedAt=new Date().toISOString();
    saveSession();
  }
}
function workoutElapsedMinutes(s=session,endAt=new Date()){
  if(!s?.workoutStartedAt)return 0;
  const ms=new Date(endAt)-new Date(s.workoutStartedAt);
  return Math.max(0,Math.min(240,ms/60000));
}
function estimateGymBurn(s=session,endAt=new Date()){
  const weight=userWeight();
  const cardioMin=s?.cardio?Number(s.cardioMinutes||20):0;
  const warmupMin=s?.warmup?5:0;
  const vibrationMin=s?.vibration?5:0;
  const zeroiMin=completedZeroi(s)*1.5;
  const elapsed=workoutElapsedMinutes(s,endAt);
  const fallbackStrength=Math.max(0,completedSets(s)*3+zeroiMin);
  const knownOther=cardioMin+warmupMin+vibrationMin+zeroiMin;
  // 開始時刻がある場合は休憩込みのジム時間から既知の有酸素等を除く。未開始なら記録内容から推定。
  const strengthMin=elapsed>0?Math.max(0,elapsed-knownOther):Math.max(0,completedSets(s)*3);
  const stretch=metKcal(2.5,zeroiMin,weight);
  const strength=metKcal(4.5,strengthMin,weight);
  const warmup=metKcal(3.5,warmupMin,weight);
  const cardio=metKcal(s?.cardioType==="bike"?5.5:4.8,cardioMin,weight);
  const vibration=metKcal(2.0,vibrationMin,weight);
  const total=stretch+strength+warmup+cardio+vibration;
  const duration=elapsed>0?elapsed:strengthMin+knownOther;
  return {
    total:Math.round(total),duration:Math.round(duration),weight,
    stretch:Math.round(stretch),strength:Math.round(strength),warmup:Math.round(warmup),cardio:Math.round(cardio),vibration:Math.round(vibration),
    strengthMin:Math.round(strengthMin),zeroiMin:Math.round(zeroiMin),warmupMin,cardioMin,vibrationMin,estimated:elapsed<=0
  };
}
function historyGymBurn(h){
  if(Number(h?.gymCalories)>0)return Number(h.gymCalories);
  // 旧履歴は保存済み情報から概算。
  const pseudo={
    sets:Object.fromEntries((h?.exercises||[]).map(e=>[e.id,Array(Math.max(0,Number(e.setsDone||0))).fill(true)])),
    zeroi:Object.fromEntries((h?.zeroi||[]).map(z=>[z.id,true])),
    warmup:!!h?.warmup,cardio:!!h?.cardio,cardioType:h?.cardioType||"walk",cardioMinutes:Number(h?.cardioMinutes||20),
    vibration:!!h?.vibration,workoutStartedAt:null
  };
  return estimateGymBurn(pseudo).total;
}
function gymBurnForDay(day){
  let total=(state.history||[]).filter(h=>isoDay(h.date)===day).reduce((a,h)=>a+historyGymBurn(h),0);
  if(day===todayKey() && sessionHasProgress(session)) total+=estimateGymBurn(session).total;
  return Math.round(total);
}
function totalBurnForDay(day){
  const bmr=Number(state.goals.bmr)||1540;
  const activity=Number(state.goals.activityBurn)||550;
  const gym=gymBurnForDay(day);
  return {bmr,activity,gym,total:Math.round(bmr+activity+gym)};
}
function savedGymBurnForDay(day){
  return Math.round((state.history||[])
    .filter(h=>isoDay(h.date)===day)
    .reduce((a,h)=>a+historyGymBurn(h),0));
}
function gymBreakdownForDay(day){
  const sum={stretch:0,strength:0,warmup:0,cardio:0,vibration:0};
  (state.history||[])
    .filter(h=>isoDay(h.date)===day)
    .forEach(h=>{
      const b=historyBreakdown(h);
      Object.keys(sum).forEach(k=>sum[k]+=Number(b?.[k]||0));
    });
  if(day===todayKey() && sessionHasProgress(session)){
    const b=estimateGymBurn(session);
    Object.keys(sum).forEach(k=>sum[k]+=Number(b?.[k]||0));
  }
  Object.keys(sum).forEach(k=>sum[k]=Math.round(sum[k]));
  return sum;
}
function quickStats(){
  const b=latestBody();
  const goal=state.goals||{};
  // v5.5.1: 保存済みの「今日の履歴」も含めた本日合計を表示する。
  const todayGym=gymBurnForDay(todayKey());
  $("quickStats").innerHTML=`
    <div class="quickStat"><span>最新体重</span><b>${b?.weight!=null?fmt(b.weight)+" kg":"—"}</b></div>
    <div class="quickStat"><span>体脂肪率</span><b>${b?.fat!=null?fmt(b.fat)+" %":"—"}</b></div>
    <div class="quickStat"><span>目標体重</span><b>${goal.weight!=null?fmt(goal.weight)+" kg":"—"}</b></div>
    <div class="quickStat gymQuick"><span>今日のジム</span><b>🔥 ${todayGym} kcal</b></div>`;
}
function previousExercise(id){
  const hs=[...state.history].sort((a,b)=>new Date(b.date)-new Date(a.date));
  for(const h of hs){
    const e=(h.exercises||[]).find(x=>x.id===id);
    if(e)return {date:h.date,...e};
  }
  return null;
}
function setRepsFor(e,s=session){
  return Array.from({length:e.sets},(_,j)=>Math.max(0,Number(s?.setReps?.[e.id]?.[j]??e.reps)||0));
}
function recommend(e){
  const done=(session.sets[e.id]||[]).slice(0,e.sets);
  const all=done.length===e.sets&&done.every(Boolean);
  const ef=session.efforts[e.id]||"";
  const w=Number(session.weights[e.id]??e.weight);
  if(!all)return w;
  const reps=setRepsFor(e);
  const min=Math.min(...reps);
  if(ef==="hard"||min<Number(e.reps)*0.6)return Math.max(0,w-e.step);
  if(ef==="easy"&&reps.every(r=>r>=Number(e.reps)))return w+e.step;
  return w;
}
function recommendAdvice(e){
  const done=(session.sets[e.id]||[]).slice(0,e.sets);
  if(done.length!==e.sets||!done.every(Boolean))return "全セット後に判定";
  const reps=setRepsFor(e),min=Math.min(...reps),target=Number(e.reps)||10,ef=session.efforts[e.id]||"";
  if(ef==="hard"||min<target*.6)return "少し軽くしてフォーム優先";
  if(reps.some(r=>r<target))return "重量は維持・休憩をしっかり";
  if(ef==="easy")return "次回は少し重量アップ";
  return "この重量を継続";
}
function updateProgress(){
  const exs=menuExercises();
  const totalSets=exs.reduce((a,e)=>a+e.sets,0);
  const doneSets=exs.reduce((a,e)=>a+(session.sets[e.id]||[]).slice(0,e.sets).filter(Boolean).length,0);
  const zeroTotal=state.zeroi.length;
  const zeroDone=Object.values(session.zeroi).filter(Boolean).length;
  const extras=[session.warmup,session.cardio,session.vibration].filter(Boolean).length;
  const denom=totalSets+zeroTotal+3;
  const p=denom?Math.round((doneSets+zeroDone+extras)/denom*100):0;
  $("ring").style.background=`conic-gradient(var(--accent) ${p*3.6}deg,#262c33 0deg)`;
  $("pct").textContent=p+"%";
}
function touchSession(){saveSession();updateProgress()}

function renderWorkoutTracker(){
  const box=$("workoutTracker");
  if(!box)return;
  const day=todayKey();
  const current=estimateGymBurn(session);
  const saved=savedGymBurnForDay(day);
  const total=gymBurnForDay(day);
  const b=gymBreakdownForDay(day);
  const running=!!session.workoutStartedAt;
  const savedCount=(state.history||[]).filter(h=>isoDay(h.date)===day).length;
  box.innerHTML=`
    <div class="burnTrackerTop">
      <div><span class="muted tiny">ジム消費（本日合計・推定）</span><strong>🔥 ${total} kcal</strong></div>
      <div class="burnTrackerTime"><span>${running?"経過":savedCount?"保存済み":"未開始"}</span><b>${running?current.duration+"分":savedCount?savedCount+"回":"—"}</b></div>
    </div>
    <div class="burnBreakdown">
      <span>ZERO-i <b>${b.stretch} kcal</b></span>
      <span>筋トレ・休憩 <b>${b.strength} kcal</b></span>
      <span>有酸素 <b>${b.cardio} kcal</b></span>
      <span>その他 <b>${b.warmup+b.vibration} kcal</b></span>
    </div>
    <button id="workoutToggle" class="${running?"sub":"primary"} full">${running?"開始時刻をリセット":savedCount?"▶ 追加トレーニング開始":"▶ トレーニング開始"}</button>
    <p class="tiny muted">本日合計：保存済み ${saved} kcal${sessionHasProgress(session)?` ＋ 入力中 ${current.total} kcal`:""}。体重 ${fmt(current.weight)}kg を使った概算です。</p>`;
  $("workoutToggle").onclick=()=>{
    if(running){
      if(!confirm("トレーニング開始時刻を今にリセットしますか？"))return;
    }
    session.workoutStartedAt=new Date().toISOString();
    sessionWasRestored=false;saveSession();renderToday();
  };
}

function renderToday(){
  const d=new Date(),w="日月火水木金土"[d.getDay()];
  $("todayDate").textContent=`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${w}）`;
  $("setupNotice").hidden=state.configured;
  $("resumeNotice").hidden=!sessionWasRestored;
  quickStats();
  renderWorkoutTracker();

  const md=menuDef();
  $("menuSummary").innerHTML=`<b>${md.name}</b>：${md.subtitle}<br><span>${md.exerciseIds.length}種目＋有酸素25〜30分。前回と交互にすると全身を回しやすいです。</span>`;
  document.querySelectorAll("[data-menu]").forEach(b=>{
    b.classList.toggle("active",b.dataset.menu===session.menu);
    b.onclick=()=>{
      const next=b.dataset.menu;if(next===session.menu)return;
      const strengthProgress=Object.values(session.sets||{}).flat().some(Boolean)||Object.keys(session.efforts||{}).length>0;
      if(strengthProgress&&!confirm("A/Bを切り替えると、今日の筋トレのセット入力をリセットします。切り替えますか？"))return;
      if(strengthProgress){
        state.exercises.forEach(e=>{session.sets[e.id]=Array(e.sets).fill(false);session.setReps[e.id]=Array(e.sets).fill(Number(e.reps)||10)});
        session.efforts={};
      }
      session.menu=next;sessionWasRestored=false;saveSession();renderToday();
    };
  });

  $("zeroList").innerHTML=state.zeroi.map((z,i)=>`
    <div class="card row">
      <div class="exerciseTitle">
        <span class="icon">${z.icon}</span>
        <div><strong>${i+1}. ${z.name}</strong><small>${z.jp} / ${z.target}<br>ゆっくり ${z.reps}回</small></div>
      </div>
      <button class="done ${session.zeroi[z.id]?"on":""}" data-zero="${z.id}">${session.zeroi[z.id]?"完了 ✓":"完了"}</button>
    </div>`).join("");
  document.querySelectorAll("[data-zero]").forEach(b=>b.onclick=()=>{
    ensureWorkoutStarted();
    session.zeroi[b.dataset.zero]=!session.zeroi[b.dataset.zero];
    sessionWasRestored=false;touchSession();renderToday();
  });

  const todayExercises=menuExercises();
  $("exerciseList").innerHTML=todayExercises.map((e,i)=>{
    const ef=session.efforts[e.id]||"";
    const prev=previousExercise(e.id);
    const prevReps=prev?.setReps?.length?prev.setReps.slice(0,prev.setsDone||prev.setReps.length).join("/")+"回":prev?`${prev.reps||e.reps}回 × ${prev.setsDone||0}set`:"";
    const prevText=prev?`${dateLabel(prev.date)}：${fmt(prev.weight)}kg / ${prevReps}${prev.effort?` / ${effortLabel(prev.effort)}`:""}`:"まだ履歴なし";
    const reps=setRepsFor(e);
    return `<div class="card exerciseCard">
      <div class="exerciseTop">
        <div class="exerciseTitle">
          <span class="icon">${e.icon}</span>
          <div><strong>${i+1}. ${e.name}</strong><small>${e.note}</small><span class="restBadge">休憩 ${exerciseRest(e)}秒</span></div>
        </div>
        <div class="weight">
          <div class="weightControl">
            <button class="mini" data-weight="${e.id}|-${e.step}">−</button>
            <input type="number" inputmode="decimal" step="${e.step}" value="${fmt(session.weights[e.id])}" data-weight-input="${e.id}">
            <button class="mini" data-weight="${e.id}|${e.step}">＋</button>
          </div>
          <small>kg / 目標 ${e.reps}回 × ${e.sets}</small>
        </div>
      </div>
      <div class="previous">前回：<b>${prevText}</b></div>
      <div class="setRows">
        ${Array.from({length:e.sets},(_,j)=>`<div class="setRow ${session.sets[e.id][j]?"on":""}">
          <div class="setName"><b>${j+1}セット</b><small>目標 ${e.reps}回</small></div>
          <div class="repControl">
            <button class="mini" data-rep="${e.id}|${j}|-1">−</button>
            <strong>${reps[j]}<small>回</small></strong>
            <button class="mini" data-rep="${e.id}|${j}|1">＋</button>
          </div>
          <button class="setDone ${session.sets[e.id][j]?"on":""}" data-set="${e.id}|${j}">${session.sets[e.id][j]?"完了 ✓":"完了"}</button>
        </div>`).join("")}
      </div>
      <p class="setHint">2セット目が8〜9回でもOK。フォームが崩れる前に止めて、実際の回数を残します。</p>
      <div class="efforts">
        ${[["easy","余裕"],["good","ちょうど"],["hard","きつい"]].map(a=>`<button class="effort ${ef===a[0]?"on":""}" data-eff="${e.id}|${a[0]}">${a[1]}</button>`).join("")}
      </div>
      <div class="next"><span>次回の目安 <small>${recommendAdvice(e)}</small></span><b>${fmt(recommend(e))}kg</b></div>
    </div>`;
  }).join("");

  document.querySelectorAll("[data-set]").forEach(b=>b.onclick=()=>{
    ensureWorkoutStarted();
    const [id,j]=b.dataset.set.split("|");
    session.sets[id][+j]=!session.sets[id][+j];
    if(session.sets[id][+j]){
      const e=state.exercises.find(x=>x.id===id);startTimer(exerciseRest(e),e?.name||"休憩");
    }
    sessionWasRestored=false;touchSession();renderToday();
  });
  document.querySelectorAll("[data-rep]").forEach(b=>b.onclick=()=>{
    ensureWorkoutStarted();
    const [id,j,delta]=b.dataset.rep.split("|");
    const e=state.exercises.find(x=>x.id===id);if(!e)return;
    session.setReps[id][+j]=Math.max(0,Math.min(99,Number(session.setReps[id][+j]??e.reps)+Number(delta)));
    sessionWasRestored=false;touchSession();renderToday();
  });
  document.querySelectorAll("[data-eff]").forEach(b=>b.onclick=()=>{
    const [id,v]=b.dataset.eff.split("|");session.efforts[id]=v;
    sessionWasRestored=false;touchSession();renderToday();
  });
  document.querySelectorAll("[data-weight]").forEach(b=>b.onclick=()=>{
    const [id,delta]=b.dataset.weight.split("|");
    session.weights[id]=Math.max(0,Number(session.weights[id]||0)+Number(delta));
    sessionWasRestored=false;touchSession();renderToday();
  });
  document.querySelectorAll("[data-weight-input]").forEach(inp=>{
    inp.onchange=()=>{
      const id=inp.dataset.weightInput;
      session.weights[id]=Math.max(0,Number(inp.value)||0);
      sessionWasRestored=false;touchSession();renderToday();
    };
  });

  document.querySelectorAll("[data-special]").forEach(b=>{
    const k=b.dataset.special;
    b.classList.toggle("on",session[k]);b.textContent=session[k]?"完了 ✓":"完了";
    b.onclick=()=>{ensureWorkoutStarted();session[k]=!session[k];sessionWasRestored=false;touchSession();renderToday()};
  });

  document.querySelectorAll("[data-cardio]").forEach(b=>{
    b.classList.toggle("active",session.cardioType===b.dataset.cardio);
    b.onclick=()=>{session.cardioType=b.dataset.cardio;sessionWasRestored=false;touchSession();renderToday()};
  });
  $("walkPane").classList.toggle("active",session.cardioType==="walk");
  $("bikePane").classList.toggle("active",session.cardioType==="bike");
  $("cardioMinutesText").textContent=session.cardioMinutes;
  document.querySelectorAll("[data-cardio-min]").forEach(b=>b.onclick=()=>{
    session.cardioMinutes=Math.max(5,Math.min(120,Number(session.cardioMinutes||25)+Number(b.dataset.cardioMin)));
    sessionWasRestored=false;touchSession();renderToday();
  });
  $("cardioDone").textContent=session.cardio?"有酸素 完了 ✓":"有酸素を完了";
  $("cardioDone").onclick=()=>{ensureWorkoutStarted();session.cardio=!session.cardio;sessionWasRestored=false;touchSession();renderToday()};

  $("sessionNote").value=session.note||"";
  $("sessionNote").oninput=()=>{session.note=$("sessionNote").value;sessionWasRestored=false;saveSession()};
  updateProgress();
}

function effortLabel(v){return v==="easy"?"余裕":v==="good"?"ちょうど":v==="hard"?"きつい":""}

function paintTimer(){
  if($("timerLabel")) $("timerLabel").textContent=timerName?`${timerName} 休憩`:"休憩";
  $("timerN").textContent=Math.max(0,Math.round(timerRemaining));
}
function startTimer(seconds,label=""){
  clearInterval(timerI);
  timerRemaining=Math.max(1,Number(seconds)||Number(state.goals.restSeconds)||60);
  timerName=label;
  $("timer").classList.remove("hidden");paintTimer();
  timerI=setInterval(()=>{
    timerRemaining--;
    paintTimer();
    if(timerRemaining<=0){
      clearInterval(timerI);$("timer").classList.add("hidden");
      navigator.vibrate?.([150,80,150]);toast("休憩終了・次のセットへ");
    }
  },1000);
}
function stopTimer(){
  clearInterval(timerI);
  timerI=null;timerRemaining=0;timerName="";
  $("timer").classList.add("hidden");
}
$("timerPlus").onclick=()=>{timerRemaining+=30;paintTimer()};
$("timerX").onclick=stopTimer;

$("saveWorkout").onclick=()=>{
  const done=menuExercises().map(e=>({
    id:e.id,name:e.name,weight:Number(session.weights[e.id]??e.weight),
    reps:e.reps,setsDone:(session.sets[e.id]||[]).filter(Boolean).length,
    setReps:setRepsFor(e).filter((_,j)=>!!session.sets[e.id]?.[j]),
    restSeconds:exerciseRest(e),effort:session.efforts[e.id]||""
  })).filter(e=>e.setsDone>0);

  if(!done.length){toast("筋トレを1種目以上記録してください");return}

  const workoutEndedAt=new Date().toISOString();
  const burn=estimateGymBurn(session,workoutEndedAt);
  state.history.unshift({
    id:Date.now(),
    date:workoutEndedAt,
    workoutStartedAt:session.workoutStartedAt||null,
    workoutEndedAt,
    durationMinutes:burn.duration,
    gymCalories:burn.total,
    gymBreakdown:{stretch:burn.stretch,strength:burn.strength,warmup:burn.warmup,cardio:burn.cardio,vibration:burn.vibration},
    calorieWeight:burn.weight,
    zeroi:state.zeroi.filter(z=>session.zeroi[z.id]).map(z=>({id:z.id,name:z.name,reps:z.reps})),
    warmup:session.warmup,
    cardio:session.cardio,
    cardioType:session.cardioType,
    cardioMinutes:session.cardio?session.cardioMinutes:0,
    vibration:session.vibration,
    note:String(session.note||"").trim(),
    menu:session.menu,exercises:done
  });

  menuExercises().forEach(e=>{
    const all=(session.sets[e.id]||[]).slice(0,e.sets).every(Boolean);
    if(!all)return;
    e.weight=recommend(e);
  });

  state.configured=true;save();clearSession();
  stopTimer(); // 保存後に休憩タイマーだけ残るのを防ぐ。
  sessionWasRestored=false;session=blankSession();saveSession();
  renderToday();toast(`保存しました・本日ジム約${gymBurnForDay(todayKey())} kcal`);
};


// ---------- 食事・カロリー v5 ----------
let foodPreviewData=null;
const mealLabel=v=>({breakfast:"朝食",lunch:"昼食",dinner:"夕食",snack:"間食"}[v]||"食事");
function foodDay(entry){return String(entry.day||entry.date||"").slice(0,10)}
function selectedFoodDay(){return $("foodDate")?.value||todayKey()}
function foodsForDay(day=selectedFoodDay()){
  return (state.foods||[]).filter(x=>foodDay(x)===day).sort((a,b)=>new Date(b.createdAt||b.date||0)-new Date(a.createdAt||a.date||0));
}
function foodTotals(rows){
  return rows.reduce((a,x)=>({
    kcal:a.kcal+Number(x.kcal||0),protein:a.protein+Number(x.protein||0),fat:a.fat+Number(x.fat||0),carbs:a.carbs+Number(x.carbs||0)
  }),{kcal:0,protein:0,fat:0,carbs:0});
}
function renderFood(){
  if(!$("foodDate").value)$("foodDate").value=todayKey();
  const day=selectedFoodDay(),rows=foodsForDay(day),t=foodTotals(rows);
  const goal=Number(state.goals.calorieGoal)||1900,burn=totalBurnForDay(day);
  const remaining=goal-t.kcal,balance=t.kcal-burn.total,pct=Math.max(0,Math.min(100,(t.kcal/goal)*100));
  $("foodStats").innerHTML=`
    <div class="foodStat"><span>摂取</span><b>${Math.round(t.kcal)} kcal</b></div>
    <div class="foodStat"><span>基礎代謝</span><b>${Math.round(burn.bmr)} kcal</b></div>
    <div class="foodStat"><span>日常生活</span><b>${Math.round(burn.activity)} kcal</b></div>
    <div class="foodStat gymBurnStat"><span>🏋️ ジム</span><b>＋${Math.round(burn.gym)} kcal</b></div>`;
  $("foodRemaining").textContent=remaining>=0?`あと ${Math.round(remaining)} kcal`:`${Math.round(Math.abs(remaining))} kcal 超過`;
  $("calorieFill").style.width=pct+"%";$("calorieFill").classList.toggle("over",remaining<0);
  $("foodBalance").innerHTML=`<div class="totalBurnLine"><span>今日の総消費</span><b>${burn.total} kcal</b></div>
    <div class="balanceLine">収支：<b>${balance>0?"+":balance<0?"−":""}${Math.abs(Math.round(balance))} kcal</b> <span>（摂取 − 消費）</span></div>
    <div class="macroText">${balance<0?`カロリー赤字 ${Math.abs(Math.round(balance))} kcal`:balance>0?`カロリー超過 ${Math.round(balance)} kcal`:"収支 0 kcal"} / P ${Math.round(t.protein)}g・F ${Math.round(t.fat)}g・C ${Math.round(t.carbs)}g</div>`;
  $("foodCountText").textContent=`${rows.length}件`;
  $("aiConnectionHint").textContent=state.ai?.endpoint?"AI接続済み。APIキーはスマホ側に保存しません。":"AI未接続：設定 → AI食事解析 にAPI URLを入れると使えます。";
  $("foodTodayList").innerHTML=rows.length?rows.map(x=>{
    const items=Array.isArray(x.items)?x.items:[];
    return `<div class="card foodEntry">
      <div class="foodEntryTop">
        <div class="meta"><b>${mealLabel(x.meal)}・${escapeHtml(x.title||x.rawText||"食事")}</b><small>${x.createdAt?timeLabel(x.createdAt):""} ${x.source==="ai"?"/ AI推定":"/ 手動"}</small></div>
        <div class="kcal"><b>${Math.round(Number(x.kcal||0))}</b><small>kcal</small></div>
      </div>
      ${x.rawText&&x.rawText!==x.title?`<p class="foodEntryRaw">${escapeHtml(x.rawText)}</p>`:""}
      ${items.length?`<div class="foodEntryDetails">${items.map(i=>`<div><span>${escapeHtml(i.name||"")} ${escapeHtml(i.amount||"")}</span><b>${Math.round(Number(i.kcal||0))} kcal</b></div>`).join("")}</div>`:""}
      <div class="macroLine"><span>P <b>${Math.round(Number(x.protein||0))}g</b></span><span>F <b>${Math.round(Number(x.fat||0))}g</b></span><span>C <b>${Math.round(Number(x.carbs||0))}g</b></span></div>
      <div class="foodEntryActions"><button class="danger" data-delfood="${x.id}">削除</button></div>
    </div>`;
  }).join(""):`<div class="card muted">この日の食事記録はまだありません。</div>`;
  document.querySelectorAll("[data-delfood]").forEach(b=>b.onclick=()=>{
    if(!confirm("この食事記録を削除しますか？"))return;
    state.foods=state.foods.filter(x=>String(x.id)!==String(b.dataset.delfood));save();renderFood();toast("食事記録を削除しました");
  });
  renderFoodPreview();
}
function getSavedAiPin(){
  // まず、ジムノート本体と同じ保存データから読む。
  // ここは体重・履歴・食事が保存できている端末なら同じ仕組みで確実に残る。
  const main=String(state?.ai?.pin||"").trim();
  if(main)return main;
  // v5.2.2以前の専用localStorageから自動移行。
  try{
    const legacy=String(localStorage.getItem(AI_PIN_KEY)||"").trim();
    if(legacy){
      state.ai=Object.assign({},state.ai||{}, {pin:legacy});
      save();
      return legacy;
    }
  }catch(e){}
  return "";
}
function saveAiPinLocal(pin){
  const v=String(pin||"").trim();
  if(!v)return false;
  try{
    // PINは独立キーだけでなく、普段のジム記録と同じAPP_KEYにも保存する。
    state.ai=Object.assign({},state.ai||{}, {pin:v});
    save();
    // 旧版互換のため独立キーにも二重保存。
    try{localStorage.setItem(AI_PIN_KEY,v)}catch(e){}
    if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
    // APP_KEYから読み直して、本当に書けたか確認。
    const check=JSON.parse(localStorage.getItem(APP_KEY)||"{}");
    return String(check?.ai?.pin||"")===v;
  }catch(e){return false}
}
function clearAiPinLocal(){
  try{
    state.ai=Object.assign({},state.ai||{}, {pin:""});
    save();
  }catch(e){}
  try{localStorage.removeItem(AI_PIN_KEY)}catch(e){}
  try{sessionStorage.removeItem(AI_PIN_KEY)}catch(e){}
}
function updateAiPinStatus(){
  const el=$("aiPinStatus");
  if(!el)return;
  const saved=!!getSavedAiPin();
  el.textContent=saved?"✅ PIN保存済み（次回から入力不要）":"未保存（最初のAI送信時にも入力できます）";
}

function normalizeAiResult(x){
  const items=Array.isArray(x?.items)?x.items.map(i=>({name:String(i.name||"食品"),amount:String(i.amount||""),kcal:Number(i.kcal||0)})):[];
  return {
    title:String(x?.title||items.map(i=>i.name).join("、")||$("foodText").value||"食事"),
    items,
    kcal:Number(x?.total_kcal??x?.kcal??items.reduce((a,i)=>a+i.kcal,0))||0,
    protein:Number(x?.protein_g??x?.protein??0)||0,
    fat:Number(x?.fat_g??x?.fat??0)||0,
    carbs:Number(x?.carbs_g??x?.carbs??0)||0,
    confidence:String(x?.confidence||"medium"),
    note:String(x?.note||"")
  };
}
function renderFoodPreview(){
  if(!foodPreviewData){$("foodPreview").innerHTML="";return}
  const x=foodPreviewData;
  $("foodPreview").innerHTML=`<div class="card foodPreviewCard">
    <div class="foodPreviewTitle"><strong>AIの推定結果</strong><b>${Math.round(x.kcal)} kcal</b></div>
    <div class="foodPreviewItems">${x.items.map(i=>`<div class="foodPreviewItem"><span>${escapeHtml(i.name)} ${escapeHtml(i.amount)}</span><b>${Math.round(i.kcal)} kcal</b></div>`).join("")}</div>
    <div class="macroLine"><span>P <b>${Math.round(x.protein)}g</b></span><span>F <b>${Math.round(x.fat)}g</b></span><span>C <b>${Math.round(x.carbs)}g</b></span><span>確度 <b>${escapeHtml(x.confidence)}</b></span></div>
    ${x.note?`<p class="tiny muted">${escapeHtml(x.note)}</p>`:""}
    <div class="previewKcalEdit"><label>合計は修正できます</label><div><input id="previewKcal" type="number" min="0" step="1" value="${Math.round(x.kcal)}"> kcal</div></div>
    <div class="previewActions"><button id="cancelFoodPreview" class="sub">やめる</button><button id="saveFoodPreview" class="primary">この内容で記録</button></div>
  </div>`;
  $("cancelFoodPreview").onclick=()=>{foodPreviewData=null;renderFoodPreview()};
  $("saveFoodPreview").onclick=()=>{
    const raw=String($("foodText").value||"").trim();
    const rec={id:Date.now(),day:selectedFoodDay(),createdAt:new Date().toISOString(),meal:$("foodMeal").value,rawText:raw,title:x.title,items:x.items,kcal:Number($("previewKcal").value)||0,protein:x.protein,fat:x.fat,carbs:x.carbs,source:"ai"};
    state.foods.unshift(rec);save();foodPreviewData=null;$("foodText").value="";renderFood();toast("食事を記録しました");
  };
}
async function analyzeFood(){
  const text=String($("foodText").value||"").trim();
  if(!text){toast("食べたものを入力してください");return}
  const endpoint=String(state.ai?.endpoint||"").trim();
  if(!endpoint){toast("設定でAI API URLを登録してください");page("settings");return}
  // 旧版のsessionStorage PINがあれば1回だけ移行。
  let pin=getSavedAiPin();
  if(!pin){
    try{
      const oldPin=String(sessionStorage.getItem(AI_PIN_KEY)||"");
      if(oldPin&&saveAiPinLocal(oldPin)){pin=oldPin;sessionStorage.removeItem(AI_PIN_KEY)}
    }catch(e){}
  }
  if(!pin){
    pin=(prompt("AI接続PINを入力してください（この端末に保存します）")||"").trim();
    if(!pin)return;
    if(!saveAiPinLocal(pin)){toast("PINを端末に保存できませんでした");return}
    updateAiPinStatus();
  }
  $("foodPreview").innerHTML='<div class="card aiLoading"><span class="aiDot"></span><span>AIがカロリーを計算しています…</span></div>';
  $("analyzeFood").disabled=true;
  try{
    const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify({pin,text,meal:mealLabel($("foodMeal").value)})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      const er=new Error(data.error||`HTTP ${r.status}`);
      er.status=r.status;
      throw er;
    }
    // 通信成功時にもPINを再保存して、端末保存を確実にする。
    saveAiPinLocal(pin);
    updateAiPinStatus();
    foodPreviewData=normalizeAiResult(data);renderFoodPreview();
  }catch(err){
    // PINそのものが不正な401のときだけ消す。ほかのAPIエラーでは保存PINを維持する。
    if(Number(err.status)===401){clearAiPinLocal();updateAiPinStatus()}
    foodPreviewData=null;$("foodPreview").innerHTML=`<div class="card"><b>AI送信に失敗しました</b><p class="muted tiny">${escapeHtml(err.message||"接続を確認してください")}</p></div>`;
  }finally{$("analyzeFood").disabled=false}
}
$("analyzeFood").onclick=analyzeFood;
$("foodDate").onchange=()=>{foodPreviewData=null;renderFood()};
$("manualFoodSave").onclick=()=>{
  const name=String($("manualFoodName").value||"").trim(),kcal=Number($("manualFoodKcal").value);
  if(!name||!Number.isFinite(kcal)||kcal<0){toast("内容とカロリーを入力してください");return}
  state.foods.unshift({id:Date.now(),day:selectedFoodDay(),createdAt:new Date().toISOString(),meal:$("foodMeal").value,rawText:name,title:name,items:[],kcal,protein:0,fat:0,carbs:0,source:"manual"});
  save();$("manualFoodName").value="";$("manualFoodKcal").value="";renderFood();toast("手動で食事を追加しました");
};
$("foodCsvBtn").onclick=()=>{
  const rows=[["日付","時刻","区分","内容","kcal","たんぱく質g","脂質g","炭水化物g","入力方法"]];
  [...(state.foods||[])].sort((a,b)=>new Date(a.createdAt||a.day)-new Date(b.createdAt||b.day)).forEach(x=>rows.push([foodDay(x),x.createdAt?timeLabel(x.createdAt):"",mealLabel(x.meal),x.rawText||x.title||"",x.kcal||0,x.protein||0,x.fat||0,x.carbs||0,x.source==="ai"?"AI":"手動"]));
  const csv="\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n");downloadBlob(csv,"text/csv;charset=utf-8",`gym-note-food-${todayKey()}.csv`);
};
(function setupFoodVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){$("voiceFood").disabled=true;$("voiceFood").textContent="🎤 音声非対応";return}
  const rec=new SR();rec.lang="ja-JP";rec.interimResults=false;rec.maxAlternatives=1;
  $("voiceFood").onclick=()=>{try{$("voiceFood").textContent="🎤 聞いています…";rec.start()}catch(e){}};
  rec.onresult=e=>{const t=e.results?.[0]?.[0]?.transcript||"";$("foodText").value=($("foodText").value.trim()?$("foodText").value.trim()+"、":"")+t};
  rec.onend=()=>{$("voiceFood").textContent="🎤 音声入力"};
  rec.onerror=()=>{$("voiceFood").textContent="🎤 音声入力";toast("音声入力を使えませんでした")};
})();

function isoDay(iso){
  if(!iso)return "";const d=new Date(iso);if(Number.isNaN(d.getTime()))return String(iso).slice(0,10);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addDays(day,delta){const [y,m,d]=String(day).split("-").map(Number),x=new Date(y,m-1,d);x.setDate(x.getDate()+Number(delta||0));return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`}
function daysInclusive(start,end){if(!start||!end||start>end)return [];const out=[];let d=start,g=0;while(d<=end&&g<4000){out.push(d);d=addDays(d,1);g++}return out}
function historyKnownDays(){return [...(state.history||[]).map(h=>isoDay(h.date)),...(state.foods||[]).map(f=>foodDay(f)),...(state.body||[]).map(b=>String(b.date||"").slice(0,10))].filter(Boolean).sort()}
function defaultHistoryRange(){const end=todayKey();return {start:`${end.slice(0,8)}01`,end}}
function normalizeHistoryRange(){if(!$("historyStart").value||!$("historyEnd").value){const x=defaultHistoryRange();$("historyStart").value=x.start;$("historyEnd").value=x.end}if($("historyStart").value>$("historyEnd").value){const x=$("historyStart").value;$("historyStart").value=$("historyEnd").value;$("historyEnd").value=x}return {start:$("historyStart").value,end:$("historyEnd").value}}
function historyRowsInRange(){const {start,end}=normalizeHistoryRange();return (state.history||[]).filter(h=>{const d=isoDay(h.date);return d>=start&&d<=end}).sort((a,b)=>new Date(b.date)-new Date(a.date))}
function recalcHistoryBurn(h,durationMinutes){
  const duration=Math.max(0,Math.min(600,Number(durationMinutes)||0)),weight=Number(h?.calorieWeight)||userWeight(),cardioMin=h?.cardio?Number(h.cardioMinutes||20):0,warmupMin=h?.warmup?5:0,vibrationMin=h?.vibration?5:0,zeroiMin=(h?.zeroi?.length||0)*1.5;
  const strengthMin=Math.max(0,duration-(cardioMin+warmupMin+vibrationMin+zeroiMin));
  const breakdown={stretch:Math.round(metKcal(2.5,zeroiMin,weight)),strength:Math.round(metKcal(4.5,strengthMin,weight)),warmup:Math.round(metKcal(3.5,warmupMin,weight)),cardio:Math.round(metKcal(h?.cardioType==="bike"?5.5:4.8,cardioMin,weight)),vibration:Math.round(metKcal(2.0,vibrationMin,weight))};
  return {duration,total:Object.values(breakdown).reduce((a,n)=>a+Number(n||0),0),breakdown,weight};
}
function historyBreakdown(h){if(h?.gymBreakdown&&Object.values(h.gymBreakdown).some(v=>Number(v)>0))return h.gymBreakdown;return recalcHistoryBurn(h,Number(h?.durationMinutes)||0).breakdown}
function setHistoryDuration(h,minutes){const r=recalcHistoryBurn(h,minutes);h.durationMinutes=r.duration;h.gymCalories=r.total;h.gymBreakdown=r.breakdown;h.calorieWeight=r.weight;h.durationCorrected=true;const endIso=h.workoutEndedAt||h.date;if(endIso&&r.duration>0){const end=new Date(endIso);if(!Number.isNaN(end.getTime()))h.workoutStartedAt=new Date(end.getTime()-r.duration*60000).toISOString()}}
function populateHistoryControls(){const cur=$("strengthMetric").value;$("strengthMetric").innerHTML=state.exercises.map(e=>`<option value="${e.id}">${e.name}</option>`).join("");if(state.exercises.some(e=>e.id===cur))$("strengthMetric").value=cur;normalizeHistoryRange()}
function renderRangeCalorieSummary(){
  const {start,end}=normalizeHistoryRange(),days=daysInclusive(start,end),recordedDays=days.filter(day=>foodsForDay(day).length>0);let intake=0,burn=0,gym=0;
  recordedDays.forEach(day=>{intake+=foodTotals(foodsForDay(day)).kcal;const b=totalBurnForDay(day);burn+=b.total;gym+=b.gym});
  const balance=intake-burn,avg=recordedDays.length?balance/recordedDays.length:0,sign=n=>n>0?"+":n<0?"−":"";const status=balance<0?`赤字 ${Math.abs(Math.round(balance))} kcal`:balance>0?`超過 ${Math.round(balance)} kcal`:"収支 0 kcal";
  if(!recordedDays.length){$("rangeCalorieSummary").innerHTML=`<div class="rangeTitle"><div><span>期間のカロリー収支</span><b>${start.replaceAll("-","/")} ～ ${end.replaceAll("-","/")}</b></div><strong>—</strong></div><p>この期間には食事記録がありません。<span>食事記録がある日だけを収支集計します。</span></p>`;return}
  $("rangeCalorieSummary").innerHTML=`<div class="rangeTitle"><div><span>期間のカロリー収支</span><b>${start.replaceAll("-","/")} ～ ${end.replaceAll("-","/")}</b></div><strong class="${balance<=0?"deficit":"surplus"}">${sign(balance)}${Math.abs(Math.round(balance))} kcal</strong></div><div class="rangeGrid"><div><span>摂取合計</span><b>${Math.round(intake)} kcal</b></div><div><span>消費合計</span><b>${Math.round(burn)} kcal</b></div><div><span>うちジム</span><b>${Math.round(gym)} kcal</b></div><div><span>1日平均収支</span><b>${sign(avg)}${Math.abs(Math.round(avg))} kcal</b></div></div><p>${status}　<span>計算：摂取 − 消費 / 食事記録あり ${recordedDays.length}日（期間 ${days.length}日）</span></p>`;
}
function historyExerciseText(e){
  const reps=Array.isArray(e?.setReps)&&e.setReps.length?e.setReps.slice(0,e.setsDone||e.setReps.length).join("/")+"回":`${e.reps||10}回 × ${e.setsDone||0}set`;
  return `${fmt(e.weight)}kg × ${reps}${e.effort?` / ${effortLabel(e.effort)}`:""}`;
}
function renderHistory(){
  populateHistoryControls();const rows=historyRowsInRange(),sets=rows.reduce((a,h)=>a+(h.exercises||[]).reduce((b,e)=>b+(e.setsDone||0),0),0),cardio=rows.reduce((a,h)=>a+(h.cardio?Number(h.cardioMinutes||20):0),0),gymKcal=rows.reduce((a,h)=>a+historyGymBurn(h),0),gymMinutes=rows.reduce((a,h)=>a+Number(h.durationMinutes||0),0),zeroi=rows.reduce((a,h)=>a+(h.zeroi?.length||0),0);
  renderRangeCalorieSummary();$("historySummary").innerHTML=`<div class="card"><b>${rows.length}</b><small>ジム回数</small></div><div class="card"><b>${sets}</b><small>総セット</small></div><div class="card"><b>${gymMinutes}</b><small>滞在 分</small></div><div class="card"><b>${cardio}</b><small>有酸素 分</small></div><div class="card"><b>${zeroi}</b><small>ZERO-i 種目</small></div><div class="card"><b>🔥 ${Math.round(gymKcal)}</b><small>ジム kcal</small></div>`;$("historyListMeta").textContent=`${rows.length}件・期間内をすべて表示`;
  $("historyList").innerHTML=rows.length?rows.map(h=>{const setCount=(h.exercises||[]).reduce((a,e)=>a+(e.setsDone||0),0),dur=Number(h.durationMinutes||0),b=historyBreakdown(h),started=h.workoutStartedAt?timeLabel(h.workoutStartedAt):"—",ended=(h.workoutEndedAt||h.date)?timeLabel(h.workoutEndedAt||h.date):"—",zeroNames=(h.zeroi||[]).map(z=>z.jp||z.name).filter(Boolean);return `<details class="card historyCard"><summary><div class="historySummaryRow"><div class="date"><b>${dateLabel(h.date)}${h.menu?` <span class="menuMini">${h.menu}</span>`:""}</b><small>${timeLabel(h.date)} / 🔥 約${Math.round(historyGymBurn(h))} kcal / ${dur?dur+"分":"時間未記録"}${h.durationCorrected?"・訂正済":""}</small></div><span class="count">${setCount} set ▾</span></div></summary><div class="historyBody"><div class="historyOverview"><div><span>開始</span><b>${started}</b></div><div><span>終了</span><b>${ended}</b></div><div><span>滞在</span><b>${dur?dur+"分":"—"}</b></div><div><span>消費</span><b>🔥 ${Math.round(historyGymBurn(h))} kcal</b></div></div><div class="durationEdit"><label>ジム滞在時間を訂正<input type="number" inputmode="numeric" min="0" max="600" step="1" value="${dur||""}" placeholder="分" data-duration-input="${h.id}"></label><button class="sub" data-save-duration="${h.id}">保存して再計算</button></div><div class="historyDetail"><div><span>ZERO-i</span><b>${h.zeroi?.length||0}/4種${zeroNames.length?`（${zeroNames.map(escapeHtml).join("・")}）`:""}</b></div><div><span>ウォームアップ</span><b>${h.warmup?"完了（5分）":"—"}</b></div>${(h.exercises||[]).map(e=>`<div><span>${escapeHtml(e.name)}</span><b>${historyExerciseText(e)}</b></div>`).join("")}<div><span>有酸素</span><b>${h.cardio?(h.cardioType==="bike"?"バイク":"ウォーキング")+" "+(h.cardioMinutes||20)+"分":"—"}</b></div><div><span>振動マシン</span><b>${h.vibration?"完了（5分）":"—"}</b></div></div><div class="historyBurnBreakdown"><div><span>ZERO-i</span><b>${Math.round(Number(b.stretch||0))} kcal</b></div><div><span>筋トレ・休憩</span><b>${Math.round(Number(b.strength||0))} kcal</b></div><div><span>ウォームアップ</span><b>${Math.round(Number(b.warmup||0))} kcal</b></div><div><span>有酸素</span><b>${Math.round(Number(b.cardio||0))} kcal</b></div><div><span>振動</span><b>${Math.round(Number(b.vibration||0))} kcal</b></div><div class="total"><span>ジム消費 合計</span><b>🔥 ${Math.round(historyGymBurn(h))} kcal</b></div></div>${h.note?`<div class="historyNote"><b>メモ</b><br>${escapeHtml(h.note)}</div>`:""}<div class="historyActions"><button class="danger" data-delhistory="${h.id}">この記録を削除</button></div></div></details>`}).join(""):`<div class="card muted">指定期間のトレーニング履歴はまだありません。</div>`;
  document.querySelectorAll("[data-save-duration]").forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const id=String(b.dataset.saveDuration),h=state.history.find(x=>String(x.id)===id),inp=document.querySelector(`[data-duration-input="${id}"]`),min=Number(inp?.value);if(!h||!Number.isFinite(min)||min<0||min>600){toast("滞在時間は0〜600分で入力してください");return}setHistoryDuration(h,Math.round(min));save();renderHistory();toast("ジム滞在時間と消費カロリーを訂正しました")});
  document.querySelectorAll("[data-delhistory]").forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();if(!confirm("このトレーニング記録を削除しますか？"))return;state.history=state.history.filter(h=>String(h.id)!==String(b.dataset.delhistory));save();renderHistory();toast("履歴を削除しました")});drawStrengthChart();
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
$("historyStart").onchange=renderHistory;
$("historyEnd").onchange=renderHistory;
document.querySelectorAll("[data-range-days]").forEach(b=>b.onclick=()=>{const end=todayKey(),days=Math.max(1,Number(b.dataset.rangeDays)||7);$("historyEnd").value=end;$("historyStart").value=addDays(end,-(days-1));renderHistory()});
document.querySelectorAll("[data-range]").forEach(b=>b.onclick=()=>{const end=todayKey();if(b.dataset.range==="month"){$("historyEnd").value=end;$("historyStart").value=`${end.slice(0,8)}01`}else if(b.dataset.range==="all"){const ds=historyKnownDays();$("historyStart").value=ds[0]||end;$("historyEnd").value=ds[ds.length-1]||end}renderHistory()});
$("strengthMetric").onchange=drawStrengthChart;

function drawLineChart(canvas,points,opts={}){
  const ctx=canvas.getContext("2d"),w=canvas.clientWidth,h=220,dpr=devicePixelRatio||1;
  canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  ctx.strokeStyle="#2d343c";ctx.lineWidth=1;
  for(let i=0;i<5;i++){const y=20+i*(h-45)/4;ctx.beginPath();ctx.moveTo(18,y);ctx.lineTo(w-12,y);ctx.stroke()}
  if(!points.length){ctx.fillStyle="#98a2ad";ctx.font="13px sans-serif";ctx.fillText("まだ記録がありません",20,40);return}
  const vals=points.map(p=>p.value),mn=Math.min(...vals),mx=Math.max(...vals),pad=Math.max((mx-mn)*.25,opts.minPad||1),lo=mn-pad,hi=mx+pad;
  const X=i=>points.length===1?w/2:24+i*(w-48)/(points.length-1),Y=v=>h-30-(v-lo)/(hi-lo)*(h-58);
  ctx.strokeStyle="#a8ef70";ctx.lineWidth=3;ctx.beginPath();
  points.forEach((p,i)=>i?ctx.lineTo(X(i),Y(p.value)):ctx.moveTo(X(i),Y(p.value)));ctx.stroke();
  points.forEach((p,i)=>{
    const x=X(i),y=Y(p.value);ctx.fillStyle="#a8ef70";ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#e8ecef";ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText(fmt(p.value),x,y-9);
    ctx.fillStyle="#7f8994";ctx.fillText(p.label,x,h-9);
  });
}
function drawStrengthChart(){
  const id=$("strengthMetric").value||state.exercises[0]?.id;
  if(!id)return;
  const points=[];
  const range=normalizeHistoryRange();
  [...state.history].filter(h=>{const d=isoDay(h.date);return d>=range.start&&d<=range.end}).sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(h=>{
    const e=(h.exercises||[]).find(x=>x.id===id);
    if(e&&e.weight!=null){
      const d=new Date(h.date);
      points.push({value:Number(e.weight),label:`${d.getMonth()+1}/${d.getDate()}`});
    }
  });
  const ex=state.exercises.find(e=>e.id===id);
  const rg=normalizeHistoryRange();
  $("strengthChartCaption").textContent=ex?`${ex.name}（kg） / ${rg.start.slice(5).replace("-","/")}〜${rg.end.slice(5).replace("-","/")}`:"指定期間の記録";
  drawLineChart($("strengthChart"),points,{minPad:2.5});
}

const BODY_FIELDS=[
  ["bodyWeight","weight"],["bodyFat","fat"],["bodyMuscle","muscle"],["bodyWaist","waist"],
  ["bodyBmi","bmi"],["bodyVisceral","visceral"],["bodyFatMass","fatMass"],["bodyBmr","bmr"],["bodyScore","score"]
];
function fillBodyFormForDate(day){
  const x=(state.body||[]).find(b=>String(b.date)===String(day));
  BODY_FIELDS.forEach(([id,key])=>{$(id).value=x?.[key]??""});
}
function bodyMetric(label,value,unit=""){return value==null?"":`<span>${label} <b>${fmt(value)}${unit}</b></span>`}
function renderBody(){
  const selected=$("bodyDate").value||todayKey();
  $("bodyDate").value=selected;
  fillBodyFormForDate(selected);
  const latest=latestBody();
  $("bodyLatestSummary").innerHTML=latest?`
    <div class="bodyLatestHead"><div><span class="muted tiny">最新の基準データ</span><strong>${String(latest.date).replaceAll("-","/")}</strong></div><b>${fmt(latest.weight)} kg</b></div>
    <div class="bodyLatestGrid">
      ${bodyMetric("体脂肪",latest.fat,"%")}${bodyMetric("骨格筋",latest.muscle,"kg")}${bodyMetric("腹囲",latest.waist,"cm")}
      ${bodyMetric("BMI",latest.bmi)}${bodyMetric("内臓脂肪",latest.visceral)}${bodyMetric("体脂肪量",latest.fatMass,"kg")}
      ${bodyMetric("基礎代謝",latest.bmr,"kcal")}${bodyMetric("InBody",latest.score,"点")}
    </div>`:`<span class="muted">まだ身体データがありません。</span>`;

  const a=[...state.body].sort((x,y)=>String(y.date).localeCompare(String(x.date)));
  $("bodyList").innerHTML=a.length?a.map(x=>`
    <div class="card bodyRow">
      <div class="row"><strong>${String(x.date).replaceAll("-","/")}</strong><button class="sub compact" data-delbody="${x.date}">削除</button></div>
      <div class="details">
        ${bodyMetric("体重",x.weight,"kg")}${bodyMetric("脂肪",x.fat,"%")}${bodyMetric("筋肉",x.muscle,"kg")}${bodyMetric("腹囲",x.waist,"cm")}
        ${bodyMetric("BMI",x.bmi)}${bodyMetric("内臓脂肪",x.visceral)}${bodyMetric("体脂肪量",x.fatMass,"kg")}${bodyMetric("基礎代謝",x.bmr,"kcal")}${bodyMetric("InBody",x.score,"点")}
      </div>
    </div>`).join(""):`<div class="card muted">まだ身体データがありません。</div>`;
  document.querySelectorAll("[data-delbody]").forEach(b=>b.onclick=()=>{
    if(!confirm("この身体データを削除しますか？"))return;
    state.body=state.body.filter(x=>String(x.date)!==String(b.dataset.delbody));save();renderBody();renderToday();
  });
  drawBodyChart();
}
$("bodyDate").onchange=()=>fillBodyFormForDate($("bodyDate").value);
$("bodyForm").onsubmit=e=>{
  e.preventDefault();
  const x={
    date:$("bodyDate").value,
    weight:Number($("bodyWeight").value),
    fat:$("bodyFat").value?Number($("bodyFat").value):null,
    muscle:$("bodyMuscle").value?Number($("bodyMuscle").value):null,
    waist:$("bodyWaist").value?Number($("bodyWaist").value):null,
    bmi:$("bodyBmi").value?Number($("bodyBmi").value):null,
    visceral:$("bodyVisceral").value?Number($("bodyVisceral").value):null,
    fatMass:$("bodyFatMass").value?Number($("bodyFatMass").value):null,
    bmr:$("bodyBmr").value?Number($("bodyBmr").value):null,
    score:$("bodyScore").value?Number($("bodyScore").value):null
  };
  state.body=state.body.filter(y=>String(y.date)!==String(x.date));state.body.push(x);
  if(x.bmr!=null) state.goals.bmr=x.bmr;
  state.configured=true;save();renderBody();renderToday();toast("身体データを保存しました");
};
$("metric").onchange=drawBodyChart;
function drawBodyChart(){
  const key=$("metric").value;
  const a=[...state.body].sort((x,y)=>String(x.date).localeCompare(String(y.date))).filter(x=>x[key]!=null).map(x=>({value:Number(x[key]),label:String(x.date).slice(5).replace("-","/")}));
  drawLineChart($("chart"),a,{minPad:key==="weight"?1:.5});
}

function renderSettings(){
  $("goalWeight").value=state.goals.weight??"";
  $("goalFat").value=state.goals.fat??"";
  $("goalMuscle").value=state.goals.muscle??"";
  $("restSec").value=state.goals.restSeconds||60;
  if($("exerciseRestSettings")) $("exerciseRestSettings").innerHTML=state.exercises.map(e=>`<label class="restSettingRow"><span>${e.name}</span><span><input type="number" min="30" max="300" step="15" value="${exerciseRest(e)}" data-rest-input="${e.id}"> 秒</span></label>`).join("");
  $("calorieGoal").value=state.goals.calorieGoal||1900;
  $("bmr").value=state.goals.bmr||1522;
  $("activityBurn").value=state.goals.activityBurn||550;
  $("aiEndpoint").value=state.ai?.endpoint||"";
  if($("aiPin")) $("aiPin").value="";
  updateAiPinStatus();
}
$("saveSettings").onclick=()=>{
  state.goals={
    weight:$("goalWeight").value?Number($("goalWeight").value):null,
    fat:$("goalFat").value?Number($("goalFat").value):null,
    muscle:$("goalMuscle").value?Number($("goalMuscle").value):null,
    restSeconds:Number($("restSec").value)||60,
    calorieGoal:Number($("calorieGoal").value)||1900,
    dailyBurn:Number(state.goals.dailyBurn)||2300,
    bmr:Number($("bmr").value)||1522,
    activityBurn:Number($("activityBurn").value)||550
  };
  document.querySelectorAll("[data-rest-input]").forEach(inp=>{const e=state.exercises.find(x=>x.id===inp.dataset.restInput);if(e)e.restSeconds=Math.max(30,Number(inp.value)||Number(state.goals.restSeconds)||60)});
  state.ai=Object.assign({},state.ai||{}, {endpoint:String($("aiEndpoint").value||"").trim().replace(/\/$/,"")});
  state.configured=true;save();renderToday();toast("設定を保存しました");
};
$("saveAiPin").onclick=()=>{
  const pin=String($("aiPin").value||"").trim();
  if(!pin){toast("PINを入力してください");return}
  if(saveAiPinLocal(pin)){$("aiPin").value="";updateAiPinStatus();toast("AI接続PINをこの端末に保存しました")}
  else toast("PINを保存できませんでした");
};
$("clearAiPin").onclick=()=>{clearAiPinLocal();$("aiPin").value="";updateAiPinStatus();toast("この端末に保存したAI接続PINを消しました")};

$("exportBtn").onclick=()=>{
  const backup=clone(state);
  if(backup.ai) backup.ai.pin="";
  downloadBlob(JSON.stringify(backup,null,2),"application/json",`gym-note-backup-${todayKey()}.json`);
};
$("csvBtn").onclick=()=>{
  const rows=[["日時","メニュー","種目","重量kg","目標回数","セット別回数","セット数","感覚","休憩秒","ZERO-i数","有酸素","有酸素分","ジム消費kcal","ジム時間分","メモ"]];
  [...state.history].sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(h=>{
    (h.exercises||[]).forEach(e=>{
      rows.push([
        new Date(h.date).toLocaleString("ja-JP"),h.menu||"",e.name,e.weight,e.reps||"",Array.isArray(e.setReps)?e.setReps.join("/"):"",e.setsDone||"",effortLabel(e.effort),e.restSeconds||"",
        h.zeroi?.length||0,h.cardio?(h.cardioType==="bike"?"バイク":"ウォーキング"):"",h.cardio?h.cardioMinutes||25:"",Math.round(historyGymBurn(h)),h.durationMinutes||"",h.note||""
      ]);
    });
  });
  const csv="\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n");
  downloadBlob(csv,"text/csv;charset=utf-8",`gym-note-history-${todayKey()}.csv`);
};
function csvCell(v){const s=String(v??"");return `"${s.replaceAll('"','""')}"`}
function downloadBlob(text,type,name){
  const blob=new Blob([text],{type}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
$("importFile").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    state=migrate(JSON.parse(await f.text()));save();
    clearSession();session=blankSession();saveSession();
    renderToday();toast("データを読み込みました");
  }catch(err){toast("JSONを読み込めませんでした")}
  e.target.value="";
};
$("resetBtn").onclick=()=>{
  if(!confirm("この端末内の履歴・身体データを初期化しますか？"))return;
  state=clone(TEMPLATE);save();clearSession();session=blankSession();saveSession();renderToday();toast("初期化しました");
};

window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();installPrompt=e;$("installBtn").hidden=false;
  $("installBtn").onclick=async()=>{installPrompt.prompt();await installPrompt.userChoice;$("installBtn").hidden=true;installPrompt=null};
});

async function registerSW(){
  if(!("serviceWorker" in navigator))return;
  try{
    let reloading=false;
    navigator.serviceWorker.addEventListener("controllerchange",()=>{
      if(reloading)return;reloading=true;
      location.reload();
    });
    const r=await navigator.serviceWorker.register("./sw.js?v=552",{updateViaCache:"none"});
    await r.update().catch(()=>{});
    $("checkUpdate").onclick=async()=>{
      try{
        toast("最新版を確認しています…");
        await r.update();
        setTimeout(()=>location.replace(`./index.html?v=552&refresh=${Date.now()}`),500);
      }catch(e){toast("更新確認に失敗しました")}
    };
  }catch(e){}
}
window.addEventListener("load",registerSW);
window.addEventListener("resize",()=>{
  if($("history").classList.contains("active"))drawStrengthChart();
  if($("body").classList.contains("active"))drawBodyChart();
});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveSession()});

setInterval(()=>{
  if($("today")?.classList.contains("active") && session.workoutStartedAt){
    renderWorkoutTracker();quickStats();updateProgress();
  }
  if($("food")?.classList.contains("active"))renderFood();
},30000);

renderToday();
