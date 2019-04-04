/**
 * Implement data constructor for two way map:
 * L -> R[]
 * R -> L[]
 */
// Benchmark 1: https://jsperf.com/set-always-add-or-test-if-has-first
// Benchmark 2: https://jsperf.com/is-merge-from-small-to-large-set-be-faster
export class Weak2WayMap<L extends object, R extends object> {

	private lm: WeakMap<L, Set<R>> = new WeakMap()
	private rm: WeakMap<R, Set<L>> = new WeakMap()

	updateFromLeft(l: L, rs: Set<R>) {
		let oldRs = this.lm.get(l)

		if (!oldRs || oldRs.size === 0) {
			for (let r of rs) {
				this.addRightLeftMap(r, l)
			}
		}
		else {
			// Very high rate no need to add or remove.
			// So we test if should add or remove firstly.
			for (let r of rs) {
				if (!oldRs.has(r)) {
					this.addRightLeftMap(r, l)
				}
			}

			for (let r of oldRs) {
				if (!rs.has(r)) {
					this.removeRightLeftMap(r, l)
				}
			}
		}

		this.lm.set(l, rs)
	}

	private addRightLeftMap(r: R, l: L) {
		let ls = this.rm.get(r)
		if (!ls) {
			ls = new Set()
			this.rm.set(r, ls)
		}

		ls.add(l)
	}

	private removeRightLeftMap(r: R, l: L) {
		let ls = this.rm.get(r)
		if (ls) {
			ls.delete(l)
		}
	}

	getFromRight(r: R): Set<L> | undefined {
		return this.rm.get(r)
	}

	clearFromLeft(l: L) {
		let rs = this.lm.get(l)
		if (rs) {
			for (let r of rs) {
				this.removeRightLeftMap(r, l)
			}
			this.lm.delete(l)
		}
	}
	
	clearFromRight(r: R) {
		let ls = this.rm.get(r)
		if (ls) {
			for (let l of ls) {
				this.removeLeftRightMap(l, r)
			}
			this.rm.delete(r)
		}
	}

	private removeLeftRightMap(l: L, r: R) {
		let rs = this.lm.get(l)
		if (rs) {
			rs.delete(r)
		}
	}
}