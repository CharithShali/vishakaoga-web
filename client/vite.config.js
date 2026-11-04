import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the React app runs on 5173 and sends /api calls to the Express server.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
