# Sendora Gift 询盘追踪完整版

这套功能把表单询盘和 WhatsApp 点击统一保存到一个受密码保护的后台，同时保留现有 Resend 邮件通知。

## 能看到什么

- 客户姓名、公司、邮箱、WhatsApp/电话和询盘内容（表单提交时）
- 表单提交或 WhatsApp 点击，以及唯一询盘编号
- 首次入口页、询盘页面、首次引荐来源和最近 10 个浏览页面
- UTM source / medium / campaign / term / content
- Google、Meta、Microsoft、TikTok 广告点击 ID
- ChatGPT、Perplexity、Gemini、Copilot、Claude、Google、Bing 等来源分类
- 浏览器语言、时区，以及 Vercel 提供的国家/城市信息
- 询盘状态、跟进备注和 CSV 导出

注意：普通自然搜索通常不会向网站提供单个访客的具体搜索词；后台只能显示实际传入的 `utm_term`。Google Ads 可在最终到达网址中使用 ValueTrack，例如 `utm_term={keyword}`。WhatsApp Business 普通跳转只能可靠记录“点击”，不能证明客户已经发送消息；预填消息中的询盘编号可用于人工匹配。

## 1. 创建 Supabase 数据表

1. 创建一个 Supabase 项目。
2. 打开 SQL Editor。
3. 运行 [`supabase/inquiry_tracking.sql`](supabase/inquiry_tracking.sql) 的全部内容。
4. 在 Project Settings → API 复制 Project URL 和 `service_role` key。

`service_role` key 只能放在 Vercel 环境变量，绝不能写进网页、提交到 GitHub 或发送给第三方。

## 2. 配置 Vercel 环境变量

在 Vercel 项目 Settings → Environment Variables 中添加：

| 变量 | 用途 |
| --- | --- |
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端数据库密钥 |
| `ADMIN_DASHBOARD_PASSWORD` | 后台登录密码，至少 12 位 |
| `ADMIN_DASHBOARD_SECRET` | Cookie 签名密钥，至少 32 位随机字符串 |

推荐生成签名密钥：

```bash
openssl rand -hex 32
```

同时保留原有表单变量：`TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET_KEY`、`RESEND_API_KEY`、`INQUIRY_TO_EMAIL` 和 `INQUIRY_FROM_EMAIL`。

添加变量后重新部署 Production。

## 3. 使用后台

访问：`https://www.sendoragift.com/admin/`

后台不会出现在网站导航或 sitemap 中，并通过 `noindex` 和登录 Cookie 保护。可按状态、渠道、来源和日期筛选，查看完整来源路径，更新跟进状态/备注并导出当前筛选结果为 CSV。

状态建议：

- `新询盘`：表单刚提交
- `WhatsApp 已点击`：点击了 WhatsApp，但尚未确认发送
- `已联系`：已回复客户
- `有效询盘`：需求、数量、预算或时间基本有效
- `已报价`：已经发送报价
- `已成交` / `未成交` / `垃圾询盘`

## 4. 广告和内容链接规范

推荐链接格式：

```text
https://www.sendoragift.com/corporate-gift.html?utm_source=google&utm_medium=cpc&utm_campaign=corporate_gifts&utm_term={keyword}
```

AI 内容或合作链接示例：

```text
https://www.sendoragift.com/corporate-gift.html?utm_source=chatgpt.com&utm_medium=referral&utm_campaign=ai_referral
```

测试任意页面的采集结果，可添加 `?debug_lead_source=1` 并在浏览器控制台查看 `Lead Source Tracking`。
