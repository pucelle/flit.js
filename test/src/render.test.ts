import * as flit from '../../src'
import * as helper from './helper'
const assert = chai.assert
const expect = chai.expect
const spy = chai.spy


describe('Test render', () => {
	it('should initialize component after render', async () => {
		flit.define('test-render', class TestCom extends flit.Component{
			value = 1
			render() {
				return 'text'
			}
		})

		let el = flit.render('<test-render></test-render>', document.body) as HTMLElement
		assert.ok(el)
		await helper.sleep(0)
		assert.ok(flit.Component.get(el))
		assert.equal(el.innerHTML, 'text')
		el.remove()
	})

	it('should render css codes using css template', async () => {
		let el = flit.render(flit.css`a{color:red;}`, document.body) as HTMLElement
		assert.ok(el)
		assert.equal(el.localName, 'style')
		assert.equal(el.textContent, 'a{color:red;}')
		el.remove()
	})

	it('should render text using text template', async () => {
		let el = flit.render(flit.text`<div></div>`, document.body) as Text
		assert.ok(el)
		assert.equal(el.nodeType, 3)
		assert.equal(el.textContent, '<div></div>')
		el.remove()
	})

	it('should render html using html template', async () => {
		let el = flit.render(flit.html`<div>${'test'}</div>`).firstChild as HTMLElement
		assert.ok(el)
		assert.equal(el.localName, 'div')
		assert.equal(el.textContent, 'test')
	})

	it('should not throw when render html using html template and use function value but not pass context', async () => {
		let onClick = spy()
		let el = flit.render(flit.html`<div @click=${onClick}></div>`).firstChild as HTMLElement
		let e = new MouseEvent('click')
		el.dispatchEvent(e)
		expect(onClick).to.have.been.called.once
	})
})