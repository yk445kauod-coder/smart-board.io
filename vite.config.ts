import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // Use relative base path to ensure assets load correctly on GitHub Pages subdirectories
    base: './', 
    define: {
      // Securely inject the API key from the environment (Vercel or .env)
      'process.env.API_KEY': JSON.stringify(env.API_KEY || "")
    }
  };
});