/** 
 * L -> R
 * R -> L
 */
export class TwoWayMap<L, R> {

	private lm: Map<L, R> = new Map()
	private rm: Map<R, L> = new Map()

	getSize(): number {
		return this.lm.size
	}

	/** 
	 * Both `l` and `r` must not been added before.
	 * You may need to calls `deleteFromLeft` and `deleteFromRight` if you can't ensure this.
	 */
	add(l: L, r: R) {
		this.lm.set(l, r)
		this.rm.set(r, l)
	}

	hasLeft(l: L): boolean {
		return this.lm.has(l)
	}

	hasRight(r: R): boolean {
		return this.rm.has(r)
	}

	getFromLeft(l: L): R | undefined {
		return this.lm.get(l)
	}

	getFromRight(r: R): L | undefined {
		return this.rm.get(r)
	}

	deleteFromLeft(l: L): boolean {
		if (this.hasLeft(l)) {
			this.rm.delete(this.lm.get(l)!)
			this.lm.delete(l)
			return true
		}

		return false
	}

	deleteFromRight(r: R): boolean {
		if (this.hasRight(r)) {
			this.lm.delete(this.rm.get(r)!)
			this.rm.delete(r)
			return true
		}
		
		return false
	}

	getAllLeft(): Iterable<L> {
		return this.lm.keys()
	}

	getAllRight(): Iterable<R> {
		return this.rm.keys()
	}
}
