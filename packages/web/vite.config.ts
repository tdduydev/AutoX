import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_URL || 'http://localhost:3000',
      '/auth': process.env.VITE_API_URL || 'http://localhost:3000',
      '/health': process.env.VITE_API_URL || 'http://localhost:3000',
    },
  },
});
