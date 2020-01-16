// Proxy benchmark: https://jsperf.com/es6-proxy/11
// Proxy getting and setting are always 50x-100x slower than plain object.
// Proxy can't apply any compile optimizing, it equals always call a dynamic function.


export {observeTarget, getObservedTarget} from './shared'
export {observe} from './observe'
export {observeComTarget} from './observe-com'
export {startUpdating, endUpdating, clearDependencies, clearAsDependency, restoreAsDependency} from './dependency'
export {observeGetter} from './observe-getter'
