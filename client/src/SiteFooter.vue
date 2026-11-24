<script setup>
defineProps({
  page: { type: String, default: '' }
});

const year = new Date().getFullYear();
</script>

<template>
  <footer class="site-footer">
    <div v-if="!page" class="footer-details">
      <a class="footer-domain" href="/">DASHINGNOAH</a>
      <div id="service">
        <h2>Customer Service</h2>
        <address>
          <a href="mailto:support@dashingnoah.top">support@dashingnoah.top</a>
        </address>
      </div>
    </div>
    <div class="footer-legal">
      <small>© {{ year }} DASHINGNOAH. All rights reserved.</small>
      <nav aria-label="Store policies">
        <a href="/privacy/" :aria-current="page === 'privacy' ? 'page' : null">Privacy Policy</a>
        <a href="/terms/" :aria-current="page === 'terms' ? 'page' : null">Terms of Service</a>
      </nav>
    </div>
  </footer>
</template>
