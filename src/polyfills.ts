// Load `$localize` onto the global scope - used if i18n tags appear in Angular templates.
import '@angular/localize/init';
// https://stackoverflow.com/a/51232137
(window as any).process = {
    env: { DEBUG: undefined },
    version: [],
    browser: true
};

// Add global to window, assigning the value of window itself.
// (window as any).global = window;
global.Buffer = global.Buffer || require('buffer').Buffer;

// Zone JS is included with and required by default for Angular itself.
import 'zone.js';

// Application imports
import 'core-js/stable';
