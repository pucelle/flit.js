// Proxy benchmark: https://jsperf.com/es6-proxy/11
// Proxy get and set are always 50x-100x slower than object get and set.
// Proxy can't apply any compile optimizing, it equals always call a dynamic function.


export {observe} from './shared'
export {observeCom} from './observe-com'
export {startUpdating, endUpdating, clearDependency, clearAsDependency} from './dependencies'
