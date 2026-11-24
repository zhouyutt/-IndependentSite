<script setup>
import { ArrowUpRight, Heart, Star } from 'lucide-vue-next';
import { amazonProductUrl, hasPrice, money, swatchStyle } from '../lib/products.js';

defineProps({
  product: { type: Object, required: true },
  saved: Boolean,
  catalogOnly: Boolean
});
defineEmits(['view', 'add', 'save']);
</script>

<template>
  <article class="product-card" :data-product-id="product.id">
    <button v-if="!catalogOnly" class="wish" :class="{ active: saved }" :aria-pressed="saved" :aria-label="`Save ${product.name}`" @click="$emit('save', product)"><Heart :size="18" /></button>
    <button class="image-button" :aria-label="`View ${product.name}`" @click="$emit('view', product)">
      <img :src="product.image" :alt="product.name" loading="lazy" width="500" height="500" />
      <span class="image-cta">Explore product <ArrowUpRight :size="16" /></span>
    </button>
    <div class="product-meta">
      <span class="product-brand">{{ product.brand }}</span>
      <button class="product-name" @click="$emit('view', product)">{{ product.name }}</button>
      <div v-if="product.rating && product.reviewCount" class="rating"><Star :size="14" fill="currentColor" /> {{ product.rating }} <span>({{ product.reviewCount }})</span></div>
      <p v-else class="product-measurement">{{ product.specs?.dimensions || product.material }}</p>
      <div v-if="hasPrice(product)" class="price-row"><strong>{{ money(product.price) }}</strong><del v-if="product.compareAt > product.price">{{ money(product.compareAt) }}</del></div>
      <span v-else class="price-note">See current price on Amazon</span>
      <div class="swatches"><span v-for="color in product.colors.slice(0, 4)" :key="color"><i aria-hidden="true" :style="swatchStyle(color)"></i>{{ color }}</span></div>
      <a v-if="catalogOnly || product.externalOnly" class="button full" :href="amazonProductUrl(product)" target="_blank" rel="noopener noreferrer" :aria-label="`${product.amazonLinkType === 'search' ? 'Find' : 'View'} ${product.name} on Amazon (opens in a new tab)`">{{ product.amazonLinkType === 'search' ? 'Find on Amazon' : 'View on Amazon' }} <ArrowUpRight :size="15" /></a>
      <button v-else class="button full" :disabled="product.stock <= 0" @click="$emit('add', product)">{{ product.stock > 0 ? 'Add to Cart' : 'Out of Stock' }}</button>
    </div>
  </article>
</template>
