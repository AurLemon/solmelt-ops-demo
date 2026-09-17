<script setup lang="ts">
definePageMeta({ layout: false })

/**
 * 全局退出入口：任何页面（包括无侧边栏的公共首页）都可以通过 /logout
 * 清理会话并回到登录页，避免登录后落在公共首页时无处退出。
 */
const { logout } = useAuth()

onMounted(() => {
	void logout()
})
</script>

<template>
	<div class="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
		<p class="text-sm">正在退出登录…</p>
	</div>
</template>
