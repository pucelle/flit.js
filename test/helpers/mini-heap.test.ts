import {MiniHeap} from '../../src/helpers/mini-heap'


describe('Test MiniHeap', () => {
	let heap = new MiniHeap((a: number, b: number) => a - b)

	it('Test MiniHeap', () => {
		let a: number[] = []
		for (let i = 0; i < 100; i++) {
			let v = Math.floor(Math.random() * 100)
			a.push(v)
			heap.add(v)
		}
		a.sort((a: number, b: number) => a - b)
		
		let b: number[] = []
		for (let i = 0; i < 100; i++) {
			b.push(heap.removeHead()!)
		}

		expect(b).toEqual(a)
	})
})