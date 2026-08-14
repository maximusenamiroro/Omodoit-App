const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        // Rewrites top-level imports into require() calls at the point
        // of first use, so a module is only evaluated when something
        // actually touches it.
        //
        // This matters here more than in most apps: AppNavigator
        // imports ~30 screen modules statically, so every screen in
        // the app — plus everything each one pulls in (maps, video,
        // Agora calling) — was parsed and evaluated before the first
        // frame could paint. Deferring that is the single largest
        // startup win available without restructuring navigation.
        inlineRequires: true,

        // Modules that must keep running at import time, in order.
        // gesture-handler in particular has to initialise before any
        // navigation/gesture code touches it — inlining its import
        // would defer that past the point where it's needed and break
        // gestures in ways that are painful to trace back to here.
        nonInlinedRequires: [
          'react',
          'React',
          'react-native',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          'react-native-gesture-handler',
          'react-native-url-polyfill/auto',
          'react-native-reanimated',
        ],
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
