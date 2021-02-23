import {WatcherGroup} from './watcher-group'


/** Global watcher group to watch scattered things that not belongs to a component. */
export const GlobalWatcherGroup = new WatcherGroup(null)


/** 
 * Watchs returned value of `fn` and calls `callback` with this value as parameter if the value changed.
 * @param fn The watched function.
 * @param callback Get called after returned value of `fn` may changed.
 */
export function watch<T>(fn: () => T, callback: (value: T) => void): () => void {
	return GlobalWatcherGroup.watch(fn, callback)
}

/** 
 * Watchs returned value of `fn` and calls `callback` with this value as parameter if the value changed.
 * Will call `callback` immediately.
 * @param fn The watched function.
 * @param callback Get called after returned value of `fn` may changed.
 */
export function watchImmediately<T>(fn: () => T, callback: (value: T) => void): () => void {
	return GlobalWatcherGroup.watchImmediately(fn, callback)
}

/** 
 * Watchs returned value of `fn` and calls `callback` with this value as parameter if the value changed.
 * Only calls `callback` for once.
 * @param fn The watched function.
 * @param callback Get called after returned value of `fn` may changed.
 */
export function watchOnce<T>(fn: () => T, callback: (value: T) => void): () => void {
	return GlobalWatcherGroup.watchOnce(fn, callback)
}

/** 
 * Watchs returneded values of `fn` and calls `callback` if this value becomes true like.
 * @param fn The watched function.
 * @param callback Get called after returned value of `fn` may changed.
 */
export function watchUntil<T>(fn: () => any, callback: (value: T) => void): () => void {
	return GlobalWatcherGroup.watchUntil(fn, callback)
}


/** 
 * Updates all the global watchers registered from `watch...()`.
 * e.g., you may call this after language changes and not automatically detected.
 */
export function updateAllGlobalWatchers() {
	GlobalWatcherGroup.update()
}
