<script setup lang="ts">
import LoginParticleSurface from '../components/LoginParticleSurface.vue'
import type { CaptchaChallenge } from '~~/shared/contracts/auth'

defineOptions({ name: 'LoginPage' })
definePageMeta({ layout: false })

const { login, token, fetchCurrentUser, apiFetch } = useAuth()

const username = ref('')
const password = ref('')
const captcha = ref('')
const challenge = ref<CaptchaChallenge | null>(null)
const errorMessage = ref('')
const submitting = ref(false)
const redirecting = ref(false)
const feedbackContent = useTemplateRef<HTMLElement>('feedbackContent')
const feedbackHeight = ref(0)
let feedbackObserver: ResizeObserver | undefined

onMounted(() => {
	const content = feedbackContent.value
	if (!content) return
	feedbackObserver = new ResizeObserver(() => {
		feedbackHeight.value = content.getBoundingClientRect().height
	})
	feedbackObserver.observe(content)
})

onBeforeUnmount(() => feedbackObserver?.disconnect())

// 解码 base64 得到原始 SVG，直接内联进 DOM 渲染，避免 data URI 加载失败。
const captchaSvg = computed(() => {
	const dataUri = challenge.value?.imageBase64
	if (!dataUri) return ''
	try {
		return atob(dataUri.replace(/^data:image\/svg\+xml;base64,/, ''))
	} catch {
		return ''
	}
})

async function refreshCaptcha(options: { preserveError?: boolean } = {}): Promise<void> {
	if (!options.preserveError) errorMessage.value = ''
	try {
		// 必须走 apiFetch：它会拆掉 ApiResult 外壳，裸 $fetch 拿到的是 { success, data, requestId }。
		challenge.value = await apiFetch<CaptchaChallenge>('/api/v1/auth/captcha')
	} catch {
		challenge.value = null
		if (!options.preserveError) errorMessage.value = '验证码获取失败，请稍后重试'
	}
}

async function submit(): Promise<void> {
	if (submitting.value) return
	if (!username.value || !password.value || !captcha.value || !challenge.value) {
		errorMessage.value = '请填写完整的登录信息'
		return
	}

	submitting.value = true
	try {
		await login({
			username: username.value,
			password: password.value,
			captcha: captcha.value,
			captchaKey: challenge.value.key,
		})
		redirecting.value = true
		await new Promise<void>((resolve) => setTimeout(resolve, 280))
		// 登录成功后统一进入系统门户：门户在 dashboard 布局内（有侧边栏与退出按钮），
		// 且不要求任何权限码，各角色都能落地；直接进 /system/users 会让无权限的 operator 被守卫踢到公共首页。
		await navigateTo('/system/portal')
	} catch (error) {
		redirecting.value = false
		errorMessage.value = error instanceof Error ? error.message : '登录失败，请检查登录信息'
		captcha.value = ''
		await refreshCaptcha({ preserveError: true })
	} finally {
		submitting.value = false
	}
}

onMounted(async () => {
	await refreshCaptcha()
	// 已登录用户访问登录页时直接进入系统门户。
	if (token.value && (await fetchCurrentUser())) {
		await navigateTo('/system/portal')
	}
})
</script>

<template>
	<div
		class="login-page relative flex min-h-screen items-center justify-center px-4 py-6 text-slate-900 sm:px-6 sm:py-10 dark:text-slate-100"
		:class="{ 'is-redirecting': redirecting }"
	>
		<div
			class="login-shell relative z-10 mx-auto grid w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 lg:grid-cols-[1fr_27rem]"
		>
			<section
				class="brand-panel relative hidden overflow-hidden border-r border-slate-200 bg-slate-50 p-10 dark:border-slate-800 dark:bg-slate-950/70 lg:flex lg:flex-col lg:justify-between"
			>
				<div class="relative z-10">
					<div class="flex items-center gap-3">
						<div
							class="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-400 text-lg font-black tracking-tight text-slate-950 shadow-sm shadow-amber-500/20"
						>
							SM
						</div>
						<div>
							<p class="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-100">
								SolMelt
							</p>
							<p class="text-xs text-slate-500 dark:text-slate-400">运营管理系统</p>
						</div>
					</div>

					<div class="mt-24 max-w-sm">
						<div class="mb-5 flex items-center gap-2 text-amber-600 dark:text-amber-300">
							<UIcon name="i-lucide-scan-line" class="h-5 w-5" aria-hidden="true" />
							<span class="text-xs font-semibold uppercase tracking-[0.18em]"
								>SolMelt Operations</span
							>
						</div>
						<h1
							class="text-3xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-white"
						>
							光热熔盐泵
							<span class="block text-slate-500 dark:text-slate-400">智能运营管理系统</span>
						</h1>
					</div>
				</div>

				<div
					class="relative z-10 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400"
				>
					<span class="h-px w-8 bg-amber-400" aria-hidden="true" />
					<span>SolMelt Operations</span>
				</div>
				<LoginParticleSurface />
			</section>

			<section class="login-panel flex flex-col justify-center p-6 sm:p-10">
				<div class="mb-8 flex items-start justify-between gap-4">
					<div>
						<div class="mb-3 flex items-center gap-2 lg:hidden">
							<span
								class="flex h-8 w-8 items-center justify-center rounded-md bg-amber-400 text-xs font-black text-slate-950"
								>SM</span
							>
							<span class="font-semibold text-slate-950 dark:text-slate-100">SolMelt</span>
						</div>
						<p
							class="text-xs font-medium uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300"
						>
							欢迎回来
						</p>
						<h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
							登录运营管理系统
						</h2>
						<p class="mt-2 text-sm text-slate-500 dark:text-slate-400">请输入账号信息继续操作</p>
					</div>
					<ThemeToggleButton />
				</div>

				<form class="login-form" @submit.prevent="submit">
					<label class="block space-y-2">
						<span class="text-sm font-medium text-slate-700 dark:text-slate-300">用户名</span>
						<UInput
							v-model="username"
							placeholder="请输入用户名"
							icon="i-lucide-user-round"
							class="w-full"
							autocomplete="username"
						/>
					</label>

					<label class="block space-y-2">
						<span class="text-sm font-medium text-slate-700 dark:text-slate-300">密码</span>
						<UInput
							v-model="password"
							type="password"
							placeholder="请输入密码"
							icon="i-lucide-lock-keyhole"
							class="w-full"
							autocomplete="current-password"
						/>
					</label>

					<div class="space-y-2">
						<div class="flex items-center justify-between gap-3">
							<span class="text-sm font-medium text-slate-700 dark:text-slate-300">验证码</span>
						</div>
						<div class="flex items-center gap-3">
							<UInput
								v-model="captcha"
								placeholder="四位验证码"
								icon="i-lucide-shield-check"
								class="min-w-0 flex-1"
								:ui="{ base: 'h-10' }"
								maxlength="4"
								autocomplete="off"
							/>
							<!-- SVG 由本系统 /captcha 接口生成、不含用户输入；内联渲染避免 data URI 加载失败 -->
							<!-- eslint-disable vue/no-v-html -->
							<button
								v-if="challenge"
								type="button"
								role="img"
								aria-label="验证码，点击刷新"
								title="点击刷新验证码"
								class="captcha-image h-10 w-28 shrink-0 overflow-hidden rounded-md border border-slate-300 bg-slate-100 transition hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:border-slate-700 dark:bg-slate-800"
								@click="refreshCaptcha()"
								v-html="captchaSvg"
							/>
							<!-- eslint-enable vue/no-v-html -->
							<UButton v-else color="neutral" variant="soft" size="sm" @click="refreshCaptcha()">
								获取验证码
							</UButton>
						</div>
					</div>

					<div class="login-feedback" :style="{ height: `${feedbackHeight}px` }">
						<div ref="feedbackContent">
							<div v-if="errorMessage" class="pt-5">
								<UAlert
									role="alert"
									aria-live="assertive"
									icon="i-lucide-circle-alert"
									color="error"
									variant="subtle"
									title="登录失败"
									:description="errorMessage"
								/>
							</div>
						</div>
					</div>

					<UButton type="submit" block color="warning" size="lg" :loading="submitting">
						<span class="font-semibold">登录</span>
					</UButton>
				</form>

				<p
					class="mt-8 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400"
				>
					验证码五分钟内有效，使用后失效。如需账号帮助，请联系系统管理员。
				</p>
			</section>
		</div>

		<Transition name="login-success">
			<div
				v-if="redirecting"
				class="login-success-overlay absolute inset-0 z-20 flex items-center justify-center px-6"
				role="status"
				aria-live="polite"
			>
				<div
					class="flex items-center gap-3 rounded-lg border border-amber-400/30 bg-white/95 px-4 py-3 text-sm font-medium text-slate-700 shadow-lg shadow-slate-950/10 dark:bg-slate-900/95 dark:text-slate-200"
				>
					<UIcon
						name="i-lucide-loader-circle"
						class="size-4 animate-spin text-amber-500"
						aria-hidden="true"
					/>
					<span>登录成功，正在进入系统</span>
				</div>
			</div>
		</Transition>
	</div>
</template>

<style scoped>
.login-page {
	isolation: isolate;
	background: #f1f5f9;
}

.login-page::before {
	content: '';
	position: absolute;
	inset: 0;
	pointer-events: none;
	background-image:
		linear-gradient(rgb(45 77 121 / 17%) 1px, transparent 1px),
		linear-gradient(90deg, rgb(45 77 121 / 17%) 1px, transparent 1px);
	background-size: 40px 40px;
	mask-image: radial-gradient(ellipse at center, #000 10%, transparent 88%);
}

.dark .login-page::before {
	background-image:
		linear-gradient(rgb(125 160 207 / 19%) 1px, transparent 1px),
		linear-gradient(90deg, rgb(125 160 207 / 19%) 1px, transparent 1px);
}

.login-page.is-redirecting .login-shell {
	transform: scale(0.985);
	opacity: 0;
	transition:
		opacity 280ms ease,
		transform 280ms ease;
}

.login-success-overlay {
	background: rgb(241 245 249 / 72%);
	backdrop-filter: blur(3px);
}

.dark .login-success-overlay {
	background: rgb(2 6 23 / 72%);
}

.login-success-enter-active,
.login-success-leave-active {
	transition: opacity 180ms ease;
}

.login-success-enter-from,
.login-success-leave-to {
	opacity: 0;
}

.dark .login-page {
	background: #020617;
}

.brand-panel {
	min-height: 38rem;
}

.captcha-image :deep(svg) {
	display: block;
	height: 100%;
	width: 100%;
}

.login-form > * + * {
	margin-top: 1.25rem;
}

.login-form > .login-feedback {
	/* Keep spacing inside the measured content so height and spacing animate together. */
	margin-block: 0;
	overflow: hidden;
	transition: height 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
	.login-success-overlay :deep(.animate-spin) {
		animation: none;
	}

	.login-page.is-redirecting .login-shell,
	.login-success-enter-active,
	.login-success-leave-active,
	.captcha-image,
	.login-form > .login-feedback {
		transition: none;
	}
}
</style>
