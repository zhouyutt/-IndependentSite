# 用 Docker 发布 dashingnoah.top

首发版提供商品展示、搜索筛选、商品详情、Amazon 购买链接，以及隐私政策和服务条款。一个 Caddy 容器提供网站、HTTPS 和 www 跳转，一个 Node 容器在 Docker 内网读取商品。启动时不需要数据库、PayPal 密钥或后台账号。

## 1. 准备现有腾讯云服务器

- 在服务器上确认 `docker version` 和 `docker compose version` 均可用。Ubuntu 可按官方步骤安装 Docker Engine 和 Compose 插件。[Ubuntu 安装说明](https://docs.docker.com/engine/install/ubuntu/)
- 在轻量应用服务器的防火墙或 CVM 的安全组，以及主机防火墙，开放公网 TCP 80 和 443。SSH 端口限自己的管理 IP 使用。容器之间的 3001 使用内部网络。[轻量防火墙说明](https://cloud.tencent.com/document/product/1207/136745)
- 用 `sudo ss -ltnp` 检查 80、443 的现有监听。如果同机已有生产网站，沿用现有网关接入新域名，避免占用其端口。可将 Compose 的 `web` 改为仅映射本机回环端口，并让原网关负责 HTTPS、域名分流及 www 跳转。本文的默认命令适用于 80、443 可用的服务器。
- 如果这台机器位于中国内地，域名指向该服务器提供网站服务前，先确认已办妥适用的 ICP 备案或接入备案。域名直连香港或美国等非内地源站无需办理这项内地接入备案。[腾讯云备案说明](https://cloud.tencent.com/document/faq/243/19630)

## 2. 把首发版放到服务器并启动

服务器可以访问 GitHub 时，按 [README 的部署流程](../README.md#部署到服务器) 克隆仓库并启动。也可以从本机传输源码包。在本机项目根目录执行以下命令，将当前 Git 提交打包并传到服务器用户的主目录。将 `用户名@服务器公网IP` 换成实际 SSH 地址。

```sh
mkdir -p dist
git archive --format=tar.gz --output=dist/dashingnoah-site.tar.gz HEAD
scp dist/dashingnoah-site.tar.gz 用户名@服务器公网IP:~/
```

登录服务器后执行以下命令。已有 Docker 权限的用户可以省略 `sudo`。若使用 Git 部署，也可以直接在包含本次 Docker 配置的完整项目根目录执行最后两条命令。

```sh
mkdir -p ~/dashingnoah
tar -xzf ~/dashingnoah-site.tar.gz -C ~/dashingnoah
cd ~/dashingnoah
sudo docker compose up -d --build --wait
sudo docker compose ps
```

首构建需要服务器能够下载 Docker Hub 的 Node 和 Caddy 镜像，以及 npm 依赖。默认站点就是 `dashingnoah.top`。只向主机发布 80、443，API 启动健康检查会读取真实商品列表。运行 `docker compose logs --tail=80 web api` 可以查看启动状态。DNS 生效前，Caddy 的证书验证可能暂时失败，它会自动重试。[Caddy 自动 HTTPS](https://caddyserver.com/docs/automatic-https)

## 3. 在 DNSPod 添加两条记录

在腾讯云控制台打开 DNSPod，选择 `dashingnoah.top` 的记录管理，将下表中的值替换为**这台服务器的公网 IPv4**。如果同名记录已存在，先确认用途再修改。邮箱使用的 MX、TXT 等记录应保留。若配置过 AAAA，确认该 IPv6 也能到达这台服务器。[DNSPod A 记录](https://docs.dnspod.cn/dns/help-a/)

| 主机记录 | 类型 | 线路 | 记录值 |
| --- | --- | --- | --- |
| `@` | A | 默认 | 服务器公网 IPv4 |
| `www` | A | 默认 | 同一公网 IPv4 |

DNSPod 生效后，Caddy 会为两个主机名分别申请证书。HTTP 跳转到 HTTPS，`https://www.dashingnoah.top/terms/` 会永久跳转到 `https://dashingnoah.top/terms/`。证书保存在 Docker 的 `caddy_data` 卷里，重新构建应用时保留这个卷。

## 4. 从服务器以外验收

```sh
dig @1.1.1.1 +short dashingnoah.top A
dig @1.1.1.1 +short www.dashingnoah.top A
curl -fsSI https://dashingnoah.top/
curl -fsSI 'https://www.dashingnoah.top/terms/?from=www'
curl -fsS https://dashingnoah.top/api/products
```

两个 DNS 查询应返回目标公网 IP。根域首页应返回 200 和有效证书，www 请求应返回 308，`Location` 保留路径和查询参数。商品接口应返回商品 JSON。在浏览器中打开商品详情、Amazon 链接、`/privacy/` 和 `/terms/`。首发不需要配置 `admin` 域名。

## 5. 后续更新

商品来源是 `server/data/products.json`，商品图片在 `client/public/assets/`。更新源码或商品后，在同一项目目录再次执行 `docker compose up -d --build --wait`。保留上一版源码包或 Git 版本，需要回滚时从上一版本重新构建，沿用相同的 Compose 项目名和证书卷。购物车、后台和收款可以在后续版本中单独启用。
