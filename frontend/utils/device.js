const DEVICE_KEY = 'device_id';

function generateId() {
  const chars = 'abcdef0123456789';
  let s = '';
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * 16)];
  return 'dev_' + s;
}

function getDeviceId() {
  try {
    let id = wx.getStorageSync(DEVICE_KEY);
    if (!id) {
      id = generateId();
      wx.setStorageSync(DEVICE_KEY, id);
    }
    return id;
  } catch (e) {
    return generateId();
  }
}

module.exports = { getDeviceId };
