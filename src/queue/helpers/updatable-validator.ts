import {Component} from '../../component'
import {Watcher} from '../../watchers/watcher'
import {Updatable} from './types'


/** Validate update times for updatable. */
export class UpdatableValidator {

	/** Cache the updated time of watchers and components. */
	private map: Map<Updatable, number> = new Map()

	/** Warn if component updated for many times. */
	validate(upt: Updatable): boolean {

		// We currently just check the count of updating times, if exceed 3 then warn.
		// 
		// A better way should be analysising dependency tree:
		//     Get current watcher referenced objects,
		//     then get their referenced watchers,
		//     then check if current watcher in it.

		let updatedTimes = this.map.get(upt) || 0
		this.map.set(upt, updatedTimes + 1)
		
		if (updatedTimes > 3) {
			if (upt instanceof Component) {
				console.warn(upt, `may change values in the render function and cause infinite updating!`)
			}
			else if (upt instanceof Watcher) {
				console.warn(upt, `may change values in the watcher callback and cause infinite updating!`)
			}
			else {
				console.warn(upt, `may change values in callback and cause infinite updating!`)
			}

			return false
		}

		return true
	}

	clear() {
		this.map = new Map()
	}
}