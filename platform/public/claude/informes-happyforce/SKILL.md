---
name: informes-happyforce
description: Publica y gestiona informes en los espacios de cliente de informes.myhappyforce.com (HTML, PDF, vídeos MP4 y enlaces) usando el conector MCP «informes». Úsala siempre que alguien de Happyforce quiera subir, publicar, compartir, sustituir o revisar un informe, un vídeo o un PDF en el espacio de un cliente («sube estos vídeos al espacio de Sabadell», «publica el informe de clima de Acme», «¿qué informes tiene X?», «da acceso a ana@cliente.com»), aunque no mencione la plataforma por su nombre.
---

# Informes Happyforce: publicar en los espacios de cliente

Customer Advisory comparte informes con cada cliente en un **espacio privado**
(`informes.myhappyforce.com/c/{cliente}`). Solo entran los emails con acceso
(login con código por email). Cada informe vive en `/r/{slug}` y puede ser un
HTML autocontenido, un PDF, un vídeo o un enlace externo.

Todo se hace con las herramientas del conector **Informes Happyforce**:
`list_clients`, `get_client`, `list_public_reports`, `create_client`,
`add_member`, `prepare_upload`, `check_upload`, `publish_report`,
`update_report`.

Funciona en el chat (Claude Desktop, web, móvil) y en Claude Code. La
diferencia es cómo llegan los ficheros: **con terminal** (Claude Code o pestaña
Code) los subes tú con `curl` y puedes revisarlos y comprimirlos; **sin
terminal** (chat) la persona los arrastra a un enlace de subida que le das.

## 0. Comprueba la conexión (y guía si falta)

Si tienes las herramientas del conector (`list_clients`, `prepare_upload`…),
llama a `list_clients`: si responde, sigue al paso 1.

Si no aparecen o piden autorización, **no sigas con la petición**: guía a la
persona y retómala después. Solo pueden conectarse cuentas `@myhappyforce.com`.

1. En Claude: **Ajustes → Conectores**, buscar **Informes Happyforce** y
   pulsar **Conectar**. (En Claude Code: `/mcp`, elegir «claude.ai Informes
   Happyforce» y autenticar.)
2. Se abre la web de informes: escribir su email @myhappyforce.com y el código
   que le llega por correo, en esa misma ventana.
3. Pulsar **Permitir**. Solo se hace una vez.
4. Volver a la conversación (en el chat, activar el conector en el menú «+» →
   Conectores si no está activo) y repetir la petición.

Si **Informes Happyforce no aparece** en la lista de conectores, el owner de la
organización aún no lo ha añadido: tiene las instrucciones en
https://informes.myhappyforce.com/admin/claude.

Si da error de autorización después de haber conectado, que pulse
«Desconectar» y «Conectar» de nuevo en Ajustes → Conectores. Nunca pidas
tokens ni códigos en el chat.

## 1. Identifica el cliente

- `list_clients` si no sabes el slug; `get_client` para ver quién tiene acceso y
  qué informes tiene ya.
- Mira las tarjetas de los informes existentes de ese cliente y **sigue su
  estilo** (badges, tono de la descripción, color de portada) para que el
  espacio quede coherente.
- Si el cliente no existe, propón `create_client` (nombre, color de marca) y
  espera el sí.

## 2. Prepara cada fichero

**Sin terminal (chat).** No puedes abrir ficheros locales ni comprimir. Si la
persona adjunta el HTML o el PDF al chat, léelo para redactar la tarjeta. Si
no, la sacarás de `check_upload` (paso 5), que devuelve los datos de un HTML
extraídos del propio fichero. Para un **vídeo** o un PDF que no hayas podido
leer, **pregunta en una línea de qué trata** antes de redactar la tarjeta. Si
un vídeo pasa de 50 MB, la página de subida lo rechaza: propón comprimirlo en
Claude Code.

**Vídeo (con terminal).** Comprueba formato y peso antes de subir:

```bash
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height -of compact "VIDEO"
```

Va bien tal cual si es **MP4 con H.264 + AAC y pesa menos de ~45 MB**. Si pesa
más, es `.mov`/HEVC u otro códec, propón comprimirlo (conserva el original):

```bash
ffmpeg -i "ENTRADA" -c:v libx264 -crf 23 -preset medium -vf "scale=-2:'min(1080,ih)'" -c:a aac -b:a 128k -movflags +faststart "SALIDA.mp4"
```

Si sigue por encima de 50 MB, sube el `-crf` a 26-28. El límite por fichero
del almacenamiento es 50 MB.

Para saber **de qué trata** el vídeo (no puedes verlo, pero sí leer
imágenes), saca 6 fotogramas repartidos por su duración en una carpeta
temporal y míralos:

```bash
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "VIDEO")
OUT=$(mktemp -d)
for i in 0 1 2 3 4 5; do
  ffmpeg -v error -ss "$(echo "$D * (0.03 + $i * 0.18)" | bc -l)" -i "VIDEO" -frames:v 1 -vf "scale=960:-2" "$OUT/frame-$i.jpg"
done
ls "$OUT"
```

Lee cada `frame-N.jpg`. Busca la diapositiva o el rótulo de título, el nombre
del cliente o del área, el periodo y las cifras que aparezcan en pantalla:
de ahí salen el título, la descripción y las stats. Usa solo lo que se lee
con claridad. Si después de mirar los fotogramas sigues sin saber de qué trata
(por ejemplo, es una grabación de pantalla sin rótulos), **pregunta en una
línea** qué cuenta el vídeo antes de redactar la tarjeta. No inventes el
contenido a partir del nombre del fichero. Borra la carpeta temporal al
terminar.

**HTML.** Lee el fichero: el título está en `<title>`/`<h1>`, el resumen en el
hero o la introducción, y los datos clave en las cifras grandes del hero.

**PDF.** Lee las primeras páginas para sacar título, resumen y cifras.

**Artefacto de Claude** (un informe hecho como artefacto o página en Claude).
Es un HTML, así que se publica como HTML, pero antes hay que conseguir el
fichero y asegurarse de que funciona fuera de Claude.

1. **Consigue el HTML.**
   - Si ya es un `.html` local, úsalo.
   - Si es un enlace `claude.ai/artifact/…` o `claude.ai/code/artifact/…`, léelo
     con la herramienta **Artifact** (`action: "read"`). Si la persona es la
     dueña, devuelve el HTML completo y dice en qué fichero lo ha guardado. Si
     devuelve solo un resumen, el artefacto es de otra persona: pide que lo
     suba su autor o que te pase el `.html`. **Nunca reconstruyas un informe a
     partir del resumen.**
   - Si no tienes la herramienta Artifact (por ejemplo, el artefacto se hizo en
     el chat de claude.ai), pide que lo descarguen desde el menú del artefacto
     (Descargar) y te pasen la ruta.
   - Si lo descargado es un `.jsx` (artefacto React del chat), no es una página:
     pide que lo exporten como HTML, o conviértelo tú en un HTML autocontenido
     (React y ReactDOM desde un CDN) y compruébalo en el navegador antes de
     seguir.
2. **Comprueba que no depende de Claude:**

   ```bash
   grep -noE 'window\.claude[.a-zA-Z]*|https://claude\.ai/[^"'"'"' )]*|(src|href)="(\./|/[a-z]|[a-zA-Z0-9_-]+\.(js|css|png|jpe?g|svg|webp|gif|json|csv))[^"]*"|fetch\(.[^h][^)]*\)' "INFORME.html"
   ```

   - `window.claude…` (datos guardados, estado compartido, comentarios,
     preguntas a Claude): fuera de Claude **no funciona**. Explica qué parte
     dejará de funcionar y propón quitarla o fijar sus datos en el HTML. No lo
     publiques sin un sí.
   - URLs de `claude.ai` (imágenes o ficheros del artefacto) o rutas relativas
     (`./datos.json`, `estilos.css`, `logo.png`, `fetch('datos.json')`): el
     cliente no podrá cargarlas.
     Descárgalas (con Artifact `read` y `path`, o pídeselas a la persona) y
     mételas en el HTML: imágenes como `data:` en base64, y CSS, JS y datos
     inline.
   - Las librerías y fuentes de CDNs públicos (cdnjs, jsdelivr, unpkg, Google
     Fonts) funcionan tal cual.
3. **Ábrelo en local** si tienes navegador, para ver que carga entero y que los
   gráficos se pintan. Después sigue como con cualquier HTML: la tarjeta sale
   del propio contenido.
4. Cuando el artefacto se actualice, sube la nueva versión con `update_report`
   (mismo slug), no como informe nuevo.

## 3. Redacta la tarjeta

- **title**: el del informe, ≤ 70 caracteres. Para una serie, nómbralos igual
  («EnergyMap · Banca Particulares», «EnergyMap · Banca Empresas»…).
- **description**: 1-2 frases (≤ 240 caracteres) que digan qué va a encontrar el
  cliente, no cómo se hizo. En español y de tú a tú, como el resto de Happyforce.
- **badges**: 1-3 etiquetas cortas (producto o tipo de informe y periodo:
  «EnergyMap», «Q3 2026»).
- **stats**: hasta 3 cifras **que aparezcan en el propio informe** (en un
  vídeo, las que se leen en los fotogramas). Nunca te las inventes; si no hay,
  déjalo vacío.
- **cover**: el color que ya use ese cliente, o `accent-orange` por defecto.
- **published_at**: hoy, salvo que te digan otra fecha.

## 4. Confirma antes de publicar

Publicar en un espacio lo hace **visible para el cliente**. Antes de subir nada,
enseña un resumen y espera el sí:

| Fichero | Tipo | Peso | Título | Cliente |
|---|---|---|---|---|

Con varios ficheros (p. ej. 3 vídeos), una sola tabla y una sola confirmación.

## 5. Sube y publica

**Con terminal**, para cada fichero:

1. `prepare_upload` con `file_name` → devuelve `staged_path` y
   `upload_command`.
2. Ejecuta el `upload_command` sustituyendo `<RUTA_DEL_FICHERO>` por la ruta
   local (entre comillas). Con vídeos dale un timeout amplio (≥ 5 min). Debe
   devolver un JSON con `"Key"`.
3. `publish_report` con `client`, `staged_path` y los datos de la tarjeta.

**Sin terminal (chat)**, para cada fichero:

1. `prepare_upload` sin `file_name` → devuelve `upload_id` y
   `upload_page_url`.
2. Pasa el enlace a la persona: «Abre este enlace y arrastra el fichero; dime
   cuando esté». Con varios ficheros, un enlace por fichero y di cuál es cuál.
3. Cuando diga que ya está, `check_upload` con el `upload_id`. Si aún no ha
   llegado, díselo y espera. Si ha llegado, usa su `staged_path` (y
   `extracted_from_file`, si lo trae, para la tarjeta).
4. `publish_report` con `client`, `staged_path` y los datos de la tarjeta.

La confirmación del paso 4 va **antes de publicar**; en el chat puedes pedir
que suban los ficheros primero y confirmar después con los datos ya a mano.

Para un **enlace** (Drive, Canva…): `publish_report` con `external_url`, sin
subida. Avisa de que la privacidad real depende de los permisos del enlace.

Para **sustituir** el fichero de un informe existente (nueva versión):
`prepare_upload` + subida + `update_report` con `slug` y `staged_path`. La URL
`/r/{slug}` no cambia. `update_report` también sirve para corregir solo la
tarjeta (pasa solo los campos que cambian).

## 6. Cierra

- Da el enlace de cada informe (`url`) y el del espacio (`space_url`).
- Si el espacio no tiene a nadie con acceso, pregunta si hay que darlo.
  `add_member` **envía un email al cliente en el momento**: no lo hagas sin un sí
  explícito con los emails exactos.

## Qué no se hace desde aquí

Quitar accesos y borrar informes o clientes: solo desde el panel
https://informes.myhappyforce.com/admin. Si te lo piden, da el enlace
`edit_url`/`admin_url` correspondiente.

## Errores frecuentes

- **«Ya existe un informe con la URL…»**: pasa otro `slug`, o usa
  `update_report` si es una nueva versión del mismo informe.
- **«No encuentro el fichero subido»**: la subida falló o pasaron más de 2 h
  (con curl). Repite `prepare_upload` y la subida.
- **`check_upload` dice que no ha llegado**: la persona no terminó de subirlo
  (o usó otro enlace). Que vuelva a la página y espere al «Fichero subido».
- **La subida devuelve 413 / «maximum allowed size»**: el fichero supera
  50 MB. Comprímelo (paso 2).
