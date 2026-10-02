import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 相対パスで出力し、GitHub Pages などどこに置いても動くようにする
export default defineConfig({
  base: './',
  plugins: [react()],
})
