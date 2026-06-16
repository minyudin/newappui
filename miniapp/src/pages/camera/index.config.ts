export default definePageConfig({
  // 默认快照模式 → 标题改成更准确的"现场画面"
  navigationBarTitleText: '现场画面',
  // Folio 风 paper 浅底, 不再用全黑
  navigationBarBackgroundColor: '#f5f1e8',
  navigationBarTextStyle: 'black',
  backgroundColor: '#f5f1e8',
  // 快照模式开启下拉刷新, live 模式不影响 (web-view 全屏遮蔽)
  enablePullDownRefresh: true,
  backgroundTextStyle: 'dark',
})
