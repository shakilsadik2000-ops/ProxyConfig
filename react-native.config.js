/**
 * React Native CLI config. Tells the asset linker which custom fonts to bundle
 * (only the icon set we actually use, to keep the APK small).
 */
module.exports = {
  project: {
    android: {},
  },
  assets: ['./node_modules/react-native-vector-icons/Fonts/Feather.ttf'],
};
