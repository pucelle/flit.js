/**
 * Implement data constructor for two way map:
 * L -> R[]
 * R -> L[]
 */
export class Weak2WayMap<L extends object, R extends object> {

	/** L -> R[] */
	private lm: WeakMap<L, Set<R>> = new WeakMap()

	/** R -> L[] */
	private rm: WeakMap<R, Set<L>> = new WeakMap()

	/** Update `L -> R[]` and `R[] -> L` maps. */
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

	/** Add one `R -> L` map. */
	private addRightLeftMap(r: R, l: L) {
		let ls = this.rm.get(r)
		if (!ls) {
			ls = new Set()
			this.rm.set(r, ls)
		}

		ls.add(l)
	}

	/** Remove one `R -> L` map. */
	private removeRightLeftMap(r: R, l: L) {
		let ls = this.rm.get(r)
		if (ls) {
			ls.delete(l)
		}
	}

	/** Removes one `L -> R` map. */
	private removeLeftRightMap(l: L, r: R) {
		let rs = this.lm.get(l)
		if (rs) {
			rs.delete(r)
		}
	}

	/** Get all `L[]` from `R` maps. */
	getFromRight(r: R): Set<L> | undefined {
		return this.rm.get(r)
	}

	/** Clears all `R[] -> L` and `L -> R[]`. */
	clearFromLeft(l: L) {
		let rs = this.lm.get(l)
		if (rs) {
			for (let r of rs) {
				this.removeRightLeftMap(r, l)
				this.removeLeftRightMap(l, r)
			}

			// No need to delete WeakMap key.
			// this.lm.delete(l)
		}
	}
}