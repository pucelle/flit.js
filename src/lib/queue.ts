import {Component} from "./component"
import {Watcher} from "./watcher"


let componentSet: Set<Component> = new Set()
let watchSet: Set<Watcher> = new Set()
let afterRenderCallbacks: (() => void)[] = []

let updatingWatchers: Watcher[]
let updateEnqueued = false
let updating = false


export function enqueueComponentUpdate(com: Component) {
	componentSet.add(com)

	if (!updateEnqueued) {
		enqueueUpdate()
	}
}

export function enqueueWatcherUpdate(watcher: Watcher) {
	// If updating watcher trigger another watcher, we should update it in the same update function.
	if (updating) {
		if (!watchSet.has(watcher)) {
			updatingWatchers.unshift(watcher)
		}
	}
	else {
		watchSet.add(watcher)
	}

	if (!updateEnqueued) {
		enqueueUpdate()
	}
}

/** Call callback after next rendered all the components in next micro task. */
export function onRendered(callback: () => void) {
	afterRenderCallbacks.push(callback)
	
	if (!updateEnqueued) {
		enqueueUpdate()
	}
}

/** Returns a promise which will be resolved after rendered all the components in next micro task. */
export function renderComplete(): Promise<void> {
	return new Promise(resolve => {
		onRendered(resolve)
	})
}

function enqueueUpdate() {
	updateEnqueued = true

	// Why not using `Promise.resolve().then` to start a micro stask:
	// When initialize a component from `connectCallback`, it's child nodes is not ready,
	// even in the following micro task queue.
	// Very frequently data changing trigger updating,
	// but then more data changes in micro tasks and trigger new updating.
	requestAnimationFrame(update)
}

function update() {
	updating = true
	updatingWatchers = [...watchSet]

	let watcherUpdatedTimesMap: Map<Watcher, number> = new Map()

	/**
	 * When updating watch, data may changed and enqueu more watcher and component.
	 * if enqueued more watch, we will run it in the same update function.
	 * 
	 * The only problems at ignore watch orders when updating is that:
	 * We may update inside firstly, and then outside, then data may flow back into inside. 
	 */
	for (let i = 0; i < updatingWatchers.length; i++) {
		let watcher = updatingWatchers[i]
		watchSet.delete(watcher)

		let updatedTimes = watcherUpdatedTimesMap.get(watcher) || 0
		watcherUpdatedTimesMap.set(watcher, updatedTimes + 1)

		if (updatedTimes > 3) {
			watcher.warnMayInfiniteUpdating()
		}
		else {
			try {
				watcher.__updateImmediately()
			}
			catch (err) {
				console.error(err)
			}
		}
	}

	/**
	 * All the data should be prepared, and no data should be changed unexpected.
	 * Should never enqueue any watcher and component updating.
	 * Observer capturing should be locked.
	 */
	for (let com of componentSet) {
		try {
			com.__updateImmediately()
		}
		catch (err) {
			console.error(err)
		}
	}

	for (let callback of afterRenderCallbacks) {
		callback()
	}

	/**
	 * If it doest enqueued some watcher or component updating.
	 * They will be removed here.
	 */
	// Benchmark: https://jsperf.com/map-clear-vs-new-map, It moves the clear time to GC.
	watchSet = new Set()
	componentSet = new Set()
	afterRenderCallbacks = []

	updateEnqueued = false
	updating = false
}
