// Copyright (C) 2026 Francisco Peña Gallardo (Reox Lab)
//
// This file is part of rl-suggest.
//
// rl-suggest is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// rl-suggest is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with rl-suggest. If not, see <https://www.gnu.org/licenses/>.

// Pruebas del buzón de sugerencias. Sin framework: node:assert.
// Se ejecuta con esbuild + node (ver `npm test`).

import assert from 'node:assert/strict'
import {
  SUGGEST_EMAIL_DEFAULT,
  SUGGEST_STYLE,
  buildSuggestMailto,
  renderSuggestBox,
  suggestSubject,
} from '../src/index.js'

// -- Stub mínimo de DOM (sin dependencias externas) --------------------------

type Listener = (event?: unknown) => void

class FakeTextNode {
  readonly nodeType = 3
  parentNode: FakeElement | null = null
  constructor(public textContent: string) {}
  toHTML(): string {
    return this.textContent
  }
}

class FakeElement {
  readonly nodeType = 1
  readonly tagName: string
  readonly children: Array<FakeElement | FakeTextNode> = []
  readonly attributes = new Map<string, string>()
  readonly listeners = new Map<string, Listener[]>()
  readonly style: Record<string, string> = {}
  parentNode: FakeElement | null = null
  ownerDocument: FakeDocument
  id = ''
  className = ''
  type = ''
  value = ''
  placeholder = ''
  disabled = false
  hidden = false
  focused = false
  selected = false
  private _textContent = ''

  constructor(tagName: string, doc: FakeDocument) {
    this.tagName = tagName.toLowerCase()
    this.ownerDocument = doc
  }

  get textContent(): string {
    if (this.children.length === 0) return this._textContent
    return this.children.map((c) => c.textContent).join('')
  }

  set textContent(val: string) {
    this.children.length = 0
    this._textContent = val
  }

  appendChild<T extends FakeElement | FakeTextNode>(child: T): T {
    if (child.parentNode) {
      child.parentNode.removeChild(child)
    }
    child.parentNode = this
    this.children.push(child)
    return child
  }

  removeChild<T extends FakeElement | FakeTextNode>(child: T): T {
    const idx = this.children.indexOf(child)
    if (idx >= 0) {
      this.children.splice(idx, 1)
      child.parentNode = null
    }
    return child
  }

  remove(): void {
    if (this.parentNode) {
      this.parentNode.removeChild(this)
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
    if (name === 'id') this.id = value
    if (name === 'class') this.className = value
  }

  getAttribute(name: string): string | null {
    if (name === 'id' && this.id) return this.id
    if (name === 'class' && this.className) return this.className
    return this.attributes.get(name) ?? null
  }

  addEventListener(type: string, fn: Listener): void {
    const list = this.listeners.get(type) ?? []
    list.push(fn)
    this.listeners.set(type, list)
  }

  removeEventListener(type: string, fn: Listener): void {
    const list = this.listeners.get(type)
    if (!list) return
    const idx = list.indexOf(fn)
    if (idx >= 0) list.splice(idx, 1)
  }

  dispatch(type: string): void {
    const list = [...(this.listeners.get(type) ?? [])]
    for (const fn of list) fn({ type, target: this })
  }

  select(): void {
    this.selected = true
  }

  focus(): void {
    this.focused = true
    this.ownerDocument.activeElement = this
  }

  find(predicate: (el: FakeElement) => boolean): FakeElement | null {
    if (predicate(this)) return this
    for (const child of this.children) {
      if (child instanceof FakeElement) {
        const hit = child.find(predicate)
        if (hit) return hit
      }
    }
    return null
  }

  findAll(predicate: (el: FakeElement) => boolean, out: FakeElement[] = []): FakeElement[] {
    if (predicate(this)) out.push(this)
    for (const child of this.children) {
      if (child instanceof FakeElement) {
        child.findAll(predicate, out)
      }
    }
    return out
  }

  toHTML(): string {
    const attrs: string[] = []
    if (this.id) attrs.push(`id="${this.id}"`)
    if (this.className) attrs.push(`class="${this.className}"`)
    if (this.type) attrs.push(`type="${this.type}"`)
    if (this.placeholder) attrs.push(`placeholder="${this.placeholder}"`)
    if (this.disabled) attrs.push('disabled')
    if (this.hidden) attrs.push('hidden')
    for (const [k, v] of this.attributes) {
      if (k === 'id' || k === 'class') continue
      attrs.push(`${k}="${v}"`)
    }
    const open = attrs.length > 0 ? `<${this.tagName} ${attrs.join(' ')}>` : `<${this.tagName}>`
    const inner =
      this.children.length > 0
        ? this.children.map((c) => c.toHTML()).join('')
        : this._textContent
    return `${open}${inner}</${this.tagName}>`
  }
}

class FakeDocument {
  readonly head: FakeElement
  readonly body: FakeElement
  readonly documentElement: FakeElement
  activeElement: FakeElement | null = null
  execCommandResult = true
  execCommandCalls: string[] = []

  constructor() {
    this.documentElement = new FakeElement('html', this)
    this.head = new FakeElement('head', this)
    this.body = new FakeElement('body', this)
    this.documentElement.appendChild(this.head)
    this.documentElement.appendChild(this.body)
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this)
  }

  createTextNode(text: string): FakeTextNode {
    return new FakeTextNode(text)
  }

  getElementById(id: string): FakeElement | null {
    return this.documentElement.find((el) => el.id === id)
  }

  execCommand(cmd: string): boolean {
    this.execCommandCalls.push(cmd)
    return this.execCommandResult
  }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

// -- 1. Constante y funciones puras ------------------------------------------

assert.equal(SUGGEST_EMAIL_DEFAULT, 'contacto@reoxlab.com')

assert.equal(suggestSubject('TableRL'), '[Sugerencia TableRL]')
assert.equal(suggestSubject('  PlotRL  '), '[Sugerencia PlotRL]')
assert.throws(() => suggestSubject(''), TypeError)
assert.throws(() => suggestSubject('   '), TypeError)
assert.throws(() => suggestSubject('\n\t'), TypeError)

const mailtoDefault = buildSuggestMailto('TableRL', 'Hola mundo')
assert.equal(
  mailtoDefault,
  'mailto:contacto@reoxlab.com?subject=%5BSugerencia%20TableRL%5D&body=Hola%20mundo',
)

const mailtoSpecial = buildSuggestMailto(
  'DifRL',
  '  Acentos: áéíóúñ & símbolos ?x=1\nsegunda línea  ',
)
assert.equal(
  mailtoSpecial,
  `mailto:contacto@reoxlab.com?subject=${encodeURIComponent('[Sugerencia DifRL]')}&body=${encodeURIComponent('Acentos: áéíóúñ & símbolos ?x=1\r\nsegunda línea')}`,
)
assert.ok(mailtoSpecial.includes('%0D%0A'), 'los saltos de línea deben codificarse como %0D%0A (CRLF, RFC 6068)')
assert.ok(mailtoSpecial.includes('%26'), 'el carácter & debe codificarse como %26')
assert.ok(mailtoSpecial.includes('%3F'), 'el carácter ? debe codificarse como %3F')
assert.ok(mailtoSpecial.includes('%3D'), 'el carácter = debe codificarse como %3D')

const mailtoCustomEmail = buildSuggestMailto(
  'PlotRL',
  '  Idea nueva  ',
  'equipo@ejemplo.org',
)
assert.equal(
  mailtoCustomEmail,
  `mailto:equipo@ejemplo.org?subject=${encodeURIComponent('[Sugerencia PlotRL]')}&body=${encodeURIComponent('Idea nueva')}`,
)

assert.throws(() => buildSuggestMailto('', 'Texto'), TypeError)
assert.throws(() => buildSuggestMailto('   ', 'Texto'), TypeError)

// toolName con espacios también se recorta en buildSuggestMailto
assert.equal(
  buildSuggestMailto('  TableRL  ', 'x'),
  'mailto:contacto@reoxlab.com?subject=%5BSugerencia%20TableRL%5D&body=x',
)

// Límite práctico: 500 caracteres con acentos (peor caso, 6 por
// carácter codificado + ~70 de esquema/asunto) quedan por debajo de 3200.
const longText = 'á'.repeat(500)
const longMailto = buildSuggestMailto('TableRL', longText)
assert.ok(longMailto.length < 3200, `mailto con 500 acentos: ${longMailto.length} caracteres`)

// -- 2. CSS exportado (theme-aware y encapsulado) ----------------------------

assert.ok(SUGGEST_STYLE.includes('.rl-suggest'))
assert.ok(SUGGEST_STYLE.includes('var(--borde'))
assert.ok(SUGGEST_STYLE.includes('var(--panel'))
assert.ok(SUGGEST_STYLE.includes('var(--vino-boton'))
assert.ok(SUGGEST_STYLE.includes('var(--carbon'))
assert.ok(SUGGEST_STYLE.includes('var(--fondo'))
assert.ok(SUGGEST_STYLE.includes('var(--texto-suave'))
assert.ok(SUGGEST_STYLE.includes('var(--radio'))
assert.ok(!/(^|\n)\s*(body|html|:root)\b/.test(SUGGEST_STYLE))
assert.ok(!/background:\s*#[0-9a-fA-F]{3,6}\b/.test(SUGGEST_STYLE))

// -- 3. renderSuggestBox: validaciones, DOM, envío, copia y dispose ----------

const doc = new FakeDocument()
const container = doc.createElement('div')
doc.body.appendChild(container)

const locationStub = { href: '' }
;(globalThis as unknown as { document: unknown }).document = doc
;(globalThis as unknown as { window: unknown }).window = { location: locationStub }

// Validaciones de entrada
assert.throws(
  () => renderSuggestBox(null as unknown as HTMLElement, { toolName: 'TableRL' }),
  TypeError,
)
assert.throws(
  () => renderSuggestBox({} as unknown as HTMLElement, { toolName: 'TableRL' }),
  TypeError,
)
assert.throws(
  () => renderSuggestBox(doc.createTextNode('texto') as unknown as HTMLElement, { toolName: 'TableRL' }),
  TypeError,
)
assert.throws(
  () => renderSuggestBox(container as unknown as HTMLElement, { toolName: '' }),
  TypeError,
)
assert.throws(
  () => renderSuggestBox(container as unknown as HTMLElement, { toolName: '   ' }),
  TypeError,
)

// Renderizado inicial y estructura HTML
const sentTexts: string[] = []
const handle = renderSuggestBox(container as unknown as HTMLElement, {
  toolName: 'TableRL',
  onSend: (text) => {
    sentTexts.push(text)
  },
})

const section = handle.element as unknown as FakeElement
assert.equal(section.tagName, 'section')
assert.equal(section.className, 'rl-suggest')
assert.equal(section.getAttribute('aria-label'), 'Buzón de sugerencias')
assert.equal(container.children.length, 1)

// Estilo inyectado una sola vez con exactamente SUGGEST_STYLE
const styleEl = doc.getElementById('rl-suggest-style')
assert.ok(styleEl !== null)
assert.equal(styleEl.textContent, SUGGEST_STYLE)

// Contenido HTML esperado
const html = section.toHTML()
assert.ok(html.includes('¿Tienes una sugerencia?'))
assert.ok(html.includes('Enviar sugerencia'))
assert.ok(html.includes('mailto:contacto@reoxlab.com'))
assert.ok(html.includes('contacto@reoxlab.com'))
assert.ok(html.includes('Copiar correo'))

const label = section.find((el) => el.tagName === 'label')!
const textarea = section.find((el) => el.className === 'rl-suggest-text')!
const sendButton = section.find((el) => el.className === 'rl-suggest-send')!
const hint = section.find((el) => el.className === 'rl-suggest-hint')!
const mailLink = section.find((el) => el.tagName === 'a')!
const copyButton = section.find((el) => el.className === 'rl-suggest-copy')!
const count = section.find((el) => el.className === 'rl-suggest-count')!

assert.ok(label && textarea && sendButton && hint && mailLink && copyButton && count)
assert.equal(count.textContent, '0/500 caracteres')
assert.equal(label.getAttribute('for'), textarea.id)
assert.equal(textarea.getAttribute('rows'), '4')
assert.equal(textarea.getAttribute('maxlength'), '500')
assert.equal(sendButton.type, 'button')
assert.equal(copyButton.type, 'button')
assert.equal(mailLink.getAttribute('href'), 'mailto:contacto@reoxlab.com')
assert.equal(hint.hidden, true)

// Botón deshabilitado mientras esté vacío o solo espacios
assert.equal(sendButton.disabled, true)
textarea.value = '   \n  '
textarea.dispatch('input')
assert.equal(sendButton.disabled, true)

textarea.value = '  Agregar exportación a CSV  '
textarea.dispatch('input')
assert.equal(sendButton.disabled, false)
assert.equal(count.textContent, `${textarea.value.length}/500 caracteres`)

// Al pulsar Enviar: abre mailto, dispara onSend con texto recortado, muestra hint y NO borra textarea
sendButton.dispatch('click')
assert.equal(
  locationStub.href,
  buildSuggestMailto('TableRL', 'Agregar exportación a CSV'),
)
assert.deepEqual(sentTexts, ['Agregar exportación a CSV'])
assert.equal(hint.hidden, false)
assert.equal(
  hint.textContent,
  'Se intentó abrir tu app de correo con la sugerencia lista para enviar.',
)
assert.equal(textarea.value, '  Agregar exportación a CSV  ')

// Al vaciar el textarea, vuelve a deshabilitarse
textarea.value = ''
textarea.dispatch('input')
assert.equal(sendButton.disabled, true)

// Clic en enviar con solo espacios: no abre mailto ni llama a onSend
locationStub.href = ''
sendButton.dispatch('click')
assert.equal(locationStub.href, '')
assert.equal(sentTexts.length, 1)

// Copiar correo con navigator.clipboard.writeText
const copiedValues: string[] = []
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    clipboard: {
      writeText: async (value: string) => {
        copiedValues.push(value)
      },
    },
  },
})

copyButton.dispatch('click')
await flushMicrotasks()
assert.deepEqual(copiedValues, ['contacto@reoxlab.com'])
assert.equal(copyButton.textContent, '¡Copiado!')

// Segunda instancia en el mismo documento no duplica <style id="rl-suggest-style">
const container2 = doc.createElement('div')
doc.body.appendChild(container2)
const handle2 = renderSuggestBox(container2 as unknown as HTMLElement, {
  toolName: 'PlotRL',
  email: 'soporte@reoxlab.com',
  title: 'Comentarios',
  submitLabel: 'Abrir correo',
})
const allStyles = doc.documentElement.findAll((el) => el.id === 'rl-suggest-style')
assert.equal(allStyles.length, 1)

const section2 = handle2.element as unknown as FakeElement
assert.ok(section2.toHTML().includes('Comentarios'))
assert.ok(section2.toHTML().includes('Abrir correo'))
assert.ok(section2.toHTML().includes('mailto:soporte@reoxlab.com'))

// title/intro con HTML no se interpretan como HTML (van como texto)
const container3 = doc.createElement('div')
doc.body.appendChild(container3)
const handle3 = renderSuggestBox(container3 as unknown as HTMLElement, {
  toolName: 'TableRL',
  title: '<b>Negrita</b>',
  intro: 'Texto <script>alert(1)</script> normal',
})
const section3 = handle3.element as unknown as FakeElement
const heading3 = section3.find((el) => el.tagName === 'h2')!
const intro3 = section3.find((el) => el.className === 'rl-suggest-intro')!
assert.equal(heading3.children.length, 0)
assert.equal(heading3.textContent, '<b>Negrita</b>')
assert.equal(intro3.children.length, 0)
assert.equal(intro3.textContent, 'Texto <script>alert(1)</script> normal')
handle3.dispose()
assert.equal(container3.children.length, 0)

// Rechazo de navigator.clipboard.writeText cae al respaldo execCommand
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    clipboard: {
      writeText: async (_value: string) => {
        throw new Error('permiso denegado')
      },
    },
  },
})
doc.execCommandResult = true
copyButton.dispatch('click')
await flushMicrotasks()
assert.equal(copyButton.textContent, '¡Copiado!')
assert.deepEqual(doc.execCommandCalls.slice(-1), ['copy'])

// Respaldo de copia sin navigator.clipboard (execCommand + restauración de foco)
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {},
})
const copyButton2 = section2.find((el) => el.className === 'rl-suggest-copy')!
const hint2 = section2.find((el) => el.className === 'rl-suggest-hint')!
copyButton2.focus()
doc.execCommandResult = true
copyButton2.dispatch('click')
await flushMicrotasks()
assert.deepEqual(doc.execCommandCalls.slice(-1), ['copy'])
assert.equal(copyButton2.textContent, '¡Copiado!')
assert.equal(doc.activeElement, copyButton2)

// Fallo al copiar muestra mensaje en hint con el correo
doc.execCommandResult = false
copyButton2.dispatch('click')
await flushMicrotasks()
assert.equal(hint2.hidden, false)
assert.equal(hint2.textContent, 'No se pudo copiar; el correo es soporte@reoxlab.com.')

// Tras el fallo, una copia correcta limpia el aviso de error
doc.execCommandResult = true
copyButton2.dispatch('click')
await flushMicrotasks()
assert.equal(copyButton2.textContent, '¡Copiado!')
assert.equal(hint2.textContent, 'Correo copiado.')
assert.equal(hint2.hidden, false)

// Restaurar navigator si existía
if (originalNavigatorDescriptor) {
  Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor)
}

// dispose() quita listeners, elimina el nodo y deja de reaccionar
handle.dispose()
assert.equal(container.children.length, 0)
handle.dispose()
assert.equal(container.children.length, 0)
assert.equal(textarea.listeners.get('input')?.length ?? 0, 0)
assert.equal(sendButton.listeners.get('click')?.length ?? 0, 0)
assert.equal(copyButton.listeners.get('click')?.length ?? 0, 0)

locationStub.href = ''
textarea.value = 'Esto no debe enviarse'
textarea.dispatch('input')
sendButton.dispatch('click')
assert.equal(locationStub.href, '')
assert.equal(sentTexts.length, 1)

handle2.dispose()
assert.equal(container2.children.length, 0)

console.log('test-suggest: OK')
