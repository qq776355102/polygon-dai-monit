import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Safe injection of environment variables
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      // Use provided Supabase credentials as defaults so it works on Vercel automatically
      'process.env.SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || 'https://mztgxwstjxxafpeefpgh.supabase.co'),
      'process.env.SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_KEY || 'sb_publishable_VqLEeWgaS2Hm7g3UQgP_iA_hZkSIWMj')
    }
  };
});