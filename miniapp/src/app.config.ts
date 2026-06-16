export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/home/index',
    'pages/adopter-login/index',
    'pages/operator-login/index',
    'pages/guest-login/index',
    'pages/setup-nickname/index',
    'pages/share-codes/index',
    'pages/operator-workbench/index',
    'pages/adoptions/index',
    'pages/ai-assist/index',
    'pages/plot/index',
    'pages/ai-chat/index',
    'pages/redeem/index',
    'pages/task/index',
    'pages/task-detail/index',
    'pages/camera/index',
    'pages/me/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#e8e8e5',
    navigationBarTitleText: '陇上管家',
    navigationBarTextStyle: 'black',
    backgroundColor: '#e8e8e5',
  },
  tabBar: {
    // custom: true · 我自己画 Folio 风 tabBar, 就不用提供 iconPath PNG 了
    custom: true,
    color: '#8a857b',
    selectedColor: '#2d2a26',
    backgroundColor: '#e8e8e5',
    borderStyle: 'white',
    list: [
      // 微信要求 tabBar.list 至少 2 项, 最多 5 项. 这里登记 5 个候选页,
      // 实际显隐由 src/custom-tab-bar/index.tsx 按 roleType 控制.
      {
        pagePath: 'pages/home/index',
        text: '首页',
      },
      {
        pagePath: 'pages/operator-workbench/index',
        text: '工作台',
      },
      {
        pagePath: 'pages/adoptions/index',
        text: '认养',
      },
      {
        pagePath: 'pages/ai-assist/index',
        text: 'AI询问',
      },
      {
        pagePath: 'pages/me/index',
        text: '我的',
      },
    ],
  },
})
