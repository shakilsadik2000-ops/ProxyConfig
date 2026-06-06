/**
 * App entry point — registers the root component with the native runtime.
 */
import 'react-native-gesture-handler'; // must be the first import for RNGH
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
