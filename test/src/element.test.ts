import * as flit from '../..'
const assert = chai.assert


describe('Test define', () => {
	it('should initialize component after element defined', async () => {
		let el = document.createElement('test-element')
		document.body.append(el)

		flit.define('test-element', class TestCom extends flit.Component{
			render() {
				return 'text'
			}
		})

		assert.ok(await flit.Component.getAsync(el))
		assert.equal(el.innerHTML, 'text')
		el.remove()
	})

	it('should initialize component after element inserted', async () => {
		let el = document.createElement('test-element')
		document.body.append(el)

		assert.ok(await flit.Component.getAsync(el))
		assert.equal(el.innerHTML, 'text')
		el.remove()
	})
})