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
					this.deleteRightLeftMap(r, props, l)
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

	getFromRight(r: R, prop: PropertyKey): Set<L> | undefined {
		let pls = this.rm.get(r)
		if (pls) {
			return pls.get(prop)
		}

		return undefined
	}

	deleteLeft(l: L) {
		let rps = this.lm.get(l)
		if (rps) {
			for (let [r, props] of rps) {
				this.deleteRightLeftMap(r, props, l)
			}
			this.lm.delete(l)
		}
	}

	deleteRight(r: R) {
		let pls = this.rm.get(r)
		if (pls) {
			for (let ls of pls.values()) {
				for (let l of ls) {
					this.deleteLeftRightMap(l, r)
				}
			}
			// Comment this line very important:
			// R may be connect again, so we can restore `L -> R -> prop` from the `R -> prop -> L`.
			// Don't worry, it doesn't prevent GC for `R`.
			//this.rm.delete(r)
		}
	}

	private deleteLeftRightMap(l: L, r: R) {
		let rps = this.lm.get(l)
		if (rps) {
			rps.delete(r)
		}
	}

	restoreFromRight(r: R) {
		let pls = this.rm.get(r)
		if (pls) {
			for (let [prop, ls] of pls.entries()) {
				for (let l of ls) {
					this.addLeftRightMap(l, r, prop)
				}
			}
		}
	}

	private addLeftRightMap(l: L, r: R, prop: PropertyKey) {
		let rps = this.lm.get(l)
		if (!rps) {
			rps = new Map()
			this.lm.set(l, rps)
		}

		let ps = rps.get(r)
		if (!ps) {
			ps = new Set()
			rps.set(r, ps)
		}
		
		ps.add(prop)
	}
}