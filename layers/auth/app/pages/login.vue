<script setup lang="ts">
import type { CaptchaChallenge } from '~~/shared/contracts/auth'

defineOptions({ name: 'LoginPage' })
definePageMeta({ layout: false })

const { login, token, fetchCurrentUser, apiFetch } = useAuth()

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------
/** 与后端一致：验证码五分钟过期、一次性使用。 */
const CAPTCHA_TTL_SECONDS = 300
/** 连续失败上限与锁定秒数，仅用于前端交互提示；服务端仍以「验证码一次性 + 五分钟过期」为主防线。 */
const MAX_FAILED_ATTEMPTS = 3
const LOCK_SECONDS = 60
/** 登录成功后停留多久再跳转，让绿色成功反馈可见。 */
const SUCCESS_FLASH_MS = 280
/** 验证码到期后先让用户看清「已过期」，再自动换新，避免瞬间跳变看不出发生了什么。 */
const CAPTCHA_EXPIRED_GRACE_MS = 700
const STORAGE_USERNAME = 'solmelt.login.username'
const STORAGE_LAST_LOGIN = 'solmelt.login.last-login-at'

// ---------------------------------------------------------------------------
// 表单与状态
// ---------------------------------------------------------------------------
const username = ref('')
const password = ref('')
const captcha = ref('')
const challenge = ref<CaptchaChallenge | null>(null)
const errorMessage = ref('')
const errorKind = ref<'error' | 'warn'>('error')
const submitting = ref(false)
const cardState = ref<'' | 'shake' | 'ok'>('')

const showPassword = ref(false)
const capsLockOn = ref(false)
const passwordInvalid = ref(false)

const rememberUsername = ref(false)
const lastLoginAt = ref('')
const serviceOnline = ref<boolean | null>(null)

const captchaLeft = ref(CAPTCHA_TTL_SECONDS)
const captchaSpinning = ref(false)
/** 去重标记：点击刷新、失败后刷新、到期刷新可能同时发生，避免并发打接口。 */
const captchaLoading = ref(false)
/** 本次换新是否为系统自动触发（用于在提示行给出可见反馈）。 */
const captchaAutoRefreshed = ref(false)
const failedAttempts = ref(0)
const lockLeft = ref(0)

/** 鼠标光晕跟随（交互 ⑧）用到的卡片元素。 */
const panelEl = ref<HTMLElement | null>(null)
/** 自动换新后把焦点送回验证码输入框，用户可以直接接着输。 */
const captchaInputEl = ref<HTMLInputElement | null>(null)

let countdownTimer: ReturnType<typeof setInterval> | null = null
let lockTimer: ReturnType<typeof setInterval> | null = null
let spinTimer: ReturnType<typeof setTimeout> | null = null
let shakeTimer: ReturnType<typeof setTimeout> | null = null
/** 到期后延迟换新的定时器；一旦有新验证码下发就被取消，避免把用户刚拿到的码又换掉。 */
let expireTimer: ReturnType<typeof setTimeout> | null = null

// ---------------------------------------------------------------------------
// 派生状态
// ---------------------------------------------------------------------------
/** 解码 base64 得到原始 SVG，直接内联进 DOM 渲染，避免 data URI 加载失败。 */
const captchaSvg = computed(() => {
	const dataUri = challenge.value?.imageBase64
	if (!dataUri) return ''
	try {
		return atob(dataUri.replace(/^data:image\/svg\+xml;base64,/, ''))
	} catch {
		return ''
	}
})

const captchaClock = computed(() => {
	const left = Math.max(captchaLeft.value, 0)
	const minutes = Math.floor(left / 60)
	const seconds = left % 60
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const captchaExpired = computed(() => captchaLeft.value <= 0)
const locked = computed(() => lockLeft.value > 0)

/** 验证码提示行：把「已自动换新」「已过期正在换」「取不到码」三种状态说清楚。 */
const captchaTip = computed(() => {
	if (!challenge.value) {
		// 首屏（含 SSR）还没拿到验证码，不能报「获取失败」吓人；只有请求真的失败了才提示失败。
		return serviceOnline.value === false ? '验证码获取失败，请点击重新获取' : '正在获取验证码…'
	}
	if (captchaExpired.value) return '验证码已过期，正在自动换新…'
	if (captchaAutoRefreshed.value) return '已自动换新验证码，请重新输入'
	return '验证码 5 分钟内有效，用后即失效'
})

const statusText = computed(() => {
	if (serviceOnline.value === null) return '检测中'
	return serviceOnline.value ? '服务正常' : '服务异常'
})

const passwordType = computed(() => (showPassword.value ? 'text' : 'password'))

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

function readStorage(key: string): string {
	try {
		return window.localStorage.getItem(key) ?? ''
	} catch {
		return ''
	}
}

function writeStorage(key: string, value: string): void {
	try {
		if (value) window.localStorage.setItem(key, value)
		else window.localStorage.removeItem(key)
	} catch {
		// 隐私模式下 localStorage 可能不可用，忽略即可，不影响登录主流程。
	}
}

/** 后端传输 UTC ISO 8601，页面按北京时间展示。 */
function formatBeijingTime(iso: string): string {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return ''
	const text = new Intl.DateTimeFormat('zh-CN', {
		timeZone: 'Asia/Shanghai',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).format(date)
	return text.replace(/\//g, '-')
}

function showError(message: string, kind: 'error' | 'warn' = 'error'): void {
	errorMessage.value = message
	errorKind.value = kind
}

/** 交互 ⑧：鼠标在登录卡上移动时，把坐标写进 CSS 变量驱动光晕。 */
function onPanelMove(event: MouseEvent): void {
	const el = panelEl.value
	if (!el) return
	const rect = el.getBoundingClientRect()
	el.style.setProperty('--mx', `${event.clientX - rect.left}px`)
	el.style.setProperty('--my', `${event.clientY - rect.top}px`)
}

// ---------------------------------------------------------------------------
// 验证码
// ---------------------------------------------------------------------------
function stopCaptchaCountdown(): void {
	if (countdownTimer) {
		clearInterval(countdownTimer)
		countdownTimer = null
	}
	// 倒计时的停止意味着这张验证码的周期结束了，挂起的自动换新也一并取消。
	if (expireTimer) {
		clearTimeout(expireTimer)
		expireTimer = null
	}
}

function startCaptchaCountdown(): void {
	stopCaptchaCountdown()
	captchaLeft.value = CAPTCHA_TTL_SECONDS
	countdownTimer = setInterval(() => {
		captchaLeft.value -= 1
		if (captchaLeft.value <= 0) {
			captchaLeft.value = 0
			stopCaptchaCountdown()
			scheduleAutoRefresh()
		}
	}, 1000)
}

/**
 * 验证码五分钟到期后自动换一张。
 * 后端过期后该验证码一定校验失败，若仍等用户手动点击，就会出现「图还在、答案已作废」的必错状态。
 * 延迟一小段再换，是为了让用户看清「已过期」而不是图片无声跳变。
 */
function scheduleAutoRefresh(): void {
	// 提交中：本次请求失败后自带刷新；锁定期：输入被禁用，等解锁时统一换新，避免空转。
	if (submitting.value || locked.value) return
	expireTimer = setTimeout(() => {
		expireTimer = null
		void refreshCaptcha({ auto: true, focus: true })
	}, CAPTCHA_EXPIRED_GRACE_MS)
}

async function playCaptchaSpin(): Promise<void> {
	captchaSpinning.value = false
	await nextTick()
	captchaSpinning.value = true
	if (spinTimer) clearTimeout(spinTimer)
	spinTimer = setTimeout(() => {
		captchaSpinning.value = false
	}, 480)
}

/**
 * 拉取新验证码。同时把「服务状态灯」绑定到这次请求结果上：
 * 能取到验证码即说明后端与数据库可用，不需要额外的健康检查接口。
 * 注意：本函数不清空错误提示，避免覆盖刚写入的登录失败原因。
 *
 * @param options.auto  是否由系统自动触发（失败刷新、到期刷新），用于提示行反馈
 * @param options.focus 换新后是否把焦点送回验证码输入框
 */
async function refreshCaptcha(options: { auto?: boolean; focus?: boolean } = {}): Promise<void> {
	if (captchaLoading.value) return
	captchaLoading.value = true
	try {
		// 必须走 apiFetch：它会拆掉 ApiResult 外壳，裸 $fetch 拿到的是 { success, data, requestId }。
		challenge.value = await apiFetch<CaptchaChallenge>('/api/v1/auth/captcha')
		serviceOnline.value = true
		captcha.value = ''
		captchaAutoRefreshed.value = options.auto === true
		startCaptchaCountdown()
		await playCaptchaSpin()
		if (options.focus) {
			await nextTick()
			captchaInputEl.value?.focus()
		}
	} catch {
		challenge.value = null
		serviceOnline.value = false
		showError('验证码获取失败，请稍后重试', 'error')
	} finally {
		captchaLoading.value = false
	}
}

async function onCaptchaClick(): Promise<void> {
	errorMessage.value = ''
	captchaAutoRefreshed.value = false
	await refreshCaptcha()
}

/** 用户开始重输验证码后，撤掉「已自动换新」的提示。 */
function onCaptchaInput(): void {
	if (captchaAutoRefreshed.value) captchaAutoRefreshed.value = false
}

// ---------------------------------------------------------------------------
// 失败计数与临时锁定
// ---------------------------------------------------------------------------
function stopLockCountdown(): void {
	if (lockTimer) {
		clearInterval(lockTimer)
		lockTimer = null
	}
}

function startLockCountdown(): void {
	stopLockCountdown()
	lockLeft.value = LOCK_SECONDS
	showError(
		`连续 ${MAX_FAILED_ATTEMPTS} 次登录失败，表单已锁定，请 ${lockLeft.value} 秒后重试`,
		'warn',
	)
	lockTimer = setInterval(() => {
		lockLeft.value -= 1
		if (lockLeft.value > 0) {
			showError(
				`连续 ${MAX_FAILED_ATTEMPTS} 次登录失败，表单已锁定，请 ${lockLeft.value} 秒后重试`,
				'warn',
			)
			return
		}
		lockLeft.value = 0
		failedAttempts.value = 0
		errorMessage.value = ''
		stopLockCountdown()
		// 解锁后换一张新验证码：锁定期间旧码大概率已过期，直接给一张可用的。
		void refreshCaptcha({ auto: true, focus: true })
	}, 1000)
}

function registerFailure(message: string): void {
	failedAttempts.value += 1
	passwordInvalid.value = true
	cardState.value = 'shake'
	if (shakeTimer) clearTimeout(shakeTimer)
	shakeTimer = setTimeout(() => {
		cardState.value = ''
	}, 900)

	if (failedAttempts.value >= MAX_FAILED_ATTEMPTS) {
		startLockCountdown()
		return
	}
	showError(`${message}（还可尝试 ${MAX_FAILED_ATTEMPTS - failedAttempts.value} 次）`, 'error')
}

// ---------------------------------------------------------------------------
// 登录
// ---------------------------------------------------------------------------
async function submit(): Promise<void> {
	if (submitting.value || locked.value) return
	if (!username.value || !password.value || !captcha.value) {
		showError('请填写完整的登录信息', 'error')
		return
	}
	// 验证码已过期就不必发给后端：后端必定判失败，还会白白消耗一次重试机会。
	if (!challenge.value || captchaExpired.value) {
		showError('验证码已过期，已自动换一张，请重新输入', 'warn')
		await refreshCaptcha({ auto: true, focus: true })
		return
	}

	submitting.value = true
	errorMessage.value = ''
	cardState.value = ''
	passwordInvalid.value = false

	try {
		await login({
			username: username.value,
			password: password.value,
			captcha: captcha.value,
			captchaKey: challenge.value.key,
		})
	} catch (error) {
		submitting.value = false
		registerFailure(error instanceof Error ? error.message : '登录失败')
		// 旧验证码对本次输入已经没有意义（错误可能就是它），自动换一张并把焦点送回输入框。
		await refreshCaptcha({ auto: true, focus: !locked.value })
		return
	}

	// 成功：记住用户名、记录本次登录时间，给出绿色反馈后再进入门户。
	failedAttempts.value = 0
	writeStorage(STORAGE_USERNAME, rememberUsername.value ? username.value : '')
	writeStorage(STORAGE_LAST_LOGIN, new Date().toISOString())
	cardState.value = 'ok'
	await sleep(SUCCESS_FLASH_MS)
	// 登录成功后统一进入系统门户：门户在 dashboard 布局内（有侧边栏与退出按钮），
	// 且不要求任何权限码，各角色都能落地；直接进 /system/users 会让无权限的 operator 被守卫踢到公共首页。
	await navigateTo('/system/portal')
}

// ---------------------------------------------------------------------------
// 交互细节
// ---------------------------------------------------------------------------
function syncCapsLock(event: KeyboardEvent): void {
	if (typeof event.getModifierState === 'function') {
		capsLockOn.value = event.getModifierState('CapsLock')
	}
}

function onPasswordInput(): void {
	passwordInvalid.value = false
}

// ---------------------------------------------------------------------------
// 生命周期
// ---------------------------------------------------------------------------
onMounted(async () => {
	const savedUsername = readStorage(STORAGE_USERNAME)
	if (savedUsername) {
		username.value = savedUsername
		rememberUsername.value = true
	}
	const savedLoginAt = readStorage(STORAGE_LAST_LOGIN)
	if (savedLoginAt) lastLoginAt.value = formatBeijingTime(savedLoginAt)

	await refreshCaptcha()

	// 已登录用户访问登录页时直接进入系统门户。
	if (token.value && (await fetchCurrentUser())) {
		await navigateTo('/system/portal')
	}
})

onUnmounted(() => {
	stopCaptchaCountdown()
	stopLockCountdown()
	if (spinTimer) clearTimeout(spinTimer)
	if (shakeTimer) clearTimeout(shakeTimer)
})
</script>

<template>
	<div class="login-screen">
		<!-- 氛围层（①）：漂浮光斑 / 网格 / 流光扫描线，纯 CSS 动画、无图片资源、无新依赖 -->
		<div class="ambient" aria-hidden="true">
			<div class="blobs">
				<i class="b1" />
				<i class="b2" />
				<i class="b3" />
			</div>
			<div class="grid" />
			<div class="scanline" />
		</div>

		<div class="content">
			<!-- 左：品牌 + 熔盐泵线稿 + 关键指标（①） -->
			<aside class="brand">
				<!-- 巨型描边水印：填住左上留白，纯装饰、不承载信息 -->
				<span class="brand-ghost" aria-hidden="true">SOLMELT</span>

				<div class="brand-head anim d0">
					<div class="logo">SM</div>
					<div>
						<h1>SolMelt</h1>
						<p>光热熔盐泵智能运营管理系统</p>
					</div>
				</div>

				<svg
					class="pump anim d1"
					viewBox="0 0 330 210"
					role="img"
					aria-label="熔盐泵结构线稿：吸入口、泵壳、出口与电机"
				>
					<!-- 底座 -->
					<path class="outline-dim" d="M28 186 H312" />
					<path class="outline" d="M74 158 V188" />
					<path class="outline" d="M124 158 V188" />
					<path class="outline" d="M244 158 V188" />

					<!-- 吸入口 -->
					<path class="outline" d="M10 110 H74" />
					<path class="outline-dim" d="M10 98 V122" />

					<!-- 泵壳 -->
					<circle class="outline" cx="120" cy="110" r="46" />
					<circle class="outline-dim" cx="120" cy="110" r="15" />
					<path class="outline-dim" d="M120 79 V95 M120 125 V141 M89 110 H105 M135 110 H151" />

					<!-- 出口 -->
					<path class="outline" d="M120 64 V26 H158" />
					<path class="outline-dim" d="M132 40 H148" />

					<!-- 联轴器 + 电机 -->
					<path class="outline" d="M166 110 H196" />
					<rect class="outline" x="196" y="64" width="104" height="92" rx="12" />
					<path
						class="outline-dim"
						d="M214 64 V156 M232 64 V156 M250 64 V156 M268 64 V156 M286 64 V156"
					/>

					<!-- 熔盐流向：进口 → 泵壳 → 出口 -->
					<path class="flow" d="M10 110 H120 V26 H158" />
					<path class="flow-2" d="M10 110 H120 V26 H158" />

					<!-- 采集节点 -->
					<circle class="node" cx="120" cy="110" r="4.5" />
					<circle class="node d2" cx="163" cy="110" r="3.5" />
					<circle class="node d3" cx="120" cy="34" r="3.5" />
				</svg>

				<ul class="facts anim d2">
					<li><b>9</b><span>设备接入</span></li>
					<li><b>30</b><span>监测属性</span></li>
					<li><b>3</b><span>级阈值报警</span></li>
					<li><b>2</b><span>类角色权限</span></li>
				</ul>

				<!-- 数据链路：与项目验收链路一致的文字说明条，不是业务数据 -->
				<ol
					class="chain anim d3"
					aria-label="数据链路：模拟上报、入库、三级阈值报警、历史查询、大屏延迟展示"
				>
					<li><i aria-hidden="true" />模拟上报</li>
					<li><i aria-hidden="true" />入库</li>
					<li><i aria-hidden="true" />三级阈值报警</li>
					<li><i aria-hidden="true" />历史查询</li>
					<li><i aria-hidden="true" />大屏展示</li>
				</ol>
			</aside>

			<!-- 右：玻璃拟态登录卡（① 玻璃拟态 + ② 全部交互微动效） -->
			<!-- 入场动画放在 panel-inner 上：panel 同时承担失败抖动动画，两个 animation
				     写在同一元素会互相覆盖，抖动期间卡片会闪烁消失后又重新淡入。 -->
			<section ref="panelEl" class="panel" :class="cardState" @mousemove="onPanelMove">
				<div class="panel-inner anim d3">
					<header class="head">
						<h2>欢迎登录</h2>
						<p class="sub">请输入账号信息以进入运营管理系统</p>
					</header>
					<span class="svc" :class="{ down: serviceOnline === false }">
						<span class="led" aria-hidden="true" />
						{{ statusText }}
					</span>

					<p v-if="errorMessage" class="alert" :class="{ warn: errorKind === 'warn' }" role="alert">
						<span class="ico" aria-hidden="true">!</span>
						<span>{{ errorMessage }}</span>
					</p>

					<!-- Prettier 会给原生 void 元素补上自闭合斜杠，与本仓库开启的 vue/html-self-closing 冲突；
					     登录页为独立布局（layout:false）需要精确控制输入框外观，故在此表单内统一关闭该规则。 -->
					<!-- eslint-disable vue/html-self-closing -->
					<form class="login-form" @submit.prevent="submit">
						<div class="field anim d4">
							<label for="login-username" class="sr-only">用户名</label>
							<div class="input-wrap">
								<svg class="lead" viewBox="0 0 24 24" aria-hidden="true">
									<circle cx="12" cy="8" r="3.6" />
									<path d="M5 20c1.4-3.6 4-5.2 7-5.2s5.6 1.6 7 5.2" />
								</svg>
								<input
									id="login-username"
									v-model="username"
									type="text"
									placeholder="请输入用户名"
									autocomplete="username"
									:disabled="locked || submitting"
								/>
							</div>
						</div>

						<div class="field anim d4" :class="{ bad: passwordInvalid }">
							<label for="login-password" class="sr-only">密码</label>
							<div class="input-wrap">
								<svg class="lead" viewBox="0 0 24 24" aria-hidden="true">
									<rect x="5" y="10.5" width="14" height="9" rx="2.4" />
									<path d="M8 10.5V8a4 4 0 018 0v2.5" />
								</svg>
								<input
									id="login-password"
									v-model="password"
									:type="passwordType"
									placeholder="请输入密码"
									autocomplete="current-password"
									:disabled="locked || submitting"
									@input="onPasswordInput"
									@keydown="syncCapsLock"
									@keyup="syncCapsLock"
									@blur="capsLockOn = false"
								/>
								<button
									type="button"
									class="eye"
									:class="{ on: showPassword }"
									:title="showPassword ? '隐藏密码' : '显示密码'"
									:aria-label="showPassword ? '隐藏密码' : '显示密码'"
									@click="showPassword = !showPassword"
								>
									<svg v-if="!showPassword" class="i-open" viewBox="0 0 24 24">
										<path
											d="M1.6 12S5.2 5.6 12 5.6 22.4 12 22.4 12 18.8 18.4 12 18.4 1.6 12 1.6 12z"
										/>
										<circle cx="12" cy="12" r="3.2" />
									</svg>
									<svg v-else class="i-off" viewBox="0 0 24 24">
										<path d="M3 3l18 18" />
										<path
											d="M10.6 6.2A9.9 9.9 0 0112 6.1c6.8 0 10.4 5.9 10.4 5.9a17.6 17.6 0 01-3.3 3.7"
										/>
										<path d="M6.7 7.8A17.3 17.3 0 001.6 12s3.6 5.9 10.4 5.9c1.1 0 2.2-.2 3.1-.5" />
									</svg>
								</button>
							</div>
						</div>

						<p class="caps" :class="{ show: capsLockOn }">
							<span class="k">Caps Lock</span><span>大写锁定已开启</span>
						</p>

						<div class="field anim d5">
							<label for="login-captcha" class="sr-only">验证码</label>
							<div class="captcha-row">
								<div class="input-wrap grow">
									<svg class="lead" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M12 3l7 3v5c0 4.6-3 8.2-7 9.4C8 19.2 5 15.6 5 11V6z" />
									</svg>
									<input
										id="login-captcha"
										ref="captchaInputEl"
										v-model="captcha"
										type="text"
										placeholder="请输入验证码"
										maxlength="4"
										autocomplete="off"
										:disabled="locked || submitting"
										@input="onCaptchaInput"
									/>
								</div>
								<!-- SVG 由本系统 /captcha 接口生成、不含用户输入；内联渲染避免 data URI 加载失败 -->
								<!-- eslint-disable vue/no-v-html -->
								<button
									v-if="challenge"
									type="button"
									class="captcha"
									:class="{ spin: captchaSpinning }"
									aria-label="验证码，点击刷新"
									title="点击刷新验证码"
									@click="onCaptchaClick"
									v-html="captchaSvg"
								/>
								<!-- eslint-enable vue/no-v-html -->
								<button v-else type="button" class="captcha empty" @click="onCaptchaClick">
									{{ serviceOnline === false ? '重新获取' : '加载中…' }}
								</button>
							</div>
							<div class="cap-line">
								<span class="tip" :class="{ fresh: captchaAutoRefreshed && !captchaExpired }">
									{{ captchaTip }}
								</span>
								<span class="cd" :class="{ warn: captchaLeft <= 60, dead: captchaExpired }">
									{{ captchaClock }}
								</span>
							</div>
						</div>

						<div class="opt-row anim d6">
							<label class="chk">
								<input v-model="rememberUsername" type="checkbox" />
								<span class="box" aria-hidden="true">
									<svg viewBox="0 0 12 12"><path d="M2 6.4l2.6 2.6L10 3.4" /></svg>
								</span>
								<span>记住用户名</span>
							</label>
							<span class="tip">忘记密码请联系管理员重置</span>
						</div>

						<button type="submit" class="btn anim d7" :class="cardState" :disabled="locked">
							<span v-if="submitting" class="sp" aria-hidden="true" />
							<span>{{ submitting ? '登录中…' : '登 录' }}</span>
						</button>
					</form>
					<!-- eslint-enable vue/html-self-closing -->

					<p class="foot anim d8">
						<span v-if="lastLoginAt" class="foot-row">
							<svg class="clock" viewBox="0 0 24 24" aria-hidden="true">
								<circle cx="12" cy="12" r="9" />
								<path d="M12 7v5l3.2 2" />
							</svg>
							上次登录（北京时间）：<b>{{ lastLoginAt }}</b>
						</span>
						<span>内置账号：<b>admin</b>（管理员）、<b>operator</b>（操作员），密码由组长分发</span>
						<span>验证码 5 分钟有效 · 一次性使用</span>
					</p>
				</div>
			</section>
		</div>
	</div>
</template>

<style scoped>
/* ===========================================================================
   登录页 · 第①类「视觉氛围」× 第②类「交互微动效」融合版
   氛围层：漂浮光斑 / 网格 / 流光扫描线 / 暗角（纯 CSS，无图片资源、无新依赖）
   交互层：聚焦发光 / 密码显隐 / 验证码刷新旋转 / 大写锁定 / 按钮 Loading /
           失败抖动 / 成功泛光 / 鼠标光晕跟随
   另保留：真实验证码倒计时、记住用户名、上次登录、服务状态灯、失败锁定
   无障碍：prefers-reduced-motion 下动画全部关闭
   =========================================================================== */
.login-screen {
	--ink: #e8eefb;
	--ink-dim: #93a4c0;
	--ink-mute: #6b7c99;
	--cyan: #22d3ee;
	--sky: #38bdf8;
	--amber: #f59e0b;
	--amber-2: #fbbf24;
	--ok: #34d399;
	--err: #f87171;

	position: relative;
	display: flex;
	min-height: 100vh;
	/* 只裁横向：矮窗口下内容超高时允许纵向滚动，避免表单被裁掉够不着 */
	overflow-x: hidden;
	color: var(--ink);
	background: #080c15;
}

/* =========================== 氛围层（①） =========================== */
.ambient {
	position: absolute;
	inset: 0;
	z-index: 0;
	overflow: hidden;
	pointer-events: none;
	background:
		radial-gradient(ellipse 120% 90% at 12% 0%, #0e1a2e 0%, transparent 55%),
		radial-gradient(ellipse 100% 80% at 100% 100%, #12172a 0%, transparent 60%),
		linear-gradient(160deg, #080d18 0%, #0b1120 52%, #080e1a 100%);
}
/* 暗角：让中心内容更聚焦 */
.ambient::after {
	content: '';
	position: absolute;
	inset: 0;
	background: radial-gradient(
		ellipse 88% 72% at 50% 46%,
		transparent 52%,
		rgba(3, 6, 13, 0.62) 100%
	);
}

/* ① -1 漂浮光斑 */
.blobs {
	position: absolute;
	inset: 0;
}
.blobs i {
	position: absolute;
	display: block;
	border-radius: 50%;
	will-change: transform;
}
.blobs .b1 {
	top: -230px;
	left: -190px;
	width: 640px;
	height: 640px;
	background: radial-gradient(
		closest-side,
		rgba(34, 211, 238, 0.42),
		rgba(34, 211, 238, 0.1) 52%,
		transparent 78%
	);
	animation: drift1 22s ease-in-out infinite;
}
.blobs .b2 {
	right: -160px;
	bottom: -200px;
	width: 560px;
	height: 560px;
	background: radial-gradient(
		closest-side,
		rgba(245, 158, 11, 0.34),
		rgba(245, 158, 11, 0.08) 52%,
		transparent 78%
	);
	animation: drift2 26s ease-in-out infinite;
}
.blobs .b3 {
	bottom: -250px;
	left: 34%;
	width: 520px;
	height: 520px;
	background: radial-gradient(
		closest-side,
		rgba(99, 102, 241, 0.34),
		rgba(99, 102, 241, 0.08) 52%,
		transparent 78%
	);
	animation: drift3 19s ease-in-out infinite;
}
@keyframes drift1 {
	0%,
	100% {
		transform: translate3d(0, 0, 0) scale(1);
	}
	33% {
		transform: translate3d(110px, -70px, 0) scale(1.14);
	}
	66% {
		transform: translate3d(-70px, 60px, 0) scale(0.93);
	}
}
@keyframes drift2 {
	0%,
	100% {
		transform: translate3d(0, 0, 0) scale(1);
	}
	40% {
		transform: translate3d(-120px, -80px, 0) scale(1.1);
	}
	70% {
		transform: translate3d(50px, 40px, 0) scale(0.96);
	}
}
@keyframes drift3 {
	0%,
	100% {
		transform: translate3d(0, 0, 0) scale(1);
	}
	50% {
		transform: translate3d(-90px, -50px, 0) scale(1.16);
	}
}

/* ① -2 网格 + 流光扫描线 */
.grid {
	position: absolute;
	inset: -2px;
	background-image:
		linear-gradient(to right, rgba(148, 163, 184, 0.085) 1px, transparent 1px),
		linear-gradient(to bottom, rgba(148, 163, 184, 0.085) 1px, transparent 1px);
	background-size: 56px 56px;
	-webkit-mask-image: radial-gradient(ellipse 92% 82% at 50% 46%, #000 26%, transparent 92%);
	mask-image: radial-gradient(ellipse 92% 82% at 50% 46%, #000 26%, transparent 92%);
}
.scanline {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	height: 240px;
	background: linear-gradient(
		180deg,
		transparent 0%,
		rgba(56, 189, 248, 0.06) 34%,
		rgba(34, 211, 238, 0.16) 49%,
		rgba(56, 189, 248, 0.2) 51%,
		rgba(56, 189, 248, 0.06) 66%,
		transparent 100%
	);
	mix-blend-mode: screen;
	animation: sweep 9.5s linear infinite;
	will-change: transform;
}
@keyframes sweep {
	from {
		transform: translateY(-270px);
	}
	to {
		transform: translateY(1150px);
	}
}

/* =========================== 内容层 =========================== */
.content {
	position: relative;
	z-index: 2;
	display: flex;
	flex: 1 1 auto;
	flex-wrap: wrap;
	gap: 56px;
	align-items: center;
	justify-content: center;
	padding: 52px 60px;
}

/* ---------- 左：品牌 + 熔盐泵线稿 ---------- */
.brand {
	position: relative;
	flex: 1 1 300px;
	min-width: 0;
	max-width: 460px;
}
/* 巨型描边水印（纯装饰）：把左上角的留白填成品牌层次 */
.brand-ghost {
	position: absolute;
	top: -58px;
	left: -56px;
	z-index: 0;
	font-size: clamp(60px, 8vw, 112px);
	font-weight: 900;
	line-height: 1;
	letter-spacing: 4px;
	color: rgba(125, 211, 252, 0.05);
	-webkit-text-stroke: 1px rgba(125, 211, 252, 0.14);
	white-space: nowrap;
	pointer-events: none;
	user-select: none;
}
/* 水印要压在内容之下，其余子项显式抬到上层 */
.brand-head,
.pump,
.facts,
.chain {
	position: relative;
	z-index: 1;
}
.brand-head {
	display: flex;
	gap: 13px;
	align-items: center;
	margin-bottom: 18px;
}
.logo {
	display: grid;
	flex: 0 0 46px;
	place-items: center;
	width: 46px;
	height: 46px;
	font-size: 15px;
	font-weight: 800;
	letter-spacing: 0.5px;
	color: #04121a;
	background: linear-gradient(135deg, var(--cyan), #5eead4 60%, #a7f3d0);
	border-radius: 13px;
	box-shadow:
		0 10px 26px -10px rgba(34, 211, 238, 0.85),
		inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
.brand-head h1 {
	margin: 0;
	font-size: 22px;
	font-weight: 800;
	letter-spacing: 0.4px;
	background: linear-gradient(92deg, #f2f7ff, #9fd8ff 70%, #7dd3fc);
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
}
.brand-head p {
	margin: 3px 0 0;
	font-size: 12.5px;
	letter-spacing: 0.2px;
	color: var(--ink-dim);
}

.pump {
	display: block;
	width: 100%;
	height: auto;
	max-height: 268px;
	overflow: visible;
}
.pump .outline {
	fill: none;
	stroke: rgba(148, 197, 255, 0.42);
	stroke-width: 1.6;
	stroke-linecap: round;
	stroke-linejoin: round;
}
.pump .outline-dim {
	fill: none;
	stroke: rgba(148, 197, 255, 0.2);
	stroke-width: 1.2;
	stroke-linecap: round;
	stroke-dasharray: 4 6;
}
.pump .flow {
	fill: none;
	stroke: var(--cyan);
	stroke-width: 2.4;
	stroke-linecap: round;
	stroke-dasharray: 56 520;
	animation: flowmove 3.6s linear infinite;
	filter: drop-shadow(0 0 6px rgba(34, 211, 238, 0.9));
}
.pump .flow-2 {
	fill: none;
	stroke: var(--amber-2);
	stroke-width: 2;
	stroke-linecap: round;
	stroke-dasharray: 34 400;
	animation: flowmove 4.6s linear infinite;
	animation-delay: -1.4s;
	filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.85));
}
@keyframes flowmove {
	from {
		stroke-dashoffset: 576;
	}
	to {
		stroke-dashoffset: 0;
	}
}
.pump .node {
	fill: var(--cyan);
	opacity: 0.9;
	transform-box: fill-box;
	transform-origin: center;
	animation: pulse 2.8s ease-in-out infinite;
}
.pump .node.d2 {
	fill: var(--amber-2);
	animation-delay: -0.9s;
}
.pump .node.d3 {
	animation-delay: -1.8s;
}
@keyframes pulse {
	0%,
	100% {
		opacity: 0.35;
		transform: scale(0.8);
	}
	50% {
		opacity: 1;
		transform: scale(1.25);
	}
}

.facts {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	margin: 18px 0 0;
	padding: 0;
	list-style: none;
}
.facts li {
	flex: 1 1 84px;
	padding: 10px 12px;
	background: rgba(148, 163, 184, 0.07);
	border: 1px solid rgba(148, 163, 184, 0.16);
	border-radius: 11px;
}
.facts b {
	display: block;
	font-size: 19px;
	font-weight: 800;
	color: #e7f6ff;
	font-variant-numeric: tabular-nums;
}
.facts span {
	display: block;
	margin-top: 2px;
	font-size: 11px;
	color: var(--ink-mute);
}

/* 数据链路说明条：与项目验收链路一致（模拟上报 → 入库 → 三级阈值报警 → 历史查询 → 大屏延迟展示） */
.chain {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	align-items: center;
	margin: 14px 0 0;
	padding: 0;
	list-style: none;
}
.chain li {
	display: inline-flex;
	gap: 6px;
	align-items: center;
	padding: 5px 10px;
	font-size: 11px;
	color: #b7d6f3;
	background: rgba(56, 189, 248, 0.09);
	border: 1px solid rgba(56, 189, 248, 0.2);
	border-radius: 999px;
}
.chain li i {
	width: 5px;
	height: 5px;
	background: var(--cyan);
	border-radius: 50%;
	box-shadow: 0 0 7px rgba(34, 211, 238, 0.95);
	animation: chainPulse 2.6s ease-in-out infinite;
}
.chain li:nth-child(2) i {
	animation-delay: -0.5s;
}
.chain li:nth-child(3) i {
	animation-delay: -1s;
}
.chain li:nth-child(4) i {
	animation-delay: -1.5s;
}
.chain li:nth-child(5) i {
	animation-delay: -2s;
}
@keyframes chainPulse {
	0%,
	100% {
		opacity: 0.35;
		transform: scale(0.8);
	}
	50% {
		opacity: 1;
		transform: scale(1.15);
	}
}

/* ---------- 右：玻璃拟态登录卡（① -3） ---------- */
.panel {
	position: relative;
	flex: 0 1 396px;
	min-width: 0;
	padding: 32px 30px 24px;
	background: linear-gradient(
		158deg,
		rgba(255, 255, 255, 0.085),
		rgba(255, 255, 255, 0.028) 62%,
		rgba(255, 255, 255, 0.05)
	);
	border: 1px solid rgba(255, 255, 255, 0.145);
	border-radius: 20px;
	box-shadow:
		0 30px 70px -26px rgba(0, 0, 0, 0.85),
		0 0 0 1px rgba(255, 255, 255, 0.03),
		inset 0 1px 0 rgba(255, 255, 255, 0.13);
	backdrop-filter: blur(18px) saturate(150%);
	-webkit-backdrop-filter: blur(18px) saturate(150%);
	transition:
		border-color 0.3s,
		box-shadow 0.3s;
}
/* 交互 ⑧：鼠标光晕跟随 */
.panel::before {
	content: '';
	position: absolute;
	inset: 0;
	pointer-events: none;
	background: radial-gradient(
		230px circle at var(--mx, 50%) var(--my, 50%),
		rgba(56, 189, 248, 0.16),
		transparent 62%
	);
	border-radius: inherit;
	opacity: 0;
	transition: opacity 0.28s ease;
}
.panel:hover::before {
	opacity: 1;
}
.panel-inner {
	position: relative;
	z-index: 1;
}
/* 交互 ⑥：登录失败 → 卡片抖动 */
.panel.shake {
	animation: shake 0.68s cubic-bezier(0.36, 0.07, 0.19, 0.97);
	border-color: rgba(248, 113, 113, 0.55);
}
@keyframes shake {
	10%,
	90% {
		transform: translateX(-2px);
	}
	20%,
	80% {
		transform: translateX(4px);
	}
	30%,
	50%,
	70% {
		transform: translateX(-7px);
	}
	40%,
	60% {
		transform: translateX(7px);
	}
}
/* 交互 ⑦：登录成功 → 绿色泛光 */
.panel.ok {
	border-color: rgba(52, 211, 153, 0.6);
	box-shadow:
		0 30px 70px -26px rgba(0, 0, 0, 0.85),
		0 0 0 3px rgba(52, 211, 153, 0.13),
		0 0 42px -6px rgba(52, 211, 153, 0.5);
}

.head h2 {
	margin: 0;
	font-size: 19px;
	font-weight: 700;
	letter-spacing: 0.3px;
	transition: color 0.3s;
}
.head .sub {
	margin: 5px 0 0;
	font-size: 12.5px;
	color: var(--ink-dim);
}
.panel.ok .head h2 {
	color: #6ee7b7;
}

/* 服务状态灯：能取到验证码即代表后端与数据库可用 */
.svc {
	display: inline-flex;
	gap: 6px;
	align-items: center;
	margin-top: 14px;
	padding: 5px 10px;
	font-size: 11px;
	font-weight: 600;
	color: var(--ink-dim);
	background: rgba(148, 163, 184, 0.1);
	border: 1px solid rgba(148, 163, 184, 0.2);
	border-radius: 999px;
}
.svc .led {
	width: 7px;
	height: 7px;
	background: var(--ok);
	border-radius: 50%;
	box-shadow: 0 0 8px 1px rgba(52, 211, 153, 0.7);
	animation: breath 2.4s ease-in-out infinite;
}
.svc.down .led {
	background: #ef4444;
	box-shadow: 0 0 8px 1px rgba(239, 68, 68, 0.7);
}
@keyframes breath {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.35;
	}
}

/* 提示条 */
.alert {
	display: flex;
	gap: 8px;
	align-items: center;
	margin: 14px 0 0;
	padding: 9px 12px;
	font-size: 12.5px;
	font-weight: 600;
	color: #fecaca;
	background: rgba(248, 113, 113, 0.13);
	border: 1px solid rgba(248, 113, 113, 0.42);
	border-radius: 10px;
	animation: dropIn 0.28s ease;
}
@keyframes dropIn {
	from {
		opacity: 0;
		transform: translateY(-6px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
.alert .ico {
	display: grid;
	flex: 0 0 16px;
	place-items: center;
	width: 16px;
	height: 16px;
	font-size: 11px;
	font-weight: 800;
	line-height: 1;
	color: #2a0b0b;
	background: var(--err);
	border-radius: 50%;
}
.alert.warn {
	color: #fde3b3;
	background: rgba(245, 158, 11, 0.14);
	border-color: rgba(245, 158, 11, 0.45);
}
.alert.warn .ico {
	color: #2a1a03;
	background: var(--amber);
}

/* 表单 */
.login-form {
	margin-top: 18px;
}
.field {
	display: block;
	margin-bottom: 14px;
}
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	white-space: nowrap;
	clip: rect(0 0 0 0);
}
.input-wrap {
	position: relative;
}
.input-wrap.grow {
	flex: 1 1 auto;
	min-width: 0;
}
.input-wrap .lead {
	position: absolute;
	top: 50%;
	left: 13px;
	width: 17px;
	height: 17px;
	fill: none;
	stroke: #6b7c99;
	stroke-width: 1.8;
	stroke-linecap: round;
	stroke-linejoin: round;
	pointer-events: none;
	transform: translateY(-50%);
	transition: stroke 0.18s;
}
/* 交互 ①：聚焦时前置图标与标签同步变亮 */
.field:focus-within .lead {
	stroke: #7dd3fc;
}
.field input {
	width: 100%;
	padding: 12px 14px 12px 40px;
	font-family: inherit;
	font-size: 14px;
	color: var(--ink);
	background: rgba(7, 12, 22, 0.58);
	border: 1px solid rgba(148, 163, 184, 0.22);
	border-radius: 11px;
	outline: none;
	transition:
		border-color 0.18s,
		box-shadow 0.18s,
		background 0.18s;
}
.field input::placeholder {
	color: #5f708c;
}
/* 交互 ①：输入框聚焦发光 */
.field input:focus {
	background: rgba(9, 16, 30, 0.75);
	border-color: rgba(56, 189, 248, 0.75);
	box-shadow:
		0 0 0 3px rgba(56, 189, 248, 0.14),
		0 0 24px -4px rgba(56, 189, 248, 0.65);
}
/* 交互 ⑥：出错时输入框变红 */
.field.bad input {
	border-color: rgba(248, 113, 113, 0.7);
	box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.13);
}
.field input:disabled {
	cursor: not-allowed;
	opacity: 0.55;
}

/* 交互 ②：密码显隐 */
.input-wrap input {
	padding-right: 44px;
}
.eye {
	position: absolute;
	top: 50%;
	right: 6px;
	display: grid;
	place-items: center;
	width: 32px;
	height: 32px;
	padding: 0;
	color: #7d8fa8;
	cursor: pointer;
	background: transparent;
	border: 0;
	border-radius: 8px;
	transform: translateY(-50%);
	transition:
		color 0.18s,
		background 0.18s;
}
.eye:hover {
	color: #9fd8ff;
	background: rgba(56, 189, 248, 0.12);
}
.eye.on {
	color: #7dd3fc;
}
.eye svg {
	width: 18px;
	height: 18px;
	fill: none;
	stroke: currentColor;
	stroke-width: 1.8;
	stroke-linecap: round;
	stroke-linejoin: round;
}

/* 交互 ④：大写锁定提示 */
.caps {
	display: flex;
	gap: 6px;
	align-items: center;
	height: 0;
	margin: 0;
	overflow: hidden;
	font-size: 11.5px;
	font-weight: 600;
	color: #fde3b3;
	opacity: 0;
	transition:
		height 0.24s ease,
		opacity 0.24s ease,
		margin 0.24s ease;
}
.caps.show {
	height: 26px;
	margin: -6px 0 8px;
	opacity: 1;
}
.caps .k {
	padding: 1px 5px;
	font-family: ui-monospace, Consolas, monospace;
	font-size: 10.5px;
	color: var(--amber-2);
	border: 1px solid rgba(245, 158, 11, 0.5);
	border-radius: 5px;
}

/* 验证码 */
.captcha-row {
	display: flex;
	gap: 10px;
}
.captcha {
	display: grid;
	flex: 0 0 108px;
	place-items: center;
	height: 44px;
	padding: 0;
	overflow: hidden;
	cursor: pointer;
	/* 接口返回的是浅底深字 SVG，容器必须用浅色底保证可读性 */
	background: #eef4f9;
	border: 1px solid rgba(148, 163, 184, 0.28);
	border-radius: 11px;
	transition:
		border-color 0.18s,
		transform 0.18s;
}
.captcha:hover {
	border-color: rgba(56, 189, 248, 0.7);
}
.captcha.empty {
	font-size: 12px;
	color: #334155;
}
/* 交互 ③：点击刷新旋转一圈 */
.captcha.spin {
	animation: cspin 0.45s cubic-bezier(0.4, 0.1, 0.3, 1);
}
@keyframes cspin {
	from {
		transform: rotate(0);
	}
	to {
		transform: rotate(360deg);
	}
}
.captcha :deep(svg) {
	display: block;
	width: 100%;
	height: 100%;
}

.cap-line {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 6px;
}
.cap-line .tip {
	font-size: 11px;
	color: var(--ink-mute);
	transition: color 0.3s;
}
/* 系统自动换新验证码时给一句可见反馈，用户才知道要重输 */
.cap-line .tip.fresh {
	color: #22d3ee;
}
.cd {
	font-family: ui-monospace, Consolas, monospace;
	font-size: 11.5px;
	font-weight: 700;
	color: var(--ink-mute);
	transition: color 0.3s;
}
.cd.warn {
	color: #fbbf24;
}
.cd.dead {
	color: #f87171;
}

/* 记住用户名 */
.opt-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 0 0 16px;
	font-size: 12px;
}
.opt-row .tip {
	font-size: 11px;
	color: var(--ink-mute);
}
.chk {
	display: inline-flex;
	gap: 8px;
	align-items: center;
	color: var(--ink-dim);
	cursor: pointer;
	user-select: none;
}
.chk input {
	position: absolute;
	width: 0;
	height: 0;
	opacity: 0;
}
.chk .box {
	display: grid;
	flex: 0 0 16px;
	place-items: center;
	width: 16px;
	height: 16px;
	background: rgba(7, 12, 22, 0.6);
	border: 1.5px solid rgba(148, 163, 184, 0.4);
	border-radius: 5px;
	transition: all 0.18s ease;
}
.chk .box svg {
	width: 11px;
	height: 11px;
	fill: none;
	stroke: #04121a;
	stroke-width: 2.6;
	stroke-linecap: round;
	stroke-linejoin: round;
	opacity: 0;
	transition: opacity 0.15s;
}
.chk input:checked + .box {
	background: linear-gradient(135deg, #22d3ee, #38bdf8);
	border-color: transparent;
	box-shadow: 0 2px 10px -2px rgba(34, 211, 238, 0.75);
}
.chk input:checked + .box svg {
	opacity: 1;
}

/* 交互 ⑤⑦：登录按钮三态 */
.btn {
	display: flex;
	gap: 9px;
	align-items: center;
	justify-content: center;
	width: 100%;
	padding: 13px;
	font-family: inherit;
	font-size: 15px;
	font-weight: 800;
	letter-spacing: 2px;
	color: #241503;
	cursor: pointer;
	background: linear-gradient(135deg, var(--amber), var(--amber-2));
	border: 0;
	border-radius: 12px;
	box-shadow:
		0 14px 30px -12px rgba(245, 158, 11, 0.85),
		inset 0 1px 0 rgba(255, 255, 255, 0.45);
	transition:
		transform 0.18s,
		box-shadow 0.18s,
		filter 0.18s,
		background 0.3s,
		color 0.3s;
}
.btn:hover:not(:disabled) {
	transform: translateY(-1px);
	filter: brightness(1.06);
	box-shadow: 0 18px 36px -12px rgba(245, 158, 11, 0.95);
}
.btn:active:not(:disabled) {
	transform: translateY(0);
}
.btn .sp {
	width: 15px;
	height: 15px;
	border: 2px solid rgba(36, 21, 3, 0.26);
	border-top-color: #241503;
	border-radius: 50%;
	animation: spin 0.7s linear infinite;
}
@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
.btn.ok {
	color: #04231a;
	background: linear-gradient(135deg, #10b981, #34d399);
	box-shadow: 0 14px 30px -12px rgba(16, 185, 129, 0.85);
}
.btn:disabled {
	cursor: not-allowed;
	filter: saturate(0.72) brightness(0.95);
}

.foot {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin: 15px 0 0;
	padding-top: 12px;
	font-size: 11.5px;
	line-height: 1.7;
	color: var(--ink-mute);
	border-top: 1px solid rgba(148, 163, 184, 0.14);
}
.foot b {
	font-weight: 600;
	color: #a8bdd9;
}
.foot-row {
	display: flex;
	gap: 6px;
	align-items: center;
}
.foot .clock {
	width: 12px;
	height: 12px;
	fill: none;
	stroke: currentColor;
	stroke-width: 1.8;
}

/* =========================== 入场动画（① -4） =========================== */
.anim {
	opacity: 0;
	animation: riseIn 0.72s cubic-bezier(0.22, 0.9, 0.3, 1) forwards;
}
.d0 {
	animation-delay: 0.05s;
}
.d1 {
	animation-delay: 0.14s;
}
.d2 {
	animation-delay: 0.22s;
}
.d3 {
	animation-delay: 0.3s;
}
.d4 {
	animation-delay: 0.38s;
}
.d5 {
	animation-delay: 0.46s;
}
.d6 {
	animation-delay: 0.54s;
}
.d7 {
	animation-delay: 0.62s;
}
.d8 {
	animation-delay: 0.7s;
}
@keyframes riseIn {
	from {
		opacity: 0;
		transform: translateY(16px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

/* =========================== 响应式 =========================== */
@media (max-width: 1080px) {
	.content {
		flex-direction: column;
		gap: 30px;
		padding: 40px 28px;
	}
	.brand {
		flex: 0 1 auto;
		width: 100%;
		max-width: 540px;
	}
	.pump {
		max-height: 170px;
	}
	.panel {
		flex: 0 1 auto;
		width: 100%;
		max-width: 430px;
	}
}
@media (max-width: 620px) {
	.content {
		padding: 28px 16px 36px;
	}
	.brand-head h1 {
		font-size: 20px;
	}
	.pump,
	.brand-ghost {
		display: none;
	}
	.panel {
		padding: 26px 20px 20px;
	}
	/* 窄屏改 2×2：单列整宽会把卡片拉成空荡的长条 */
	.facts li {
		flex: 1 1 calc(50% - 5px);
	}
	.chain {
		gap: 6px;
	}
	.chain li {
		padding: 4px 8px;
	}
}

/* 无障碍：系统开启「减少动态效果」时关闭全部动画 */
@media (prefers-reduced-motion: reduce) {
	.blobs i,
	.scanline,
	.pump .flow,
	.pump .flow-2,
	.pump .node,
	.chain li i,
	.anim,
	.svc .led,
	.captcha.spin,
	.panel.shake,
	.btn .sp,
	.alert {
		animation: none !important;
	}
	.anim {
		opacity: 1 !important;
		transform: none !important;
	}
	.pump .flow,
	.pump .flow-2 {
		stroke-dasharray: none;
		stroke-dashoffset: 0;
		opacity: 0.9;
	}
}
</style>
