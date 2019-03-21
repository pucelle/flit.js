import * as flit from '../../src'
import * as helper from './helper'
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

		await helper.sleep(0)
		assert.ok(flit.getComponentAt(el))
		assert.equal(el.innerHTML, 'text')
		el.remove()
	})

	it('should initialize component after element inserted', async () => {
		let el = document.createElement('test-element')
		document.body.append(el)

		await helper.sleep(0)
		assert.ok(flit.getComponentAt(el))
		assert.equal(el.innerHTML, 'text')
		el.remove()
	})
})