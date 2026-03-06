import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://viona.app',
  output: 'static',
  integrations: [
    sitemap({
      serialize(item) {
        item.lastmod = new Date().toISOString().split('T')[0];
        return item;
      }
    })
  ],
  vite: {
    css: {
      postcss: './postcss.config.mjs'
    }
  }
});
