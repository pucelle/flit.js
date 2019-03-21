import {define, html, Component} from '../src'

define('test-com', class TestCom extends Component{

	value = 100
	message = 'Hello'
	pie = false
	a = {a: [1,2,3,4,5,6,7,8,9]}

	onclick() {
		this.value++
		this.pie = !this.pie
		this.update()
	}

	render() {
		return  html`
		<style>
		  :host { display: block; }
		  :host([hidden]) { display: none; }
		</style>
  
		<h1>Start LitElement!</h1>
		<p>${this.message}</p>
  
		<input name="myinput" id="myinput" 
		  type="checkbox"
		  ?checked="${this.pie}"
		  @change="${this.onclick}">
  
		<label for="myinput">I like pie.</label>
  
		${
		  this.a.a.map(i => html`<div>a${i}b</div>`)
		}
		
		${this.pie ? html`<lazy-element a="b"></lazy-element>` : ''}
	  `
	}
})