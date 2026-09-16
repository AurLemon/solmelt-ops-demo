import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const databaseUrl =
	process.env.DATABASE_URL ?? 'mysql://solmelt:solmelt_dev@127.0.0.1:3306/solmelt_ops'

export default defineConfig({
	schema: 'prisma/schema',
	migrations: {
		path: 'prisma/migrations',
		seed: 'tsx prisma/seed.ts',
	},
	datasource: {
		url: databaseUrl,
	},
})
