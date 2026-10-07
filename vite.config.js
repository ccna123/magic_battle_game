import { defineConfig } from 'vite';

// base './' để bản build mở được ở bất kỳ thư mục con nào (GitHub Pages, itch.io…)
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
