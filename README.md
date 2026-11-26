# rl-suggest

Buzón de sugerencias compartido por las herramientas web de Reox Lab
(TableRL, PlotRL, DifRL y las que vengan). En vez de que cada herramienta
implemente su propio formulario o enlace de contacto por separado, aquí vive
un único componente sin framework y sin backend: construye un enlace `mailto:`
con asunto y cuerpo codificados y abre la app de correo del usuario.

- **Sin backend ni secretos:** no hace peticiones de red, no guarda datos y no
  depende de servicios de terceros.
- **Control del usuario:** el mensaje solo se envía si el usuario lo envía
  desde su propia aplicación de correo.
- **Adaptado al tema:** usa las variables CSS de la herramienta (claro y
  oscuro vía `[data-theme]`) sin JavaScript adicional de tema.
- **Sin dependencias** en tiempo de ejecución. Solo TypeScript.
- **Licencia:** GPL v3 (todo derivado sigue libre).

## Instalación

Desde GitHub:

```sh
npm install git+https://github.com/reoxlab/rl-suggest.git
```

O desde Gitea (espejo privado; requiere autenticación):

```sh
npm install git+https://git.reoxlab.com/fpena/rl-suggest.git
```

## Uso rápido

Una sola llamada renderiza el buzón completo dentro del contenedor que elijas
e inyecta sus estilos una sola vez por documento:

```ts
import { renderSuggestBox } from 'rl-suggest'

const container = document.querySelector<HTMLElement>('#suggest-root')!

const suggest = renderSuggestBox(container, {
  toolName: 'TableRL',
  // Opcional: registrar analítica cuando el usuario pulsa «Enviar sugerencia».
  // `track()` es el helper local de cada app (Umami con try/catch y `?.`).
  onSend: () => track('tablerl-suggest-send'),
})

// Al desmontar o cambiar de vista, quita los listeners y elimina la sección:
suggest.dispose()
```

### Opciones (`SuggestBoxOptions`)

| Opción | Tipo | Por defecto | Descripción |
| --- | --- | --- | --- |
| `toolName` | `string` | *(obligatorio)* | Nombre de la herramienta, p. ej. `'TableRL'`. Se incluye en el asunto (`[Sugerencia TableRL]`). |
| `email` | `string` | `'contacto@reoxlab.com'` | Dirección de destino. |
| `title` | `string` | `'¿Tienes una sugerencia?'` | Título del bloque (`<h2>`). |
| `intro` | `string` | `'Cuéntanos qué mejorarías o qué echas en falta. Se abre tu app de correo con el mensaje listo; no se envía nada sin que tú lo envíes.'` | Texto introductorio bajo el título. |
| `placeholder` | `string` | `'Escribe tu sugerencia…'` | Placeholder del `<textarea>`. |
| `submitLabel` | `string` | `'Enviar sugerencia'` | Etiqueta del botón principal. |
| `maxLength` | `number` | `500` | Longitud máxima del `<textarea>` (con contador `n/500 caracteres`). El `mailto:` codificado crece con el texto: 500 es el límite práctico para que la URL no se trunque en los clientes de correo. |
| `onSend` | `(text: string) => void` | `undefined` | Callback opcional que recibe el texto ya recortado al pulsar enviar. |

## Funciones puras

Si una herramienta prefiere construir su propia interfaz y reutilizar solo la
generación del asunto y el `mailto:`:

```ts
import {
  SUGGEST_EMAIL_DEFAULT,
  buildSuggestMailto,
  suggestSubject,
} from 'rl-suggest'

const subject = suggestSubject('TableRL')
// '[Sugerencia TableRL]'

const href = buildSuggestMailto('TableRL', 'Me gustaría exportar a CSV')
// 'mailto:contacto@reoxlab.com?subject=%5BSugerencia%20TableRL%5D&body=Me%20gustar%C3%ADa%20exportar%20a%20CSV'
```

| Exportación | Qué hace |
| --- | --- |
| `SUGGEST_EMAIL_DEFAULT` | Correo por defecto (`'contacto@reoxlab.com'`) |
| `SUGGEST_STYLE` | Hoja de estilos CSS inyectada bajo `.rl-suggest` |
| `suggestSubject(toolName)` | Devuelve `[Sugerencia <toolName>]`; lanza `TypeError` si está vacío |
| `buildSuggestMailto(toolName, text, email?)` | Construye el enlace `mailto:` con asunto y cuerpo codificados con `encodeURIComponent` |
| `renderSuggestBox(container, options)` | Renderiza el buzón en `container` y devuelve `{ element, dispose }` |
| `SuggestBoxOptions`, `SuggestBoxHandle` | Tipos del componente |

## Comportamiento

- El botón de envío permanece deshabilitado mientras el `<textarea>` esté
  vacío o solo contenga espacios.
- Al pulsar «Enviar sugerencia» se llama a `onSend?.(textoRecortado)`, se
  abre `window.location.href = mailto` y se muestra un aviso de
  confirmación; el texto escrito **no** se borra por si el usuario
  necesita copiarlo o volver a intentarlo.
- El `<textarea>` tiene `maxlength` 500 por defecto (opción `maxLength`)
  con contador visible; los saltos de línea del cuerpo se normalizan a
  CRLF (`%0D%0A`, RFC 6068).
- El enlace directo `mailto:` incluye un botón «Copiar correo» que usa
  `navigator.clipboard.writeText` con respaldo clásico (`execCommand('copy')`)
  y muestra un aviso con la dirección si la copia falla.
- No realiza ninguna petición de red, no guarda nada en el navegador y no usa
  secretos ni servicios externos.

## CSS y tema

`renderSuggestBox` inserta una sola vez por documento un
`<style id="rl-suggest-style">` con todas las reglas encapsuladas bajo
`.rl-suggest`. El diseño responde automáticamente a los temas claro y oscuro
definidos por la app en `:root` y `[data-theme='dark']` leyendo estas
variables (todas con valores de reserva):

- `--panel`, `--fondo`, `--fondo-suave`
- `--carbon`, `--texto-suave`
- `--borde`, `--borde-fuerte`
- `--vino`, `--vino-boton`
- `--radio`

## Versionado

Como en `rl-ui`, conviene fijar la dependencia por commit en `package.json`
para evitar cambios inesperados al reinstalar:

```json
{
  "dependencies": {
    "rl-suggest": "git+https://github.com/reoxlab/rl-suggest.git#<commit>"
  }
}
```

Usa el transporte `git+https`, no el atajo `github:`: npm lo normaliza a
`git+ssh` en el lockfile y el build de Docker en Skynet no tiene claves
SSH (el `Dockerfile` lleva además `RUN apk add --no-cache git` antes de
`npm install`/`npm ci`).

> Nota: el commit de GitHub se publica por snapshot (Contents API), así
> que su SHA difiere del commit git de Gitea (`main`/`dev`); ambos
> árboles son idénticos byte a byte y el pin usa el SHA de GitHub. El
> espejo Gitea (`fpena/rl-suggest`) es privado y requiere autenticación;
> la vía pública es GitHub.

v1.0.1: centrado del bloque, límite 500 con contador, CRLF en el cuerpo,
orden de `onSend` y menores de revisión.

## Desarrollo

```sh
npm install
npm run build # tsc → dist/ (ESM + declaraciones .d.ts)
npm test      # pruebas con esbuild + node
```

## Licencia

GPL v3. Ver `LICENSE`.
