import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Crucial for Electron to load assets from file system
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    // Pass environment variables to the client
    'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY)
  }
});