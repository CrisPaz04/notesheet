"""Campaña de mutantes de colocarPaneles.js y ortografia.js.

Rompe una cosa cada vez, pasa los tests que tocan ese archivo y apunta si
alguno lo detecta. El original se guarda en memoria y se escribe de vuelta pase
lo que pase (finally), así que no hace falta git ni copias de seguridad.

    py -3 scripts/mutantes-paneles-ortografia.py

Tres sobreviven y son equivalentes (no cambian lo que se ve): `d >= 6` en
conLetra (con 6 semitonos las dos dan null), la alteración escrita con bemol
(donde actúa, DOb y LAbm, las notas de fuera de la escala son naturales) y
nombrarNota con negativos (solo recibe 0-11). Si sobrevive otro, falta un test.

Stryker no sirve aquí tal cual: @notesheet/core llega por un enlace del
workspace, así que solo ve los mutantes en modo "en el sitio", y en ese modo
copia y restaura todos los archivos del proyecto (pisa lo que se edite mientras
corre) y tarda horas, porque arranca el entorno de tests entero por mutante.
"""
import shutil, subprocess, pathlib

RAIZ = pathlib.Path(__file__).resolve().parents[1]
WEB = RAIZ / 'apps' / 'web'

PANELES = 'apps/web/src/components/herramientas/colocarPaneles.js'
ORTO = 'packages/core/src/music/ortografia.js'
T_PANELES = ['src/test/colocarPaneles.test.js', 'src/test/propiedades.test.js', 'src/test/herramientasFlotantes.test.jsx']
T_ORTO = ['src/test/ortografia.test.js', 'src/test/propiedades.test.js', 'src/test/transposition.test.js',
          'src/test/songRendering.test.js', 'src/test/acordes.test.js', 'src/test/double-accidentals.test.js']

MUTANTES = [
    # --- colocarPaneles: el arreglo nuevo y lo de antes
    (PANELES, 'deshace el arreglo: el fijo no baja por los de encima', 'Math.max(masBajo, Math.min(fijo.top, masAlto))', 'Math.max(limites.minTop, Math.min(fijo.top, masAlto))'),
    (PANELES, 'frontera: masBajo <= masAlto pasa a <', 'masBajo <= masAlto', 'masBajo < masAlto'),
    (PANELES, 'sin hueco entre paneles al reservar', 'lista.reduce((suma, p) => suma + p.alto + HUECO, 0)', 'lista.reduce((suma, p) => suma + p.alto, 0)'),
    (PANELES, 'sin reserva para los de debajo', "{ ...limites, maxBottom: limites.maxBottom - resto }", '{ ...limites }'),
    (PANELES, 'sin reserva para los de encima', "{ ...limites, minTop: limites.minTop + resto }", '{ ...limites }'),
    (PANELES, 'los de debajo se quedan en su sitio aunque pisen', 'acotar(Math.max(p.top, borde), p.alto,', 'acotar(p.top, p.alto,'),
    (PANELES, 'reparto encima/debajo: >= pasa a >', 'centro(p) >= centro(fijo)', 'centro(p) > centro(fijo)'),
    (PANELES, 'ladoPorPosicion: < pasa a <=', 'centroX < anchoVentana / 2', 'centroX <= anchoVentana / 2'),
    (PANELES, 'alturaInicial: >= pasa a >', 'top >= limites.minTop ? top', 'top > limites.minTop ? top'),
    (PANELES, 'acotar sin tope inferior', 'Math.max(minTop, Math.min(top, maxBottom - alto))', 'Math.min(top, maxBottom - alto)'),
    # --- ortografía
    (ORTO, 'escala mayor con la séptima menor', 'const ESCALA_MAYOR = [0, 2, 4, 5, 7, 9, 11];', 'const ESCALA_MAYOR = [0, 2, 4, 5, 7, 9, 10];'),
    (ORTO, 'conLetra: > 6 pasa a >= 6', 'if (d > 6) d -= 12;', 'if (d >= 6) d -= 12;'),
    (ORTO, 'empate FA#/SOLb al revés', "preferencia === 'b' ? 'SOLb' : 'FA#'", "preferencia === '#' ? 'SOLb' : 'FA#'"),
    (ORTO, 'empate RE#m/MIbm al revés', "preferencia === '#' ? 'RE#m' : 'MIbm'", "preferencia === 'b' ? 'RE#m' : 'MIbm'"),
    (ORTO, 'direccionDe no ve los sostenidos', "if (o[10] === 'LA#') return '#';", ''),
    (ORTO, 'direccionDe no ve los bemoles', "if (o[1] === 'REb' || o[6] === 'SOLb') return 'b';", ''),
    (ORTO, 'sin sensible en las menores', 'if (nombre) nombres[sensible] = nombre;', ''),
    (ORTO, 'la relativa mayor a +4 en vez de +3', 'const relativaMayor = t.menor ? (t.indice + 3) % 12 : t.indice;', 'const relativaMayor = t.menor ? (t.indice + 4) % 12 : t.indice;'),
    (ORTO, 'se ignora la alteración escrita (#)', "if (t.alteracion === '#' && base !== SOSTENIDOS) base = SOSTENIDOS;", ''),
    (ORTO, 'se ignora la alteración escrita (b)', "if (t.alteracion === 'b' && base !== BEMOLES) base = BEMOLES;", ''),
    (ORTO, 'neutra con LA# en vez de SIb', "export const ORTOGRAFIA_NEUTRA = ['DO', 'DO#', 'RE', 'MIb', 'MI', 'FA', 'FA#', 'SOL', 'LAb', 'LA', 'SIb', 'SI'];", "export const ORTOGRAFIA_NEUTRA = ['DO', 'DO#', 'RE', 'MIb', 'MI', 'FA', 'FA#', 'SOL', 'LAb', 'LA', 'LA#', 'SI'];"),
    (ORTO, 'nombrarNota sin módulo para negativos', 'ortografia[((indice % 12) + 12) % 12]', 'ortografia[indice % 12]'),
]


def pasar(tests):
    npx = shutil.which('npx') or 'npx'
    r = subprocess.run([npx, 'vitest', 'run', *tests], cwd=WEB, capture_output=True, text=True, encoding='utf8', errors='replace')
    return r.returncode == 0


resultados = []
for ruta, nombre, buscar, poner in MUTANTES:
    archivo = RAIZ / ruta
    original = archivo.read_bytes()
    texto = original.decode('utf8')
    if texto.count(buscar) != 1:
        resultados.append(('NO APLICA', ruta, nombre)); print('NO APLICA', nombre, flush=True); continue
    try:
        archivo.write_bytes(texto.replace(buscar, poner).encode('utf8'))
        sobrevive = pasar(T_PANELES if ruta == PANELES else T_ORTO)
    finally:
        archivo.write_bytes(original)
    estado = 'SOBREVIVE' if sobrevive else 'detectado'
    resultados.append((estado, ruta, nombre)); print(estado, '-', nombre, flush=True)

print()
print('detectados', sum(r[0] == 'detectado' for r in resultados), 'de', len(resultados))
for r in resultados:
    if r[0] != 'detectado': print(r[0], r[1].split('/')[-1], '-', r[2])
