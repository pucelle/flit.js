import {Component} from '../component'
import {LazyWatcher, Watcher} from './watcher'


/** 
 * Indicates what we are updating.
 * Updating at a stage may cause new items added into following stages.
 */
enum UpdatingStage {

	/** No updata tasks. */
	NotStarted,

	/** Will update in next animation frame. */
	Prepended,

	UpdatingUpdatable,
	UpdatingLazyWatchers,
	CallingCallbacks,

	/** Update End. */
	End,
}


/** A binding or directive can be updated. */
interface Updatable {
	__updateImmediately(): void
}


/** Components wait to be updated. */
let updatableSet: Set<Updatable> = new Set()
let updatables: Updatable[] = []

/** Watchers wait to be updated. */
let lazyWatcherSet: Set<LazyWatcher> = new Set()
let lazyWatchers: LazyWatcher[] = []

/** Callbacks wait to be called after all the things update. */
let renderCompleteCallbacks: (() => void)[] = []

/** Cache the updated time of watchers and components. */
let updatedTimesMap: Map<Updatable, number> = new Map()

/** What's updating right now. */
let updatingStage: UpdatingStage = UpdatingStage.NotStarted


/** When a component should be updated. */
export function enqueueUpdatable(upt: Updatable) {
	if (updatableSet.has(upt)) {
		return
	}

	if (updatingStage >= UpdatingStage.UpdatingUpdatable) {
		if (!validateUpdateTimes(upt)) {
			return
		}
	}

	updatableSet.add(upt)
	updatables.push(upt)
	enqueueUpdateIfNot()

	// Must after enqueueUpdateIfNot.
	if (updatingStage > UpdatingStage.UpdatingUpdatable) {
		updatingStage = UpdatingStage.UpdatingUpdatable
	}
}


/** When a lazy watcher should be updated. */
export function enqueueLazyWatcher(watcher: Watcher) {
	if (lazyWatcherSet.has(watcher)) {
		return
	}

	if (updatingStage >= UpdatingStage.UpdatingLazyWatchers) {
		if (!validateUpdateTimes(watcher)) {
			return
		}
	}
	lazyWatcherSet.add(watcher)
	lazyWatchers.push(watcher)
	enqueueUpdateIfNot()

	// Must after enqueueUpdateIfNot.
	if (updatingStage > UpdatingStage.UpdatingLazyWatchers) {
		updatingStage = UpdatingStage.UpdatingLazyWatchers
	}
}


/** Warn if component updated for many times. */
function validateUpdateTimes(upt: Updatable): boolean {

	// We currently just check the count of updating times, if exceed 3 then warn.
	// 
	// A better way should be analysising dependency tree:
	//     Get current watcher referenced objects,
	//     then get their referenced watchers,
	//     then check if current watcher in it.

	let updatedTimes = updatedTimesMap.get(upt) || 0
	updatedTimesMap.set(upt, updatedTimes + 1)
	
	if (updatedTimes > 3) {
		if (upt instanceof Component) {
			console.warn(upt, `may change values in the render function and cause infinite updating!`)
		}
		else if (upt instanceof Watcher) {
			console.warn(upt, `may change values in the watcher callback and cause infinite updating!`)
		}
		else if (upt instanceof Watcher) {
			console.warn(upt, `may change values in callback and cause infinite updating!`)
		}

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

	// Why doesn't use `Promise.resolve().then` to start a micro stask normally:
	// When initialize a component from `connectedCallback`,
	// it's child nodes especially elements of child components are not ready,
	// even in the following micro task queue.
	// Wait for `requestAnimationFrame` will make child nodes prepared.

	// Otherwise it's very frequently to trigger updating since data are always in changing,
	// Uses `requestAnimationFrame` can handle less data channing and callbaks.

	// But sill need to wait for a micro tick,
	// because more components will be connected in next micro task.

	if (updatingStage === UpdatingStage.NotStarted) {
		requestAnimationFrame(update)
		updatingStage = UpdatingStage.Prepended
	}
}

async function update() {

	if (updatingStage === UpdatingStage.Prepended) {
		updatingStage = UpdatingStage.UpdatingUpdatable
	}

	while (updatingStage !== UpdatingStage.End) {

		// Stage 1, updating watchers, components and other updatable, may cause more components or watchers to update.
		if (updatingStage === UpdatingStage.UpdatingUpdatable) {
			for (let i = 0; i < updatables.length; i++) {
				let upt = updatables[i]
				updatableSet.delete(upt)

				try {
					upt.__updateImmediately()
				}
				catch (err) {
					console.error(err)
				}
			}

			updatables = []
			updatingStage = UpdatingStage.UpdatingLazyWatchers
		}

		// Stage 2, all components and watchers become stable now.
		else if (updatingStage === UpdatingStage.UpdatingLazyWatchers) {
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

			if (updatingStage === UpdatingStage.UpdatingLazyWatchers) {
				updatingStage = UpdatingStage.CallingCallbacks
				
				// May reset state in the micro task tick.
				await Promise.resolve()
			}
		}

		else if (updatingStage === UpdatingStage.CallingCallbacks) {
			for (let i = 0; i < renderCompleteCallbacks.length; i++) {
				try {
					renderCompleteCallbacks[i]()
				}
				catch (err) {
					console.error(err)
				}
			}
		
			renderCompleteCallbacks = []

			if (updatingStage === UpdatingStage.CallingCallbacks) {
				updatingStage = UpdatingStage.End

				// May reset state in the micro task tick.
				await Promise.resolve()
			}
		}
	}



	// Will back to start stage.
	// But still wait for a short micro task tick to see if there is new updating requests come.
	updatedTimesMap = new Map()
	updatingStage = UpdatingStage.NotStarted
}
