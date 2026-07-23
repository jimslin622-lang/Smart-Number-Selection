let navigating = false;
let lastUrl = '';
let lastAt = 0;

function resetSoon() {
  setTimeout(() => {
    navigating = false;
    lastUrl = '';
  }, 800);
}

function safeNavigateTo(url) {
  const now = Date.now();
  if (!url) return;
  if (navigating || (lastUrl === url && now - lastAt < 1000)) return;

  navigating = true;
  lastUrl = url;
  lastAt = now;

  wx.navigateTo({
    url,
    success() {
      resetSoon();
    },
    fail(err) {
      navigating = false;
      lastUrl = '';
      console.error('[navigateTo failed]', url, err);
      wx.showToast({ title: '页面打开失败，请稍后重试', icon: 'none' });
    },
  });
}

function safeSwitchTab(url) {
  const now = Date.now();
  if (!url) return;
  if (navigating || (lastUrl === url && now - lastAt < 1000)) return;

  navigating = true;
  lastUrl = url;
  lastAt = now;

  wx.switchTab({
    url,
    success() {
      resetSoon();
    },
    fail(err) {
      navigating = false;
      lastUrl = '';
      console.error('[switchTab failed]', url, err);
      wx.showToast({ title: '页面切换失败，请稍后重试', icon: 'none' });
    },
  });
}

module.exports = { safeNavigateTo, safeSwitchTab };
