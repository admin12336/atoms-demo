# 提交清单（飞书第四节）

## 已完成

| 项 | 内容 |
|----|------|
| GitHub Public 仓库 | https://github.com/admin12336/atoms-demo |
| 本地 Demo | http://localhost:3000 |

## 还差你填的

1. **飞书文档副本公开链接**：笔试文档设为「互联网获得链接可阅读」  
2. **Demo 公网 URL**：按下面部署后粘贴  
3. **（加分）** Cursor 使用截图  

## 一键部署 Vercel（约 3 分钟）

1. 打开（已带上仓库）：  
   https://vercel.com/new/clone?repository-url=https://github.com/admin12336/atoms-demo  
   或 https://vercel.com/new → Import `admin12336/atoms-demo`
2. Environment Variables 填入：

```text
ALLOW_DEMO_MODE=true
AUTH_SECRET=换成一串随机字符
OPENAI_API_KEY=（可选，有 DeepSeek 密钥再填）
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

3. Deploy → 复制 `https://xxx.vercel.app` 填回飞书  

> Vercel 无持久磁盘，服务端 JSON 可能在冷启动后重置；评审当场注册体验即可。无密钥时演示模式也能走完全流程。
