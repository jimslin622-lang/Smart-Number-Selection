const auth = require('./utils/auth');

App({
  globalData: {
    systemInfo: { screenWidth: 375, screenHeight: 812, pixelRatio: 2 },
    user: null,
    isLoggedIn: false,
  },

  onLaunch() {
    // 获取系统信息
    try {
      if (typeof wx !== 'undefined' && wx.getWindowInfo) {
        const win = wx.getWindowInfo();
        if (win) {
          this.globalData.systemInfo = {
            screenWidth: win.windowWidth || 375,
            screenHeight: win.windowHeight || 812,
            pixelRatio: win.pixelRatio || 2,
            __raw: win
          };
        }
      }
    } catch (e) {}

    // 自动登录
    this.autoLogin();
  },

  autoLogin() {
    auth.login().then(user => {
      this.globalData.user = user;
      this.globalData.isLoggedIn = true;
      console.log('自动登录成功');
    }).catch(err => {
      console.warn('自动登录失败:', err.message);
      // 登录失败不影响使用，匿名用户也能操作
    });
  },

  // 提供给页面调用的登录方法
  login() {
    return auth.login().then(user => {
      this.globalData.user = user;
      this.globalData.isLoggedIn = true;
      return user;
    });
  },
});
