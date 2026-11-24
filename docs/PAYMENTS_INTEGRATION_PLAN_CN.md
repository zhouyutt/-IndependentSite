# FREG LLC 美国独立站收单与结算对接方案

更新日期：2026-06-22

## 1. 结论

建议采用 **Stripe + PayPal 双通道**：

- Stripe：Visa、Mastercard、American Express、Discover、Apple Pay、Google Pay、Link、Cash App Pay、ACH Direct Debit，以及按审核结果启用 Affirm/Klarna。
- PayPal Checkout：PayPal、Venmo、PayPal Pay Later。关闭 PayPal 的普通银行卡入口，避免和 Stripe 重复路由。
- USD 定价、USD 收单，结算到 FREG LLC 的美国公司银行账户。
- 前端使用 Stripe Payment Element/Express Checkout Element 和 PayPal JS SDK；Node 后端统一计算金额、创建支付、接收 Webhook、退款和对账。

这套方案适合当前规模：无月费起步快、支付方式完整、开发和运营成本较低，并保留未来把高交易量流量迁移到 Adyen 或协商 IC+ 费率的空间。

## 2. 市场方案比较

| 方案 | 美国市场支付方式 | 标准公开费率/模式 | 结算特点 | 适用判断 |
| --- | --- | --- | --- | --- |
| Stripe | 卡、Apple Pay、Google Pay、Link、Cash App Pay、ACH、Affirm、Klarna 等 | 美国本地卡 2.9% + $0.30；ACH 0.8%，最高 $5 | 可按日自动打款；首次真实打款通常需 7-14 天；符合条件可次日或即时打款 | **主通道首选**，API、风控、对账和 Vue 定制体验最好 |
| PayPal Checkout | PayPal、Venmo、Pay Later、卡 | PayPal/Venmo 通常 3.49% + $0.49；Pay Later 4.99% + $0.49；以实际商户协议为准 | 标准转入关联银行通常免费；即时转账 1.5% | **必须补充**，覆盖 Stripe 对美国商户暂不提供的 PayPal/Venmo |
| Braintree | 卡、PayPal、Venmo、钱包、ACH | 卡和第三方钱包 2.89% + $0.29；ACH 0.75%，最高 $5 | 统一在 PayPal/Braintree 体系管理，具体打款周期按商户审核 | 单平台备选，但当前项目的灵活性和实施体验不如双通道方案 |
| Adyen | 卡、钱包、ACH、Cash App Pay、Affirm、Afterpay、PayPal/Venmo 等 | 固定处理费 + 各支付方式费用，通常需销售报价 | 工作日净额结算，支持销售日结算和详细 Settlement Report | 月交易额明显增长、有多地区/线下统一收单需求后再评估 |
| Checkout.com | 卡、钱包、本地支付，企业定制 | 销售报价 | 企业级资金和多币种管理 | 更适合已有较大规模和专业支付团队的企业 |

费率会因行业、拒付率、国际卡、币种转换和交易量变化，最终以 FREG LLC 审核后的合同为准。

## 3. 推荐支付展示

结账页按资格动态展示：

1. 顶部快捷支付：Apple Pay / Google Pay / Link。
2. 信用卡与借记卡：Stripe Payment Element。
3. PayPal / Venmo：PayPal 独立按钮，仅向符合条件的设备和用户展示。
4. 分期：商品价格较高时启用 Affirm 或 PayPal Pay Later；先确认毛利可覆盖约 5%-6% 的通道成本。
5. ACH：建议先用于批发、大额订单或复购客户。ACH 最长可需 4 个工作日确认，支付成功前不能发货。

不建议首期同时启用过多分期产品；先上线 PayPal Pay Later 或 Affirm 其中一个，观察转化率、退款率和净毛利后再扩展。

## 4. 系统架构

```text
Vue Storefront
  |-- Stripe Elements --------> Stripe
  |-- PayPal JS SDK ----------> PayPal
  |             client token only
  v
Node Payment API
  |-- server-side price, tax, shipping and inventory validation
  |-- Stripe adapter / PayPal adapter
  |-- webhook signature verification and idempotency
  |-- order, payment, refund, dispute and settlement records
  v
Admin System
  |-- transaction details
  |-- refund / partial refund
  |-- dispute and exception queue
  |-- payout reconciliation
```

架构决策：

- 项目结构：按 `payments`、`orders`、`refunds`、`reconciliation` 功能拆分。
- API：延续现有 REST + typed fetch，支付供应商封装在后端 adapter 内。
- 认证：消费者可游客下单；退款、对账和交易查询必须走后台 RBAC。
- 实时状态：支付结果依赖 Webhook；前端成功页短轮询订单状态，不以浏览器跳转作为付款依据。
- 错误处理：统一错误码和 request ID，禁止向前端返回通道密钥或原始异常。

## 5. 订单与资金状态

```text
cart
  -> payment_pending
  -> processing (ACH/异步支付)
  -> paid
  -> fulfillment_pending
  -> shipped
  -> completed

异常分支：payment_failed / canceled / partially_refunded / refunded / disputed
```

核心规则：

- 商品价格、库存、运费和税费必须由 Node 后端重新计算，绝不接受前端传入的总金额。
- 创建支付请求时使用 `orderId` 作为 metadata，并使用唯一幂等键防止重复扣款。
- 卡支付以已验证 Webhook 为最终入账依据；ACH 需等待异步成功事件后才转为 `paid`。
- Webhook 事件以供应商 event ID 去重；重复回调必须返回成功但不得重复减库存、发邮件或发货。
- 退款先落本地退款申请，再调用通道；通道成功后更新订单和库存策略。
- 金额统一用最小货币单位整数存储，例如 `$129.99 = 12999`，禁止浮点金额。

## 6. API 对接清单

### 商城 API

- `POST /api/checkout/quote`：后端校验购物车，计算商品、折扣、运费、税费和总额。
- `POST /api/payments/stripe/intents`：创建或复用 PaymentIntent，返回 `clientSecret`。
- `POST /api/payments/paypal/orders`：创建 PayPal Order，返回 PayPal order ID。
- `POST /api/payments/paypal/orders/:id/capture`：服务端 capture，并等待 Webhook/查询结果最终确认。
- `GET /api/orders/:id/status`：成功页查询支付和履约状态。

### Webhook

- `POST /api/webhooks/stripe`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `checkout.session.async_payment_succeeded`（如改用 Stripe Checkout）
  - `checkout.session.async_payment_failed`
  - `charge.refunded`
  - `charge.dispute.created` / `charge.dispute.closed`
  - `payout.paid` / `payout.failed`
- `POST /api/webhooks/paypal`
  - 支付 capture 完成/拒绝
  - 退款完成/失败
  - dispute 相关事件

Stripe Webhook 必须读取未经 JSON 中间件改写的 raw body，并使用 `Stripe-Signature` + endpoint secret 验签。PayPal Webhook 同样必须调用官方验证机制，不得只相信请求体中的事件类型。

### 后台 API

- `GET /api/admin/transactions`：按订单、通道、状态、日期、金额检索。
- `GET /api/admin/transactions/:id`：支付、退款、Webhook 和资金流水时间线。
- `POST /api/admin/orders/:id/refunds`：全额或部分退款，要求权限和操作原因。
- `GET /api/admin/disputes`：拒付待处理队列、证据截止时间和处理结果。
- `GET /api/admin/payouts`：通道结算批次、手续费、净额和银行到账状态。
- `POST /api/admin/reconciliation/run`：触发指定日期区间的对账任务。

## 7. 数据模型

至少新增以下持久化表；当前内存数组不适合真实资金交易，正式接入前应迁移到 PostgreSQL。

- `orders`：订单号、客户、地址、金额快照、支付状态、履约状态。
- `order_items`：SKU、成交单价、数量、商品快照。
- `payments`：provider、provider_payment_id、amount、currency、status、payment_method_type、risk_result。
- `payment_events`：provider_event_id（唯一索引）、事件类型、处理状态、收到时间、脱敏 payload。
- `refunds`：本地退款号、provider_refund_id、金额、原因、状态、操作人。
- `disputes`：拒付金额、原因、证据截止时间、状态。
- `payouts`：provider_payout_id、gross、fees、refunds、adjustments、net、arrival_date、status。
- `ledger_entries`：订单、手续费、退款、拒付和结算的不可变资金分录。

## 8. 对账与结算

每日自动对账：

1. 拉取 Stripe Balance Transactions / Payout 和 PayPal Transaction Search / Settlement 数据。
2. 按 provider transaction ID 匹配本地 `payments`、`refunds`、`disputes`。
3. 校验 `销售额 - 退款 - 拒付 - 手续费 + 调整 = 结算净额`。
4. 未匹配、金额不一致、结算失败进入后台异常队列。
5. 保存原始报表到只读对象存储，数据库保存解析结果和文件哈希。

后台需要展示毛销售额、退款、拒付、通道费、待结算、已结算净额和预计到账日期。订单状态和银行到账状态必须分开，避免把“客户已付款”误认为“银行已到账”。

## 9. 风控与合规

- 使用 Stripe Elements/PayPal 托管组件，服务器不接触完整卡号和 CVV，降低 PCI 范围；仍需完成适用的 PCI 自评。
- 启用 AVS、CVC、Stripe Radar 和 3D Secure 动态规则；首期不要设置过度严格的统一拦截。
- 高客单体育器材重点保存物流单号、签收证明、商品描述、退换货沟通和设备序列信息，便于拒付举证。
- 管理后台退款接口启用角色权限、二次确认和不可修改审计日志。
- 日志禁止记录卡号、CVV、access token、Webhook secret 和完整敏感个人信息。
- 上线前完善网站的 Shipping、Returns & Refunds、Privacy、Terms、Contact 页面，并确保账单描述符能让买家识别 FREG LLC/品牌。
- 支付通道不等于销售税合规。需由税务顾问确认各州 nexus；可另行接入 Stripe Tax、Avalara 或 TaxJar。

## 10. 商户开户材料

建议提前准备：

- FREG LLC 注册文件、EIN、美国公司银行账户证明。
- 负责人和 25% 以上受益所有人的身份及地址信息（以通道实际 KYC 要求为准）。
- 网站域名和公司邮箱。
- 产品页、真实售价、库存/供应链说明、预计月交易额和平均客单价。
- 发货时效、物流服务商、退换货/退款政策和客服联系方式。
- DASHINGNOAH 品牌或商品销售授权、采购凭证；独立站信息需与开户主体和账单描述符一致。

## 11. 实施计划

### 第一阶段：基础设施（2-3 个工作日）

- PostgreSQL 订单和支付数据模型、迁移、环境变量校验。
- PaymentProvider adapter、统一错误码、幂等与审计日志。
- 测试/生产密钥完全隔离。

### 第二阶段：Stripe 主通道（3-5 个工作日）

- Payment Element + Express Checkout。
- 卡、Apple Pay、Google Pay、Link、Cash App Pay；ACH 可随后开启。
- Webhook、退款、支付详情和订单状态机。

### 第三阶段：PayPal 补充通道（2-3 个工作日）

- PayPal、Venmo、Pay Later 按 eligibility 动态显示。
- 服务端 create/capture、Webhook、退款和异常处理。

### 第四阶段：对账、后台与上线（3-5 个工作日）

- 交易详情、退款、拒付、Payout 和日对账页面。
- Sandbox 全流程、失败/重复回调、退款、移动端钱包和权限测试。
- 小流量上线，首周每日人工核对通道余额、订单和银行到账。

预计完整首版 10-16 个工作日，前提是商户账号审核、银行账户和域名均已准备完成。

## 12. 上线验收标准

- 卡、Apple Pay/Google Pay、PayPal/Venmo 至少各完成一次 Sandbox 成功与失败测试。
- 重复点击支付、API 重试和重复 Webhook 不会产生重复订单、扣款或库存变更。
- 支付失败、取消、超时、ACH processing 和异步失败均有正确页面状态。
- 全额退款、部分退款、退款失败和拒付事件可在中文后台追踪。
- 后台订单金额、通道交易金额、手续费、Payout 净额能完成逐笔和批次对账。
- 密钥不进入 Git 或前端 bundle，日志中无敏感支付信息。
- 桌面和移动端完成端到端回归，生产 Webhook 使用 HTTPS 且验签有效。

## 13. 主要官方资料

- [Stripe 美国定价](https://stripe.com/us/pricing)
- [Stripe Payment Element 与 Checkout](https://docs.stripe.com/orders)
- [Stripe 支付方式支持矩阵](https://docs.stripe.com/payments/payment-methods/payment-method-support)
- [Stripe ACH Direct Debit](https://docs.stripe.com/payments/ach-debit)
- [Stripe Payout](https://docs.stripe.com/payouts)
- [Stripe Webhook 验签](https://docs.stripe.com/webhooks/signature?lang=node)
- [Stripe Checkout 履约与异步支付](https://docs.stripe.com/checkout/fulfillment)
- [Stripe API 幂等请求](https://docs.stripe.com/api/idempotent_requests)
- [PayPal 美国商业定价](https://www.paypal.com/us/business/pricing)
- [PayPal Braintree 美国费率](https://www.paypal.com/enterprise/paypal-braintree-fees)
- [PayPal 独立按钮与 Venmo](https://developer.paypal.com/docs/checkout/standard/customize/standalone-buttons/)
- [Adyen 支付方式](https://docs.adyen.com/payment-methods/)
- [Adyen 定价](https://www.adyen.com/pricing)
- [Adyen 结算说明](https://docs.adyen.com/account/getting-paid)

