import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Local development runs at /. The GitHub Actions workflow supplies the
  // repository subpath so built asset URLs work on GitHub Project Pages.
  base: process.env.VITE_BASE_PATH || '/',
});
