import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Mesma porta do devUrl em src-tauri/tauri.conf.json
  server: { port: 5174, strictPort: true },
})
