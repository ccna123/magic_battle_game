import { defineConfig } from 'vite';
import { resolve } from 'path';

// base './' để bản build mở được ở bất kỳ thư mục con nào (GitHub Pages, itch.io…)
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), duel: resolve(__dirname, 'duel.html') },   // duel.html: bản thử Đấu phép tốc độ
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
