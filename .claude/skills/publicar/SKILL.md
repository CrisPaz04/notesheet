---
name: publicar
description: Commit, push a master y comprobación del deploy de Netlify en producción, las tres cosas seguidas. Úsalo siempre que el usuario apruebe subir los cambios del repo: "commit y push", "aprobado, haz commit y push", "súbelo", "sube todo a producción", "publica los cambios", /publicar, aunque venga junto a otra petición. No lo uses si pide commit sin push, una rama o un PR, solo revisar un deploy, desplegar reglas de Firebase, o "publicar"/"subir" algo dentro de la app (una lista, un PDF).
---

# Publicar: commit, push y deploy comprobado

Cada push a `master` despliega a producción (Netlify). Publicar no termina en el
push: termina cuando se ha comprobado que producción sirve ese commit.

## 0. Qué se pidió exactamente

Este skill hace un push a producción, así que confirma antes que es eso lo que se
pidió. Si es solo una parte, haz solo esa parte:

- **"Comprueba el deploy"** a secas: solo el paso 3, sin commit ni push.
- **Commit sin push** ("pero no lo subas"): solo el commit, en local.
- **Rama o PR**: ese otro flujo, no un push a `master`.
- Si junto al "commit y push" viene otra tarea ("y luego ajustemos X"), publica
  primero lo que ya estaba aprobado y empieza la otra después.

## 1. Antes del commit

- `git status --short`: mira qué entra. Los archivos nuevos (`??`) también van;
  si hay algo que no debería subirse (datos de prueba, `.env`, archivos sueltos
  de un experimento), para y pregunta.
- Si hubo cambios de código desde la última comprobación, pasa los tests
  (`npm run test:run`) y el lint (`npm run lint --workspace=web`, 0 errores).
  Si algo falla, no publiques: dilo.
- Nunca subas la clave de GetSongBPM ni nada de `.env`.

## 2. Commit y push

- Mensaje en español, con el estilo del repo: `tipo(ámbito): qué cambia` y, debajo,
  por qué (mira `git log --oneline -10`). Termina con la línea de coautoría que
  indique el sistema.
- `git add -A`, commit, `git push origin master`.
- Comprueba con `git status -sb` que `master` queda igual que `origin/master`.

## 3. Comprobar el deploy

Con el conector de Netlify (herramientas `netlify-project-services-reader` y
`netlify-deploy-services-reader`; cárgalas con ToolSearch si están diferidas):

1. `get-projects` con `projectNameSearchValue: "notesheet"` (el sitio es
   `notesheet-app`) y toma `currentDeploy.id`.
2. `get-deploy-for-site` con ese id. Tiene que estar `state: "ready"`, sin
   `error_message`, y su `commit_ref` tiene que ser **el commit recién subido**.
   Si todavía es el anterior o está construyendo, espera un poco y vuelve a
   mirar (un build tarda unos 20–30 s). Si falló, di por qué con el
   `error_message` y los mensajes del resumen: un deploy fallido no se nota en la
   web, que sigue sirviendo el anterior.
3. Descarga lo publicado para confirmar que el cambio está en producción:
   `curl` de `https://notesheet-app.netlify.app/`, y en el JavaScript de
   `/assets/` busca algún texto o clase propia de lo que se acaba de cambiar
   (las vistas van en sus propios archivos: busca en los que enlaza el
   principal).
4. **CI** (GitHub Actions, `pruebas.yml`): Netlify despliega aunque CI falle, así
   que un deploy listo no dice nada de los tests. Busca la ejecución del commit
   (`gh run list --commit <sha>`) y espera a que acabe (`gh run watch <id>
   --exit-status`, unos 4–5 min). Si falla, mira `gh run view <id> --log-failed`
   y dilo en el informe. Ya pasó: un test que cargaba Firebase sin `.env` falló
   en CI dos push seguidos sin que nadie lo viera. Antes de subir, si se tocaron
   tests de componentes, pasa la suite con el `.env` apartado.

## 4. Informe

Corto: el hash del commit, que el deploy está listo (hora y duración) y qué se
comprobó que ya está en producción. Si la app estaba abierta, recordar que hay
que recargar para ver la versión nueva.
