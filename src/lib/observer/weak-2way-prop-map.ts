/**
 * Implement data constructor for two way property map:
 * L -> { R: [prop] }
 * R -> { prop: [L] }
 */
// Benchmark refere to `wrek-2way-map`.
export class Weak2WayPropMap<L extends object, R extends object> {

	private lm: WeakMap<L, Map<R, Set<PropertyKey>>> = new WeakMap()
	private rm: WeakMap<R, Map<PropertyKey, Set<L>>> = new WeakMap()

	updateFromLeft(l: L, rs: Map<R, Set<PropertyKey>>) {
		let oldrs = this.lm.get(l)

		if (!oldrs || oldrs.size === 0) {
			for (let [r, props] of rs) {
				this.addRightLeftMap(r, props, l)
			}
		}
		else {
			for (let [r, props] of rs) {
				if (!oldrs.has(r)) {
					this.addRightLeftMap(r, props, l)
				}
			}

			for (let [r, props] of oldrs) {
				if (!rs.has(r)) {
					this.removeRightLeftMap(r, props, l)
				}
			}
		}

		this.lm.set(l, rs)
	}

	private addRightLeftMap(r: R, props: Set<PropertyKey>, l: L) {
		let ls = this.rm.get(r)
		if (!ls) {
			ls = new Map()
			this.rm.set(r, ls)
		}

		for (let prop of props) {
			let pls = ls.get(prop)
			if (!pls) {
				pls = new Set()
				ls.set(prop, pls)
			}
			pls.add(l)
		}
	}

	private removeRightLeftMap(r: R, props: Set<PropertyKey>, l: L) {
		let ls = this.rm.get(r)
		if (ls) {
			for (let prop of props) {
				let pls = ls.get(prop)
				if (pls) {
					pls.delete(l)
				}
			}
		}
	}

	getFromRight(r: R, prop: PropertyKey): Set<L> | undefined {
		let ls = this.rm.get(r)
		if (ls) {
			return ls.get(prop)
		}

		return undefined
	}

	clearFromLeft(l: L) {
		let rs = this.lm.get(l)
		if (rs) {
			for (let [r, props] of rs) {
				this.removeRightLeftMap(r, props, l)
			}
			this.lm.delete(l)
		}
	}

	clearFromRight(r: R) {
		let lps = this.rm.get(r)
		if (lps) {
			for (let ls of lps.values()) {
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