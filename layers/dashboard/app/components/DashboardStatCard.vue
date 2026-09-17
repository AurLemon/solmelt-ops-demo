<script setup lang="ts">
type StatTone = 'cyan' | 'emerald' | 'slate' | 'amber' | 'orange' | 'rose'

const props = withDefaults(
	defineProps<{
		label: string
		value: number | string
		unit?: string
		tone?: StatTone
		icon?: string
		hint?: string
	}>(),
	{ unit: '', tone: 'cyan', icon: '', hint: '' },
)

/** 完整类名必须字面量出现，Tailwind 才能静态收集。 */
const TONE_TEXT: Record<StatTone, string> = {
	cyan: 'text-cyan-300',
	emerald: 'text-emerald-300',
	slate: 'text-slate-400',
	amber: 'text-amber-300',
	orange: 'text-orange-300',
	rose: 'text-rose-300',
}

const TONE_BORDER: Record<StatTone, string> = {
	cyan: 'border-l-cyan-500',
	emerald: 'border-l-emerald-500',
	slate: 'border-l-slate-600',
	amber: 'border-l-amber-500',
	orange: 'border-l-orange-500',
	rose: 'border-l-rose-500',
}

const valueClass = computed(() => TONE_TEXT[props.tone])
const borderClass = computed(() => TONE_BORDER[props.tone])
</script>

<template>
	<div
		class="flex flex-col justify-between rounded-lg border border-slate-800 border-l-4 bg-slate-900/60 px-4 py-3"
		:class="borderClass"
	>
		<div class="flex items-center justify-between gap-2">
			<span class="truncate text-xs tracking-wide text-slate-400">{{ label }}</span>
			<UIcon v-if="icon" :name="icon" class="size-4 shrink-0 text-slate-500" />
		</div>
		<div class="mt-1 flex items-baseline gap-1">
			<span class="text-4xl leading-none font-semibold tabular-nums" :class="valueClass">
				{{ value }}
			</span>
			<span v-if="unit" class="text-sm text-slate-400">{{ unit }}</span>
		</div>
		<p class="mt-1 truncate text-xs text-slate-500">{{ hint }}</p>
	</div>
</template>
