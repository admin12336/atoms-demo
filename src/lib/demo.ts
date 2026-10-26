import type { BuildPlan } from "./types";

type DemoKind = "ledger" | "pomodoro" | "snake" | "cafe" | "habit";

function detectKind(idea: string): DemoKind {
  const t = idea.toLowerCase();
  if (/记账|账本|预算|开销|分类.*图/.test(t)) return "ledger";
  if (/番茄|倒计时|专注/.test(t)) return "pomodoro";
  if (/贪吃蛇|小游戏|snake/.test(t)) return "snake";
  if (/咖啡|落地页|菜单|预约/.test(t)) return "cafe";
  return "habit";
}

export function demoPlan(idea: string): BuildPlan {
  const kind = detectKind(idea);
  const presets: Record<DemoKind, Omit<BuildPlan, "title" | "summary">> = {
    ledger: {
      productType: "web_app",
      pages: [
        { name: "记账", purpose: "按分类录入收支" },
        { name: "图表", purpose: "分类占比条形图" },
      ],
      features: ["分类记账", "收支切换", "本地持久化", "分类占比图", "合计统计", "清空重来"],
      styleDirection: "浅色卡片 + 靛蓝强调，工具感清晰",
      acceptanceChecks: ["能新增一笔", "图表随数据变化", "刷新后仍在"],
    },
    pomodoro: {
      productType: "web_app",
      pages: [
        { name: "计时", purpose: "25 分钟专注倒计时" },
        { name: "待办", purpose: "任务列表与完成计数" },
      ],
      features: ["番茄倒计时", "开始/暂停/重置", "待办增删", "今日完成次数", "本地持久化", "提示音可选"],
      styleDirection: "深红番茄色强调，居中计时器",
      acceptanceChecks: ["倒计时可走", "待办可勾选", "刷新保留任务"],
    },
    snake: {
      productType: "web_app",
      pages: [{ name: "游戏", purpose: "方向键/按钮控制贪吃蛇" }],
      features: ["开始/重开", "方向控制", "得分与最高分", "撞墙/撞身结束", "速度随得分提升", "触控按钮"],
      styleDirection: "深色像素感游戏板",
      acceptanceChecks: ["能开始移动", "吃到食物加分", "结束后可重开"],
    },
    cafe: {
      productType: "landing",
      pages: [
        { name: "首页", purpose: "品牌与菜单展示" },
        { name: "预约", purpose: "桌位预约表单" },
      ],
      features: ["品牌 Hero", "菜单卡片", "预约表单", "表单校验", "预约本地存档", "移动端友好"],
      styleDirection: "暖奶油底 + 咖啡棕强调",
      acceptanceChecks: ["菜单可浏览", "预约可提交", "提交后有确认"],
    },
    habit: {
      productType: "web_app",
      pages: [
        { name: "主面板", purpose: "完成核心增删改查与状态切换" },
        { name: "统计", purpose: "展示进度与本地持久化状态" },
      ],
      features: ["添加条目", "完成/取消", "删除", "筛选", "localStorage 持久化", "主题色切换"],
      styleDirection: "深墨青底 + 琥珀强调，圆角克制，偏工具感",
      acceptanceChecks: ["刷新后数据仍在", "可完成主流程点击", "移动端可用"],
    },
  };

  const base = presets[kind];
  const title = idea.slice(0, 28) || "演示应用";
  return {
    title,
    summary: `根据「${idea}」生成的可交互单页应用（演示模式，未调用大模型）。`,
    ...base,
  };
}

export function demoBuildHtml(plan: BuildPlan): string {
  const kind = detectKind(`${plan.title} ${plan.summary}`);
  switch (kind) {
    case "ledger":
      return ledgerHtml(plan);
    case "pomodoro":
      return pomodoroHtml(plan);
    case "snake":
      return snakeHtml(plan);
    case "cafe":
      return cafeHtml(plan);
    default:
      return habitHtml(plan);
  }
}

export function demoIterateHtml(html: string, instruction: string): string {
  const note = escapeHtml(instruction);
  const tint =
    /绿|green/i.test(instruction)
      ? "#22a06b"
      : /蓝|blue/i.test(instruction)
        ? "#3b82f6"
        : /紫|purple/i.test(instruction)
          ? "#8b5cf6"
          : null;

  let next = html;
  if (tint) {
    if (next.includes("--accent:")) {
      next = next.replace(/--accent:\s*[^;]+;/, `--accent:${tint};`);
    } else if (next.includes(":root")) {
      next = next.replace(":root {", `:root { --accent:${tint};`);
    }
  }

  if (next.includes('id="iterate-banner"')) {
    return next.replace(/id="iterate-banner">[\s\S]*?<\/div>/, `id="iterate-banner">演示迭代：${note}</div>`);
  }
  return next.replace(
    "<body>",
    `<body><div id="iterate-banner" style="position:sticky;top:0;z-index:9;background:var(--accent,#e3a008);color:#1a1200;padding:8px 12px;font:600 13px/1.4 system-ui">演示迭代：${note}</div>`,
  );
}

function shell(title: string, css: string, body: string, script: string) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
${body}
<script>${script}</script>
</body>
</html>`;
}

function habitHtml(plan: BuildPlan): string {
  const safeTitle = escapeHtml(plan.title);
  const features = plan.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("");
  const css = `
  :root { --bg:#0f1714; --panel:#17221d; --line:#2a3a32; --text:#e8f0ea; --muted:#9bb0a4; --accent:#e3a008; }
  *{box-sizing:border-box} body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;background:radial-gradient(1200px 600px at 10% -10%,#1d3a2d,transparent),var(--bg);color:var(--text);min-height:100vh}
  header{padding:20px 20px 8px;max-width:720px;margin:0 auto}
  h1{margin:0 0 6px;font-size:1.45rem} p{margin:0;color:var(--muted);line-height:1.5}
  main{max-width:720px;margin:0 auto;padding:12px 20px 40px}
  .bar{display:flex;gap:8px;margin:16px 0}
  input,select,button{font:inherit} input,select{flex:1;background:#0c1210;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:10px 12px}
  button{border:0;border-radius:10px;padding:10px 14px;background:var(--accent);color:#1a1200;font-weight:700;cursor:pointer}
  button.ghost{background:transparent;border:1px solid var(--line);color:var(--text);font-weight:500}
  .list{display:grid;gap:8px} .item{display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}
  .item.done .title{text-decoration:line-through;color:var(--muted)}
  .title{flex:1} .meta{font-size:12px;color:var(--muted);margin-top:14px}
  details{margin-top:16px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}`;
  const body = `
<header><h1>${safeTitle}</h1><p>${escapeHtml(plan.summary)}</p></header>
<main>
  <div class="bar"><input id="text" placeholder="输入一条内容，回车添加" /><button id="add">添加</button></div>
  <div class="bar">
    <select id="filter"><option value="all">全部</option><option value="active">未完成</option><option value="done">已完成</option></select>
    <button class="ghost" id="theme">切换强调色</button>
  </div>
  <div class="list" id="list"></div>
  <p class="meta" id="stats"></p>
  <details><summary>方案功能点</summary><ul>${features}</ul></details>
</main>`;
  const script = `
const KEY='atoms-demo-items-v1'; const THEME_KEY='atoms-demo-accent';
let items=JSON.parse(localStorage.getItem(KEY)||'[]');
const accents=['#e3a008','#3dba7e','#4aa3ff','#ff7a59'];
let accent=localStorage.getItem(THEME_KEY)||accents[0];
document.documentElement.style.setProperty('--accent', accent);
const list=document.getElementById('list'); const stats=document.getElementById('stats'); const filter=document.getElementById('filter');
function save(){localStorage.setItem(KEY,JSON.stringify(items));}
function render(){
  const mode=filter.value; list.innerHTML='';
  items.filter(i=>mode==='all'||(mode==='done'?i.done:!i.done)).forEach(item=>{
    const row=document.createElement('div'); row.className='item'+(item.done?' done':'');
    row.innerHTML='<input type="checkbox" '+(item.done?'checked':'')+' /><div class="title"></div><button class="ghost">删除</button>';
    row.querySelector('.title').textContent=item.text;
    row.querySelector('input').onchange=()=>{item.done=!item.done;save();render();};
    row.querySelector('button').onclick=()=>{items=items.filter(x=>x.id!==item.id);save();render();};
    list.appendChild(row);
  });
  stats.textContent='共 '+items.length+' 条，已完成 '+items.filter(i=>i.done).length+' 条 · localStorage 已保存';
}
function add(){const el=document.getElementById('text'); const text=el.value.trim(); if(!text) return;
  items.unshift({id:Date.now().toString(36),text,done:false}); el.value=''; save(); render();}
document.getElementById('add').onclick=add;
document.getElementById('text').onkeydown=e=>{if(e.key==='Enter')add();};
filter.onchange=render;
document.getElementById('theme').onclick=()=>{const i=(accents.indexOf(accent)+1)%accents.length; accent=accents[i];
  localStorage.setItem(THEME_KEY,accent); document.documentElement.style.setProperty('--accent', accent);};
render();`;
  return shell(plan.title, css, body, script);
}

function ledgerHtml(plan: BuildPlan): string {
  const css = `
  :root{--bg:#f4f7fb;--panel:#fff;--line:#d7e0ea;--text:#142033;--muted:#5b6b7c;--accent:#2563eb;--in:#16a34a;--out:#dc2626}
  *{box-sizing:border-box} body{margin:0;font-family:Georgia,"Songti SC",serif;background:linear-gradient(180deg,#e8eef8,var(--bg));color:var(--text);min-height:100vh}
  .wrap{max-width:760px;margin:0 auto;padding:24px 18px 48px}
  h1{margin:0 0 6px;font-size:1.6rem} .sub{color:var(--muted);margin:0 0 18px;line-height:1.5}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:0 10px 30px rgba(20,32,51,.06)}
  .row{display:flex;flex-wrap:wrap;gap:8px} input,select,button{font:inherit;border-radius:10px;border:1px solid var(--line);padding:10px 12px}
  input,select{flex:1;min-width:120px;background:#fff;color:var(--text)}
  button{background:var(--accent);color:#fff;border:0;font-weight:700;cursor:pointer}
  .sum{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .sum div{padding:12px;border-radius:12px;background:#f8fafc;border:1px solid var(--line)}
  .sum b{display:block;font-size:1.25rem;margin-top:4px}
  .bar{height:10px;background:#eef2f7;border-radius:999px;overflow:hidden;margin-top:6px}
  .bar>i{display:block;height:100%;background:var(--accent)}
  .item{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px dashed var(--line);font-family:"Segoe UI",sans-serif}
  .amt.in{color:var(--in)} .amt.out{color:var(--out)} .muted{color:var(--muted);font-size:.86rem}`;
  const body = `
<div class="wrap">
  <h1>${escapeHtml(plan.title)}</h1>
  <p class="sub">${escapeHtml(plan.summary)}</p>
  <div class="card sum"><div>本月收入<b id="income">¥0</b></div><div>本月支出<b id="expense">¥0</b></div></div>
  <div class="card">
    <div class="row">
      <select id="type"><option value="out">支出</option><option value="in">收入</option></select>
      <select id="cat"><option>餐饮</option><option>交通</option><option>购物</option><option>工资</option><option>其他</option></select>
      <input id="amount" type="number" min="0" step="0.01" placeholder="金额" />
      <input id="note" placeholder="备注" />
      <button id="add">记账</button>
    </div>
  </div>
  <div class="card"><h3 style="margin:0 0 10px;font-size:1rem">分类占比</h3><div id="chart"></div></div>
  <div class="card"><h3 style="margin:0 0 10px;font-size:1rem">最近记录</h3><div id="list"></div></div>
</div>`;
  const script = `
const KEY='atoms-ledger-v1'; let rows=JSON.parse(localStorage.getItem(KEY)||'[]');
const list=document.getElementById('list'); const chart=document.getElementById('chart');
function save(){localStorage.setItem(KEY,JSON.stringify(rows));}
function money(n){return '¥'+Number(n).toFixed(2)}
function render(){
  let inc=0,exp=0; const by={};
  rows.forEach(r=>{ if(r.type==='in') inc+=r.amount; else {exp+=r.amount; by[r.cat]=(by[r.cat]||0)+r.amount;} });
  document.getElementById('income').textContent=money(inc);
  document.getElementById('expense').textContent=money(exp);
  const max=Math.max(...Object.values(by),1);
  chart.innerHTML=Object.keys(by).length?Object.entries(by).map(([k,v])=>'<div style="margin:8px 0"><div class="muted">'+k+' · '+money(v)+'</div><div class="bar"><i style="width:'+(v/max*100)+'%"></i></div></div>').join(''):'<div class="muted">还没有支出分类</div>';
  list.innerHTML=rows.slice(0,20).map(r=>'<div class="item"><div><b>'+r.cat+'</b> <span class="muted">'+r.note+'</span></div><div class="amt '+r.type+'">'+(r.type==='in'?'+':'-')+money(r.amount)+'</div></div>').join('')||'<div class="muted">暂无记录</div>';
}
document.getElementById('add').onclick=()=>{
  const amount=Number(document.getElementById('amount').value); if(!amount||amount<=0) return alert('请输入金额');
  rows.unshift({id:Date.now(),type:document.getElementById('type').value,cat:document.getElementById('cat').value,amount,note:document.getElementById('note').value.trim()||'—' });
  document.getElementById('amount').value=''; document.getElementById('note').value=''; save(); render();
};
render();`;
  return shell(plan.title, css, body, script);
}

function pomodoroHtml(plan: BuildPlan): string {
  const css = `
  :root{--bg:#1a1214;--panel:#26191c;--line:#3a2a2e;--text:#f7ecee;--muted:#b39aa0;--accent:#e11d48}
  *{box-sizing:border-box} body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;background:radial-gradient(900px 500px at 50% -10%,#4c1d25,transparent),var(--bg);color:var(--text);min-height:100vh}
  .wrap{max-width:640px;margin:0 auto;padding:28px 18px}
  h1{margin:0 0 6px;text-align:center} .sub{text-align:center;color:var(--muted);margin:0 0 22px}
  .timer{font-size:clamp(3rem,12vw,5rem);font-weight:800;letter-spacing:.04em;text-align:center;margin:10px 0 18px}
  .actions{display:flex;justify-content:center;gap:10px;margin-bottom:22px}
  button{border:0;border-radius:999px;padding:10px 16px;background:var(--accent);color:#fff;font-weight:700;cursor:pointer}
  button.ghost{background:transparent;border:1px solid var(--line);color:var(--text)}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px}
  .row{display:flex;gap:8px} input{flex:1;border-radius:10px;border:1px solid var(--line);background:#140e10;color:var(--text);padding:10px}
  .item{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)}
  .item.done span{text-decoration:line-through;color:var(--muted)} .meta{color:var(--muted);font-size:.9rem;margin:10px 0}`;
  const body = `
<div class="wrap">
  <h1>${escapeHtml(plan.title)}</h1>
  <p class="sub">${escapeHtml(plan.summary)}</p>
  <div class="timer" id="clock">25:00</div>
  <div class="actions"><button id="start">开始</button><button class="ghost" id="reset">重置</button></div>
  <p class="meta" id="today">今日完成番茄：0</p>
  <div class="card">
    <div class="row"><input id="todo" placeholder="添加待办" /><button id="add">添加</button></div>
    <div id="list"></div>
  </div>
</div>`;
  const script = `
const KEY='atoms-pomo-v1'; const state=JSON.parse(localStorage.getItem(KEY)||'{"todos":[],"doneToday":0,"day":""}');
const today=new Date().toDateString(); if(state.day!==today){state.day=today; state.doneToday=0;}
let left=25*60, timer=null, running=false;
const clock=document.getElementById('clock'); const list=document.getElementById('list');
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function fmt(s){const m=String(Math.floor(s/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return m+':'+ss;}
function tick(){ clock.textContent=fmt(left); document.getElementById('today').textContent='今日完成番茄：'+state.doneToday; }
function render(){ list.innerHTML=state.todos.map((t,i)=>'<div class="item '+(t.done?'done':'')+'"><input type="checkbox" '+(t.done?'checked':'')+' data-i="'+i+'"/><span></span><button class="ghost" data-d="'+i+'">删</button></div>').join('');
  [...list.querySelectorAll('span')].forEach((el,i)=>el.textContent=state.todos[i].text);
  list.querySelectorAll('input').forEach(el=>el.onchange=()=>{state.todos[el.dataset.i].done=el.checked;save();render();});
  list.querySelectorAll('[data-d]').forEach(el=>el.onclick=()=>{state.todos.splice(el.dataset.d,1);save();render();});
}
document.getElementById('start').onclick=()=>{
  if(running){clearInterval(timer); running=false; document.getElementById('start').textContent='开始'; return;}
  running=true; document.getElementById('start').textContent='暂停';
  timer=setInterval(()=>{ left--; if(left<=0){ clearInterval(timer); running=false; left=25*60; state.doneToday++; save(); document.getElementById('start').textContent='开始'; alert('番茄完成！'); } tick(); },1000);
};
document.getElementById('reset').onclick=()=>{clearInterval(timer); running=false; left=25*60; document.getElementById('start').textContent='开始'; tick();};
document.getElementById('add').onclick=()=>{const v=document.getElementById('todo').value.trim(); if(!v) return; state.todos.unshift({text:v,done:false}); document.getElementById('todo').value=''; save(); render();};
tick(); render();`;
  return shell(plan.title, css, body, script);
}

function snakeHtml(plan: BuildPlan): string {
  const css = `
  :root{--bg:#0b1220;--panel:#121a2b;--line:#243049;--text:#e7eefc;--muted:#8fa0bf;--accent:#22d3ee}
  *{box-sizing:border-box} body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;background:radial-gradient(800px 400px at 20% 0,#123047,transparent),var(--bg);color:var(--text);min-height:100vh}
  .wrap{max-width:480px;margin:0 auto;padding:20px 16px 40px;text-align:center}
  h1{margin:0 0 6px} .sub{color:var(--muted);margin:0 0 14px;line-height:1.5}
  canvas{width:min(100%,360px);height:auto;background:#060b14;border:1px solid var(--line);border-radius:12px;image-rendering:pixelated}
  .hud{display:flex;justify-content:space-between;margin:10px 0;color:var(--muted)}
  .pad{display:grid;grid-template-columns:repeat(3,64px);gap:8px;justify-content:center;margin-top:12px}
  button{border:0;border-radius:12px;padding:12px;background:var(--accent);color:#042027;font-weight:800;cursor:pointer}
  button.ghost{background:var(--panel);border:1px solid var(--line);color:var(--text)}`;
  const body = `
<div class="wrap">
  <h1>${escapeHtml(plan.title)}</h1>
  <p class="sub">${escapeHtml(plan.summary)}</p>
  <div class="hud"><span>得分 <b id="score">0</b></span><span>最高 <b id="best">0</b></span></div>
  <canvas id="c" width="360" height="360"></canvas>
  <div style="margin-top:12px"><button id="start">开始 / 重开</button></div>
  <div class="pad">
    <span></span><button class="ghost" data-d="0,-1">↑</button><span></span>
    <button class="ghost" data-d="-1,0">←</button><button class="ghost" data-d="0,1">↓</button><button class="ghost" data-d="1,0">→</button>
  </div>
</div>`;
  const script = `
const canvas=document.getElementById('c'); const ctx=canvas.getContext('2d');
const BEST_KEY='atoms-snake-best'; let best=Number(localStorage.getItem(BEST_KEY)||0);
document.getElementById('best').textContent=best;
const N=20; let snake, dir, food, score, loop, alive;
function cell(){return canvas.width/N;}
function placeFood(){ food={x:Math.floor(Math.random()*N), y:Math.floor(Math.random()*N)}; if(snake.some(s=>s.x===food.x&&s.y===food.y)) placeFood(); }
function reset(){ snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}]; dir={x:1,y:0}; score=0; alive=true; placeFood(); document.getElementById('score').textContent=0; }
function draw(){ const s=cell(); ctx.fillStyle='#060b14'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#22d3ee'; snake.forEach((p,i)=>{ctx.fillRect(p.x*s+1,p.y*s+1,s-2,s-2); if(i===0){ctx.fillStyle='#67e8f9';}});
  ctx.fillStyle='#f43f5e'; ctx.fillRect(food.x*s+2,food.y*s+2,s-4,s-4);
}
function step(){ if(!alive) return; const head={x:snake[0].x+dir.x, y:snake[0].y+dir.y};
  if(head.x<0||head.y<0||head.x>=N||head.y>=N||snake.some(p=>p.x===head.x&&p.y===head.y)){ alive=false; clearInterval(loop); if(score>best){best=score; localStorage.setItem(BEST_KEY,String(best)); document.getElementById('best').textContent=best;} return; }
  snake.unshift(head); if(head.x===food.x&&head.y===food.y){ score++; document.getElementById('score').textContent=score; placeFood(); } else snake.pop(); draw();
}
function setDir(x,y){ if(dir.x+x===0&&dir.y+y===0) return; dir={x,y}; }
document.getElementById('start').onclick=()=>{ clearInterval(loop); reset(); draw(); loop=setInterval(step, 120); };
document.querySelectorAll('[data-d]').forEach(btn=>btn.onclick=()=>{ const [x,y]=btn.dataset.d.split(',').map(Number); setDir(x,y); });
window.addEventListener('keydown',e=>{ const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}; if(m[e.key]){ e.preventDefault(); setDir(...m[e.key]); }});
reset(); draw();`;
  return shell(plan.title, css, body, script);
}

function cafeHtml(plan: BuildPlan): string {
  const css = `
  :root{--bg:#f6efe6;--panel:#fffaf4;--line:#e4d4c2;--text:#2b2118;--muted:#7a6554;--accent:#8b5a2b}
  *{box-sizing:border-box} body{margin:0;font-family:Georgia,"Songti SC",serif;background:linear-gradient(180deg,#efe2d2,var(--bg));color:var(--text)}
  header{padding:48px 20px 28px;text-align:center;background:radial-gradient(700px 280px at 50% 0,#d9b89655,transparent)}
  .brand{letter-spacing:.18em;text-transform:uppercase;color:var(--accent);font-size:.78rem;margin:0 0 10px}
  h1{margin:0 0 10px;font-size:clamp(2rem,6vw,3rem)} .lead{max-width:36ch;margin:0 auto;color:var(--muted);line-height:1.6}
  main{max-width:880px;margin:0 auto;padding:10px 18px 56px}
  h2{font-size:1.25rem;margin:24px 0 12px}
  .menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:0 8px 24px rgba(43,33,24,.05)}
  .price{color:var(--accent);font-weight:700}
  form{display:grid;gap:10px} input,select,textarea,button{font:inherit;border-radius:10px;border:1px solid var(--line);padding:10px 12px}
  button{background:var(--accent);color:#fff;border:0;font-weight:700;cursor:pointer}
  .ok{color:#166534;background:#ecfdf3;border:1px solid #bbf7d0;padding:10px 12px;border-radius:10px;display:none}
  .muted{color:var(--muted);font-size:.92rem}`;
  const body = `
<header>
  <p class="brand">Atoms Cafe</p>
  <h1>${escapeHtml(plan.title)}</h1>
  <p class="lead">${escapeHtml(plan.summary)}</p>
</header>
<main>
  <h2>菜单</h2>
  <div class="menu">
    <div class="card"><b>澳白</b><p class="muted">丝滑奶泡</p><div class="price">¥28</div></div>
    <div class="card"><b>手冲耶加</b><p class="muted">花香果酸</p><div class="price">¥36</div></div>
    <div class="card"><b>脏脏拿铁</b><p class="muted">可可冷萃</p><div class="price">¥32</div></div>
    <div class="card"><b>坚果司康</b><p class="muted">现烤</p><div class="price">¥18</div></div>
  </div>
  <h2>预约桌位</h2>
  <div class="card">
    <form id="form">
      <input id="name" placeholder="称呼" required />
      <input id="phone" placeholder="手机号" required />
      <input id="time" type="datetime-local" required />
      <select id="people"><option>2 人</option><option>3-4 人</option><option>5 人以上</option></select>
      <textarea id="note" rows="3" placeholder="备注（可选）"></textarea>
      <button type="submit">提交预约</button>
    </form>
    <div class="ok" id="ok">预约已保存到本机，到店报手机号即可。</div>
  </div>
</main>`;
  const script = `
const KEY='atoms-cafe-bookings';
document.getElementById('form').onsubmit=e=>{
  e.preventDefault();
  const row={name:name.value.trim(),phone:phone.value.trim(),time:time.value,people:people.value,note:note.value.trim(),at:Date.now()};
  if(!row.name||!row.phone||!row.time) return;
  const all=JSON.parse(localStorage.getItem(KEY)||'[]'); all.unshift(row); localStorage.setItem(KEY,JSON.stringify(all));
  document.getElementById('ok').style.display='block'; e.target.reset();
};`;
  return shell(plan.title, css, body, script);
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
