import type {Component} from '../component'
import {Watcher} from './watcher'


/** Indicates what we are updating. */
enum UpdatingStage {
	NotStarted,
	Prepended,
	UpdatingWatchers,
	UpdatingComponents,
	UpdatingLazyWatchers,
	CallingCallbacks,
}


/** Components wait to be updated. */
let componentSet: Set<Component> = new Set()
let components: Component[] = []

/** Watchers wait to be updated. */
let normalWatcherSet: Set<Watcher> = new Set()
let lazyWatcherSet: Set<Watcher> = new Set()
let normalWatchers: Watcher[] = []
let lazyWatchers: Watcher[] = []

/** Callbacks wait to be called after all the things update. */
let renderCompleteCallbacks: (() => void)[] = []

/** Cache the updated time of watchers and components. */
let updatedTimesMap: Map<Watcher | Component, number> = new Map()

/** What's updating right now. */
let updatingStage: UpdatingStage = UpdatingStage.NotStarted


/** When a component should be updated. */
export function enqueueComponents(com: Component) {
	if (componentSet.has(com)) {
		return
	}

	if (updatingStage >= UpdatingStage.UpdatingComponents) {
		if (!validateComponentUpdateTimes(com)) {
			return
		}
	}

	if (updatingStage > UpdatingStage.UpdatingComponents) {
		com.__updateImmediately()
	}
	else {
		componentSet.add(com)
		components.push(com)
		enqueueUpdateIfNot()
	}
}


/** When a watcher should be updated. */
export function enqueueWatcher(watcher: Watcher) {
	if (normalWatcherSet.has(watcher)) {
		return
	}

	if (updatingStage >= UpdatingStage.UpdatingWatchers) {
		if (!validateWatcherUpdateTimes(watcher)) {
			return
		}
	}

	if (updatingStage > UpdatingStage.UpdatingWatchers) {
		watcher.__updateImmediately()
	}
	else {
		normalWatcherSet.add(watcher)
		normalWatchers.push(watcher)
		enqueueUpdateIfNot()
	}
}


/** When a lazy watcher should be updated. */
export function enqueueLazyWatcher(watcher: Watcher) {
	if (lazyWatcherSet.has(watcher)) {
		return
	}

	if (updatingStage >= UpdatingStage.UpdatingLazyWatchers) {
		if (!validateWatcherUpdateTimes(watcher)) {
			return
		}
	}

	if (updatingStage > UpdatingStage.UpdatingLazyWatchers) {
		watcher.__updateImmediately()
	}
	else {
		lazyWatcherSet.add(watcher)
		lazyWatchers.push(watcher)
		enqueueUpdateIfNot()
	}
}


/** Warn if component updated for many times. */
function validateComponentUpdateTimes(com: Component): boolean {

	// We currently just check the count of updating times, if exceed 3 then warn.
	// 
	// A better way should be analysising dependency tree:
	//     Get current watcher referenced objects,
	//     then get their referenced watchers,
	//     then check if current watcher in it.

	let updatedTimes = updatedTimesMap.get(com) || 0
	updatedTimesMap.set(com, updatedTimes + 1)
	
	if (updatedTimes > 3) {
		let html = com.el.outerHTML
		let shortHTML = html.length > 100 ? html.slice(0, 100) + '...' : html
		console.warn(`Component with element "${shortHTML}" may change values in the render function and cause infinite updating!`)

		return false
	}

	return true
}


/** Warn if watcher updated for many times. */
function validateWatcherUpdateTimes(watcher: Watcher) {
	let updatedTimes = updatedTimesMap.get(watcher) || 0
	updatedTimesMap.set(watcher, updatedTimes + 1)

	if (updatedTimes > 3) {
		console.warn(`Watcher "${watcher.toString()}" may change values in the watcher callback and cause infinite updating!`)
		return false
	}

	return true
}

/** 
 * Calls `callback` after all the components and watchers updated and rendering completed.
 * Note that it was called before `renderComplete`.
 */
export function onRenderComplete(callback: () => void) {
	renderCompleteCallbacks.push(callback)
	enqueueUpdateIfNot()
}

/** 
 * Returns a promise which will be resolved after all the components and watchers updated and rendering completed.
 * Note that it was called after `onRenderComplete`.
 */
export function renderComplete(): Promise<void> {
	return new Promise(resolve => {
		onRenderComplete(resolve)
	})
}


function enqueueUpdateIfNot() {
	// Why doesn't use `Promise.resolve().then` to start a micro stask:
	// When initialize a component from `connectedCallback`,
	// it's child nodes especially elements of child components are not ready,
	// even in the following micro task queue.
	// Wait for `requestAnimationFrame` will make child nodes prepared.

	// Otherwise it's very frequently to trigger updating since data are always in changing,
	// Uses `requestAnimationFrame` can handle less data channing and callbaks.

	if (updatingStage === UpdatingStage.NotStarted) {
		requestAnimationFrame(update)
		updatingStage = UpdatingStage.Prepended
	}
}

async function update() {

	// At beginning, we update watchers firstly and then components,
	// because we want to reduce the sencories that data changing in watchers cause components to updated.
	
	// But later we relaized the watchers were updated most possible because the components updated and applies `.property`.
	// So updating watchers later can ensure components which requires the watched properties are rendered.

	// So finally we decided to update watchers before components,
	// And if components are updating, we update watchers immediately.
	
	// Stage 1
	updatingStage = UpdatingStage.UpdatingWatchers

	for (let i = 0; i < normalWatchers.length; i++) {
		let watcher = normalWatchers[i]
		normalWatcherSet.delete(watcher)

		try {
			watcher.__updateImmediately()
		}
		catch (err) {
			console.error(err)
		}
	}
	
	normalWatchers = []


	// Stage 2
	updatingStage = UpdatingStage.UpdatingComponents

	for (let i = 0; i < components.length; i++) {
		let com = components[i]
		componentSet.delete(com)

		try {
			com.__updateImmediately()
		}
		catch (err) {
			console.error(err)
		}
	}

	components = []


	// Stage 3
	updatingStage = UpdatingStage.UpdatingLazyWatchers

	for (let i = 0; i < lazyWatchers.length; i++) {
		let watcher = lazyWatchers[i]
		lazyWatcherSet.delete(watcher)

		try {
			watcher.__updateImmediately()
		}
		catch (err) {
			console.error(err)
		}
	}
	
	lazyWatchers = []


	// Stage 4
	updatingStage = UpdatingStage.CallingCallbacks

	for (let i = 0; i < renderCompleteCallbacks.length; i++) {
		renderCompleteCallbacks[i]()
	}

	renderCompleteCallbacks = []


	// Back to start stage.
	updatedTimesMap = new Map()
	updatingStage = UpdatingStage.NotStarted
}
