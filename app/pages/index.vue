<script setup lang="ts">
const domains = [
	{ name: '登录与权限', owner: 'feat/auth', icon: 'i-lucide-shield-check' },
	{ name: '物模型与设备', owner: 'feat/device', icon: 'i-lucide-settings-2' },
	{ name: '数据采集与查询', owner: 'feat/telemetry', icon: 'i-lucide-activity' },
	{ name: '监测大屏', owner: 'feat/dashboard', icon: 'i-lucide-monitor-up' },
] satisfies ReadonlyArray<{ name: string; owner: string; icon: string }>
</script>

<template>
	<section class="space-y-8">
		<div class="max-w-3xl space-y-3">
			<p class="text-sm font-medium tracking-widest text-amber-300 uppercase">Team Baseline</p>
			<h1 class="text-4xl font-bold tracking-tight">四个领域，一套契约，一个可集成系统</h1>
			<p class="text-slate-300">
				当前仓库只提供公共骨架、领域边界和协作门禁。各组请进入自己的 Layer 开发，并在提交 PR 前执行
				<code>pnpm pr:check</code>。
			</p>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<UCard v-for="domain in domains" :key="domain.owner" class="border-slate-800 bg-slate-900/70">
				<div class="flex items-center gap-4">
					<UIcon :name="domain.icon" class="size-8 text-amber-300" />
					<div>
						<p class="font-semibold">{{ domain.name }}</p>
						<p class="font-mono text-sm text-slate-400">{{ domain.owner }}</p>
					</div>
				</div>
			</UCard>
		</div>
	</section>
</template>
