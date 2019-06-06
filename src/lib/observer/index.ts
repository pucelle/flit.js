// Proxy benchmark: https://jsperf.com/es6-proxy/11
// Proxy getting and setting are always 50x-100x slower than plain object.
// Proxy can't apply any compile optimizing, it equals always call a dynamic function.


export {observe, observeTarget, targetMap, proxyMap, } from './shared'
export {observeComTarget} from './observe-com'
export {startUpdating, endUpdating, clearDependencies, clearAsDependency, restoreAsDependency} from './dependency'

