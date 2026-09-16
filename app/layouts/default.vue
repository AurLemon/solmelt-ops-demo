<template>
	<div class="min-h-screen bg-slate-950 text-slate-100">
		<header class="border-b border-slate-800 bg-slate-950/90">
			<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
				<div>
					<p class="text-lg font-semibold text-amber-300">SolMelt</p>
					<p class="text-xs text-slate-400">光热熔盐泵智能运营管理系统</p>
				</div>
				<UBadge color="success" variant="subtle">Baseline v0.1</UBadge>
			</div>
		</header>
		<main class="mx-auto max-w-6xl px-6 py-10">
			<slot />
		</main>
	</div>
</template>
