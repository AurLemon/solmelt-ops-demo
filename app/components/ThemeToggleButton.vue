<script setup lang="ts">
defineOptions({ name: 'ThemeToggleButton' })

const colorMode = useColorMode()
let transitionTimer: ReturnType<typeof setTimeout> | null = null

const isDark = computed(() => colorMode.value === 'dark')
const label = computed(() => (isDark.value ? '切换到浅色模式' : '切换到暗黑模式'))
const icon = computed(() => (isDark.value ? 'i-lucide-sun' : 'i-lucide-moon'))

function toggleColorMode(): void {
	if (!import.meta.client) return

	const root = document.documentElement
	root.classList.remove('theme-switching')
	void root.offsetWidth
	root.classList.add('theme-switching')
	void root.offsetWidth

	colorMode.preference = isDark.value ? 'light' : 'dark'

	if (transitionTimer !== null) clearTimeout(transitionTimer)
	transitionTimer = setTimeout(() => {
		root.classList.remove('theme-switching')
		transitionTimer = null
	}, 360)
}

onBeforeUnmount(() => {
	if (transitionTimer !== null) clearTimeout(transitionTimer)
})
</script>

<template>
	<UButton
		color="neutral"
		variant="ghost"
		size="sm"
		square
		:icon="icon"
		:aria-label="label"
		:title="label"
		@click="toggleColorMode"
	/>
</template>
