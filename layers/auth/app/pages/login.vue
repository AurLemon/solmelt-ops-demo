<script setup lang="ts">
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
	errorMessage.value = ''
	try {
		await login({
			username: username.value,
			password: password.value,
			captcha: captcha.value,
			captchaKey: challenge.value.key,
		})
		// 登录成功后统一进入系统门户：门户在 dashboard 布局内（有侧边栏与退出按钮），
		// 且不要求任何权限码，各角色都能落地；直接进 /system/users 会让无权限的 operator 被守卫踢到公共首页。
		await navigateTo('/system/portal')
	} catch (error) {
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
		class="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
	>
		<div class="w-full max-w-md space-y-6">
			<div class="text-center">
				<p class="text-3xl font-bold text-amber-500 dark:text-amber-300">SolMelt</p>
				<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">光热熔盐泵智能运营管理系统</p>
			</div>

			<UCard
				class="border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
			>
				<form class="space-y-4" @submit.prevent="submit">
					<label class="block space-y-1">
						<span class="text-sm text-slate-700 dark:text-slate-300">用户名</span>
						<UInput
							v-model="username"
							placeholder="请输入用户名"
							class="w-full"
							autocomplete="username"
						/>
					</label>

					<label class="block space-y-1">
						<span class="text-sm text-slate-700 dark:text-slate-300">密码</span>
						<UInput
							v-model="password"
							type="password"
							placeholder="请输入密码"
							class="w-full"
							autocomplete="current-password"
						/>
					</label>

					<div class="space-y-1">
						<span class="text-sm text-slate-700 dark:text-slate-300">验证码</span>
						<div class="flex items-center gap-3">
							<UInput
								v-model="captcha"
								placeholder="四位验证码"
								class="w-full"
								maxlength="4"
								autocomplete="off"
							/>
							<!-- SVG 由本系统 /captcha 接口生成、不含用户输入；内联渲染避免 data URI 加载失败 -->
							<!-- eslint-disable vue/no-v-html -->
							<span
								v-if="challenge"
								role="img"
								aria-label="验证码，点击刷新"
								title="点击刷新验证码"
								class="block h-10 w-28 cursor-pointer overflow-hidden rounded-md border border-slate-300 bg-slate-100 [&>svg]:h-full [&>svg]:w-full"
								@click="refreshCaptcha()"
								v-html="captchaSvg"
							/>
							<!-- eslint-enable vue/no-v-html -->
							<UButton v-else color="neutral" variant="soft" size="sm" @click="refreshCaptcha()">
								获取验证码
							</UButton>
						</div>
					</div>

					<Transition name="login-feedback" mode="out-in">
						<UAlert
							v-if="errorMessage"
							:key="errorMessage"
							role="alert"
							aria-live="assertive"
							icon="i-lucide-circle-alert"
							color="error"
							variant="subtle"
							title="登录失败"
							:description="errorMessage"
						/>
					</Transition>

					<UButton type="submit" block color="warning" :loading="submitting">登 录</UButton>
				</form>
			</UCard>

			<div class="flex justify-center">
				<ThemeToggleButton />
			</div>
		</div>
	</div>
</template>

<style scoped>
.login-feedback-enter-active {
	transition:
		opacity 260ms cubic-bezier(0.16, 1, 0.3, 1),
		transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.login-feedback-leave-active {
	transition:
		opacity 150ms ease-in,
		transform 150ms ease-in;
}

.login-feedback-enter-from {
	opacity: 0;
	transform: translateY(-8px) scale(0.985);
}

.login-feedback-leave-to {
	opacity: 0;
	transform: translateY(-4px) scale(0.99);
}

@media (prefers-reduced-motion: reduce) {
	.login-feedback-enter-active,
	.login-feedback-leave-active {
		transition: none;
	}
}
</style>
