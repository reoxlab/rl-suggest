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

// rl-suggest — buzón de sugerencias compartido (mailto).
//
// Componente sin framework ni backend compartido por las herramientas web de
// Reox Lab (TableRL, PlotRL, DifRL y las que vengan). En vez de enviar datos a
// un servidor, construye un enlace `mailto:` con asunto y cuerpo codificados y
// abre la app de correo del usuario: no se envía nada sin que el usuario lo
// envíe explícitamente.
//
// Dos niveles de uso:
// - Funciones puras (`suggestSubject`, `buildSuggestMailto`): útiles si una
//   herramienta quiere armar su propio botón o enlace.
// - `renderSuggestBox`: renderiza la sección completa dentro de un contenedor,
//   inyecta su CSS una sola vez por documento usando las variables de tema de
//   la app y devuelve un manejador con `dispose()`.

export const SUGGEST_EMAIL_DEFAULT: string = 'contacto@reoxlab.com'

const DEFAULT_TITLE = '¿Tienes una sugerencia?'
const DEFAULT_INTRO =
  'Cuéntanos qué mejorarías o qué echas en falta. Se abre tu app de correo con el mensaje listo; no se envía nada sin que tú lo envíes.'
const DEFAULT_PLACEHOLDER = 'Escribe tu sugerencia…'
const DEFAULT_SUBMIT_LABEL = 'Enviar sugerencia'
const DEFAULT_COPY_LABEL = 'Copiar correo'
const DEFAULT_MAX_LENGTH = 500
const COPIED_LABEL = '¡Copiado!'
const COPY_FEEDBACK_MS = 2000
const STYLE_ELEMENT_ID = 'rl-suggest-style'

let instanceCounter = 0

export const SUGGEST_STYLE: string = `
.rl-suggest {
  box-sizing: border-box;
  max-width: 42rem;
  margin: 1.5rem auto;
  padding: 1.25rem 1.5rem;
  background: var(--panel, #ffffff);
  color: var(--carbon, #131315);
  border: 1px solid var(--borde, #e3c9cd);
  border-radius: var(--radio, 10px);
}

.rl-suggest *,
.rl-suggest *::before,
.rl-suggest *::after {
  box-sizing: border-box;
}

.rl-suggest h2 {
  margin: 0 0 0.4rem;
  font-size: 1.125rem;
  line-height: 1.3;
  color: var(--carbon, #131315);
}

.rl-suggest .rl-suggest-intro {
  margin: 0 0 0.85rem;
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--texto-suave, #5b5560);
}

.rl-suggest .rl-suggest-label {
  display: block;
  margin: 0 0 0.35rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--carbon, #131315);
}

.rl-suggest .rl-suggest-text {
  display: block;
  width: 100%;
  min-height: 6rem;
  padding: 0.65rem 0.75rem;
  font: inherit;
  line-height: 1.45;
  color: var(--carbon, #131315);
  background: var(--fondo, #ffffff);
  border: 1px solid var(--borde-fuerte, #d3adb4);
  border-radius: calc(var(--radio, 10px) * 0.75);
  resize: vertical;
}

.rl-suggest .rl-suggest-text::placeholder {
  color: var(--texto-suave, #5b5560);
  opacity: 0.8;
}

.rl-suggest .rl-suggest-text:focus-visible {
  outline: 2px solid var(--vino, #80001e);
  outline-offset: 2px;
}

.rl-suggest .rl-suggest-count {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: var(--texto-suave, #5b5560);
  text-align: right;
}

.rl-suggest .rl-suggest-actions {
  margin-top: 0.75rem;
}

.rl-suggest .rl-suggest-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-block-size: 2.35rem;
  padding: 0.5rem 1.1rem;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 600;
  color: #ffffff;
  background: var(--vino-boton, #80001e);
  border: 1px solid transparent;
  border-radius: calc(var(--radio, 10px) * 0.75);
  cursor: pointer;
}

.rl-suggest .rl-suggest-send:hover:not(:disabled) {
  filter: brightness(1.08);
}

.rl-suggest .rl-suggest-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rl-suggest .rl-suggest-send:focus-visible {
  outline: 2px solid var(--vino, #80001e);
  outline-offset: 2px;
}

.rl-suggest .rl-suggest-hint {
  margin: 0.65rem 0 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--texto-suave, #5b5560);
}

.rl-suggest .rl-suggest-hint[hidden] {
  display: none;
}

.rl-suggest .rl-suggest-mail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin: 0.9rem 0 0;
  padding-top: 0.75rem;
  border-top: 1px solid var(--borde, #e3c9cd);
  font-size: 0.86rem;
  line-height: 1.45;
  color: var(--texto-suave, #5b5560);
}

.rl-suggest .rl-suggest-mail a {
  color: var(--vino, #80001e);
  text-underline-offset: 2px;
}

.rl-suggest .rl-suggest-mail a:focus-visible {
  outline: 2px solid var(--vino, #80001e);
  outline-offset: 2px;
}

.rl-suggest .rl-suggest-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-block-size: 1.75rem;
  padding: 0.2rem 0.6rem;
  font: inherit;
  font-size: 0.82rem;
  color: var(--carbon, #131315);
  background: transparent;
  border: 1px solid var(--borde-fuerte, #d3adb4);
  border-radius: calc(var(--radio, 10px) * 0.6);
  cursor: pointer;
}

.rl-suggest .rl-suggest-copy:hover {
  background: var(--fondo-suave, #f3e1e5);
}

.rl-suggest .rl-suggest-copy:focus-visible {
  outline: 2px solid var(--vino, #80001e);
  outline-offset: 2px;
}
`.trim()

export function suggestSubject(toolName: string): string {
  if (typeof toolName !== 'string' || toolName.trim().length === 0) {
    throw new TypeError('rl-suggest: `toolName` no puede estar vacío')
  }
  return `[Sugerencia ${toolName.trim()}]`
}

export function buildSuggestMailto(
  toolName: string,
  text: string,
  email?: string,
): string {
  const subject = suggestSubject(toolName)
  const recipient = resolveEmail(email)
  // RFC 6068: los saltos de línea del cuerpo van como CRLF (%0D%0A).
  const body = (typeof text === 'string' ? text.trim() : '').replace(/\r?\n/g, '\r\n')
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export interface SuggestBoxOptions {
  /** Nombre de la herramienta, p. ej. 'TableRL'. Va en el asunto. */
  toolName: string
  /** Destinatario. Por defecto 'contacto@reoxlab.com'. */
  email?: string
  /** Título. Por defecto '¿Tienes una sugerencia?' */
  title?: string
  /** Texto corto bajo el título. Por defecto:
      'Cuéntanos qué mejorarías o qué echas en falta. Se abre tu app de
      correo con el mensaje listo; no se envía nada sin que tú lo envíes.' */
  intro?: string
  /** Placeholder del textarea. Por defecto 'Escribe tu sugerencia…'. */
  placeholder?: string
  /** Texto del botón. Por defecto 'Enviar sugerencia'. */
  submitLabel?: string
  /** Longitud máxima del textarea. Por defecto 500 (límite práctico
      del `mailto:`: el cuerpo codificado crece con el texto y muchos
      clientes truncan URLs largas). */
  maxLength?: number
  /** Se llama al pulsar «Enviar sugerencia» con el texto ya recortado
      (la app lo usa para su analítica, p. ej. evento Umami). */
  onSend?: (text: string) => void
}

export interface SuggestBoxHandle {
  /** El <section> renderizado. */
  readonly element: HTMLElement
  /** Quita los listeners y elimina la sección del DOM. */
  dispose(): void
}

export function renderSuggestBox(
  container: HTMLElement,
  options: SuggestBoxOptions,
): SuggestBoxHandle {
  if (!isElementLike(container)) {
    throw new TypeError('rl-suggest: `container` debe ser un elemento del DOM')
  }
  if (!options || typeof options !== 'object') {
    throw new TypeError('rl-suggest: `options` es obligatorio')
  }
  // Valida `toolName` antes de tocar el DOM.
  suggestSubject(options.toolName)

  const doc = resolveDocument(container)
  injectStyleOnce(doc, container)

  const recipient = resolveEmail(options.email)
  const titleText = options.title ?? DEFAULT_TITLE
  const introText = options.intro ?? DEFAULT_INTRO
  const placeholderText = options.placeholder ?? DEFAULT_PLACEHOLDER
  const submitLabelText = options.submitLabel ?? DEFAULT_SUBMIT_LABEL
  const maxLength = resolveMaxLength(options.maxLength)

  instanceCounter += 1
  const textId = `rl-suggest-text-${instanceCounter}`
  const introId = `rl-suggest-intro-${instanceCounter}`

  const section = doc.createElement('section')
  section.className = 'rl-suggest'
  section.setAttribute('aria-label', 'Buzón de sugerencias')

  const heading = doc.createElement('h2')
  heading.textContent = titleText
  section.appendChild(heading)

  const intro = doc.createElement('p')
  intro.className = 'rl-suggest-intro'
  intro.id = introId
  intro.textContent = introText
  section.appendChild(intro)

  const label = doc.createElement('label')
  label.className = 'rl-suggest-label'
  label.setAttribute('for', textId)
  label.textContent = 'Tu sugerencia'
  section.appendChild(label)

  const textarea = doc.createElement('textarea') as HTMLTextAreaElement
  textarea.id = textId
  textarea.className = 'rl-suggest-text'
  textarea.setAttribute('rows', '4')
  textarea.setAttribute('maxlength', String(maxLength))
  textarea.setAttribute('aria-describedby', introId)
  textarea.placeholder = placeholderText
  textarea.value = ''
  section.appendChild(textarea)

  const count = doc.createElement('p')
  count.className = 'rl-suggest-count'
  count.textContent = `0/${maxLength} caracteres`
  section.appendChild(count)

  const actions = doc.createElement('div')
  actions.className = 'rl-suggest-actions'

  const sendButton = doc.createElement('button') as HTMLButtonElement
  sendButton.type = 'button'
  sendButton.className = 'rl-suggest-send'
  sendButton.textContent = submitLabelText
  sendButton.disabled = true
  actions.appendChild(sendButton)
  section.appendChild(actions)

  const hint = doc.createElement('p')
  hint.className = 'rl-suggest-hint'
  hint.setAttribute('role', 'status')
  hint.hidden = true
  section.appendChild(hint)

  const mailLine = doc.createElement('p')
  mailLine.className = 'rl-suggest-mail'
  appendText(doc, mailLine, 'O escríbenos directamente a ')

  const mailLink = doc.createElement('a') as HTMLAnchorElement
  mailLink.setAttribute('href', `mailto:${recipient}`)
  mailLink.textContent = recipient
  mailLine.appendChild(mailLink)

  appendText(doc, mailLine, ' ')

  const copyButton = doc.createElement('button') as HTMLButtonElement
  copyButton.type = 'button'
  copyButton.className = 'rl-suggest-copy'
  copyButton.textContent = DEFAULT_COPY_LABEL
  mailLine.appendChild(copyButton)

  section.appendChild(mailLine)
  container.appendChild(section)

  let disposed = false
  let copyTimer: ReturnType<typeof setTimeout> | undefined

  function showHint(message: string): void {
    hint.textContent = message
    hint.hidden = false
  }

  function updateSendDisabled(): void {
    sendButton.disabled = textarea.value.trim().length === 0
  }

  function onInput(): void {
    updateSendDisabled()
    count.textContent = `${textarea.value.length}/${maxLength} caracteres`
  }

  function onSendClick(): void {
    const trimmed = textarea.value.trim()
    if (trimmed.length === 0) {
      sendButton.disabled = true
      return
    }
    const mailto = buildSuggestMailto(options.toolName, trimmed, recipient)
    options.onSend?.(trimmed)
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = mailto
    }
    showHint('Se intentó abrir tu app de correo con la sugerencia lista para enviar.')
  }

  function markCopied(): void {
    if (disposed) return
    if (copyTimer !== undefined) {
      clearTimeout(copyTimer)
    }
    copyButton.textContent = COPIED_LABEL
    showHint('Correo copiado.')
    copyTimer = setTimeout(() => {
      copyTimer = undefined
      if (!disposed) {
        copyButton.textContent = DEFAULT_COPY_LABEL
      }
    }, COPY_FEEDBACK_MS)
  }

  function markCopyFailed(): void {
    if (disposed) return
    showHint(`No se pudo copiar; el correo es ${recipient}.`)
  }

  function onCopyClick(): void {
    void copyToClipboard(doc, recipient).then((ok) => {
      if (ok) {
        markCopied()
      } else {
        markCopyFailed()
      }
    })
  }

  textarea.addEventListener('input', onInput)
  sendButton.addEventListener('click', onSendClick)
  copyButton.addEventListener('click', onCopyClick)

  return {
    element: section,
    dispose: () => {
      if (disposed) return
      disposed = true
      if (copyTimer !== undefined) {
        clearTimeout(copyTimer)
        copyTimer = undefined
      }
      textarea.removeEventListener('input', onInput)
      sendButton.removeEventListener('click', onSendClick)
      copyButton.removeEventListener('click', onCopyClick)
      if (typeof section.remove === 'function') {
        section.remove()
      } else if (section.parentNode) {
        section.parentNode.removeChild(section)
      }
    },
  }
}

function resolveEmail(email?: string): string {
  if (typeof email === 'string' && email.trim().length > 0) {
    return email.trim()
  }
  return SUGGEST_EMAIL_DEFAULT
}

function resolveMaxLength(maxLength?: number): number {
  if (maxLength === undefined) return DEFAULT_MAX_LENGTH
  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    throw new TypeError('rl-suggest: `maxLength` debe ser un entero positivo')
  }
  return maxLength
}

function isElementLike(value: unknown): value is HTMLElement {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<HTMLElement>
  if (typeof candidate.appendChild !== 'function') return false
  if ('nodeType' in candidate && candidate.nodeType !== 1) return false
  return true
}

function resolveDocument(container: HTMLElement): Document {
  if (container.ownerDocument) return container.ownerDocument
  if (typeof document !== 'undefined') return document
  throw new TypeError('rl-suggest: no hay documento disponible para renderizar')
}

function injectStyleOnce(doc: Document, fallbackParent: HTMLElement): void {
  if (typeof doc.getElementById === 'function' && doc.getElementById(STYLE_ELEMENT_ID)) {
    return
  }
  const style = doc.createElement('style')
  style.id = STYLE_ELEMENT_ID
  style.textContent = SUGGEST_STYLE
  const target = doc.head ?? doc.documentElement ?? fallbackParent
  target.appendChild(style)
}

function appendText(doc: Document, parent: HTMLElement, text: string): void {
  if (typeof doc.createTextNode === 'function') {
    parent.appendChild(doc.createTextNode(text))
    return
  }
  const span = doc.createElement('span')
  span.textContent = text
  parent.appendChild(span)
}

async function copyToClipboard(doc: Document, text: string): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Si falla la API asíncrona (contexto no seguro o permiso denegado),
      // intenta el respaldo clásico con textarea temporal.
    }
  }
  return legacyCopy(doc, text)
}

function legacyCopy(doc: Document, text: string): boolean {
  if (!doc.body || typeof doc.execCommand !== 'function') return false
  const previousFocus = doc.activeElement as HTMLElement | null
  const temp = doc.createElement('textarea') as HTMLTextAreaElement
  temp.value = text
  temp.setAttribute('readonly', '')
  if (temp.style) {
    temp.style.position = 'fixed'
    temp.style.top = '0'
    temp.style.left = '-9999px'
    temp.style.opacity = '0'
  }
  doc.body.appendChild(temp)
  try {
    if (typeof temp.select === 'function') temp.select()
    return Boolean(doc.execCommand('copy'))
  } catch {
    return false
  } finally {
    if (typeof temp.remove === 'function') {
      temp.remove()
    } else if (temp.parentNode) {
      temp.parentNode.removeChild(temp)
    }
    if (previousFocus && typeof previousFocus.focus === 'function') {
      try {
        previousFocus.focus({ preventScroll: true })
      } catch {
        // Ignorar si el elemento previo ya no puede recibir foco.
      }
    }
  }
}
