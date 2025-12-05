import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // CRITICAL FIX: Do not overwrite the entire 'process.env' object.
      // Instead, define specific keys safely.
      // This ensures 'process.env.NODE_ENV' remains intact for React.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    }
  };
});