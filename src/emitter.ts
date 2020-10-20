import {observeTarget} from './observer'
import {Emitter} from './internal/emitter'


/** Observed base class, changes it's sub properties will cause the components depend on them to update. */
export class ObservedBaseClass {
	constructor() {
		return observeTarget(this)
	}
}


/** Observed emitter class, changes it's sub properties will cause the components depend on them to update. */
export class ObservedEmitter<Events = any> extends Emitter<Events> {
	constructor() {
		super()
		return observeTarget(this)
	}
}
