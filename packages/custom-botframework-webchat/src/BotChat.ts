export { App, AppProps } from './App';
export { Chat, ChatProps } from './Chat';
export * from '@bfemulator/custom-botframework-directlinejs';
export { queryParams } from './Attachment';
export { SpeechOptions } from './SpeechOptions'
export { Speech } from './SpeechModule'
export { createStore } from './Store';
export { FormatOptions } from './Types';
// below are shims for compatibility with old browsers (IE 10 being the main culprit)
import 'core-js/modules/es6.string.starts-with';
import 'core-js/modules/es6.array.find';
import 'core-js/modules/es6.array.find-index';
