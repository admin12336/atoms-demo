# 交付说明 · Atoms Demo（对照飞书笔试文档）

> 对应文档：【请创建副本后使用】研发笔试——XXX  
> 参考产品：[Atoms](https://atoms.dev/)  
> 仓库：https://github.com/admin12336/atoms-demo

## 0. 题目理解

笔试要求完成一个可运行的 **Atoms-Demo**：用 AI 把「场景」做成可体验产品，而不是重造整个 Atoms 平台。

本项目实现的核心闭环：

```text
注册登录 → 中文描述需求 → Emma 产品方案 → 你批准
  → Alex 生成可交互网页 → 右侧预览 / 对话迭代 / 回滚导出分享
```

鼓励使用 Cursor 等 AI 编程工具完成本题（本仓库即由 Cursor 协作交付）。

## 1. 笔试要求 → 实现对照

| 文档要求 | 实现 |
|----------|------|
| 智能体驱动生成应用，并可视化网页展示 | Mike 状态协调 + Emma 规划 + Alex 生成；右侧 Canvas 预览 |
| 真实交互（非纯命令行） | Web UI：登录、对话、批准按钮、iframe 内增删改查 |
| 数据持久化（哪怕简单） | 服务端 JSON（用户/项目/消息/版本）；生成应用 localStorage |
| 初始化 / 注册 / 登录 / 核心业务流 | 完整具备 |
| 至少一个衍生能力 / 复杂模块 | Open-Meteo 第三方天气；版本回滚、导出 HTML、分享链接、多端预览 |
| 提供公网可访问链接 | 见 `SUBMIT.md`；支持 Vercel 部署 |
| 提交文档说明设计与过程 | 本文件 + `README.md` |
| GitHub Public | https://github.com/admin12336/atoms-demo |

## 2. 实现思路与取舍

1. **方案先行**  
   先出结构化方案再生成代码，贴近 Atoms「先对齐、再执行」的协作方式。

2. **生成物 = 单文件 HTML**  
   沙箱即可运行，3–4 小时内能打通「可点、可改、可交付」。

3. **服务端持久化账号与项目**  
   满足「不是纯前端 Mock」；生成应用内状态仍用 localStorage。

4. **第三方能力**  
   - OpenAI 兼容大模型（DeepSeek 等）做规划与生成  
   - Open-Meteo 天气 API（无需 Key）写入侧栏与生成上下文  

5. **演示模式**  
   无 API Key 时仍可走完全流程，便于评审机器验收。

## 3. 完成度

### 已完成

- 注册 / 登录 / 退出  
- 多项目、模板启动  
- Emma 方案卡片 + 批准生成  
- Alex 生成与对话迭代  
- 桌面/平板/手机预览、版本回滚、导出、分享  
- Open-Meteo  
- README / DELIVERY / SUBMIT  

### 明确边界

- 不生成独立多文件 React 工程后端业务服务  
- 不做支付、OAuth、自定义域名  
- Vercel 无持久盘时 JSON 可能随实例重置（当场注册即可体验）

## 4. 技术栈

Next.js 15 · TypeScript · OpenAI SDK（兼容 DeepSeek）· bcrypt Cookie 会话 · 文件 JSON 存储 · Open-Meteo

## 5. 本地与部署

```bash
cd atoms-demo
cp .env.example .env.local
npm install
npm run dev
```

部署与提交粘贴稿见 `SUBMIT.md`。
