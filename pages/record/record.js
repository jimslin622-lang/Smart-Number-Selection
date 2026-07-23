const { LOTTERY_MAP, BALL_COLORS, LOTTERY_TYPES } = require('../../utils/lottery');
const { safeNavigateTo } = require('../../utils/safe-navigate');
const { request } = require('../../services/request');

const TYPE_COLORS = {
  lhc: '#10b981', ssq: '#ef4444', dlt: '#f59e0b', qlc: '#ec4899',
  qxc: '#6366f1', fc3d: '#8b5cf6', pl3: '#22c55e', pl5: '#14b8a6', kl8: '#f97316'
};

const BALL_STYLE_MAP = {
  'ball-red': 'linear-gradient(135deg, #ef4444, #b91c1c)',
  'ball-blue': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  'ball-special': 'linear-gradient(135deg, #f59e0b, #d97706)',
  'ball-green': 'linear-gradient(135deg, #10b981, #047857)',
  'ball-orange': 'linear-gradient(135deg, #f97316, #ea580c)',
  'ball-pinkpurple': 'linear-gradient(135deg, #ec4899, #be185d)',
  'ball-indigopink': 'linear-gradient(135deg, #818cf8, #7c3aed)',
  'ball-violet': 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  'ball-emerald': 'linear-gradient(135deg, #34d399, #059669)',
  'ball-cyanindigo': 'linear-gradient(135deg, #22c55e, #2563eb)',
  'ball-amberred': 'linear-gradient(135deg, #fbbf24, #ef4444)',
  'red': 'linear-gradient(135deg, #ef4444, #b91c1c)',
  'blue': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
};

function buildBallList(mainNumbers, extraNumbers, lotteryCode) {
  const colors = BALL_COLORS[lotteryCode] || {};
  const mainBg = BALL_STYLE_MAP[colors.main] || 'linear-gradient(135deg, #ef4444, #b91c1c)';
  const extraBg = BALL_STYLE_MAP[colors.sub || colors.special] || 'linear-gradient(135deg, #3b82f6, #1d4ed8)';

  const list = (mainNumbers || []).map(n => ({
    num: String(n).padStart(2, '0'), bg: mainBg
  }));

  if (extraNumbers && extraNumbers.length) {
    list.push({ num: '', bg: 'transparent', sep: true });
    extraNumbers.forEach(n => {
      list.push({ num: String(n).padStart(2, '0'), bg: extraBg });
    });
  }

  return list;
}

Page({
  data: {
    history: [],
    allHistory: [],
    filter: 'all',
    filterTabs: [
      { key: 'all', label: '全部' },
      { key: 'favorite', label: '收藏' }
    ],
    lotteryFilter: 'all',
    lotteryOptions: [],
    loading: false,
  },

  onShow() {
    Promise.all([this.loadHistory(), this.loadLotteryTypes()]);
  },

  loadLotteryTypes() {
    request({ path: '/api/v1/templates' }).then(list => {
      if (list && list.length) {
        const opts = list.map(t => ({ id: t.id, name: t.name }));
        this.setData({ lotteryOptions: opts });
      }
    }).catch(() => {});
  },

  loadHistory() {
    this.setData({ loading: true });
    const lotteryCode = this.data.lotteryFilter === 'all' ? '' : this.data.lotteryFilter;
    const query = lotteryCode ? { lottery: lotteryCode } : {};
    request({ path: '/api/v1/records', query }).then(list => {
      const rawList = list || [];
      const filtered = lotteryCode ? rawList.filter(item => item.lottery_code === lotteryCode) : rawList;
      const rows = filtered.map(item => {
        const code = item.lottery_code || 'ssq';
        const typeName = LOTTERY_MAP[code]?.name || code.toUpperCase();
        return {
          id: item.id,
          type: typeName,
          typeBg: TYPE_COLORS[code] || '#4f46e5',
          numbers: item.display_text || '',
          main_numbers: item.main_numbers || [],
          extra_numbers: item.extra_numbers || [],
          ballList: buildBallList(item.main_numbers, item.extra_numbers, code),
          score: item.score || 0,
          score_dims: item.score_dims || {},
          favorite: !!item.starred,
          time: item.created_at ? new Date(item.created_at).toLocaleString('zh-CN', { hour12: false }) : '',
        };
      });
      this.setData({ allHistory: rows });
      this.applyFilter(this.data.filter);
      this.setData({ loading: false });
    }).catch(() => {});
  },

  applyFilter(filter) {
    const source = this.data.allHistory || [];
    const history = filter === 'favorite' ? source.filter(item => item.favorite) : source;
    this.setData({ history, filter });
  },

  switchFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.applyFilter(filter);
  },

  toggleFavorite(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.allHistory.find(r => String(r.id) === String(id));
    if (!item) return;
    const newFavorite = !item.favorite;
    request({
      path: '/api/v1/records/star',
      method: 'PUT',
      data: { id: Number(id), starred: newFavorite }
    }).then(() => {
      item.favorite = newFavorite;
      const allHistory = [...this.data.allHistory];
      this.setData({ history: allHistory });
      this.applyFilter(this.data.filter);
    }).catch(() => {});
  },

  copyRecord(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.history.find(record => String(record.id) === String(id));
    if (!item) return;
    wx.setClipboardData({
      data: item.numbers,
      success: () => wx.showToast({ title: '已复制号码', icon: 'success' }),
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  deleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          request({
            path: '/api/v1/records',
            method: 'DELETE',
            data: { ids: [Number(id)] }
          }).then(() => {
            const allHistory = [...this.data.allHistory];
            const newHistory = allHistory.filter(r => String(r.id) !== String(id));
            this.setData({ allHistory: newHistory });
            this.applyFilter(this.data.filter);
            wx.showToast({ title: '已删除', icon: 'success' });
          }).catch(() => {});
        }
      },
    });
  },

  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有数字记录吗？',
      success: (res) => {
        if (res.confirm) {
          const ids = this.data.allHistory.map(r => Number(r.id));
          if (ids.length === 0) return;
          request({
            path: '/api/v1/records',
            method: 'DELETE',
            data: { ids }
          }).then(() => {
            this.setData({ history: [], allHistory: [] });
            wx.showToast({ title: '已清空', icon: 'success' });
          }).catch(() => {});
        }
      },
    });
  },
});