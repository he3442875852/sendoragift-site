# Sendora Gift：SEO / AEO / GEO 内容扩展

本次从已合并 PR #77 的 main（`4a07cc7`）继续，新增 6 个独立页面，并把它们接入现有产品、解决方案、指南和询盘路径。新增内容按现有产品与采购任务选题；没有读取关键词搜索量、Search Console 或 GA4 报表。

## 新增页面与用途

| 页面 | 独立内容及买家任务 | 主要承接入口 |
| --- | --- | --- |
| `/channel-partner-welcome-gifts.html` | 渠道伙伴入驻礼品；收礼人、分批数量、联合品牌及后续补单 | solutions、分销商采购页 |
| `/document-folder-pen-gift-sets.html` | 文件夹与金属笔组合；文件适配、笔及笔盒方向、装载包装确认 | solutions、文件夹及金属笔产品页 |
| `/blog/a4-a5-document-folder-capacity-guide.html` | 用实际文件包检查可用容量、开口、闭合及装载状态 | blog、文件夹产品页 |
| `/blog/metal-pen-engraving-vs-printing.html` | 按具体笔材质、表面、图案和阅读方向比较雕刻与印刷 | blog、金属笔及 Logo 工艺页 |
| `/blog/corporate-gift-artwork-file-checklist.html` | 主文件与预览、PDF 内容检查、逐表面说明、审批版本及附件限制 | blog、Logo 工艺及产品中心 |
| `/blog/golf-tournament-sponsor-logo-checklist.html` | 赞助商、使用表面、收礼人版本及审批矩阵 | blog、高尔夫套装详情 |

渠道伙伴欢迎礼与“采购商品用于转售”的分销商页面承担不同意图。组合页不取代单品页，指南不取代产品与询价页。新增页面不使用重复城市、近义词或无差别替换文案建立门页。

## 实际优化

- SEO：6 个独立 title、description、H1、canonical、社交分享信息及面包屑；更新两个 sitemap，把新页接入解决方案和指南中心及相关旧页。Blog ItemList 与实际 20 篇指南保持一致。只更新本轮实质变更页面的 sitemap 日期。
- AEO：每页开头先回答具体问题，再提供比较表、核对步骤、相关问答和询价准备信息。核心文字与链接直接输出在 HTML 中，不依赖生成式摘要或客户端渲染。
- GEO：沿用一致的 Sendora Gift 品牌、公司实体、联系人及地址；新增文章注明公司署名和实际修订日期；实拍说明区分产品参考与客户案例，必要的技术说明链接到原始资料。页面使用 WebPage、BreadcrumbList，以及 Service 或 BlogPosting 标记，内容与可见页面一致。
- 询盘：两个新商业页使用固定产品标识；两条询价路线均保留具体组合名称、类别与来源，WhatsApp 延续同一需求上下文。新增测试覆盖这两组名称，并验证无关组合参数不会被套用。
- 体验：新页有桌面目录、移动端目录、局部滚动表格及相关内容入口。新增可下载的空白 artwork handoff 文本清单。修复手机询价页验证失败提示出现后按钮区域换列、撑宽页面的问题，并更新两条询盘页 CSS 与上下文脚本缓存版本。

## 内容与业务事实

钥匙扣写为金属钥匙扣。文件夹容量以实际装载文件检查，不把纸张名称直接当成可用内尺寸。礼盒尺寸、库存、准确价格、测试性能、工厂资质及交期未获确认，不作固定承诺。约 100 套只作为现有礼品规划参考，最终 MOQ 取决于单品、颜色、Logo 和包装。组合方向为待确认方案，不伪装成固定库存 SKU。

现有照片只说明能观察到的产品；未编造客户名称、订单量、项目成果、评价或成交数据。高尔夫数量示例标注为说明计算方法的假设情形。文件指南与网站当前仅接受一份 JPG、PNG 或 PDF 的行为一致，其他主文件格式要求另行协调传递。

## 实施依据与边界

Google 的 AI features 指南继续要求可抓取、可索引、可显示摘要的页面，以及可见、有用的正文和正常内链；并未要求额外的 AI 专用 schema 或文本文件。`llms.txt` 更新为可选资源目录，不能当作 Google 排名或引用信号。新版页面保留可见问答，但未新增 FAQPage 标记，也不承诺 FAQ 富结果。Google 2026 年更新记录已说明 FAQ 搜索展示的停用。现有旧页的 FAQ 标记不在本轮全站迁移范围内。

主要原始资料（2026-10-31 核对）：

- [Google：AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google：Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google Search documentation updates](https://developers.google.com/search/updates)
- [Google：Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google：Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Adobe：Raster and vector files](https://helpx.adobe.com/photoshop/desktop/create-open-import-images/import-files/use-raster-and-vector-files.html)
- [Trotec：Anodized aluminum application](https://www.troteclaser.com/en/laserable-materials/laser-engraving-anodized-aluminum)

Adobe 资料支持“PDF 可含矢量与位图”的区分。Trotec 资料只作为某种具体材料的应用背景，不能证明本网站某支笔采用相同材料或产生相同外观。指南没有把外部资料当成自家产品认证。

## 验证

- `node --test tests/*.test.js`：94 项通过。
- `node scripts/seo_checks.js`：128 个可索引页面通过，比原 122 个增加 6 个；全部可从首页链接到达。
- `git diff --check`：通过。
- 浏览器检查：渠道伙伴页桌面首屏、金属笔指南正文与表格，以及 6 个新增页面的窄屏布局。窄屏内容视口 361px，页面没有横向溢出；宽比较表在自身容器内滚动。
- 两个新组合的询价名称与类别通过浏览器及自动化检查；文件夹与笔组合手机询价页在验证服务失败提示出现后，仍为 361px 宽且无横向溢出。

预览使用静态托管，本地 API 不具备生产邮件和验证服务；未提交真实询盘、未发送测试邮件。预览副本关闭生产 GA 初始化，正式源码保留现有测量。下载清单的文件、链接及内容已检查；本轮未取得浏览器下载完成的事件证据。

PR 与预览可用不等于正式上线、Google 已收录或 AI 已引用。发布后按 `MEASUREMENT_PLAN_2026-10-31.md` 区分新页收录、搜索曝光、落地访问、询盘意向与有效询盘，不能用当前代码检查推导流量增长。
