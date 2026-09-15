/**
 * @format
 */

// MUST be the first import.
//
// @supabase/realtime-js decodes incoming socket frames with
// TextDecoder, which Hermes does not provide on iOS. Without this
// polyfill every realtime channel throws
//   ReferenceError: Property 'TextDecoder' doesn't exist
// and silently stops delivering — which broke incoming calls, live
// presence and realtime notifications on iOS while Android (whose
// Hermes build does expose it) worked fine, making it look like a
// platform quirk rather than a missing polyfill.
import 'text-encoding-polyfill';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
