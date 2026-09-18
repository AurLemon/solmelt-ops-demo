<script setup lang="ts">
interface PointerPosition {
	x: number
	y: number
	active: boolean
}

const canvas = useTemplateRef<HTMLCanvasElement>('surface')
let dispose: (() => void) | undefined

onMounted(() => {
	const element = canvas.value
	const panel = element?.parentElement
	const context = element?.getContext('2d')
	if (!element || !panel || !context) return

	const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
	const pointer: PointerPosition = { x: 0, y: 0, active: false }
	let width = 0
	let height = 0
	let frame = 0
	let previousTime = 0
	let phase = 0
	let dark = false
	let disposed = false

	function draw(): void {
		if (!context || !width || !height) return
		context.clearRect(0, 0, width, height)
		// Perspective rows form a decorative surface, not operational data.
		// Extend both ends without changing the existing surface spacing or foreground.
		for (let row = -8; row < 50; row++) {
			const depth = row / 29
			// Fade along depth independently of the existing left/right edge falloff.
			const fadeProgress = Math.min(1, Math.max(0, (row + 8) / 26))
			const distanceFade = fadeProgress * fadeProgress * (3 - 2 * fadeProgress)
			// Add columns on both sides instead of stretching the existing particle spacing.
			for (let column = -24; column < 72; column++) {
				const across = column / 47
				const wave = Math.sin(across * 8 + depth * 5 + phase)
				const fold = Math.cos(across * 5 - depth * 4 + phase * 0.65)
				let x = width * (0.5 + (across - 0.5) * (0.52 + depth * 0.85))
				let y = height * (0.55 + depth * 0.35) + wave * (12 + depth * 19) + fold * 13
				const dx = x - pointer.x
				const dy = y - pointer.y
				const distance = Math.hypot(dx, dy)
				const influence =
					pointer.active && !motion.matches ? Math.pow(Math.max(0, 1 - distance / 115), 2) : 0
				x += (dx / Math.max(distance, 1)) * influence * 7
				y += (dy / Math.max(distance, 1)) * influence * 7
				if (x < -4 || x > width + 4 || y > height + 4) continue
				const edge = Math.sin(((column + 24) / 95) * Math.PI)
				const alpha = Math.min(0.9, (0.15 + depth * 0.35) * edge + influence * 0.4) * distanceFade
				const accent = (column + row * 2) % 11 === 0 || influence > 0.22
				context.fillStyle = accent
					? `rgba(${dark ? '251, 191, 36' : '180, 113, 10'}, ${alpha})`
					: `rgba(${dark ? '125, 160, 207' : '45, 77, 121'}, ${alpha})`
				context.beginPath()
				context.arc(x, y, 0.65 + depth * 0.75 + influence * 1.05, 0, Math.PI * 2)
				context.fill()
			}
		}
	}

	function tick(time: number): void {
		frame = 0
		if (disposed) return
		if (previousTime) phase += Math.min(time - previousTime, 50) * 0.00022
		previousTime = time
		draw()
		frame = requestAnimationFrame(tick)
	}

	function sync(): void {
		cancelAnimationFrame(frame)
		frame = 0
		previousTime = 0
		if (disposed || !width || !height || document.hidden) return
		draw()
		if (!motion.matches) frame = requestAnimationFrame(tick)
	}

	function resize(): void {
		if (!element || !context || disposed) return
		const bounds = element.getBoundingClientRect()
		width = bounds.width
		height = bounds.height
		const ratio = Math.min(window.devicePixelRatio || 1, 2)
		element.width = Math.round(width * ratio)
		element.height = Math.round(height * ratio)
		context.setTransform(ratio, 0, 0, ratio, 0, 0)
		pointer.active = false
		sync()
	}

	function move(event: PointerEvent): void {
		if (!element || motion.matches || event.pointerType !== 'mouse') return
		const bounds = element.getBoundingClientRect()
		pointer.x = event.clientX - bounds.left
		pointer.y = event.clientY - bounds.top
		pointer.active = true
	}

	function leave(): void {
		pointer.active = false
	}

	function updateTheme(): void {
		dark = document.documentElement.classList.contains('dark')
		sync()
	}

	function updateMotion(): void {
		pointer.active = false
		sync()
	}

	const sizeObserver = new ResizeObserver(resize)
	const themeObserver = new MutationObserver(updateTheme)
	sizeObserver.observe(element)
	themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
	panel.addEventListener('pointermove', move, { passive: true })
	panel.addEventListener('pointerleave', leave)
	window.addEventListener('resize', resize, { passive: true })
	document.addEventListener('visibilitychange', sync)
	motion.addEventListener('change', updateMotion)
	updateTheme()
	resize()

	dispose = () => {
		disposed = true
		cancelAnimationFrame(frame)
		sizeObserver.disconnect()
		themeObserver.disconnect()
		panel.removeEventListener('pointermove', move)
		panel.removeEventListener('pointerleave', leave)
		window.removeEventListener('resize', resize)
		document.removeEventListener('visibilitychange', sync)
		motion.removeEventListener('change', updateMotion)
	}
})

onBeforeUnmount(() => dispose?.())
</script>

<template>
	<canvas ref="surface" class="particle-surface" aria-hidden="true" />
</template>

<style scoped>
.particle-surface {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
}
</style>
