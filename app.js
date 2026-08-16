const APP_KEY="gym_note_data";
const SESSION_KEY="gym_note_session_v4";
const VERSION=5;

const TEMPLATE={
  dataVersion:5,
  configured:false,
  goals:{weight:null,fat:null,muscle:null,restSeconds:60,calorieGoal:1900,dailyBurn:2300},
  zeroi:[
    {id:"shoulder_elevation",name:"Shoulder Elevation",jp:"ショルダー・エレベーション",target:"背中上部・肩まわり",reps:10,icon:"🙆"},
    {id:"chest_extension",name:"Chest Extension",jp:"チェスト・エクステンション",target:"胸部・肩",reps:10,icon:"🫸"},
    {id:"adductor_extension",name:"Adductor Extension",jp:"アダクター・エクステンション",target:"股関節まわり",reps:10,icon:"🦵"},
    {id:"hip_flex",name:"Hip Flex",jp:"ヒップ・フレックス",target:"臀部・お尻",reps:10,icon:"🍑"}
  ],
  exercises:[
    {id:"legpress",name:"レッグプレス",icon:"🦵",weight:45,reps:10,sets:2,step:5,note:"脚・お尻。膝を伸ばし切らない。"},
    {id:"chest",name:"チェストプレス",icon:"💪",weight:20,reps:10,sets:2,step:2.5,note:"胸。肩をすくめずゆっくり。"},
    {id:"lat",name:"ラットプルダウン",icon:"↙️",weight:22.5,reps:10,sets:2,step:2.5,note:"背中。胸の上へ引く。"},
    {id:"row",name:"シーテッドロー",icon:"🚣",weight:22.5,reps:10,sets:2,step:2.5,note:"背中。肩甲骨を寄せる。"},
    {id:"legcurl",name:"レッグカール",icon:"🦿",weight:17.5,reps:10,sets:2,step:2.5,note:"もも裏。反動を使わない。"},
    {id:"abductor",name:"ヒップアブダクター",icon:"🍑",weight:22.5,reps:12,sets:2,step:2.5,note:"お尻の横。開いて1秒止める。"},
    {id:"abs",name:"アブドミナルクランチ",icon:"🔥",weight:17.5,reps:12,sets:2,step:2.5,note:"腹筋。首ではなく腹を丸める。"}
  ],
  body:[],
  history:[],
  foods:[],
  ai:{endpoint:""}
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
  s.zeroi=x.zeroi?.length?x.zeroi:clone(TEMPLATE.zeroi);
  s.exercises=x.exercises?.length?x.exercises:clone(TEMPLATE.exercises);
  s.body=Array.isArray(x.body)?x.body:[];
  s.foods=Array.isArray(x.foods)?x.foods:[];
  s.ai=Object.assign({},TEMPLATE.ai,x.ai||{});
  s.history=Array.isArray(x.history)?x.history.map(h=>{
    const hh=Object.assign({zeroi:[],note:"",cardioMinutes:h.cardio?20:0},h);
    hh.exercises=Array.isArray(h.exercises)?h.exercises.map(e=>Object.assign({
      setsDone:e.setsDone||0,
      reps:e.reps||10,
      effort:e.effort||""
    },e)):[];
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
let sessionWasRestored=false;

function blankSession(){
  const sets={},weights={},zeroi={};
  state.exercises.forEach(e=>{sets[e.id]=Array(e.sets).fill(false);weights[e.id]=Number(e.weight)||0});
  state.zeroi.forEach(z=>zeroi[z.id]=false);
  return {
    date:todayKey(),
    startedAt:new Date().toISOString(),
    sets,weights,zeroi,efforts:{},
    warmup:false,cardio:false,cardioType:"walk",cardioMinutes:20,
    vibration:false,note:""
  };
}
function sessionHasProgress(s){
  if(!s)return false;
  return Object.values(s.sets||{}).flat().some(Boolean) ||
    Object.values(s.zeroi||{}).some(Boolean) ||
    s.warmup||s.cardio||s.vibration||String(s.note||"").trim().length>0;
}
function loadSession(){
  try{
    const s=JSON.parse(localStorage.getItem(SESSION_KEY));
    if(!s||s.date!==todayKey()) return blankSession();
    const fresh=blankSession();
    Object.assign(fresh,s);
    state.exercises.forEach(e=>{
      if(!Array.isArray(fresh.sets[e.id])) fresh.sets[e.id]=Array(e.sets).fill(false);
      while(fresh.sets[e.id].length<e.sets)fresh.sets[e.id].push(false);
      if(fresh.weights[e.id]==null) fresh.weights[e.id]=e.weight;
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
function quickStats(){
  const b=latestBody();
  const goal=state.goals||{};
  $("quickStats").innerHTML=`
    <div class="quickStat"><span>最新体重</span><b>${b?.weight!=null?fmt(b.weight)+" kg":"—"}</b></div>
    <div class="quickStat"><span>体脂肪率</span><b>${b?.fat!=null?fmt(b.fat)+" %":"—"}</b></div>
    <div class="quickStat"><span>目標体重</span><b>${goal.weight!=null?fmt(goal.weight)+" kg":"—"}</b></div>`;
}
function previousExercise(id){
  const hs=[...state.history].sort((a,b)=>new Date(b.date)-new Date(a.date));
  for(const h of hs){
    const e=(h.exercises||[]).find(x=>x.id===id);
    if(e)return {date:h.date,...e};
  }
  return null;
}
function recommend(e){
  const all=(session.sets[e.id]||[]).slice(0,e.sets).every(Boolean);
  const ef=session.efforts[e.id]||"";
  const w=Number(session.weights[e.id]??e.weight);
  if(!all)return w;
  if(ef==="easy")return w+e.step;
  if(ef==="hard")return Math.max(0,w-e.step);
  return w;
}
function updateProgress(){
  const totalSets=state.exercises.reduce((a,e)=>a+e.sets,0);
  const doneSets=Object.values(session.sets).flat().filter(Boolean).length;
  const zeroTotal=state.zeroi.length;
  const zeroDone=Object.values(session.zeroi).filter(Boolean).length;
  const extras=[session.warmup,session.cardio,session.vibration].filter(Boolean).length;
  const p=Math.round((doneSets+zeroDone+extras)/(totalSets+zeroTotal+3)*100);
  $("ring").style.background=`conic-gradient(var(--accent) ${p*3.6}deg,#262c33 0deg)`;
  $("pct").textContent=p+"%";
}
function touchSession(){saveSession();updateProgress()}

function renderToday(){
  const d=new Date(),w="日月火水木金土"[d.getDay()];
  $("todayDate").textContent=`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${w}）`;
  $("setupNotice").hidden=state.configured;
  $("resumeNotice").hidden=!sessionWasRestored;
  quickStats();

  $("zeroList").innerHTML=state.zeroi.map((z,i)=>`
    <div class="card row">
      <div class="exerciseTitle">
        <span class="icon">${z.icon}</span>
        <div><strong>${i+1}. ${z.name}</strong><small>${z.jp} / ${z.target}<br>ゆっくり ${z.reps}回</small></div>
      </div>
      <button class="done ${session.zeroi[z.id]?"on":""}" data-zero="${z.id}">${session.zeroi[z.id]?"完了 ✓":"完了"}</button>
    </div>`).join("");
  document.querySelectorAll("[data-zero]").forEach(b=>b.onclick=()=>{
    session.zeroi[b.dataset.zero]=!session.zeroi[b.dataset.zero];
    sessionWasRestored=false;touchSession();renderToday();
  });

  $("exerciseList").innerHTML=state.exercises.map((e,i)=>{
    const ef=session.efforts[e.id]||"";
    const prev=previousExercise(e.id);
    const prevText=prev?`${dateLabel(prev.date)}：${fmt(prev.weight)}kg × ${prev.setsDone}set${prev.effort?` / ${effortLabel(prev.effort)}`:""}`:"まだ履歴なし";
    return `<div class="card">
      <div class="exerciseTop">
        <div class="exerciseTitle">
          <span class="icon">${e.icon}</span>
          <div><strong>${i+1}. ${e.name}</strong><small>${e.note}</small></div>
        </div>
        <div class="weight">
          <div class="weightControl">
            <button class="mini" data-weight="${e.id}|-${e.step}">−</button>
            <input type="number" inputmode="decimal" step="${e.step}" value="${fmt(session.weights[e.id])}" data-weight-input="${e.id}">
            <button class="mini" data-weight="${e.id}|${e.step}">＋</button>
          </div>
          <small>kg / ${e.reps}回 × ${e.sets}</small>
        </div>
      </div>
      <div class="previous">前回：<b>${prevText}</b></div>
      <div class="sets">
        ${Array.from({length:e.sets},(_,j)=>`<button class="set ${session.sets[e.id][j]?"on":""}" data-set="${e.id}|${j}">${j+1}セット ${session.sets[e.id][j]?"✓":e.reps+"回"}</button>`).join("")}
      </div>
      <div class="efforts">
        ${[["easy","余裕"],["good","ちょうど"],["hard","きつい"]].map(a=>`<button class="effort ${ef===a[0]?"on":""}" data-eff="${e.id}|${a[0]}">${a[1]}</button>`).join("")}
      </div>
      <div class="next"><span>次回の目安</span><b>${fmt(recommend(e))}kg</b></div>
    </div>`;
  }).join("");

  document.querySelectorAll("[data-set]").forEach(b=>b.onclick=()=>{
    const [id,j]=b.dataset.set.split("|");
    session.sets[id][+j]=!session.sets[id][+j];
    if(session.sets[id][+j])startTimer();
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
    b.onclick=()=>{session[k]=!session[k];sessionWasRestored=false;touchSession();renderToday()};
  });

  document.querySelectorAll("[data-cardio]").forEach(b=>{
    b.classList.toggle("active",session.cardioType===b.dataset.cardio);
    b.onclick=()=>{session.cardioType=b.dataset.cardio;sessionWasRestored=false;touchSession();renderToday()};
  });
  $("walkPane").classList.toggle("active",session.cardioType==="walk");
  $("bikePane").classList.toggle("active",session.cardioType==="bike");
  $("cardioMinutesText").textContent=session.cardioMinutes;
  document.querySelectorAll("[data-cardio-min]").forEach(b=>b.onclick=()=>{
    session.cardioMinutes=Math.max(5,Math.min(120,Number(session.cardioMinutes||20)+Number(b.dataset.cardioMin)));
    sessionWasRestored=false;touchSession();renderToday();
  });
  $("cardioDone").textContent=session.cardio?"有酸素 完了 ✓":"有酸素を完了";
  $("cardioDone").onclick=()=>{session.cardio=!session.cardio;sessionWasRestored=false;touchSession();renderToday()};

  $("sessionNote").value=session.note||"";
  $("sessionNote").oninput=()=>{session.note=$("sessionNote").value;sessionWasRestored=false;saveSession()};
  updateProgress();
}

function effortLabel(v){return v==="easy"?"余裕":v==="good"?"ちょうど":v==="hard"?"きつい":""}

function startTimer(){
  clearInterval(timerI);
  let n=Number(state.goals.restSeconds)||60;
  $("timer").classList.remove("hidden");$("timerN").textContent=n;
  timerI=setInterval(()=>{
    $("timerN").textContent=--n;
    if(n<=0){
      clearInterval(timerI);$("timer").classList.add("hidden");
      navigator.vibrate?.([150,80,150]);toast("休憩終了");
    }
  },1000);
}
$("timerX").onclick=()=>{clearInterval(timerI);$("timer").classList.add("hidden")};

$("saveWorkout").onclick=()=>{
  const done=state.exercises.map(e=>({
    id:e.id,name:e.name,weight:Number(session.weights[e.id]??e.weight),
    reps:e.reps,setsDone:(session.sets[e.id]||[]).filter(Boolean).length,
    effort:session.efforts[e.id]||""
  })).filter(e=>e.setsDone>0);

  if(!done.length){toast("筋トレを1種目以上記録してください");return}

  state.history.unshift({
    id:Date.now(),
    date:new Date().toISOString(),
    zeroi:state.zeroi.filter(z=>session.zeroi[z.id]).map(z=>({id:z.id,name:z.name,reps:z.reps})),
    warmup:session.warmup,
    cardio:session.cardio,
    cardioType:session.cardioType,
    cardioMinutes:session.cardio?session.cardioMinutes:0,
    vibration:session.vibration,
    note:String(session.note||"").trim(),
    exercises:done
  });

  state.exercises.forEach(e=>{
    const all=(session.sets[e.id]||[]).slice(0,e.sets).every(Boolean);
    if(!all)return;
    e.weight=recommend(e);
  });

  state.configured=true;save();clearSession();
  sessionWasRestored=false;session=blankSession();saveSession();
  renderToday();toast("今日のトレーニングを保存しました");
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
  const goal=Number(state.goals.calorieGoal)||1900,burn=Number(state.goals.dailyBurn)||2300;
  const remaining=goal-t.kcal,balance=burn-t.kcal,pct=Math.max(0,Math.min(100,(t.kcal/goal)*100));
  $("foodStats").innerHTML=`
    <div class="foodStat"><span>摂取</span><b>${Math.round(t.kcal)} kcal</b></div>
    <div class="foodStat"><span>目標</span><b>${Math.round(goal)} kcal</b></div>
    <div class="foodStat"><span>消費目安</span><b>${Math.round(burn)} kcal</b></div>`;
  $("foodRemaining").textContent=remaining>=0?`あと ${Math.round(remaining)} kcal`:`${Math.round(Math.abs(remaining))} kcal 超過`;
  $("calorieFill").style.width=pct+"%";$("calorieFill").classList.toggle("over",remaining<0);
  $("foodBalance").textContent=`消費目安との差：${balance>=0?"−":"＋"}${Math.abs(Math.round(balance))} kcal ／ P ${Math.round(t.protein)}g・F ${Math.round(t.fat)}g・C ${Math.round(t.carbs)}g`;
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
  let pin=sessionStorage.getItem("gym_note_ai_pin")||"";
  if(!pin){pin=prompt("AI接続PINを入力してください")||"";if(!pin)return;sessionStorage.setItem("gym_note_ai_pin",pin)}
  $("foodPreview").innerHTML='<div class="card aiLoading"><span class="aiDot"></span><span>AIがカロリーを計算しています…</span></div>';
  $("analyzeFood").disabled=true;
  try{
    const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify({pin,text,meal:mealLabel($("foodMeal").value)})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
    foodPreviewData=normalizeAiResult(data);renderFoodPreview();
  }catch(err){
    if(String(err.message).includes("PIN")){sessionStorage.removeItem("gym_note_ai_pin")}
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

function monthOptions(){
  const months=new Set([localYM(new Date().toISOString())]);
  state.history.forEach(h=>months.add(localYM(h.date)));
  return [...months].sort().reverse();
}
function populateHistoryControls(){
  const months=monthOptions();
  const current=$("historyMonth").value;
  $("historyMonth").innerHTML=months.map(m=>`<option value="${m}">${m.replace("-","年")}月</option>`).join("");
  $("historyMonth").value=months.includes(current)?current:months[0];

  const cur=$("strengthMetric").value;
  $("strengthMetric").innerHTML=state.exercises.map(e=>`<option value="${e.id}">${e.name}</option>`).join("");
  if(state.exercises.some(e=>e.id===cur))$("strengthMetric").value=cur;
}
function renderHistory(){
  populateHistoryControls();
  const ym=$("historyMonth").value||monthOptions()[0];
  const rows=state.history.filter(h=>localYM(h.date)===ym).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const sets=rows.reduce((a,h)=>a+(h.exercises||[]).reduce((b,e)=>b+(e.setsDone||0),0),0);
  const cardio=rows.reduce((a,h)=>a+(h.cardio?Number(h.cardioMinutes||20):0),0);

  $("historySummary").innerHTML=`
    <div class="card"><b>${rows.length}</b><small>この月の回数</small></div>
    <div class="card"><b>${sets}</b><small>総セット</small></div>
    <div class="card"><b>${cardio}</b><small>有酸素 分</small></div>`;

  $("historyList").innerHTML=rows.length?rows.map(h=>{
    const setCount=(h.exercises||[]).reduce((a,e)=>a+(e.setsDone||0),0);
    return `<details class="card historyCard">
      <summary>
        <div class="historySummaryRow">
          <div class="date"><b>${dateLabel(h.date)}</b><small>${timeLabel(h.date)} / ${h.cardio?(h.cardioType==="bike"?"バイク":"ウォーキング")+" "+(h.cardioMinutes||20)+"分":"有酸素なし"}</small></div>
          <span class="count">${setCount} set ▾</span>
        </div>
      </summary>
      <div class="historyBody">
        <div class="historyDetail">
          <div><span>ZERO-i</span><b>${h.zeroi?.length||0}/4種</b></div>
          <div><span>ウォームアップ</span><b>${h.warmup?"完了":"—"}</b></div>
          ${(h.exercises||[]).map(e=>`<div><span>${e.name}</span><b>${fmt(e.weight)}kg × ${e.reps||10}回 × ${e.setsDone||0}set${e.effort?` / ${effortLabel(e.effort)}`:""}</b></div>`).join("")}
          <div><span>有酸素</span><b>${h.cardio?(h.cardioType==="bike"?"バイク":"ウォーキング")+" "+(h.cardioMinutes||20)+"分":"—"}</b></div>
          <div><span>振動マシン</span><b>${h.vibration?"完了":"—"}</b></div>
        </div>
        ${h.note?`<div class="historyNote"><b>メモ</b><br>${escapeHtml(h.note)}</div>`:""}
        <div class="historyActions"><button class="danger" data-delhistory="${h.id}">この記録を削除</button></div>
      </div>
    </details>`;
  }).join(""):`<div class="card muted">この月のトレーニング履歴はまだありません。</div>`;

  document.querySelectorAll("[data-delhistory]").forEach(b=>b.onclick=e=>{
    e.preventDefault();e.stopPropagation();
    if(!confirm("このトレーニング記録を削除しますか？"))return;
    state.history=state.history.filter(h=>String(h.id)!==String(b.dataset.delhistory));
    save();renderHistory();toast("履歴を削除しました");
  });
  drawStrengthChart();
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
$("historyMonth").onchange=renderHistory;
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
  [...state.history].sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(h=>{
    const e=(h.exercises||[]).find(x=>x.id===id);
    if(e&&e.weight!=null){
      const d=new Date(h.date);
      points.push({value:Number(e.weight),label:`${d.getMonth()+1}/${d.getDate()}`});
    }
  });
  const ex=state.exercises.find(e=>e.id===id);
  $("strengthChartCaption").textContent=ex?`${ex.name}（kg）`:"記録された重量";
  drawLineChart($("strengthChart"),points,{minPad:2.5});
}

function renderBody(){
  $("bodyDate").value=todayKey();
  const a=[...state.body].sort((x,y)=>String(y.date).localeCompare(String(x.date)));
  $("bodyList").innerHTML=a.length?a.map(x=>`
    <div class="card bodyRow">
      <div class="row"><strong>${String(x.date).replaceAll("-","/")}</strong><button class="sub compact" data-delbody="${x.date}">削除</button></div>
      <div class="details">
        <span>体重 <b>${fmt(x.weight)}kg</b></span>
        <span>脂肪 <b>${fmt(x.fat)}%</b></span>
        <span>筋肉 <b>${fmt(x.muscle)}kg</b></span>
        ${x.waist!=null?`<span>腹囲 <b>${fmt(x.waist)}cm</b></span>`:""}
      </div>
    </div>`).join(""):`<div class="card muted">まだ身体データがありません。</div>`;
  document.querySelectorAll("[data-delbody]").forEach(b=>b.onclick=()=>{
    if(!confirm("この身体データを削除しますか？"))return;
    state.body=state.body.filter(x=>String(x.date)!==String(b.dataset.delbody));save();renderBody();renderToday();
  });
  drawBodyChart();
}
$("bodyForm").onsubmit=e=>{
  e.preventDefault();
  const x={
    date:$("bodyDate").value,
    weight:Number($("bodyWeight").value),
    fat:$("bodyFat").value?Number($("bodyFat").value):null,
    muscle:$("bodyMuscle").value?Number($("bodyMuscle").value):null,
    waist:$("bodyWaist").value?Number($("bodyWaist").value):null
  };
  state.body=state.body.filter(y=>String(y.date)!==String(x.date));state.body.push(x);
  state.configured=true;save();e.target.reset();renderBody();renderToday();toast("身体データを追加しました");
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
  $("calorieGoal").value=state.goals.calorieGoal||1900;
  $("dailyBurn").value=state.goals.dailyBurn||2300;
  $("aiEndpoint").value=state.ai?.endpoint||"";
}
$("saveSettings").onclick=()=>{
  state.goals={
    weight:$("goalWeight").value?Number($("goalWeight").value):null,
    fat:$("goalFat").value?Number($("goalFat").value):null,
    muscle:$("goalMuscle").value?Number($("goalMuscle").value):null,
    restSeconds:Number($("restSec").value)||60,
    calorieGoal:Number($("calorieGoal").value)||1900,
    dailyBurn:Number($("dailyBurn").value)||2300
  };
  state.ai={endpoint:String($("aiEndpoint").value||"").trim().replace(/\/$/,"")};
  state.configured=true;save();renderToday();toast("設定を保存しました");
};
$("clearAiPin").onclick=()=>{sessionStorage.removeItem("gym_note_ai_pin");toast("AI接続PINを消しました")};

$("exportBtn").onclick=()=>{
  downloadBlob(JSON.stringify(state,null,2),"application/json",`gym-note-backup-${todayKey()}.json`);
};
$("csvBtn").onclick=()=>{
  const rows=[["日時","種目","重量kg","回数","セット数","感覚","ZERO-i数","有酸素","有酸素分","メモ"]];
  [...state.history].sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(h=>{
    (h.exercises||[]).forEach(e=>{
      rows.push([
        new Date(h.date).toLocaleString("ja-JP"),e.name,e.weight,e.reps||"",e.setsDone||"",effortLabel(e.effort),
        h.zeroi?.length||0,h.cardio?(h.cardioType==="bike"?"バイク":"ウォーキング"):"",h.cardio?h.cardioMinutes||20:"",h.note||""
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
    const r=await navigator.serviceWorker.register("./sw.js");
    $("checkUpdate").onclick=async()=>{
      await r.update();toast("更新を確認しました。必要ならアプリを一度閉じて開き直してください");
    };
  }catch(e){}
}
window.addEventListener("load",registerSW);
window.addEventListener("resize",()=>{
  if($("history").classList.contains("active"))drawStrengthChart();
  if($("body").classList.contains("active"))drawBodyChart();
});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveSession()});

renderToday();
