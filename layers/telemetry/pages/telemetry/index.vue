<script setup lang="ts">
definePageMeta({
	layout: 'dashboard',
	permission: 'telemetry:read',
	middleware: () => navigateTo('/telemetry/history', { redirectCode: 302, replace: true }),
})
</script>

<template>
	<div />
</template>
