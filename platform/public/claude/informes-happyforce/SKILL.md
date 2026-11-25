---
name: informes-happyforce
description: Publica y gestiona informes en los espacios de cliente de informes.myhappyforce.com (HTML, PDF, vídeos MP4 y enlaces) usando el conector MCP «informes». Úsala siempre que alguien de Happyforce quiera subir, publicar, compartir, sustituir o revisar un informe, un vídeo o un PDF en el espacio de un cliente («sube estos vídeos al espacio de Sabadell», «publica el informe de clima de Acme», «¿qué informes tiene X?», «da acceso a ana@cliente.com»), aunque no mencione la plataforma por su nombre.
---

# Informes Happyforce: publicar en los espacios de cliente

Customer Advisory comparte informes con cada cliente en un **espacio privado**
(`informes.myhappyforce.com/c/{cliente}`). Solo entran los emails con acceso
(login por enlace mágico). Cada informe vive en `/r/{slug}` y puede ser un HTML
autocontenido, un PDF, un vídeo o un enlace externo.

Todo se hace con las herramientas del conector MCP **informes**:
`list_clients`, `get_client`, `list_public_reports`, `create_client`,
`add_member`, `prepare_upload`, `publish_report`, `update_report`.

## 0. Comprueba la conexión

Si las herramientas `informes` no están disponibles o devuelven «Token no
válido», la persona tiene que crear su token en
https://informes.myhappyforce.com/admin/claude y seguir las instrucciones de esa
página. Para **subir ficheros** hace falta un terminal (Claude Code o la pestaña
Code de Claude Desktop): el fichero se sube con `curl`. Desde el chat sin
terminal solo se pueden consultar espacios, dar accesos y publicar enlaces.

## 1. Identifica el cliente

- `list_clients` si no sabes el slug; `get_client` para ver quién tiene acceso y
  qué informes tiene ya.
- Mira las tarjetas de los informes existentes de ese cliente y **sigue su
  estilo** (badges, tono de la descripción, color de portada) para que el
  espacio quede coherente.
- Si el cliente no existe, propón `create_client` (nombre, color de marca) y
  espera el sí.

## 2. Prepara cada fichero

**Vídeo.** Comprueba formato y peso antes de subir:

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

Para cada fichero:

1. `prepare_upload` con el nombre del fichero → devuelve `staged_path` y
   `upload_command`.
2. Ejecuta el `upload_command` sustituyendo `<RUTA_DEL_FICHERO>` por la ruta
   local (entre comillas). Con vídeos dale un timeout amplio (≥ 5 min). Debe
   devolver un JSON con `"Key"`.
3. `publish_report` con `client`, `staged_path` y los datos de la tarjeta.

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
- **«No encuentro el fichero subido»**: la subida falló o pasaron más de 2 h.
  Repite `prepare_upload` y la subida.
- **La subida devuelve 413 / «maximum allowed size»**: el fichero supera
  50 MB. Comprímelo (paso 2).
