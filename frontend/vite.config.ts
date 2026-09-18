import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:8000';
const PRODUCTION_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const SITE_URL = PRODUCTION_HOST ? `https://${PRODUCTION_HOST}` : '';

function absoluteSocialImage(): Plugin {
  return {
    name: 'absolute-social-image',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL),
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), absoluteSocialImage()],
  server: {
    proxy: { '/api': BACKEND_URL },
  },
});
