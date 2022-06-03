/** Weak Map indexed with double keys column. */
export class DoubleKeysWeakMap<K1 extends object, K2, V> {

	private map: WeakMap<K1, Map<K2, V>> = new WeakMap

	set(k1: K1, k2: K2, v: V) {
		let sub = this.map.get(k1)
		if (!sub) {
			sub = new Map()
			this.map.set(k1, sub)
		}

		sub.set(k2, v)
	}

	has(k1: K1, k2: K2): boolean {
		let sub = this.map.get(k1)
		if (!sub) {
			return false
		}

		return sub.has(k2)
	}

	get(k1: K1, k2: K2): V | undefined {
		let sub = this.map.get(k1)
		if (!sub) {
			return undefined
		}

		return sub.get(k2)
	}

	delete(k1: K1, k2: K2) {
		let sub = this.map.get(k1)
		if (sub) {
			sub.delete(k2)

			if (sub.size === 0) {
				this.map.delete(k1)
			}
		}
	}
}
