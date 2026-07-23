const { request } = require('../../services/request');
const { login, getCachedUser, clearAuth } = require('../../utils/auth');

Page({
  data: {
    user: null,
    isLoggedIn: false,
    nickname: '',
    avatarUrl: '',
    stats: {
      total: 0,
      starred: 0,
      byLottery: [],
    },
    loading: false,
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    this.setData({ loading: true });

    const cached = getCachedUser();
    if (cached) {
      this.setData({
        user: cached,
        isLoggedIn: true,
        nickname: cached.nickname || '',
        avatarUrl: cached.avatar_url || '',
      });
    }

    login().then(user => {
      this.setData({
        user,
        isLoggedIn: true,
        nickname: user.nickname || '',
        avatarUrl: user.avatar_url || '',
      });
      this.loadStats();
    }).catch(err => {
      console.error('login error', err);
      this.setData({ loading: false });
    });
  },

  loadStats() {
    request({ path: '/api/v1/auth/me' }).then(data => {
      if (data && data.stats) {
        this.setData({ stats: data.stats });
      }
      this.setData({ loading: false });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  getUserProfile() {
    const app = getApp();
    app.login().then(user => {
      this.setData({
        user,
        isLoggedIn: true,
      });
      this.loadStats();
    }).catch(() => {
      wx.showToast({ title: '登录失败', icon: 'none' });
    });
  },

  goRecord() {
    wx.reLaunch({ url: '/pages/record/record' });
  },

  exportAll() {
    request({ path: '/api/v1/records', query: { limit: 200 } }).then(records => {
      if (!records || !records.length) {
        wx.showToast({ title: '暂无记录可导出', icon: 'none' });
        return;
      }

      const now = new Date();
      let txt = '═══════════════════════════════════════\n';
      txt += '智能随机助手 - 全部记录导出\n';
      txt += '导出时间：' + now.toLocaleString('zh-CN', { hour12: false }) + '\n';
      txt += '共 ' + records.length + '条记录\n';
      txt += '═══════════════════════════════════════\n\n';

      records.forEach((r, i) => {
        const ms = (r.main_numbers || []).map(n => String(n).padStart(2, '0')).join(' ');
        const es = r.extra_numbers && r.extra_numbers.length ? ' + ' + r.extra_numbers.map(n => String(n).padStart(2, '0')).join(' ') : '';
        txt += '第 ' + (i + 1) + '注：' + ms + es + '\n';
        txt += '玩法：' + (r.lottery_code || '') + '玩法：' + (r.method_name || '') + '评分：' + (r.score || 0) + '\n';
        txt += '时间：' + (r.created_at || '') + '\n\n';
      });

      txt += '═══════════════════════════════════════\n';
      txt += '仅供参考 · 理性娱乐 · 量力而行\n';
      txt += '═══════════════════════════════════════';

      wx.setClipboardData({
        data: txt,
        success: () => wx.showToast({ title: '已复制到剪贴板', icon: 'success' }),
      });
    }).catch(() => {
      wx.showToast({ title: '获取记录失败', icon: 'none' });
    });
  },

  clearAll() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有数字记录吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          request({ path: '/api/v1/records', method: 'DELETE', data: { ids: [-1] } }).then(() => {
            this.setData({ stats: { total: 0, starred: 0, byLottery: [] } });
            wx.showToast({ title: '已清空', icon: 'success' });
          }).catch(() => {
            wx.showToast({ title: '清空失败', icon: 'none' });
          });
        }
      },
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新登录才能查看记录',
      success: (res) => {
        if (res.confirm) {
          clearAuth();
          this.setData({
            user: null,
            isLoggedIn: false,
            nickname: '',
            avatarUrl: '',
            stats: { total: 0, starred: 0, byLottery: [] },
          });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      },
    });
  },

  showAbout() {
    wx.showModal({
      title: '关于',
      content: '智能随机助手 v0.1.0\n\n本工具仅供娱乐参考，不对应任何现实业务场景。\n理性娱乐，量力而行。',
      showCancel: false,
    });
  },
});