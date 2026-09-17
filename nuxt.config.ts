export default defineNuxtConfig({
	compatibilityDate: '2026-09-16',
	extends: ['./layers/auth', './layers/device', './layers/telemetry', './layers/dashboard'],
	modules: ['@nuxt/ui', '@nuxt/eslint'],
	css: ['~/assets/css/main.css'],
	colorMode: {
		preference: 'dark',
		fallback: 'dark',
	},
	devtools: { enabled: true },
	typescript: {
		strict: true,
		typeCheck: true,
	},
	runtimeConfig: {
		databaseHost: process.env.DATABASE_HOST ?? '127.0.0.1',
		databasePort: Number(process.env.DATABASE_PORT ?? 3306),
		databaseUser: process.env.DATABASE_USER ?? 'solmelt',
		databasePassword: process.env.DATABASE_PASSWORD ?? 'solmelt_dev',
		databaseName: process.env.DATABASE_NAME ?? 'solmelt_ops',
		jwtSecret: process.env.JWT_SECRET ?? 'replace-this-development-secret',
		public: {
			appName: 'SolMelt 光热熔盐泵智能运营管理系统',
		},
	},
	app: {
		head: {
			title: 'SolMelt',
			meta: [
				{ charset: 'utf-8' },
				{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			],
		},
	},
})
