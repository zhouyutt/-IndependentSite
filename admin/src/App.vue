<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import {
  Box,
  DataAnalysis,
  Document,
  Goods,
  Menu as MenuIcon,
  Plus,
  Refresh,
  Search,
  Setting,
  Tickets,
  Warning
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { adminApi } from './lib/api.js';

const loading = ref(true);
const error = ref('');
const dashboard = ref(null);
const products = ref([]);
const orders = ref([]);
const paypalAccount = ref(null);
const activeView = ref('dashboard');
const selectedOrder = ref(null);
const orderDrawerOpen = ref(false);
const productDialogOpen = ref(false);
const editingProductId = ref('');
const productSearch = ref('');
const productStatus = ref('');
const orderStatus = ref('');
const paypalSaving = ref(false);

const defaultAmazonUrl = 'https://www.amazon.com/DASHINGNOAH-Basketball-4-82-8-53FT-Adjustable-Backboard/dp/B0DBH3RLX2?ref_=ast_sto_dp';

const productForm = reactive({
  id: '',
  name: '',
  category: 'Basketball Hoops',
  collection: 'DASHINGNOAH Sports Equipment',
  price: 159,
  compareAt: 209,
  stock: 20,
  summary: '',
  color: 'Black',
  badge: 'New',
  material: 'Steel frame and PE base',
  image: '/assets/product-basketball-hoop-853.jpg',
  status: 'active',
  amazonStoreUrl: defaultAmazonUrl
});

const paypalForm = reactive({
  mode: 'sandbox',
  clientId: '',
  clientSecret: '',
  merchantId: '',
  merchantEmail: ''
});

const metrics = computed(() => dashboard.value?.metrics || {
  revenue: 0,
  orderCount: 0,
  units: 0,
  activeProducts: 0,
  lowStockCount: 0,
  averageOrderValue: 0
});

const filteredProducts = computed(() => {
  const q = productSearch.value.trim().toLowerCase();
  return products.value.filter((item) => {
    const matchesText = !q ||
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.collection.toLowerCase().includes(q);
    const matchesStatus = !productStatus.value || (item.status || 'active') === productStatus.value;
    return matchesText && matchesStatus;
  });
});

const filteredOrders = computed(() => {
  if (!orderStatus.value) return orders.value;
  return orders.value.filter((order) => order.status === orderStatus.value);
});

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value % 1 ? 2 : 0 }).format(value || 0);
}

function statusLabel(status) {
  if (status === 'draft') return '草稿';
  if (status === 'archived') return '已归档';
  return '在售';
}

function statusType(status) {
  if (status === 'draft') return 'warning';
  if (status === 'archived') return 'info';
  return 'success';
}

function paymentStatusLabel(status) {
  if (status === 'paid') return '已付款';
  if (status === 'payment_pending') return '待付款';
  return '已确认';
}

function paymentProvider(order) {
  return order.paymentMethod === 'paypal' || order.payment?.provider === 'paypal' ? 'PayPal' : 'Mock';
}

async function loadAdmin() {
  loading.value = true;
  error.value = '';
  try {
    const [dashboardData, productData, orderData, paypalData] = await Promise.all([
      adminApi.dashboard(),
      adminApi.products(),
      adminApi.orders(),
      adminApi.paypalAccount()
    ]);
    dashboard.value = dashboardData;
    products.value = productData.products;
    orders.value = orderData.orders;
    paypalAccount.value = paypalData.account;
    Object.assign(paypalForm, {
      mode: paypalData.account.mode || 'sandbox',
      clientId: paypalData.account.clientId || '',
      clientSecret: '',
      merchantId: paypalData.account.merchantId || '',
      merchantEmail: paypalData.account.merchantEmail || ''
    });
  } catch (err) {
    error.value = err.message || '无法加载后台数据。';
  } finally {
    loading.value = false;
  }
}

function resetProductForm() {
  Object.assign(productForm, {
    id: '',
    name: '',
    category: 'Basketball Hoops',
    collection: 'DASHINGNOAH Sports Equipment',
    price: 159,
    compareAt: 209,
    stock: 20,
    summary: '',
    color: 'Black',
    badge: 'New',
    material: 'Steel frame and PE base',
    image: '/assets/product-basketball-hoop-853.jpg',
    status: 'active',
    amazonStoreUrl: defaultAmazonUrl
  });
  editingProductId.value = '';
}

function openCreateProduct() {
  resetProductForm();
  productDialogOpen.value = true;
}

function editProduct(product) {
  editingProductId.value = product.id;
  Object.assign(productForm, {
    id: product.id,
    name: product.name,
    category: product.category,
    collection: product.collection,
    price: product.price,
    compareAt: product.compareAt,
    stock: product.stock,
    summary: product.summary,
    color: product.color,
    badge: product.badge,
    material: product.material,
    image: product.image,
    status: product.status || 'active',
    amazonStoreUrl: product.amazonStoreUrl || defaultAmazonUrl
  });
  productDialogOpen.value = true;
}

async function saveProduct() {
  const payload = {
    ...productForm,
    price: Number(productForm.price),
    compareAt: Number(productForm.compareAt),
    stock: Number(productForm.stock),
    colors: [...new Set([productForm.color, 'Black', 'Blue'].filter(Boolean))],
    gallery: [productForm.image],
    features: ['FREG LLC catalog source', 'Amazon link and ASIN tracking', 'Managed through FREG Operations'],
    amazonStoreUrl: productForm.amazonStoreUrl,
    source: 'Amazon product link supplied by user',
    company: 'FREG LLC',
    businessType: 'E-COMMERCE, RETAIL, WHOLESALE',
    companyPrincipalOffice: '26682 ALMOND AVENUE UNIT B, REDLANDS, CA 92374'
  };

  if (editingProductId.value) {
    await adminApi.updateProduct(editingProductId.value, payload);
    ElMessage.success('商品已更新。');
  } else {
    await adminApi.createProduct(payload);
    ElMessage.success('商品已上架。');
  }
  productDialogOpen.value = false;
  resetProductForm();
  await loadAdmin();
}

async function removeProduct(product) {
  await ElMessageBox.confirm(`确定删除「${product.name}」吗？`, '删除商品', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  });
  await adminApi.deleteProduct(product.id);
  ElMessage.success('商品已删除。');
  await loadAdmin();
}

function openOrder(order) {
  selectedOrder.value = order;
  orderDrawerOpen.value = true;
}

async function savePayPalAccount() {
  paypalSaving.value = true;
  try {
    const data = await adminApi.savePayPalAccount({ ...paypalForm });
    paypalAccount.value = data.account;
    paypalForm.clientSecret = '';
    ElMessage.success('PayPal 收款账户已绑定。');
  } finally {
    paypalSaving.value = false;
  }
}

async function disconnectPayPal() {
  await ElMessageBox.confirm('解绑后前台将无法调起 PayPal 收款，确定继续吗？', '解绑 PayPal', {
    confirmButtonText: '解绑',
    cancelButtonText: '取消',
    type: 'warning'
  });
  const data = await adminApi.disconnectPayPalAccount();
  paypalAccount.value = data.account;
  Object.assign(paypalForm, { mode: 'sandbox', clientId: '', clientSecret: '', merchantId: '', merchantEmail: '' });
  ElMessage.success('PayPal 收款账户已解绑。');
}

onMounted(loadAdmin);
</script>

<template>
  <el-container class="admin-layout">
    <el-aside width="232px" class="admin-aside">
      <div class="brand-block">
        <strong>FREG LLC</strong>
        <span>运营后台</span>
      </div>
      <el-menu :default-active="activeView" class="side-menu" @select="activeView = $event">
        <el-menu-item index="dashboard"><el-icon><DataAnalysis /></el-icon><span>数据看板</span></el-menu-item>
        <el-menu-item index="products"><el-icon><Goods /></el-icon><span>商品管理</span></el-menu-item>
        <el-menu-item index="orders"><el-icon><Tickets /></el-icon><span>交易详情</span></el-menu-item>
        <el-menu-item index="payments"><el-icon><Document /></el-icon><span>收款账户</span></el-menu-item>
        <el-menu-item index="inventory"><el-icon><Warning /></el-icon><span>库存预警</span></el-menu-item>
        <el-menu-item index="settings"><el-icon><Setting /></el-icon><span>运营设置</span></el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="admin-header">
        <div>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>FREG LLC</el-breadcrumb-item>
            <el-breadcrumb-item>{{ activeView === 'dashboard' ? '数据看板' : activeView === 'products' ? '商品管理' : activeView === 'orders' ? '交易详情' : activeView === 'payments' ? '收款账户' : activeView === 'inventory' ? '库存预警' : '运营设置' }}</el-breadcrumb-item>
          </el-breadcrumb>
          <h1>{{ activeView === 'dashboard' ? '运营数据看板' : activeView === 'products' ? '商品管理' : activeView === 'orders' ? '交易详情' : activeView === 'payments' ? '收款账户' : activeView === 'inventory' ? '库存预警' : '运营设置' }}</h1>
        </div>
        <div class="header-actions">
          <el-tag type="success">加州 · 电商 / 零售 / 批发</el-tag>
          <el-button :icon="Refresh" @click="loadAdmin">刷新</el-button>
        </div>
      </el-header>

      <el-main class="admin-main" v-loading="loading">
        <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />

        <section v-if="activeView === 'dashboard'" class="page-stack">
          <div class="metric-grid">
            <el-card shadow="never"><span>销售额</span><strong>{{ money(metrics.revenue) }}</strong></el-card>
            <el-card shadow="never"><span>订单数</span><strong>{{ metrics.orderCount }}</strong></el-card>
            <el-card shadow="never"><span>售出件数</span><strong>{{ metrics.units }}</strong></el-card>
            <el-card shadow="never"><span>在售 SKU</span><strong>{{ metrics.activeProducts }}</strong></el-card>
            <el-card shadow="never"><span>低库存</span><strong>{{ metrics.lowStockCount }}</strong></el-card>
            <el-card shadow="never"><span>客单价</span><strong>{{ money(metrics.averageOrderValue) }}</strong></el-card>
          </div>

          <div class="content-grid">
            <el-card shadow="never">
              <template #header><div class="card-header"><span>近期交易</span><el-button link @click="activeView = 'orders'">查看全部</el-button></div></template>
              <el-table :data="dashboard?.recentOrders || []" size="small" empty-text="暂无交易记录" @row-click="openOrder">
                <el-table-column prop="id" label="订单号" min-width="150" />
                <el-table-column prop="customer.name" label="客户" min-width="120" />
                <el-table-column label="金额" width="110"><template #default="{ row }">{{ money(row.summary.total) }}</template></el-table-column>
                <el-table-column label="状态" width="100"><template #default="{ row }">{{ paymentStatusLabel(row.status) }}</template></el-table-column>
              </el-table>
            </el-card>

            <el-card shadow="never">
              <template #header><div class="card-header"><span>低库存提醒</span><el-button link @click="activeView = 'inventory'">处理</el-button></div></template>
              <el-table :data="dashboard?.lowStock || []" size="small" empty-text="暂无低库存商品">
                <el-table-column label="商品" min-width="210">
                  <template #default="{ row }">
                    <div class="product-mini"><img :src="row.image" :alt="row.name" /><span>{{ row.name }}</span></div>
                  </template>
                </el-table-column>
                <el-table-column prop="stock" label="库存" width="80" />
                <el-table-column width="90"><template #default="{ row }"><el-button size="small" @click="editProduct(row)">补货</el-button></template></el-table-column>
              </el-table>
            </el-card>
          </div>
        </section>

        <section v-if="activeView === 'products'" class="page-stack">
          <el-card shadow="never">
            <div class="toolbar">
              <div class="toolbar-left">
                <el-input v-model="productSearch" :prefix-icon="Search" clearable placeholder="搜索商品名称 / 分类 / 产品线" style="width: 320px" />
                <el-select v-model="productStatus" clearable placeholder="状态" style="width: 140px">
                  <el-option label="在售" value="active" />
                  <el-option label="草稿" value="draft" />
                  <el-option label="已归档" value="archived" />
                </el-select>
              </div>
              <el-button type="primary" :icon="Plus" @click="openCreateProduct">上架商品</el-button>
            </div>

            <el-table :data="filteredProducts" border stripe size="small" empty-text="暂无商品">
              <el-table-column label="商品" min-width="300" fixed>
                <template #default="{ row }">
                  <div class="product-cell">
                    <img :src="row.image" :alt="row.name" />
                    <div><strong>{{ row.name }}</strong><small>{{ row.category }} · {{ row.collection }}</small></div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="售价" width="110"><template #default="{ row }">{{ money(row.price) }}</template></el-table-column>
              <el-table-column prop="stock" label="库存" width="90" sortable />
              <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
              <el-table-column prop="source" label="来源" min-width="150" />
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button size="small" @click="editProduct(row)">编辑</el-button>
                  <el-button size="small" type="danger" text @click="removeProduct(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </section>

        <section v-if="activeView === 'orders'" class="page-stack">
          <el-card shadow="never">
            <div class="toolbar">
              <div class="toolbar-left">
                <el-select v-model="orderStatus" clearable placeholder="订单状态" style="width: 150px">
                  <el-option label="已确认" value="confirmed" />
                  <el-option label="已付款" value="paid" />
                  <el-option label="待付款" value="payment_pending" />
                </el-select>
                <el-tag>{{ filteredOrders.length }} 个订单</el-tag>
              </div>
            </div>
            <el-table :data="filteredOrders" border stripe size="small" empty-text="暂无交易记录" @row-click="openOrder">
              <el-table-column prop="id" label="订单号" min-width="150" />
              <el-table-column prop="customer.name" label="客户" min-width="120" />
              <el-table-column prop="customer.email" label="邮箱" min-width="190" />
              <el-table-column label="金额" width="120"><template #default="{ row }">{{ money(row.summary.total) }}</template></el-table-column>
              <el-table-column label="支付方式" width="110"><template #default="{ row }">{{ paymentProvider(row) }}</template></el-table-column>
              <el-table-column label="状态" width="100"><template #default="{ row }">{{ paymentStatusLabel(row.status) }}</template></el-table-column>
              <el-table-column label="下单时间" min-width="180"><template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template></el-table-column>
            </el-table>
          </el-card>
        </section>

        <section v-if="activeView === 'payments'" class="page-stack">
          <el-card shadow="never">
            <template #header>
              <div class="card-header">
                <span>PayPal 收款账户</span>
                <el-tag :type="paypalAccount?.status === 'connected' ? 'success' : 'warning'">{{ paypalAccount?.status === 'connected' ? '已绑定' : '未绑定' }}</el-tag>
              </div>
            </template>
            <div class="payment-settings">
              <el-alert
                title="目前前台只接 PayPal。这里保存的是运行时配置，正式上线建议迁移到加密数据库或密钥管理服务。"
                type="info"
                show-icon
                :closable="false"
              />
              <el-descriptions border :column="2" size="small">
                <el-descriptions-item label="环境">{{ paypalAccount?.mode || 'sandbox' }}</el-descriptions-item>
                <el-descriptions-item label="状态">{{ paypalAccount?.status === 'connected' ? '已绑定' : '未绑定' }}</el-descriptions-item>
                <el-descriptions-item label="Client ID">{{ paypalAccount?.clientIdPreview || '未配置' }}</el-descriptions-item>
                <el-descriptions-item label="Merchant ID">{{ paypalAccount?.merchantId || '未填写' }}</el-descriptions-item>
                <el-descriptions-item label="收款邮箱">{{ paypalAccount?.merchantEmail || '未填写' }}</el-descriptions-item>
                <el-descriptions-item label="更新时间">{{ paypalAccount?.updatedAt ? new Date(paypalAccount.updatedAt).toLocaleString() : '未配置' }}</el-descriptions-item>
              </el-descriptions>
              <el-form label-position="top" class="paypal-form">
                <el-row :gutter="12">
                  <el-col :span="8">
                    <el-form-item label="PayPal 环境">
                      <el-select v-model="paypalForm.mode" aria-label="PayPal 环境">
                        <el-option label="Sandbox 沙盒" value="sandbox" />
                        <el-option label="Live 正式" value="live" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="16">
                    <el-form-item label="Client ID">
                      <el-input v-model="paypalForm.clientId" aria-label="PayPal Client ID" placeholder="PayPal REST App Client ID" />
                    </el-form-item>
                  </el-col>
                </el-row>
                <el-form-item label="Client Secret">
                  <el-input v-model="paypalForm.clientSecret" aria-label="PayPal Client Secret" type="password" show-password placeholder="重新绑定时必填，后台不会回显 Secret" />
                </el-form-item>
                <el-row :gutter="12">
                  <el-col :span="12">
                    <el-form-item label="Merchant ID">
                      <el-input v-model="paypalForm.merchantId" aria-label="PayPal Merchant ID" placeholder="PayPal Business Merchant ID" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="收款邮箱">
                      <el-input v-model="paypalForm.merchantEmail" aria-label="PayPal 收款邮箱" placeholder="payments@example.com" />
                    </el-form-item>
                  </el-col>
                </el-row>
                <div class="payment-actions">
                  <el-button type="primary" :loading="paypalSaving" @click="savePayPalAccount">绑定 / 更新 PayPal</el-button>
                  <el-button type="danger" plain :disabled="paypalAccount?.status !== 'connected'" @click="disconnectPayPal">解绑</el-button>
                </div>
              </el-form>
            </div>
          </el-card>
        </section>

        <section v-if="activeView === 'inventory'" class="page-stack">
          <el-card shadow="never">
            <template #header><div class="card-header"><span>库存预警</span><el-tag type="warning">{{ dashboard?.lowStock?.length || 0 }} 个低库存 SKU</el-tag></div></template>
            <el-table :data="dashboard?.lowStock || []" border stripe size="small" empty-text="暂无低库存商品">
              <el-table-column label="商品" min-width="320">
                <template #default="{ row }">
                  <div class="product-cell">
                    <img :src="row.image" :alt="row.name" />
                    <div><strong>{{ row.name }}</strong><small>{{ row.category }}</small></div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="stock" label="库存" width="100" />
              <el-table-column prop="status" label="状态" width="100" />
              <el-table-column width="110"><template #default="{ row }"><el-button size="small" @click="editProduct(row)">更新库存</el-button></template></el-table-column>
            </el-table>
          </el-card>
        </section>

        <section v-if="activeView === 'settings'" class="page-stack">
          <el-card shadow="never">
            <template #header><span>运营设置</span></template>
            <el-descriptions border :column="1" size="small">
              <el-descriptions-item label="公司名称">FREG LLC</el-descriptions-item>
              <el-descriptions-item label="业务类型">E-COMMERCE, RETAIL, WHOLESALE</el-descriptions-item>
              <el-descriptions-item label="主办公室">26682 ALMOND AVENUE UNIT B, REDLANDS, CA 92374</el-descriptions-item>
              <el-descriptions-item label="商品来源">用户提供的 DASHINGNOAH Amazon 产品链接</el-descriptions-item>
              <el-descriptions-item label="默认 Amazon URL">{{ defaultAmazonUrl }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </section>
      </el-main>
    </el-container>

    <el-dialog v-model="productDialogOpen" :title="editingProductId ? '编辑商品' : '上架商品'" width="720px" destroy-on-close>
      <el-form label-position="top" class="product-form">
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="商品 ID"><el-input v-model="productForm.id" aria-label="商品 ID" :disabled="!!editingProductId" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="商品名称"><el-input v-model="productForm.name" aria-label="商品名称" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="分类"><el-input v-model="productForm.category" aria-label="分类" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="产品线"><el-input v-model="productForm.collection" aria-label="产品线" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="状态"><el-select v-model="productForm.status" aria-label="状态"><el-option label="在售" value="active" /><el-option label="草稿" value="draft" /><el-option label="已归档" value="archived" /></el-select></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="售价"><el-input-number v-model="productForm.price" aria-label="售价" :min="1" style="width: 100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="划线价"><el-input-number v-model="productForm.compareAt" aria-label="划线价" :min="1" style="width: 100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="库存"><el-input-number v-model="productForm.stock" aria-label="库存" :min="0" style="width: 100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="颜色"><el-input v-model="productForm.color" aria-label="颜色" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="标签"><el-input v-model="productForm.badge" aria-label="标签" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="商品图片"><el-select v-model="productForm.image" aria-label="商品图片"><el-option label="6-in-1 Weight Bench" value="/assets/product-weight-bench.jpg" /><el-option label="Basketball Hoop 4.82-8.53FT" value="/assets/product-basketball-hoop-853.jpg" /><el-option label="Basketball Hoop Teen" value="/assets/product-basketball-hoop-teen.jpg" /><el-option label="Portable Treadmill" value="/assets/product-portable-treadmill.jpg" /></el-select></el-form-item></el-col>
        </el-row>
        <el-form-item label="Amazon 产品链接"><el-input v-model="productForm.amazonStoreUrl" aria-label="Amazon 产品链接" /></el-form-item>
        <el-form-item label="商品描述"><el-input v-model="productForm.summary" aria-label="商品描述" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="productDialogOpen = false">取消</el-button>
        <el-button type="primary" @click="saveProduct">{{ editingProductId ? '保存商品' : '发布商品' }}</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="orderDrawerOpen" title="交易详情" size="460px">
      <template v-if="selectedOrder">
        <el-descriptions border :column="1" size="small">
          <el-descriptions-item label="订单号">{{ selectedOrder.id }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ selectedOrder.customer.name }} · {{ selectedOrder.customer.email }}</el-descriptions-item>
          <el-descriptions-item label="收货地址">{{ selectedOrder.customer.address }}, {{ selectedOrder.customer.city }}, {{ selectedOrder.customer.state }} {{ selectedOrder.customer.zip }}</el-descriptions-item>
          <el-descriptions-item label="订单金额">{{ money(selectedOrder.summary.total) }}</el-descriptions-item>
          <el-descriptions-item label="支付方式">{{ paymentProvider(selectedOrder) }}</el-descriptions-item>
          <el-descriptions-item label="支付状态">{{ paymentStatusLabel(selectedOrder.status) }}</el-descriptions-item>
          <el-descriptions-item v-if="selectedOrder.payment?.paypalOrderId" label="PayPal Order ID">{{ selectedOrder.payment.paypalOrderId }}</el-descriptions-item>
          <el-descriptions-item v-if="selectedOrder.payment?.paypalCaptureId" label="PayPal Capture ID">{{ selectedOrder.payment.paypalCaptureId }}</el-descriptions-item>
          <el-descriptions-item label="预计送达">{{ selectedOrder.eta }}</el-descriptions-item>
        </el-descriptions>
        <el-divider>商品明细</el-divider>
        <div class="drawer-lines">
          <div v-for="line in selectedOrder.items" :key="line.productId + line.color" class="drawer-line">
            <img :src="line.product.image" :alt="line.product.name" />
            <div><strong>{{ line.product.name }}</strong><span>{{ line.quantity }} × {{ line.color }}</span></div>
            <b>{{ money(line.lineTotal) }}</b>
          </div>
        </div>
      </template>
    </el-drawer>
  </el-container>
</template>
