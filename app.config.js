const { expo } = require('./app.json');

const androidDisplayName = process.env.APP_DISPLAY_NAME || expo.name;
const iosDisplayName = process.env.IOS_DISPLAY_NAME || androidDisplayName;

module.exports = {
  ...expo,
  name: androidDisplayName,
  ios: {
    ...expo.ios,
    infoPlist: {
      ...expo.ios?.infoPlist,
      CFBundleDisplayName: iosDisplayName,
    },
  },
};
