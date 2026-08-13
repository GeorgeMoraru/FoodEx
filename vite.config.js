import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build trigger for secret updates

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000
  }
});
