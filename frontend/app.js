const { getDeviceId } = require('./utils/device');

App({
  globalData: {
    systemInfo: { screenWidth: 375, screenHeight: 812, pixelRatio: 2 },
    deviceId: '',
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

    // 初始化设备标识（未登录时用它区分用户归属，无需微信登录）
    this.globalData.deviceId = getDeviceId();
  },
});
