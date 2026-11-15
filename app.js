/* ============================ 基础设施 ============================ */
const KEY = 'sf_en_v1';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const pad = n => (n<10?'0':'')+n;
function today(){ const d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function addDays(dstr,n){ const d=new Date(dstr+'T00:00:00'); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function daysBetween(a,b){ return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000); }
function toast(t){ const el=$('#toast'); el.textContent=t; el.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('on'),1800); }

const INTERVALS=[1,2,3,5,8,14,30];

/* ============================ 状态 ============================ */
function blank(){ return {ver:1, prog:{}, wprog:{}, logs:[], examBest:null}; }
let S = blank();
try{ const raw=localStorage.getItem(KEY); if(raw){ const o=JSON.parse(raw); if(o&&typeof o==='object'){ S=Object.assign(blank(),o); if(!S.prog)S.prog={}; } } }catch(e){}
function save(){ try{ localStorage.setItem(KEY,JSON.stringify(S)); }catch(e){ toast('保存失败：浏览器存储可能已满'); } }

function P(id){ if(!S.prog[id]) S.prog[id]={s:0,o:0,b:0,lv:0,due:today(),off:false,fav:false}; return S.prog[id]; }
/* 读：不存在就给默认值，不写盘；写：用 Wset */
function W(id){ return S.wprog[id] || {lv:0,due:today(),r:0}; }
function Wset(id){ if(!S.wprog[id]) S.wprog[id]={lv:0,due:today(),r:0}; return S.wprog[id]; }

/* 改错判分后写进度 */
function gradeFix(q, ok){
  const p=P(q[0]);
  if(ok){ p.s++; p.lv=Math.min(p.lv+1,INTERVALS.length-1); }
  else { p.o++; p.b++; p.lv=0; }
  p.due = addDays(today(), INTERVALS[p.lv]);
  p.off = false;
  logToday('fix', ok?1:0, 1);
  save();
}
function logToday(type, good, all){
  const d=today();
  let l=S.logs.find(x=>x.d===d&&x.type===type);
  if(!l){ l={d,type,good:0,all:0}; S.logs.push(l); }
  l.good+=good; l.all+=all;
  if(S.logs.length>400) S.logs=S.logs.slice(-400);
}
function todayLog(type){ const l=S.logs.find(x=>x.d===today()&&x.type===type); return l?l:{good:0,all:0}; }

/* 队列统计 */
const dueWords = () => WORDS.filter(w=>{ const p=W(w[0]); return p.lv<INTERVALS.length-1 && p.due<=today(); });
const dueFixList = () => FIX.filter(q=>{ const p=S.prog[q[0]]; return p && p.b>0 && !p.off && p.due<=today(); });
const weakTags = () => Object.keys(TAGS).map(t=>{
  let s=0,o=0;
  FIX.filter(q=>q[1]===t).forEach(q=>{ const p=S.prog[q[0]]; if(p){ s+=p.s; o+=p.o; } });
  return {t,n:s+o,acc:(s+o)?s/(s+o):null};
}).sort((a,b)=>(a.acc===null?9:a.acc)-(b.acc===null?9:b.acc));

/* 题队列 */
let Q = {list:[],i:0,ok:0,answered:false,picked:null,mode:'fix',tag:null,living:false,endAt:0,tick:0,lock:false};
function startFix(n, tag){
  let pool = FIX.filter(q=>tag?q[1]===tag:true);
  const due = pool.filter(q=>{ const p=S.prog[q[0]]; return p&&p.b>0&&!p.off&&p.due<=today(); });
  const rest = pool.filter(q=>!due.includes(q));
  let arr = due.concat(rest.sort(()=>Math.random()-0.5));
  arr = arr.slice(0, Math.min(n, arr.length));
  Q={list:arr,i:0,ok:0,answered:false,picked:null,mode:'fix',tag:tag||null,living:false,endAt:0,lock:false};
  location.hash='#quiz';
}
function startReview(){
  const arr = dueFixList().sort(()=>Math.random()-0.5).slice(0,20);
  if(!arr.length){ toast('今天没有到期错题，去做 10 道改错'); return; }
  Q={list:arr,i:0,ok:0,answered:false,picked:null,mode:'fix',tag:'回炉',living:false,endAt:0,lock:false};
  location.hash='#quiz';
}
function startExam(){
  const arr = FIX.slice().sort(()=>Math.random()-0.5).slice(0,20);
  Q={list:arr,i:0,ok:0,answered:false,picked:null,mode:'exam',tag:null,living:true,endAt:Date.now()+EXAM_MIN*60000,tick:0,lock:false};
  location.hash='#quiz';
}
/* 词卡队列 */
let WQ={list:[],i:0,revealed:false,type:null,ok:0};
function startWords(n, type){
  const pool = WORDS.filter(w=>type?w[1]===type:true);
  const due = pool.filter(w=>{ const p=W(w[0]); return p.due<=today(); });
  const rest = pool.filter(w=>!due.includes(w));
  let arr = due.concat(rest).slice(0, Math.min(n, pool.length));
  WQ={list:arr,i:0,revealed:false,type:type||null,ok:0};
  location.hash='#wquiz';
}
function gradeWord(ok){
  const w=WQ.list[WQ.i], p=Wset(w[0]);
  if(ok){ p.lv=Math.min(p.lv+1,INTERVALS.length-1); p.r++; WQ.ok++; }
  else { p.lv=0; }
  p.due = addDays(today(), INTERVALS[p.lv]);
  logToday('word', ok?1:0, 1);
  save();
  WQ.revealed=false; WQ.i++;
  if(WQ.i>=WQ.list.length){ save(); location.hash='#today'; Q.living=false; render(); toast('这一组背完了'); }
  else render();
}

/* ============================ 计时 ============================ */
setInterval(()=>{
  if(Q.living && !Q.lock){
    const left=Math.max(0,Math.round((Q.endAt-Date.now())/1000));
    const el=$('#timer');
    if(el){ el.textContent=fmt(left); el.classList.toggle('low', left<=600); }
    if(left<=0){ Q.lock=true; Q.result=true; toast('时间到，本卷已锁定'); render(); }
  }
},1000);
function fmt(sec){ const m=Math.floor(sec/60), s=sec%60; return pad(m)+':'+pad(s); }

/* ============================ 视图 ============================ */
const VIEWS={};

VIEWS.today = () => {
  const left = daysBetween(today(), EXAM_DATE);
  const dw = dueWords().length, df = dueFixList().length;
  const wDone = todayLog('word').all, fDone = todayLog('fix').all;
  const reviewed = S.reviewedOn===today();
  const thirdOk = df===0 ? (wDone>=10 && fDone>=10) : reviewed;
  const done = (wDone>=10?1:0)+(fDone>=10?1:0)+(thirdOk?1:0);
  const wt = weakTags().filter(x=>x.n>0);
  return `<h1>距考试还有 ${left} 天</h1>
  <div class="muted">今天只做三件。做完一件打一个勾，剩下的交给明天。</div>

  <h2>今日三件</h2>
  <div class="card tint">
    <div class="between" style="margin-bottom:6px"><h3 style="margin:0">1 · 考点词 10 条</h3><span class="chip ${wDone>=10?'on':''}">${Math.min(wDone,10)}/10</span></div>
    <div class="small">到期 ${dw} 条${dw>10?'，先做到期的':''}。只记「看到什么就选什么」，不背中文释义。</div>
    <div class="qfoot"><button class="btn sm" data-act="words10">开始背词</button><button class="btn sm ghost" data-act="wordsA">只背 A 类</button></div>
  </div>
  <div class="card tint">
    <div class="between" style="margin-bottom:6px"><h3 style="margin:0">2 · 改错 10 题</h3><span class="chip ${fDone>=10?'on':''}">${Math.min(fDone,10)}/10</span></div>
    <div class="small">到期错题 ${df} 道${wt.length?'，最弱：'+TAGS[wt[0].t][0]:''}。每做完一题，说出它属于哪一类。</div>
    <div class="qfoot"><button class="btn sm" data-act="fix10">开始做题</button><button class="btn sm ghost" data-act="review">回炉到期 ${df}</button></div>
  </div>
  <div class="card ${df===0?'tint':''}">
    <div class="between" style="margin-bottom:6px"><h3 style="margin:0">3 · 回炉与复盘</h3><span class="chip ${df===0?'on':''}">${df===0?'无需回炉':'待回炉 '+df}</span></div>
    <div class="small">${df===0?'今天没有到期错题。把昨天的错题说一遍错在哪类，再做 5 道巩固。':'先回炉，再开新题。回炉顺序按 1/2/3/5/8 天自动排。'}</div>
    <div class="qfoot"><button class="btn sm ghost" data-act="review">回炉</button><button class="btn sm ghost" data-act="goto-fix">看十类清单</button></div>
  </div>

  <div class="stats">
    <div class="stat"><b>${done}/3</b><span>今日完成</span></div>
    <div class="stat"><b>${FIX.filter(q=>{const p=S.prog[q[0]];return p&&p.s>0;}).length}</b><span>做对过的题</span></div>
    <div class="stat"><b>${WORDS.filter(w=>W(w[0]).lv>=2).length}</b><span>记住的词</span></div>
  </div>

  <h2>80 分怎么凑（按题型反推）</h2>
  <div class="card">
    <table class="tb"><colgroup><col style="width:34%"><col style="width:16%"><col style="width:50%"></colgroup>
      <tr><th>题型</th><th class="num">目标</th><th>条件</th></tr>
      <tr><td>阅读 40</td><td class="num">28</td><td>20 题对 14 题</td></tr>
      <tr><td>改错 20</td><td class="num">18</td><td>10 题对 9 题（主战场）</td></tr>
      <tr><td>写作 20</td><td class="num">14</td><td>框架 + 15 句模板</td></tr>
      <tr><td>选词 15</td><td class="num">9</td><td>先判词性再选</td></tr>
      <tr><td>汉译英 15</td><td class="num">9</td><td>5 句，抓主干</td></tr>
      <tr><td>完形 20</td><td class="num">8</td><td>只做搭配空</td></tr>
      <tr><td>判断 10</td><td class="num">6</td><td>比对，不通读</td></tr>
      <tr><td>英译汉 10</td><td class="num">6</td><td>抓主干</td></tr>
    </table>
    <div class="small" style="margin-top:8px">合计 80。改错是唯一能在两周内从 0 到 6 题的板块，所以第一个月重心不在阅读。</div>
  </div>`;
};

VIEWS.words = () => {
  const cnt = t => WORDS.filter(w=>w[1]===t).length;
  const dueCnt = t => WORDS.filter(w=>w[1]===t && W(w[0]).due<=today()).length;
  const mem = t => WORDS.filter(w=>w[1]===t && W(w[0]).lv>=2).length;
  return `<h1>考点词</h1>
  <div class="muted">共 ${WORDS.length} 条。不背大纲词，只背「看到什么就选什么」的考点。</div>
  <div class="sect">
    ${['A','B','C','D'].map(t=>`<div class="topic" data-words="${t}">
      <div class="grow"><div class="nm">${WT[t]}</div>
        <div class="mt">${cnt(t)} 条 · 已记住 ${mem(t)} · 到期 ${dueCnt(t)}</div></div>
      <div class="go">练这一组</div></div>`).join('')}
  </div>
  <div class="qfoot"><button class="btn wide" data-act="words10">混合练 10 条（先到期）</button></div>
  <div class="note">怎么算记住：<b>遮住答案能说出「考点长什么样 + 答案长什么样」</b>，就算记住。中文释义说不出来没关系，考试不考释义。记住的按 1/2/3/5/8/14/30 天回炉。</div>
  <h2>这一组怎么用</h2>
  <div class="card">
    <div class="kv"><span>背的时候</span><b>只看考点和考法</b></div>
    <div class="kv"><span>背完立即</span><b>做 10 道改错（把词放进题里）</b></div>
    <div class="kv"><span>忘了怎么办</span><b>点「忘了」，明天必回炉</b></div>
  </div>`;
};

VIEWS.fix = () => {
  const st = weakTags();
  const doneN = FIX.filter(q=>{const p=S.prog[q[0]];return p&&p.s>0;}).length;
  return `<h1>改错 · 20 分</h1>
  <div class="muted">10 题 × 2 分。这是你唯一能靠套路从 0 到 9 题的板块，先把十类吃透。</div>

  <h2>按类别练</h2>
  <div class="sect">
    ${st.map(x=>{
      const p=S.prog;
      const n=FIX.filter(q=>q[1]===x.t).length;
      const acc = x.acc===null?'未做过':Math.round(x.acc*100)+'%';
      return `<div class="topic" data-fix="${x.t}">
        <div class="grow"><div class="nm">${TAGS[x.t][0]}</div>
          <div class="mt">${n} 题 · 正确率 ${acc}${x.acc!==null&&x.acc<0.5?' · 最弱':''}</div></div>
        <div class="go">练这一组</div></div>`;
    }).join('')}
  </div>
  <div class="qfoot"><button class="btn wide" data-act="fix10">做 10 题（错题优先）</button><button class="btn wide ghost" data-act="fixAll">全部 ${FIX.length} 题</button></div>

  <h2>十类清单（做题时照着说）</h2>
  <div class="card">
    ${Object.keys(TAGS).map((t,i)=>`<div style="display:grid;grid-template-columns:96px 1fr;gap:10px;padding:8px 0;${i<9?'border-bottom:1px dashed var(--line);':''}font-size:13px">
      <b style="font-weight:600">${TAGS[t][0]}</b><span class="small" style="line-height:1.6">${TAGS[t][1]}</span></div>`).join('')}
  </div>
  <div class="note">总进度：${doneN}/${FIX.length} 题做对过。错题按 1/2/3/5/8 天自动回到「今日三件」。</div>`;
};

VIEWS.exam = () => {
  const best = S.examBest;
  return `<h1>整卷 · 计时</h1>
  <div class="muted">真题 ${EXAM_MIN} 分钟。你现在练的不是做对，是「到点能收尾」。</div>

  <div class="card amber">
    <h3>当前卷只有改错</h3>
    <div class="small">v1 的卷面：改错 20 题（现库 ${FIX.length} 题里抽 20）。阅读、选词、翻译、写作 还没灌进来，所以这 ${EXAM_MIN} 分钟练的是节奏和心态，不是真实分数。</div>
  </div>

  <div class="card">
    <div class="kv"><span>限时</span><b>${EXAM_MIN} 分钟</b></div>
    <div class="kv"><span>题量</span><b>20 题</b></div>
    <div class="kv"><span>到点规则</span><b>锁卷，不许再答</b></div>
    <div class="kv"><span>上次成绩</span><b>${best?best.score+' / '+best.total+'　'+best.used: '没做过'}</b></div>
  </div>
  <div class="qfoot"><button class="btn wide" data-act="examStart">开始整卷计时</button></div>
  <div class="note">建议固定在同一天做（比如每周日）。做完别立即看答案，隔一天再来回炉，效果更实。</div>`;
};

VIEWS.me = () => {
  const st = weakTags();
  const memN = WORDS.filter(w=>W(w[0]).lv>=2).length;
  const tot = FIX.filter(q=>{const p=S.prog[q[0]];return p&&(p.s+p.o)>0;});
  let s=0,o=0; tot.forEach(q=>{ s+=S.prog[q[0]].s; o+=S.prog[q[0]].o; });
  return `<h1>我的</h1>
  <div class="stats">
    <div class="stat"><b>${s+o?Math.round(s/(s+o)*100):0}%</b><span>总正确率</span></div>
    <div class="stat"><b>${memN}</b><span>记住的词</span></div>
    <div class="stat"><b>${dueFixList().length}</b><span>待回炉</span></div>
  </div>

  <h2>按考点看正确率</h2>
  <div class="card">
    <table class="tb"><colgroup><col style="width:44%"><col style="width:28%"><col style="width:28%"></colgroup>
      <tr><th>考点</th><th class="num">做题</th><th class="num">正确率</th></tr>
      ${st.map(x=>`<tr><td>${TAGS[x.t][0]}</td><td class="num">${x.n}</td><td class="num">${x.acc===null?'—':Math.round(x.acc*100)+'%'}</td></tr>`).join('')}
    </table>
  </div>

  <h2>数据</h2>
  <div class="card">
    <div class="small">导出后换设备导入即可继续。文件存到你手机/电脑的下载目录。</div>
    <div class="qfoot"><button class="btn sm" data-act="export">导出备份</button><button class="btn sm ghost" data-act="import">导入备份</button><button class="btn sm danger" data-act="reset">清空</button></div>
    <div class="small" id="iohint" style="margin-top:8px"></div>
  </div>

  <h2>下一批要灌进来的</h2>
  <div class="card">
    <div class="kv"><span>阅读</span><b>待灌 40 分</b></div>
    <div class="kv"><span>选词填空</span><b>待灌 15 分</b></div>
    <div class="kv"><span>汉译英 + 写作</span><b>待灌 35 分</b></div>
    <div class="small" style="margin-top:6px">这几块要真题扫描件校对，按周进。</div>
  </div>`;
};

VIEWS.quiz = () => {
  if(!Q.list.length) return `<h1>没有题</h1><div class="empty">回「改错」选一组。</div>`;
  if(Q.result) return quizResult();
  const q=Q.list[Q.i];
  const tag=TAGS[q[1]], p=P(q[0]);
  const left = Q.living? Math.max(0,Math.round((Q.endAt-Date.now())/1000)) : 0;
  const head=`<div class="between" style="margin-top:6px">
      <div>
        <div class="nm" style="font-weight:700">${Q.mode==='exam'?'整卷计时':'改错'}</div>
        <div class="mt small">第 ${Q.i+1} / ${Q.list.length} 题${Q.living?'　<span class="timer" id="timer">'+fmt(left)+'</span>':''}</div>
      </div>
      <button class="btn sm ghost" data-act="quit">退出</button>
    </div>
    <div class="hud"><div class="bar"><i style="width:${Math.round(Q.i/Q.list.length*100)}%"></i></div><span>对 ${Q.ok}</span></div>`;

  const opts=`<div class="opts">${q.slice(3,7).map((t,k)=>{
    let cls='opt';
    if(Q.answered){ if(k===q[7]) cls+=' right'; else if(k===Q.picked) cls+=' wrong'; }
    else if(Q.picked===k) cls+=' sel';
    return `<button class="${cls}" data-opt="${k}" ${Q.lock?'disabled':''}><span class="lb">${'ABCD'[k]}</span><span>${esc(t)}</span></button>`;
  }).join('')}</div>`;

  let verdict='';
  if(Q.answered){
    const ok = Q.picked===q[7];
    verdict = `<div class="ansbox ${ok?'':'bad'}"><div class="k">${ok?'正确':'正确答案：'+'ABCD'[q[7]]+'　'+q[3+q[7]]}</div>
      <div class="small" style="margin-bottom:6px"><b>考点：${tag[0]}</b></div>
      <pre>${esc(q[8])}</pre></div>`;
  }
  let foot='';
  if(!Q.answered){
    foot = `<div class="qfoot"><button class="btn wide" data-act="submit" ${Q.picked===null?'disabled style="opacity:.5"':''}>确定</button></div>`;
  }else{
    foot = `<div class="qfoot"><button class="btn wide" data-act="next">${Q.i+1>=Q.list.length?'看结果':'下一题'}</button></div>`;
  }
  const froze = Q.lock? `<div class="note" style="border-color:#e2b3a7;color:var(--warn)">时间到，本卷已锁定，不能再作答。</div>`:'';
  return head+`<div class="qbox"><div class="qmeta"><span class="chip">${Q.mode==='exam'?'整卷':'练习'}</span><span class="chip">${tag[0]}</span>${p.b>0?'<span class="chip amber">错过 '+p.b+' 次</span>':''}</div>
    <div class="qstem">${esc(q[2])}</div>${opts}${verdict}${foot}${froze}
    <div class="note">做法：先通读整句 → 逐个核对四个划线处 → 说出它属于哪一类（主谓/时态/非谓语/词性/介词/冠词/比较级/连词/单复数/搭配）。</div></div>`;
};

function quizResult(){
  const n=Q.list.length, right=Q.ok, wrong=n-right;
  if(Q.mode==='exam'){
    const used = EXAM_MIN - Math.max(0,Math.round((Q.endAt-Date.now())/60000));
    S.examBest = S.examBest||{};
    if(!S.examBest.score || right>=S.examBest.score){ S.examBest={score:right,total:n,used:Math.min(EXAM_MIN,Math.max(0,used))+' 分钟'}; }
    save();
  }
  const bad = Q.list.filter(q=>S.prog[q[0]]&&S.prog[q[0]].b>0);
  const tagCnt={}; Q.list.forEach(q=>{ if(!(S.prog[q[0]]&&S.prog[q[0]].s>0)) tagCnt[q[1]]=(tagCnt[q[1]]||0)+1; });
  return `<h1>${Q.mode==='exam'?'整卷结束':'这一组结束'}</h1>
  <div class="stats">
    <div class="stat"><b>${right}/${n}</b><span>做对</span></div>
    <div class="stat"><b>${n?Math.round(right/n*100):0}%</b><span>正确率</span></div>
    <div class="stat"><b>${wrong}</b><span>进错题本</span></div>
  </div>
  <div class="card">
    <h3>错在哪几类</h3>
    ${Object.keys(tagCnt).length?Object.keys(tagCnt).map(t=>`<div class="kv"><span>${TAGS[t][0]}</span><b>${tagCnt[t]} 题</b></div>`).join(''):'<div class="small">全对，或者都做过了。去做下一类。</div>'}
  </div>
  <div class="note">错题已按 1/2/3/5/8 天回流到「今日三件」。明天先回炉，再开新题。</div>
  <div class="qfoot"><button class="btn wide" data-act="again">再来一组</button><button class="btn wide ghost" data-act="quit">回今日</button></div>`;
}

VIEWS.wquiz = () => {
  if(!WQ.list.length) return `<h1>没有词</h1><div class="empty">回「考点词」选一组。</div>`;
  if(WQ.i>=WQ.list.length) return `<h1>这组完成</h1><div class="empty">记住 ${WQ.ok} / ${WQ.list.length} 条。</div><div class="qfoot"><button class="btn wide" data-act="words10">再来 10 条</button><button class="btn wide ghost" data-act="quit">回今日</button></div>`;
  const w=WQ.list[WQ.i];
  return `<div class="between" style="margin-top:6px"><div><div style="font-weight:700">${WT[w[1]]}</div><div class="small">第 ${WQ.i+1} / ${WQ.list.length} 条</div></div>
    <button class="btn sm ghost" data-act="quit">退出</button></div>
  <div class="hud"><div class="bar"><i style="width:${Math.round(WQ.i/WQ.list.length*100)}%"></i></div><span>记住 ${WQ.ok}</span></div>
  <div class="wcard">
    <div class="k">考点</div>
    <div class="w">${esc(w[2])}</div>
    <div class="f">${esc(w[3])}</div>
    ${WQ.revealed?`<div class="a">${esc(w[4])}</div>`:''}
  </div>
  ${WQ.revealed
    ? `<div class="qfoot"><button class="btn grow" data-grade="1">记住了</button><button class="btn ghost grow" data-grade="0">忘了</button></div>`
    : `<div class="qfoot"><button class="btn wide" data-act="reveal">看答案（先自己说出来）</button></div>`}`;
};

/* ============================ 渲染 ============================ */
function render(){
  const h=(location.hash||'#today').replace('#','');
  const v=$('#view');
  const fn=VIEWS[h]||VIEWS.today;
  v.innerHTML=fn();
  document.querySelectorAll('.tb-btn').forEach(b=>{
    const k=b.dataset.go;
    b.classList.toggle('on', k===h || (k==='fix'&&h==='quiz') || (k==='words'&&h==='wquiz'));
  });
  const cd=$('#cdNum'); if(cd) cd.textContent=daysBetween(today(),EXAM_DATE);
}

/* ============================ 事件（统一委托，避免监听器叠加） ============================ */
document.addEventListener('click',e=>{
  const goBtn=e.target.closest('.tb-btn');
  if(goBtn){ if(Q.living&&goBtn.dataset.go!=='exam'){ Q.living=false; } location.hash='#'+goBtn.dataset.go; return; }
  const a=e.target.closest('[data-act]');
  const opt=e.target.closest('[data-opt]');
  const gr=e.target.closest('[data-grade]');
  const wsel=e.target.closest('[data-words]');
  const fsel=e.target.closest('[data-fix]');

  if(wsel){ startWords(10, wsel.dataset.words); return; }
  if(fsel){ startFix(10, fsel.dataset.fix); return; }

  if(opt && !Q.lock){ Q.picked=Number(opt.dataset.opt); render(); return; }

  if(gr && WQ.list.length){ gradeWord(gr.dataset.grade==='1'); return; }

  if(!a) return;
  const act=a.dataset.act;
  if(act==='quit'){ Q.living=false; location.hash='#today'; render(); return; }
  if(act==='submit'){
    if(Q.picked===null||Q.answered||Q.lock) return;
    const q=Q.list[Q.i];
    Q.answered=true;
    const ok=Q.picked===q[7];
    if(ok) Q.ok++;
    gradeFix(q, ok);
    render(); return;
  }
  if(act==='reveal'){ WQ.revealed=true; render(); return; }
  if(act==='next'){
    Q.i++; Q.answered=false; Q.picked=null;
    if(Q.i>=Q.list.length){
      Q.result=true;
      if(Q.tag==='回炉'){ S.reviewedOn=today(); save(); }
      render();
    } else render();
    return;
  }
  if(act==='again'){ Q.result=false; if(Q.mode==='exam') startExam(); else startFix(10, Q.tag==='回炉'?null:Q.tag); return; }
  if(act==='words10'){ startWords(10); return; }
  if(act==='wordsA'){ startWords(10,'A'); return; }
  if(act==='fix10'){ startFix(10); return; }
  if(act==='fixAll'){ startFix(FIX.length); return; }
  if(act==='review'){ startReview(); return; }
  if(act==='examStart'){ startExam(); return; }
  if(act==='goto-fix'){ location.hash='#fix'; return; }
  if(act==='export'){
    const blob=new Blob([JSON.stringify(S,null,1)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const aEl=document.createElement('a');
    aEl.href=url; aEl.download='英语专站备份-'+today()+'.json';
    document.body.appendChild(aEl); aEl.click(); aEl.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    $('#iohint').textContent='备份已导出到下载目录。';
    return;
  }
  if(act==='import'){
    const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
    inp.onchange=()=>{
      const f=inp.files[0]; if(!f) return;
      const rd=new FileReader();
      rd.onload=()=>{
        try{
          const o=JSON.parse(rd.result);
          if(!o||!o.prog) throw new Error('格式不对');
          S.prog=Object.assign({},o.prog); S.wprog=Object.assign({},o.wprog||{});
          S.logs=(o.logs||[]).slice(-400); S.examBest=o.examBest||S.examBest;
          save(); toast('导入成功'); $('#iohint').textContent='导入成功：'+Object.keys(S.prog).length+' 条题目进度，'+Object.keys(S.wprog).length+' 条词进度。';
        }catch(err){ toast('导入失败：文件格式不对'); }
      };
      rd.readAsText(f,'utf-8');
    };
    inp.click(); return;
  }
  if(act==='reset'){
    if(confirm('清空全部进度？错题、背词记录都会删掉，导出了备份才可恢复。')){
      S=blank(); save(); toast('已清空'); render();
    }
    return;
  }
});
window.addEventListener('hashchange',render);
render();
