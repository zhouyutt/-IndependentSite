# DASHINGNOAH Sports Store

A Vue storefront and Node API for dashingnoah.top, with a separate Vue admin application. The catalog features sports and fitness equipment from the [DASHINGNOAH Amazon Store](https://www.amazon.com/stores/DASHINGNOAH/page/EA8BE3A0-3BA6-4DA7-98B7-C1D6F0147970).

Customers can send order and privacy questions to [support@dashingnoah.top](mailto:support@dashingnoah.top).

## 部署到服务器

默认部署域名为 `dashingnoah.top`。访客可以浏览和搜索商品、查看详情，并前往 Amazon 购买。Caddy 提供 HTTPS 和静态页面，并把商品请求转发给 Docker 内网中的 Node API。购物车、管理后台和 PayPal 结账仅在本地开发模式中启用。

### 1. 准备服务器和域名

- 在有公网 IP 的 Linux 服务器上安装 Git、Docker Engine 和支持 `--wait` 的 Docker Compose 插件。运行 `git --version`、`docker version`、`docker compose version` 确认安装成功。服务器构建时需要访问 Docker Hub 和 npm。以下命令假定当前用户有 Docker 权限。需要提权时，在 `docker` 命令前加 `sudo`。[Ubuntu 安装 Docker](https://docs.docker.com/engine/install/ubuntu/)
- 在 `dashingnoah.top` 的 DNS 管理页面添加两条 A 记录，主机记录分别为 `@` 和 `www`，记录值都填服务器的公网 IPv4。如果已有 AAAA 记录，确认它也指向这台服务器可访问的 IPv6 地址。
- 在云防火墙或安全组以及主机防火墙放通入站 TCP **80、443**，并确认这两个端口可供 Caddy 使用。API 的 `3001` 仅供容器内部使用。腾讯云控制台设置和已有网关的处理方式见[腾讯云部署指南](docs/TENCENT_CLOUD_DEPLOYMENT_CN.md)。

### 2. 从 GitHub 克隆并启动

通过 SSH 登录服务器后执行以下命令。使用默认域名时，仓库中的配置可以直接启动，无需创建 `.env` 或填写支付密钥。

```bash
cd ~
git clone --branch main https://github.com/zhouyutt/-IndependentSite.git dashingnoah
cd ~/dashingnoah
docker compose config --quiet
docker compose up -d --build --wait
docker compose ps
```

`api` 应显示 `healthy`，`web` 应显示 `Up`。DNS 生效且公网端口可达后，Caddy 会为根域名和 www 自动申请、续订证书。[Caddy 自动 HTTPS](https://caddyserver.com/docs/automatic-https)

### 3. 从公网验收

在服务器以外的电脑上运行以下命令。

```bash
dig +short dashingnoah.top A
dig +short www.dashingnoah.top A
curl -fsSI https://dashingnoah.top/
curl -fsS https://dashingnoah.top/api/products
curl -sSI 'https://www.dashingnoah.top/terms/?from=www'
```

两个 DNS 查询应返回服务器公网 IP。首页应返回 `200`，商品接口应返回含 `products` 数组的 JSON。最后一条请求应返回 `308`，且 `Location` 为 `https://dashingnoah.top/terms/?from=www`。用浏览器打开一个商品，确认购买按钮能进入对应的 Amazon 页面。

如果首页无法访问，在服务器的 `~/dashingnoah` 下运行 `docker compose logs --tail=100 web api`。若日志提示证书验证失败，先核对两个域名的解析结果和公网 80、443 端口。

### 4. 发布更新和回滚

在服务器的部署目录中先记下当前版本的提交号，再拉取并构建新版。商品数据来自 `server/data/products.json`，更新商品后也需要重新构建。

```bash
cd ~/dashingnoah
git rev-parse HEAD
git switch main
git pull --ff-only origin main
docker compose up -d --build --wait
docker compose ps
```

更新后重复公网验收。如需回滚，将 `git switch --detach 上一版提交号` 中的提交号替换为刚才记录的值，执行后重新运行 `docker compose up -d --build --wait`。继续使用同一 Compose 项目并保留 `caddy_data` 卷，其中保存了 HTTPS 证书。

## Run locally

```bash
npm ci
npm run dev
```

Storefront: http://localhost:5173  
Admin system: http://localhost:5174  
Backend API: http://localhost:3001

## Local PayPal setup

To test PayPal Checkout locally, bind the receiving account in the admin system under `收款账户`, or export these variables in the shell that starts the backend.

```bash
export PAYPAL_MODE=sandbox
export PAYPAL_CLIENT_ID=your-paypal-rest-app-client-id
export PAYPAL_CLIENT_SECRET=your-paypal-rest-app-client-secret
export PAYPAL_MERCHANT_ID=your-paypal-business-merchant-id
export PAYPAL_MERCHANT_EMAIL=payments@example.com
```

For local automated tests only, the project recognizes `mock_paypal_sandbox_secret` as a sandbox mock secret so Playwright can verify the PayPal button flow without contacting PayPal.

## Useful commands

```bash
npm run build
npm run test
```

For the end-to-end tests, start `npm run dev` and run `npm run test:e2e` in a second terminal. The test script uses Google Chrome installed under `/Applications` on macOS.
