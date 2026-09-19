<script setup lang="ts">
interface PointerPosition {
	x: number
	y: number
	active: boolean
}

interface TowerPointerState {
	x: number
	y: number
	strength: number
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
	const towerPointer: TowerPointerState = { x: 0, y: 0, strength: 0 }
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
		drawTower()
	}

	function drawTower(): void {
		if (!context) return
		const drawingContext = context
		const scale = Math.min(width / 590, height / 610)
		const centerX = width * 0.77
		const top = height * 0.23
		const baseY = height * 0.59
		const receiverHeight = 35 * scale
		const neckY = top + receiverHeight + 10 * scale
		const steel = dark ? '125, 160, 207' : '45, 77, 121'
		const heat = dark ? '251, 191, 36' : '180, 113, 10'

		function particle(x: number, y: number, radius: number, alpha: number, accent = false): void {
			const dx = x - towerPointer.x
			const dy = y - towerPointer.y
			const distance = Math.hypot(dx, dy)
			const influence = motion.matches
				? 0
				: Math.pow(Math.max(0, 1 - distance / 68), 2) * towerPointer.strength
			const blend = Math.min(1, Math.max(0, (y - (baseY - 65 * scale)) / (78 * scale)))
			const colorShift = Math.min(1, influence * 0.8)
			const fade = 1 - blend * blend * (3 - 2 * blend)
			drawingContext.fillStyle = `rgba(${accent ? heat : influence > 0.12 ? heat : steel}, ${Math.min(1, alpha + influence * 0.1 + colorShift * 0.08) * fade})`
			drawingContext.beginPath()
			drawingContext.arc(
				x + (dx / Math.sqrt(distance * distance + 144)) * influence * 5,
				y + (dy / Math.sqrt(distance * distance + 144)) * influence * 5,
				radius * scale + influence * 0.2,
				0,
				Math.PI * 2,
			)
			drawingContext.fill()
		}

		// Structural rings retain the silhouette while surface particles rise and repel the pointer.
		function ring(y: number, radius: number, alpha: number, accent = false): void {
			for (let column = 0; column < 48; column++) {
				const angle = (column / 48) * Math.PI * 2
				const front = (Math.sin(angle) + 1) / 2
				particle(
					centerX + Math.cos(angle) * radius,
					y + Math.sin(angle) * radius * 0.25,
					0.7,
					alpha * (0.35 + front * 0.65),
					accent,
				)
			}
		}

		// A broad foundation anchors the tower to the distant particle landscape.
		for (let row = 0; row < 4; row++) {
			ring(baseY + row * 2.8 * scale, (31 - row * 1.5) * scale, 0.24 - row * 0.035)
		}
		for (let row = 0; row < 53; row++) {
			const progress = (((row / 53 - phase * 0.045) % 1) + 1) % 1
			const radius = (10 + 13 * progress ** 1.7) * scale
			const y = neckY + (baseY - neckY) * progress
			for (let column = 0; column <= 18; column++) {
				const angle = (column / 18) * Math.PI
				const face = Math.sin(angle)
				const light = 0.5 + 0.5 * Math.cos(angle - 0.65)
				particle(
					centerX + Math.cos(angle) * radius,
					y + face * radius * 0.25,
					column % 6 === 0 ? 0.85 : 0.6,
					(0.14 + light * 0.29) * (column % 6 === 0 ? 1 : 0.7) * Math.min(1, progress * 18),
				)
			}
		}
		ring(neckY, 16 * scale, 0.48)
		ring(neckY - 4 * scale, 16 * scale, 0.36)

		// Receiver panels have a rounded cap, shaded sides and a restrained warm core.
		const glow = drawingContext.createRadialGradient(
			centerX,
			top + receiverHeight * 0.5,
			0,
			centerX,
			top + receiverHeight * 0.5,
			46 * scale,
		)
		glow.addColorStop(0, `rgba(${heat}, ${dark ? 0.12 : 0.07})`)
		glow.addColorStop(1, `rgba(${heat}, 0)`)
		drawingContext.fillStyle = glow
		drawingContext.fillRect(centerX - 46 * scale, top - 30 * scale, 92 * scale, 100 * scale)
		for (let row = 0; row <= 12; row++) {
			for (let column = 0; column <= 22; column++) {
				const angle = (column / 22) * Math.PI
				const face = Math.sin(angle)
				const pulse = 0.92 + Math.sin(phase * 1.4 + row * 0.25) * 0.08
				particle(
					centerX + Math.cos(angle) * 21 * scale,
					top + (row / 12) * receiverHeight + face * 5 * scale,
					0.75,
					(0.25 + face * 0.4) * pulse,
					column > 3 && column < 19,
				)
			}
		}
		ring(top, 21 * scale, 0.52)
		ring(top + receiverHeight, 22 * scale, 0.55)
		ring(top - 3 * scale, 17 * scale, 0.35)

		// Staggered streams and short fading trails make the upward flow visible.
		for (let index = 0; index < 30; index++) {
			const progress = (index / 30 + phase * 0.22) % 1
			const lane = (index % 5) / 4
			const angle = 0.3 + lane * (Math.PI - 0.6)
			for (let tail = 0; tail < 4; tail++) {
				const travel = progress - tail * 0.012
				if (travel < 0) continue
				const radius = (10 + 13 * (1 - travel) ** 1.7) * scale
				particle(
					centerX + Math.cos(angle) * radius,
					baseY - (baseY - neckY) * travel + Math.sin(angle) * radius * 0.25,
					tail === 0 ? 1.15 : 0.7,
					Math.sin(travel * Math.PI) * (0.8 - tail * 0.18),
					true,
				)
			}
		}
	}

	function tick(time: number): void {
		frame = 0
		if (disposed) return
		const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0
		phase += elapsed * 0.00022
		// Time-based smoothing keeps response consistent across display refresh rates.
		const follow = 1 - Math.exp(-elapsed / 75)
		const fade = 1 - Math.exp(-elapsed / 110)
		towerPointer.x += (pointer.x - towerPointer.x) * follow
		towerPointer.y += (pointer.y - towerPointer.y) * follow
		towerPointer.strength += ((pointer.active ? 1 : 0) - towerPointer.strength) * fade
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
		towerPointer.strength = 0
		sync()
	}

	function move(event: PointerEvent): void {
		if (!element || motion.matches || event.pointerType !== 'mouse') return
		const bounds = element.getBoundingClientRect()
		pointer.x = event.clientX - bounds.left
		pointer.y = event.clientY - bounds.top
		if (!pointer.active && towerPointer.strength < 0.01) {
			towerPointer.x = pointer.x
			towerPointer.y = pointer.y
		}
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
		towerPointer.strength = 0
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
