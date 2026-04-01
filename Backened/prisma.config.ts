import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

// Load .env so DATABASE_URL is available for the CLI
config()

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
