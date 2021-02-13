import {Weak2WayMap} from '../helpers/weak-2way-map'
import {Weak2WayPropMap} from '../helpers/weak-2way-prop-map'


/** Currently rendering component or running watcher, and their dependencies. */
interface Updating {

	/** The source where updating come from. */
	source: UpdatableProxied

	/** Dependent objects that collected when updating. */
	deps: Set<Dependency>

	/** Dependent components and their properties that collected when updating. */
	depProps: Map<UpdatableTarget, Set<PropertyKey>>
}


/**
 * `UpdatableProxied <-> Dependency` map.
 * 
 * To know when rendering a component or update a watcher, all the dependent objects it used.
 * So after any of those object changed, we know which components or watchers should be updated.
 *
 * If the dependent objects were removed, the component or watchers should be updated,
 * and it will clear useless dependencies before.
 * So cached the objects will not prevent GC.
 */
const DepMap = new Weak2WayMap<UpdatableProxied, Dependency>()

/**
 * `UpdatableProxied <-> Dependency -> Property` map.
 * 
 * To know when rendering a component or update a watcher, all dependent components and what's the properties it used.
 * So after any of those properties changed, we know which components or watchers should be updated.
 * 
 * Why we don't observe properties for all the objects but only components?
 * In fact I do so at beginning, until one day I found 1M dependencies in my app.
 * There is no memory leak, my app just may load more than 10K data records.
 * 
 * Otherwise, our implementation for updating is not 100% precise,
 * and update whole component part at once, not update each properties, bindings, directives.
 * So no need to observe all the details.
 */
const ComPropMap = new Weak2WayPropMap<UpdatableProxied, UpdatableTarget>()

/** The updating component or watcher. */
let updating: Updating | null = null

/** May one updating is not completed and start a new one, so a stack is required. */
const updatingStack: Updating[] = []


/** 
 * Called when a component or a watcher disconnected,
 * No need to trigger updating on the component or watcher any more.
 */
export function clearDependenciesOf(updating: UpdatableProxied) {
	DepMap.clearFromLeft(updating)
	ComPropMap.clearFromLeft(updating)
}


/** Called when start rendering a component or running a watcher function. */
export function startUpdating(source: UpdatableProxied) {
	if (updating) {
		updatingStack.push(updating)
	}

	updating = {
		source,
		deps: new Set(),
		depProps: new Map(),
	}
}


/** Called when complete rendering component or complete running watch functions. */
export function endUpdating(_source: UpdatableProxied) {
	
	// We split updating dependencies to two steps:
	//   1. Collect dependencies, cache them.
	//   2. Merge them into dependency tree.
	// 
	// It's common to use one object dependency for moren than 100 times in one updating,
	// no need to update dependency tree each time.

	if (updating) {
		DepMap.updateFromLeft(updating.source, updating.deps)
		ComPropMap.updateFromLeft(updating.source, updating.depProps)
		updating = updatingStack.pop() || null
	}
}


/** Whether is updating recently. */
export function isUpdating(): boolean {
	return !!updating
}


/** Called when uses an object or array. */
export function addDependency(dep: Dependency) {
	if (!updating) {
		return
	}

	updating.deps.add(dep)
}


/** Called when changing an array or object. */
export function notifyObjectSet(obj: Dependency) {
	let upts = DepMap.getFromRight(obj)
	if (upts) {
		for (let upt of upts) {
			upt.update()
		}
	}
}


/** Called when uses one property of component. */
export function addComDependency(com: UpdatableTarget, prop: PropertyKey) {
	if (!updating) {
		return
	}

	let propertySet = updating.depProps.get(com)
	if (!propertySet) {
		propertySet = new Set()
		updating.depProps.set(com, propertySet)
	}

	propertySet.add(prop)		
}


/** Called when setting one property of component. */
export function notifyComPropertySet(com: UpdatableTarget, prop: PropertyKey) {
	let upts = ComPropMap.getFromRight(com, prop)
	if (upts) {
		for (let upt of upts) {
			upt.update()
		}
	}
}

