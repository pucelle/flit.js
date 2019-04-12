import {Updatable, Dependency, Com} from './shared'
import {Weak2WayMap} from './weak-2way-map'
import {Weak2WayPropMap} from './weak-2way-prop-map'


/**
 * To know when rendering component, which objects we used.
 * And to know when object changed, which component or watcher should be update.
 * Otherwise we need to remove from left when component disconnected.
 * 
 * If the dependent objects were removed, the component or watchers should be updated, And it will clear dependencies before.
 * So cached the objects will not prevent their GC.
 */
const depMap = new Weak2WayMap<Updatable, Dependency>()


/**
 * To know when rendering component, which component and what's the properties it called.
 * And to know when specified property in object changed, which component should be update.
 * 
 * Why we don't observe properties for all the object but only component?
 * In fact I do so at beginning, until one day I found 1M dependencies in my app.
 * There is no memory leak, my app just may load more than 20K data records.
 * Otherwise, now we are using not 100% precise updating, and update whole component part for once.
 * no need to observe every details.
 */
const comPropMap = new Weak2WayPropMap<Updatable, Com>()


/** Currently rendering component or running watcher, and their dependencies. */
let updating: Updatable | undefined
let updatingDeps: Set<Dependency> = new Set()
let updatingComPropMap: Map<Com, Set<PropertyKey>> = new Map()

// a stack is required, `watchImmediately` need to be update immediately,
// but an component may be updating recently.
const updatingStack: Updatable[] = []


/** Called when start rendering proxied component or running watch functions. */
export function startUpdating(upt: Updatable) {
	if (updating) {
		updatingStack.push(updating)
	}
	updating = upt
}

/** Called when complete rendering component or complete running watch functions. */
export function endUpdating(_upt: Updatable) {
	if (updating) {
		depMap.updateFromLeft(updating, updatingDeps)
		comPropMap.updateFromLeft(updating, updatingComPropMap)

		updating = updatingStack.pop()
		updatingDeps = new Set()
		updatingComPropMap = new Map()
	}
}

/** Returns if is updating recently. */
export function isUpdating(): boolean {
	return !!updating
}


/** Called when start rendering component or running watch functions, or component and watcher disconnected. */
export function clearDependency(updating: Updatable) {
	depMap.clearFromLeft(updating)
	comPropMap.clearFromLeft(updating)
}

/**  Called when don't want to obserse object changing. */
export function clearAsDependency(obj: Dependency) {
	depMap.clearFromRight(obj)
	comPropMap.clearFromRight(obj)
}


// We split adding dependencies to two steps:
//   1. Collect dependencies, cache them.
//   2. Merge them into dependency tree.
// 
// May use one object dependency for moren than 100 times in one updating,
// no need to update dependency tree for each calling.
// 
// Otherwise, a very high rate the dependencies are no need to update.

/** Called when in object's or array's proxy.get. */
export function mayAddDependency(dep: Dependency) {
	if (!updating) {
		return
	}

	updatingDeps.add(dep)
}

/** Called when in component's proxy.get. */
export function mayAddComDependency(com: Com, prop: PropertyKey) {
	if (!updating) {
		return
	}

	let propertySet = updatingComPropMap.get(com)
	if (!propertySet) {
		propertySet = new Set()
		updatingComPropMap.set(com, propertySet)
	}

	propertySet.add(prop)		
}

/** Called when in component's proxy.set. */
export function notifyComPropertySet(com: Com, prop: PropertyKey) {
	let upts = comPropMap.getFromRight(com, prop)
	if (upts) {
		for (let upt of upts) {
			upt.update()
		}
	}
}

/** Called when in array's or object's proxy.set. */
export function notifyObjectSet(obj: Dependency) {
	let upts = depMap.getFromRight(obj)
	if (upts) {
		for (let upt of upts) {
			upt.update()
		}
	}
}