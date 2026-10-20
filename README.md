# Atoms Demo

> 一句话描述想法 → Emma 产品方案 → 你批准 → Alex 生成可交互网页 → 右侧预览 / 对话迭代 / 版本回滚 / 分享导出

面向 ROOT / 深度赋智研发笔试的可运行 Demo，对标 [Atoms](https://atoms.dev/) 的核心工作流：**用 AI 把场景快速做成可体验产品**，而不是重造整个 Atoms 平台。

## 在线地址（提交时填写）

| 项 | 链接 |
|----|------|
| 可访问 Demo URL | _部署后填入_ |
| GitHub 仓库 | _设为 Public 后填入_ |

## 5 分钟自测

1. 打开站点 → **注册** → 进入工坊  
2. 点模板「习惯打卡」或输入任意中文需求  
3. 查看 Emma 方案 → **批准并生成**  
4. 右侧预览可点击交互；切换手机/平板尺寸  
5. 对话「把主色换成绿色」触发迭代；版本下拉可回滚  
6. **导出 HTML** / **分享预览**；刷新后项目仍在  
7. 侧栏可见 **Open-Meteo** 实时天气（第三方 API）

## 笔试要求对照

| 要求 | 实现 |
|------|------|
| 真实交互 UI | 沙箱 iframe 内可操作的完整 HTML 应用 |
| 数据持久化 | 用户/项目/版本写入服务端 `data/store.json`；生成应用内用 localStorage |
| 初始化 / 注册登录 / 主流程 | 注册登录 → 建项目 → 方案批准 → 生成 → 迭代 |
| 至少一个第三方能力 | OpenAI 兼容 LLM（DeepSeek 等）+ Open-Meteo 天气 |
| 可公网访问 | 支持 Vercel / Railway 部署（见下方） |
| 说明文档 | 本 README + `DELIVERY.md` |

## 主流程

```text
注册/登录
  → 描述需求（或选模板）
  → Emma 产出方案
  → 批准并生成
  → Alex 输出单文件 HTML
  → Canvas 预览 + 迭代 + 回滚 / 导出 / 分享
```

角色说明：

- **Mike**：本地状态机协调（不单独调模型）
- **Emma**：需求 → 结构化 BuildPlan
- **Alex**：按方案生成 / 迭代完整 HTML

## 本地启动

```bash
cd atoms-demo
cp .env.example .env.local
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

### 环境变量

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | DeepSeek / OpenAI 等兼容平台密钥 |
| `OPENAI_BASE_URL` | 默认 `https://api.deepseek.com/v1` |
| `OPENAI_MODEL` | 默认 `deepseek-chat` |
| `AUTH_SECRET` | Cookie 签名密钥 |
| `ALLOW_DEMO_MODE` | 无密钥时启用内置演示生成（默认 true） |

未配置 API Key 时，系统自动进入**演示模式**，仍可走完全流程，便于先交可运行版本。

## 部署建议

### Vercel（前端公网最快）

1. 把本仓库推到 GitHub（Public）  
2. [vercel.com](https://vercel.com) Import 项目  
3. 配置环境变量（同上）  
4. Deploy → 得到公网 URL  

注意：Vercel Serverless **无持久磁盘**，默认内存+冷启动可能导致进程重启后本地 JSON 丢失。演示账号/项目若需跨实例持久，可改接 Neon / Turso；笔试 PoC 也可用「演示模式 + 当场注册体验」说明边界。

### Railway（推荐有持久化）

1. New Project → Deploy from GitHub  
2. Root Directory: `atoms-demo`（若仓库根在上一级）  
3. Start: `npm run build && npm run start`  
4. 挂载持久卷到 `/app/data`（如使用）

## 技术栈

- Next.js 15 App Router + TypeScript  
- 服务端 JSON 存储、HttpOnly Cookie 会话、bcrypt 密码哈希  
- OpenAI SDK（兼容 DeepSeek）  
- Open-Meteo REST API  

## 目录

```text
src/app/api/          注册登录、项目、Agent、天气、分享
src/app/studio/       工坊三栏：项目 / 对话 / 预览
src/lib/llm.ts        Emma / Alex 调用与演示回退
src/lib/db.ts         持久化
DELIVERY.md           设计思路与完成度说明
```
