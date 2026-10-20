# 提交清单（飞书第四节）

按笔试文档填写：

1. **飞书文档副本公开链接**：把你的笔试文档设为「互联网获得链接可阅读」后粘贴  
2. **Demo 公网 URL**：部署后的地址（Vercel / Railway）  
3. **GitHub Public 仓库链接**：本仓库设为 Public  
4. **（加分）** Cursor / Claude 订阅或使用截图  

## 推送 GitHub（本机暂无 gh 时可手动）

```bash
cd atoms-demo
git remote add origin https://github.com/<你的用户名>/atoms-demo.git
git branch -M main
git push -u origin main
```

然后在 GitHub → Settings → General → Danger Zone → **Change visibility → Public**。

## 一键部署 Vercel

1. 打开 https://vercel.com/new  
2. Import 上述 GitHub 仓库  
3. Environment Variables 填入：

```text
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
AUTH_SECRET=换成随机长字符串
ALLOW_DEMO_MODE=true
```

4. Deploy → 复制生产域名填回飞书  

> 说明：Vercel 无持久磁盘，服务端 JSON 在冷启动/多实例下可能重置；评审当场注册体验即可。若要求强持久，改用 Railway 并挂载 volume。
