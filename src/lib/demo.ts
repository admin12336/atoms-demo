import type { BuildPlan } from "./types";

export function demoPlan(idea: string): BuildPlan {
  const title = idea.slice(0, 24) || "演示应用";
  return {
    title,
    summary: `根据「${idea}」生成的可交互单页应用（演示模式，未调用大模型）。`,
    productType: "web_app",
    pages: [
      { name: "主面板", purpose: "完成核心增删改查与状态切换" },
      { name: "统计", purpose: "展示进度与本地持久化状态" },
    ],
    features: ["添加条目", "完成/取消", "删除", "筛选", "localStorage 持久化", "主题色切换"],
    styleDirection: "深墨青底 + 琥珀强调，圆角卡片克制使用，偏工具感",
    acceptanceChecks: ["刷新后数据仍在", "可完成主流程点击", "移动端可用"],
  };
}

export function demoBuildHtml(plan: BuildPlan): string {
  const safeTitle = escapeHtml(plan.title);
  const features = plan.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
  :root { --bg:#0f1714; --panel:#17221d; --line:#2a3a32; --text:#e8f0ea; --muted:#9bb0a4; --accent:#e3a008; --ok:#3dba7e; }
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
  details{margin-top:16px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}
</style>
</head>
<body>
<header>
  <h1>${safeTitle}</h1>
  <p>${escapeHtml(plan.summary)}</p>
</header>
<main>
  <div class="bar">
    <input id="text" placeholder="输入一条内容，回车添加" />
    <button id="add">添加</button>
  </div>
  <div class="bar">
    <select id="filter">
      <option value="all">全部</option>
      <option value="active">未完成</option>
      <option value="done">已完成</option>
    </select>
    <button class="ghost" id="theme">切换强调色</button>
  </div>
  <div class="list" id="list"></div>
  <p class="meta" id="stats"></p>
  <details>
    <summary>方案功能点</summary>
    <ul>${features}</ul>
  </details>
</main>
<script>
const KEY='atoms-demo-items-v1';
const THEME_KEY='atoms-demo-accent';
let items=JSON.parse(localStorage.getItem(KEY)||'[]');
const accents=['#e3a008','#3dba7e','#4aa3ff','#ff7a59'];
let accent=localStorage.getItem(THEME_KEY)||accents[0];
document.documentElement.style.setProperty('--accent', accent);
const list=document.getElementById('list');
const stats=document.getElementById('stats');
const filter=document.getElementById('filter');
function save(){localStorage.setItem(KEY,JSON.stringify(items));}
function render(){
  const mode=filter.value;
  list.innerHTML='';
  items.filter(i=>mode==='all'||(mode==='done'?i.done:!i.done)).forEach(item=>{
    const row=document.createElement('div');
    row.className='item'+(item.done?' done':'');
    row.innerHTML='<input type="checkbox" '+(item.done?'checked':'')+' /><div class="title"></div><button class="ghost">删除</button>';
    row.querySelector('.title').textContent=item.text;
    row.querySelector('input').onchange=()=>{item.done=!item.done;save();render();};
    row.querySelector('button').onclick=()=>{items=items.filter(x=>x.id!==item.id);save();render();};
    list.appendChild(row);
  });
  const done=items.filter(i=>i.done).length;
  stats.textContent='共 '+items.length+' 条，已完成 '+done+' 条 · 数据已写入 localStorage，刷新仍在';
}
function add(){
  const el=document.getElementById('text');
  const text=el.value.trim();
  if(!text) return;
  items.unshift({id:Date.now().toString(36),text,done:false});
  el.value='';
  save();render();
}
document.getElementById('add').onclick=add;
document.getElementById('text').onkeydown=e=>{if(e.key==='Enter')add();};
filter.onchange=render;
document.getElementById('theme').onclick=()=>{
  const i=(accents.indexOf(accent)+1)%accents.length;
  accent=accents[i];
  localStorage.setItem(THEME_KEY,accent);
  document.documentElement.style.setProperty('--accent', accent);
};
render();
</script>
</body>
</html>`;
}

export function demoIterateHtml(html: string, instruction: string): string {
  const note = escapeHtml(instruction);
  if (html.includes("id=\"iterate-banner\"")) {
    return html.replace(
      /id="iterate-banner">[\s\S]*?<\/div>/,
      `id="iterate-banner">演示迭代：${note}</div>`,
    );
  }
  return html.replace(
    "<body>",
    `<body><div id="iterate-banner" style="position:sticky;top:0;z-index:9;background:#e3a008;color:#1a1200;padding:8px 12px;font:600 13px/1.4 system-ui">演示迭代：${note}</div>`,
  );
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
