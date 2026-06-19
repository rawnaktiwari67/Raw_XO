import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const clerkPublishableKey = (
    env.VITE_CLERK_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.VITE_CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    ''
  ).trim();
  const isVercelBuild = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

  if (command === 'build' && isVercelBuild) {
    if (!clerkPublishableKey) {
      throw new Error('Vercel builds require VITE_CLERK_PUBLISHABLE_KEY or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.');
    }

    if (clerkPublishableKey.startsWith('pk_test_')) {
      throw new Error('Vercel builds must use a Clerk live publishable key (pk_live_), not a test key.');
    }
  }

  return {
  base: '/',
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],

  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@clerk')) return 'clerk';
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/framer-motion')) return 'motion';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'react-vendor';
          }
        },
      },
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  };
});
