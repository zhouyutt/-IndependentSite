import { createApp } from 'vue';
import SiteFooter from './SiteFooter.vue';

const footer = document.getElementById('site-footer');
createApp(SiteFooter, { page: footer.dataset.page }).mount(footer);
