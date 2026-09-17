export default defineNuxtConfig({
	// 国内网络下禁用远程字体 provider，避免 google/googleicons 请求超时拖慢或卡死构建。
	// 图标走本地已安装的 @iconify-json/lucide 集合，不依赖网络。
	// 注：根配置回归公共基线后由设备层携带此配置；组长后续可通过 Contract Change 移至根配置。
	fonts: {
		providers: {
			google: false,
			googleicons: false,
			fontsource: false,
		},
	},
})
