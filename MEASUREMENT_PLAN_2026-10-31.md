# Sendora Gift：上线后的效果核对方案

状态：代码与事件设计已准备，尚无本次改动上线后的效果数据。未读取 GA4 或 Search Console 账户报表，也未修改 GA4 属性设置。预览环境的测量检查不能证明正式属性已收到数据。

## 发布时建立记录

记录正式域名实际部署完成的时间、对应 commit、变更页面和同期广告活动。比较窗口从正式部署日期开始；不要把 PR 创建或预览构建日期当成上线日期。保留发布前相同长度、相同星期构成的基线，按渠道、国家、设备和落地页分组。

本次重点页面：8个 `/products/<set>/` 套装详情页、`/custom-metal-pens.html`、`/custom-pu-document-folders.html`、汽车交付和房地产场景页、样品中心及两条询盘路径。

## 网站中的事件

| 事件 | 实际含义 | 分组参数 |
| --- | --- | --- |
| `product_detail_view` | 打开有组合选择器的产品或场景页 | `product_id` |
| `gift_direction_select` | 买家切换组合方向 | `product_id`, `configuration_id` |
| `quote_builder_continue` | 买家通过选品表单继续填写需求 | `product_id`, `configuration_id`, `packing_id` |
| `sample_reference_open` | 打开有标注的实拍或样品参考 | `product_id`（相关页有值）, `evidence_id` |
| `sample_video_start` | 首次播放该页标注的样品视频 | `product_id`, `evidence_id` |
| `quote_start` | 点击当前页面上的内部询盘链接 | `product_id`（有值时）, `journey_step` |
| `quote_form_start` | 首次开始填写正式询盘表单 | `product_id`, `configuration_id`（已带入时） |
| `quote_submit_error` | 一次提交尝试遇到验证、网络、服务或服务器附件错误 | `journey_step`：固定错误类别；不包含表单内容或文件名 |
| `whatsapp_click` | 点击 WhatsApp | 原有来源信息；本次增加产品和组合参数 |
| `generate_lead` | 原有成功提交处理器确认询盘提交成功 | 原有来源信息；本次增加产品和组合参数 |

`quote_start` 不包含选品表单的 GET 跳转，后者单独计为 `quote_builder_continue`。同一页面浏览中的 `quote_form_start` 只发送一次；视频事件每个标注视频只计第一次播放。WhatsApp 点击不等于客户已经发来消息；成功表单提交也不等于成交订单。

询价可靠性改动后，`generate_lead` 要求提交 API 返回成功 HTTP 状态且 JSON 中明确有 `ok: true`，异常页面或无法解析的返回不会记录成功。`quote_submit_error` 的类别限于 `verification`、`network`、`service`、`validation`、`upload_too_large`、`invalid_upload`。该事件不覆盖所有原生字段校验失败；重复尝试可以产生多次错误事件，不能用全部错误事件次数直接计算用户失败率。优先按同一会话、设备与询价路径核对发生错误的用户及其后续是否成功提交。

新增自定义事件参数只接受预设名称和受限的标识符：`product_id`、`configuration_id`、`packing_id`、`evidence_id`、`journey_step`。不把买家的姓名、邮箱、自由描述、邮编或数量作为新增分析参数。询盘所需内容仍通过现有表单处理和保存。

## GA4 属性中仍需核对的事项

1. 在正式属性的实时报告或 DebugView 中验证事件接收，核对属性 ID，排除内部测试流量。
2. 要按新增参数做报表，应由具有属性编辑权限的管理者核对并注册对应的事件级自定义维度，避免重复创建。
3. 保留原有 `generate_lead` 成功语义。不要把选品继续、询盘链接点击或每次输入都设为同一种成功转化。
4. 使用同一会话或用户范围比较漏斗步骤。简单相除全部事件次数不能直接当作会话转化率。

参考：[Google：事件参数](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters)、[Google：事件级自定义维度](https://support.google.com/analytics/answer/14239696?hl=en)。本次提交不代表上述后台设置已经完成。

## 观察与决策

| 时间窗口 | 核对内容 | 据此采取的动作 |
| --- | --- | --- |
| 上线后初期 | 链接、表单、事件接收及参数是否正确 | 先排除采集或页面故障 |
| 有足够访问数据后 | 产品访问 → 组合选择 → 填写需求 → 成功提交；单独看 WhatsApp 点击 | 找出流失集中在哪一步，再调整对应页面 |
| 更长的可比窗口 | Search Console 中重点页的查询、展示、点击、CTR及平均位置 | 结合搜索意图、设备和国家评估标题、摘要与内容，而不只看总访问量 |
| 持续跟进 | 有效询盘、报价及订单的人工业务记录 | 区分页面点击增长与采购质量增长 |

Search Console 使用相同页面过滤和日期比较条件；记录是否包含品牌词，并结合同期投放、节假日和季节性解释变化。参考：[Google：搜索表现比较](https://support.google.com/webmasters/answer/10268906?hl=en)。

## 数据状态

发布前基线：待从账户读取。正式上线日期：待发布。上线后结果：待采集。当前没有可支持“流量已增加”或“询盘已提升”的数据。
