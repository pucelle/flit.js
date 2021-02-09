/**
 * Implement data constructor for two way property map:
 * L -> {R: [prop]}
 * R -> {prop: [L]}
 */
export class Weak2WayPropMap<L extends object, R extends object> {

	/** L -> {R: [prop]} */
	private lm: WeakMap<L, Map<R, Set<PropertyKey>>> = new WeakMap()

	/** R -> {prop: [L]} */
	private rm: WeakMap<R, Map<PropertyKey, Set<L>>> = new WeakMap()

	/** Update `L -> R[] -> props[]` and `R[] -> prop[] -> L` maps. */
	updateFromLeft(l: L, rps: Map<R, Set<PropertyKey>>) {
		let oldRps = this.lm.get(l)

		if (!oldRps) {
			for (let [r, props] of rps) {
				this.addRightLeftMap(r, props, l)
			}
		}
		else {
			for (let [r, props] of rps) {
				if (oldRps.has(r)) {
					this.updateRightLeftMap(r, oldRps.get(r)!, props, l)
				}
				else {
					this.addRightLeftMap(r, props, l)
				}
			}

			for (let [r, props] of oldRps) {
				if (!rps.has(r)) {
					this.deleteRightLeftMap(r, props, l)
				}
			}
		}

		this.lm.set(l, rps)
	}

	/** Add `L -> R -> prop[]` and `R -> prop[] -> L` map. */
	private addRightLeftMap(r: R, props: Set<PropertyKey>, l: L) {
		let pls = this.rm.get(r)
		if (!pls) {
			pls = new Map()
			this.rm.set(r, pls)
		}

		for (let prop of props) {
			let ls = pls.get(prop)

			if (!ls) {
				ls = new Set()
				pls.set(prop, ls)
			}

			ls.add(l)
		}
	}

	/** Update `R -> prop[] -> L` map. */
	private updateRightLeftMap(r: R, oldProps: Set<PropertyKey>, newProps: Set<PropertyKey>, l: L) {
		let pls = this.rm.get(r)
		if (pls) {
			for (let prop of newProps) {
				if (!oldProps.has(prop)) {
					let ls = pls.get(prop)
					if (!ls) {
						ls = new Set()
						pls.set(prop, ls)
					}
					ls.add(l)
				}
			}

			for (let prop of oldProps) {
				if (!newProps.has(prop)) {
					let ls = pls.get(prop)
					if (ls) {
						ls.delete(l)
					}
				}
			}
		}
	}

	/** Deletes `R -> L -> prop[]` map. */
	private deleteRightLeftMap(r: R, props: Set<PropertyKey>, l: L) {
		let pls = this.rm.get(r)
		if (pls) {
			for (let prop of props) {
				let ls = pls.get(prop)
				if (ls) {
					ls.delete(l)
				}
			}
		}
	}

	/** Deletes `L -> R -> prop[]` map. */
	private deleteLeftRightMap(l: L, r: R) {
		let rps = this.lm.get(l)
		if (rps) {
			rps.delete(r)
		}
	}

	/** Get `L[]` from `R -> prop`. */
	getFromRight(r: R, prop: PropertyKey): Set<L> | undefined {
		let pls = this.rm.get(r)
		if (pls) {
			return pls.get(prop)
		}

		return undefined
	}

	/** Clear all `L -> R[] -> prop[]` and `R[] -> prop[] -> L` maps. */
	clearFromLeft(l: L) {
		let rps = this.lm.get(l)
		if (rps) {
			for (let [r, props] of rps) {
				this.deleteRightLeftMap(r, props, l)
				this.deleteLeftRightMap(l, r)
			}

			// No need to delete WeakMap key.
			// this.lm.delete(l)
		}
	}
}