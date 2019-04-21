import {Component} from './component'
import {Watcher} from './watcher'


let componentSet: Set<Component> = new Set()
let watchSet: Set<Watcher> = new Set()
let afterRenderCallbacks: (() => void)[] = []
let willUpdate = false
let updatingWatchers: Watcher[] = []
let updatingComponents: Component[] = []


export function enqueueComponentUpdate(com: Component) {
	// If updating component trigger another watcher or component, we should update it in the same update function.
	if (!componentSet.has(com)) {
		componentSet.add(com)
		updatingComponents.push(com)
	}

	if (!willUpdate) {
		enqueueUpdate()
	}
}

export function enqueueWatcherUpdate(watcher: Watcher) {
	// If updating watcher trigger another watcher or component, we should update it in the same update function.
	if (!watchSet.has(watcher)) {
		watchSet.add(watcher)
		updatingWatchers.push(watcher)
	}

	if (!willUpdate) {
		enqueueUpdate()
	}
}

/** 
 * Call callback after next rendered all the components in next micro task.
 * Note that it will call callback immediately if no updating tasks enqueued.
 */
export function onRenderComplete(callback: () => void) {
	afterRenderCallbacks.push(callback)
	
	if (!willUpdate) {
		enqueueUpdate()
	}
}

/** 
 * Returns a promise which will be resolved after rendered all the components in next micro task.
 * Note that it will call callback in the next micro task if no updating tasks enqueued.
 * Please don't call `await renderComplete()` for two times,
 * The second one will be called in a new `requestAnimationFrame` and browser will render before it.
 */
export function renderComplete(): Promise<void> {
	return new Promise(resolve => {
		onRenderComplete(resolve)
	})
}

function enqueueUpdate() {
	// Why not using `Promise.resolve().then` to start a micro stask:
	// When initialize a component from `connectedCallback`, it's child nodes is not ready,
	// even in the following micro task queue.
	// But we need `<slot>` elemnts to be prepared before updating.

	// Otherwise it's very frequently to trigger updating from data changing ,
	// but then more data changes in micro tasks and trigger new updating.
	requestAnimationFrame(update)
	
	willUpdate = true
}

async function update() {
	let updatedTimesMap: Map<Watcher | Component, number> = new Map()

	do {
		// At beginning, we update watchers firstly and then components,
		// because we want to reduce the sencories that data changing in watchers cause components to updated.
		
		// But later we relaized the watchers were updated most possible because the components updated and applied `:prop` or `:props`,
		// And updating watchers later can ensure components which requires the watched properties are rendered.

		// Another influenced place is the `repeat` directive.
		// The `repeat` directive watched the iterating datas and update indenpently when they changed.
		// So if data changed from outer components and then items in old data changed,
		// It would update items in old data, and then whole data,
		// This cause it updated for twice.
		for (let i = 0; i < updatingComponents.length; i++) {
			let com = updatingComponents[i]
			componentSet.delete(com)

			let updatedTimes = updatedTimesMap.get(com) || 0
			updatedTimesMap.set(com, updatedTimes + 1)
			
			if (updatedTimes > 3) {
				console.warn(`Component with element "${com.el.outerHTML}" may have infinite updating`)
			}
			else {
				try {
					com.__updateImmediately()
				}
				catch (err) {
					console.error(err)
				}
			}
		}

		updatingComponents = []


		// When updating watch or component, data may changed and enqueu more watcher and component.
		// if enqueued more watch, we will run it in the same update function.

		// The only problems at ignore watch orders when updating is that:
		// We may update inside firstly, and then outside, then data may flow back into inside. 
		// So inner watcher may update for 1 more time.
		for (let i = 0; i < updatingWatchers.length; i++) {
			let watcher = updatingWatchers[i]

			// Delete it so it can be added again for at most once.
			watchSet.delete(watcher)

			let updatedTimes = updatedTimesMap.get(watcher) || 0
			updatedTimesMap.set(watcher, updatedTimes + 1)
		
			if (updatedTimes > 3) {
				console.warn(`Watcher "${watcher.toString()}" may have infinite updating`)
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

		updatingWatchers = []

		// If elements were added when updating, they will be connected in next micro task.
		// Here we must wait them to be instantiated.
		await Promise.resolve()
	}
	while (updatingComponents.length > 0 || updatingWatchers.length > 0)

	willUpdate = false

	// Normally `onRenderComplete` should not enqueue more watchers and components.
	// But if it enqueued, run them in next updating.
	let callbacks = afterRenderCallbacks
	afterRenderCallbacks = []

	for (let callback of callbacks) {
		callback()
	}
}
