module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // ⚠️ Reanimated 플러그인은 가장 마지막에 둡니다
      'react-native-reanimated/plugin',
    ],
  };
};
