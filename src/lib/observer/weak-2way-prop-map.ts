/**
 * Implement data constructor for two way property map:
 * L -> { R: [prop] }
 * R -> { prop: [L] }
 */
// Benchmark refere to `wrek-2way-map`.
export class Weak2WayPropMap<L extends object, R extends object> {

	private lm: WeakMap<L, Map<R, Set<PropertyKey>>> = new WeakMap()
	private rm: WeakMap<R, Map<PropertyKey, Set<L>>> = new WeakMap()

	updateFromLeft(l: L, rps: Map<R, Set<PropertyKey>>) {
		let oldRps = this.lm.get(l)

		if (!oldRps || oldRps.size === 0) {
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
					this.removeRightLeftMap(r, props, l)
				}
			}
		}

		this.lm.set(l, rps)
	}

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

	private removeRightLeftMap(r: R, props: Set<PropertyKey>, l: L) {
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

	getFromRight(r: R, prop: PropertyKey): Set<L> | undefined {
		let pls = this.rm.get(r)
		if (pls) {
			return pls.get(prop)
		}

		return undefined
	}

	clearFromLeft(l: L) {
		let rps = this.lm.get(l)
		if (rps) {
			for (let [r, props] of rps) {
				this.removeRightLeftMap(r, props, l)
			}
			this.lm.delete(l)
		}
	}

	clearFromRight(r: R) {
		let pls = this.rm.get(r)
		if (pls) {
			for (let ls of pls.values()) {
				for (let l of ls) {
					this.removeLeftRightMap(l, r)
				}
			}
			this.rm.delete(r)
		}
	}

	private removeLeftRightMap(l: L, r: R) {
		let rps = this.lm.get(l)
		if (rps) {
			rps.delete(r)
		}
	}
}