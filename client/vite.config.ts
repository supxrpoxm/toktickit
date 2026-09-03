import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // เมื่อไรที่หน้าบ้านเรียก /api ให้วิ่งไปหา Backend ที่ localhost:3000
      '/api': {
        target: 'http://localhost:3000', 
        changeOrigin: true,
      }
    }
  }
})