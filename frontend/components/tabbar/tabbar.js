Component({
  data: {
    list: [
      {
        pagePath: '/pages/index/index',
        text: '首页',
        iconPath: '/assets/icons/home.png',
        selectedIconPath: '/assets/icons/home-active.png',
        key: 'index'
      },
      {
        pagePath: '/pages/record/record',
        text: '记录',
        iconPath: '/assets/icons/record.png',
        selectedIconPath: '/assets/icons/record-active.png',
        key: 'record'
      },
      {
        pagePath: '/pages/profile/profile',
        text: '我的',
        iconPath: '/assets/icons/profile.png',
        selectedIconPath: '/assets/icons/profile-active.png',
        key: 'profile'
      }
    ],
    current: ''
  },

  lifetimes: {
    attached() {
      this.updateCurrent();
    }
  },

  pageLifetimes: {
    show() {
      this.updateCurrent();
    }
  },

  methods: {
    updateCurrent() {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      if (!currentPage) return;
      const route = '/' + currentPage.route;
      const list = this.data.list;
      for (const item of list) {
        if (item.pagePath === route) {
          this.setData({ current: item.key });
          return;
        }
      }
      this.setData({ current: '' });
    },

    onTabTap(e) {
      const { page } = e.currentTarget.dataset;
      const current = this.data.current;
      const target = this.data.list.find(item => item.pagePath === page);
      const targetKey = target ? target.key : '';
      if (targetKey && targetKey === current) return;

      // 使用 reLaunch 跳转，确保页面重新加载，current 正确显示
      wx.reLaunch({ url: page });
    }
  }
});