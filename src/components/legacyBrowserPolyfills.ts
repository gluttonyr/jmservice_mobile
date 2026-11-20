// Website on older phones: the navigation (expo-router), the animations (reanimated), react-native-svg and
// the gesture handler call recent JavaScript functions (Chrome 97+ / Safari 15.4+). On an older Android
// browser or iPhone, the first navigation after the splash threw an error and left only the blue background.
// Each function is added only when the browser lacks it; recent browsers and the native app are untouched.
/* eslint-disable no-extend-native */

function define(target: object, name: string, value: unknown) {
  if (!(name in target)) {
    Object.defineProperty(target, name, { value, writable: true, configurable: true, enumerable: false });
  }
}

const arrayProto = Array.prototype as any;

define(arrayProto, 'at', function (this: any[], index: number) {
  const i = Math.trunc(index) || 0;
  return this[i < 0 ? this.length + i : i];
});
define(String.prototype, 'at', function (this: string, index: number) {
  const i = Math.trunc(index) || 0;
  return this.charAt(i < 0 ? this.length + i : i) || undefined;
});
define(arrayProto, 'findLast', function (this: any[], fn: (v: any, i: number, a: any[]) => unknown, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) if (fn.call(thisArg, this[i], i, this)) return this[i];
  return undefined;
});
define(arrayProto, 'findLastIndex', function (this: any[], fn: (v: any, i: number, a: any[]) => unknown, thisArg?: unknown) {
  for (let i = this.length - 1; i >= 0; i--) if (fn.call(thisArg, this[i], i, this)) return i;
  return -1;
});
define(Object, 'hasOwn', (obj: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(obj, key));

const g = globalThis as any;
if (typeof g.structuredClone !== 'function') {
  // Only used on plain animation data (numbers, strings, arrays, objects).
  g.structuredClone = (value: unknown) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
}
if (typeof g.queueMicrotask !== 'function') {
  g.queueMicrotask = (fn: () => void) => { Promise.resolve().then(fn); };
}
if (typeof g.requestIdleCallback !== 'function') {
  g.requestIdleCallback = (fn: (d: { didTimeout: boolean; timeRemaining: () => number }) => void) =>
    setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 0 }), 1);
  g.cancelIdleCallback = (id: number) => clearTimeout(id);
}

export {};
