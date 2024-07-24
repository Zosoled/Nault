// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/bundles/zone'
import 'zone.js/bundles/long-stack-trace-zone';
import 'zone.js/bundles/proxy.js';
import 'zone.js/bundles/sync-test';
import 'zone.js/bundles/jasmine-patch';
import 'zone.js/bundles/async-test';
import 'zone.js/bundles/fake-async-test';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

// Unfortunately there's no typing for the `__karma__` variable. Just declare it as any.
declare const __karma__: any;
declare const require: any;

// Prevent Karma from running prematurely.
__karma__.loaded = function () {};

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(), {
    teardown: { destroyAfterEach: false }
}
);
// Then we find all the tests.
const context = require.context('./', true, /\.spec\.ts$/);
// And load the modules.
context.keys().map(context);
// Finally, start Karma to run the tests.
__karma__.start();
