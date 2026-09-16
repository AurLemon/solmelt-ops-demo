import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
	rules: {
		'@typescript-eslint/no-explicit-any': 'error',
		'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
		'vue/require-v-for-key': 'warn',
		'vue/no-use-v-if-with-v-for': 'warn',
		'vue/html-self-closing': 'warn',
		'vue/attribute-hyphenation': 'off',
		'vue/attributes-order': 'off',
	},
})
