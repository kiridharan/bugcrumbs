import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mockApi } from './mock-api.ts'

export default defineConfig({
  plugins: [react(), mockApi()],
})
