const { expo } = require('./app.json');

const androidDisplayName = process.env.APP_DISPLAY_NAME || expo.name;
const iosDisplayName = process.env.IOS_DISPLAY_NAME || androidDisplayName;
const androidAdmobAppId =
  process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || 'ca-app-pub-3940256099942544~3347511713';
const iosAdmobAppId =
  process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || 'ca-app-pub-3940256099942544~1458002511';

const plugins = (expo.plugins || []).map((plugin) => {
  if (Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads') {
    return [
      'react-native-google-mobile-ads',
      {
        ...(plugin[1] || {}),
        androidAppId: androidAdmobAppId,
        iosAppId: iosAdmobAppId,
      },
    ];
  }

  return plugin;
});

module.exports = {
  ...expo,
  name: androidDisplayName,
  plugins,
  ios: {
    ...expo.ios,
    infoPlist: {
      ...expo.ios?.infoPlist,
      CFBundleDisplayName: iosDisplayName,
    },
  },
};
