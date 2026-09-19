"""
Convierte a PNG las paginas de una partitura, vengan como vengan.

El repertorio es mixto: unos PDF son fotos escaneadas (un bitmap incrustado) y
otros son tinta vectorial de una app de tableta (miles de trazos m/l/S). Este
script detecta cual es cada uno y hace lo que toque, pagina por pagina.

Uso:  python scripts/pdf-a-imagen.py entrada.pdf salida.png [ancho]

Con varias paginas escribe `salida-p1.png`, `salida-p2.png`...; con una sola
escribe `salida.png` tal cual.
"""

import re
import sys
import zlib
import struct


def valor_entero(dic, clave):
    m = re.search(clave.encode() + rb'\s+(\d+)', dic)
    return int(m.group(1)) if m else None


def escribir_png(ruta, ancho, alto, bits, canales, datos):
    tipo_color = {1: 0, 3: 2, 4: 6}[canales]
    bytes_fila = (ancho * canales * bits + 7) // 8
    esperado = bytes_fila * alto
    if len(datos) < esperado:
        datos = datos + b'\xff' * (esperado - len(datos))

    cuerpo = bytearray()
    for y in range(alto):
        cuerpo.append(0)
        cuerpo += datos[y * bytes_fila:(y + 1) * bytes_fila]

    def trozo(tipo, contenido):
        return (struct.pack('>I', len(contenido)) + tipo + contenido
                + struct.pack('>I', zlib.crc32(tipo + contenido) & 0xFFFFFFFF))

    png = b'\x89PNG\r\n\x1a\n'
    png += trozo(b'IHDR', struct.pack('>IIBBBBB', ancho, alto, bits, tipo_color, 0, 0, 0))
    png += trozo(b'IDAT', zlib.compress(bytes(cuerpo), 6))
    png += trozo(b'IEND', b'')
    open(ruta, 'wb').write(png)


def reducir(datos, ancho, alto, canales, factor):
    """Submuestrea para que la imagen quepa en algo legible."""
    na, nl = ancho // factor, alto // factor
    salida = bytearray(na * nl * canales)
    for y in range(nl):
        fo = (y * factor) * ancho * canales
        fd = y * na * canales
        for x in range(na):
            o = fo + (x * factor) * canales
            d = fd + x * canales
            salida[d:d + canales] = datos[o:o + canales]
    return bytes(salida), na, nl


# --- Recorrer el PDF ---------------------------------------------------------
#
# Son todos PDF 1.4 con objetos planos (`N 0 obj`) y sin flujos de objetos, asi
# que se pueden recorrer a base de expresiones regulares y no hace falta traer
# una libreria. Hay que ir pagina por pagina porque 27 de las partituras tienen
# mas de una, y antes se miraba solo el stream mas largo: es decir, una sola.

def objetos(data):
    """num -> (diccionario, stream crudo o None) de cada objeto indirecto."""
    tabla = {}
    for m in re.finditer(rb'(?:^|[\s>])(\d+)\s+\d+\s+obj\b', data):
        num = int(m.group(1))
        fin = data.find(b'endobj', m.end())
        cuerpo = data[m.end():fin if fin > 0 else len(data)]

        s = re.search(rb'stream\r?\n', cuerpo)
        if s:
            dic = cuerpo[:s.start()]
            largo = re.search(rb'/Length\s+(\d+)', dic)
            ini = s.end()
            crudo = (cuerpo[ini:ini + int(largo.group(1))] if largo
                     else cuerpo[ini:cuerpo.find(b'endstream', ini)])
        else:
            dic, crudo = cuerpo, None
        tabla[num] = (dic, crudo)
    return tabla


def referencias(dic, clave):
    """Los numeros de objeto a los que apunta /Clave, sea uno o un array."""
    m = re.search(clave.encode() + rb'\s*(\[[^\]]*\]|\d+\s+\d+\s+R)', dic)
    if not m:
        return []
    return [int(n) for n in re.findall(rb'(\d+)\s+\d+\s+R', m.group(1))]


def es_pagina(dic):
    return (re.search(rb'/Type\s*/Page\b', dic) is not None
            and re.search(rb'/Type\s*/Pages\b', dic) is None)


def paginas(tabla):
    """Numeros de objeto de las paginas, en el orden del arbol /Kids."""
    raices = [n for n, (dic, _) in tabla.items()
              if re.search(rb'/Type\s*/Pages\b', dic) and b'/Parent' not in dic]

    orden, vistos = [], set()

    def bajar(num):
        if num in vistos or num not in tabla:
            return
        vistos.add(num)
        dic = tabla[num][0]
        if es_pagina(dic):
            orden.append(num)
            return
        for hijo in referencias(dic, '/Kids'):
            bajar(hijo)

    for r in raices:
        bajar(r)

    if not orden:   # sin arbol reconocible: el orden en que aparecen
        orden = [n for n, (dic, _) in sorted(tabla.items()) if es_pagina(dic)]
    return orden


def medidas(tabla, num, saltos=8):
    """El /MediaBox de la pagina o, si no lo trae, el que hereda del padre."""
    while num in tabla and saltos > 0:
        dic = tabla[num][0]
        m = re.search(rb'/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)', dic)
        if m:
            return (abs(float(m.group(3)) - float(m.group(1))),
                    abs(float(m.group(4)) - float(m.group(2))))
        padre = referencias(dic, '/Parent')
        if not padre:
            break
        num, saltos = padre[0], saltos - 1
    return (1752.0, 2800.0)


def inflar(crudo):
    try:
        return zlib.decompress(crudo)
    except zlib.error:
        try:
            return zlib.decompressobj().decompress(crudo)
        except zlib.error:
            return crudo   # varios vienen sin comprimir


def contenido_de(tabla, num):
    """Los streams de /Contents de una pagina, descomprimidos y unidos."""
    trozos = [inflar(tabla[r][1]) for r in referencias(tabla[num][0], '/Contents')
              if r in tabla and tabla[r][1] is not None]
    return b'\n'.join(trozos)


def imagenes_de(tabla, num):
    """Los XObject de imagen que usa la pagina, de mayor a menor."""
    candidatos = []
    for rec in referencias(tabla[num][0], '/Resources'):
        if rec in tabla:
            candidatos += referencias(tabla[rec][0], '/XObject')

    dic = tabla[num][0]
    if not candidatos and b'/XObject' in dic:   # /Resources escrito en linea
        candidatos = [int(n) for n in re.findall(rb'(\d+)\s+\d+\s+R', dic)]

    utiles = []
    for o in candidatos:
        if o not in tabla:
            continue
        d, crudo = tabla[o]
        if crudo is None or b'/Image' not in d:
            continue
        a, h = valor_entero(d, '/Width'), valor_entero(d, '/Height')
        if a and h:
            utiles.append((a * h, d, a, h, crudo, canales_de(tabla, d)))
    utiles.sort(reverse=True, key=lambda t: t[0])
    return [(d, a, h, c, n) for _, d, a, h, c, n in utiles]


def canales_de(tabla, dic):
    """Cuantos bytes por pixel trae la imagen.

    No basta con buscar /DeviceRGB: varias partituras traen el espacio de color
    como `/ICCBased N 0 R`, y ahi el numero de componentes esta en el /N de ese
    objeto. Tomarlo por gris deja la imagen ilegible, con las filas corridas.
    """
    if b'/DeviceCMYK' in dic:
        return 4
    if b'/DeviceRGB' in dic:
        return 3
    if b'/DeviceGray' in dic:
        return 1

    m = re.search(rb'/ColorSpace\s*\[?\s*/ICCBased\s+(\d+)\s+\d+\s+R', dic)
    if m:
        ref = int(m.group(1))
        if ref in tabla:
            n = valor_entero(tabla[ref][0], '/N')
            if n in (1, 3, 4):
                return n
        return 3   # lo normal en un ICC incrustado de un escaneo

    m = re.search(rb'/ColorSpace\s+(\d+)\s+\d+\s+R', dic)
    if m and int(m.group(1)) in tabla:
        return canales_de(tabla, tabla[int(m.group(1))][0])

    return 1


# --- Dibujar -----------------------------------------------------------------

def como_tinta(contenido, w, h, salida, ancho_px):
    if len(contenido) < 2000 or b' l' not in contenido:
        return False

    tokens = contenido.replace(b'\r', b' ').replace(b'\n', b' ').split()
    segs, pila, grosor = [], [], 1.0
    voltear = not re.search(rb'^\s*1\s+0\s+0\s+-1\s', contenido[:40])

    for i, t in enumerate(tokens):
        try:
            if t == b'w' and i >= 1:
                grosor = float(tokens[i - 1])
            elif t == b'm' and i >= 2:
                pila = [(float(tokens[i - 2]), float(tokens[i - 1]))]
            elif t == b'l' and i >= 2 and pila:
                pila.append((float(tokens[i - 2]), float(tokens[i - 1])))
            elif t in (b'S', b's', b'f', b'B') and len(pila) > 1:
                segs += [(a[0], a[1], b[0], b[1], grosor) for a, b in zip(pila, pila[1:])]
                pila = []
        except ValueError:
            pila = []

    if len(segs) < 200:   # solo las rayas del cuaderno: no hay tinta
        return False

    escala = ancho_px / w
    ah = int(h * escala)
    lienzo = bytearray(b'\xff' * (ancho_px * ah))

    for x0, y0, x1, y1, g in segs:
        if voltear:
            y0, y1 = h - y0, h - y1
        ax, ay, bx, by = int(x0 * escala), int(y0 * escala), int(x1 * escala), int(y1 * escala)
        r = max(0, int(g * escala / 2))
        dx, dy = abs(bx - ax), -abs(by - ay)
        sx, sy = (1 if ax < bx else -1), (1 if ay < by else -1)
        err = dx + dy
        while True:
            for yy in range(ay - r, ay + r + 1):
                for xx in range(ax - r, ax + r + 1):
                    if 0 <= xx < ancho_px and 0 <= yy < ah:
                        lienzo[yy * ancho_px + xx] = 0
            if ax == bx and ay == by:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; ax += sx
            if e2 <= dx:
                err += dx; ay += sy

    escribir_png(salida, ancho_px, ah, 8, 1, bytes(lienzo))
    print(f'{salida}: tinta {len(segs)} trazos -> {ancho_px}x{ah}')
    return True


def como_imagen(imagenes, salida, ancho_px):
    """Si la pagina trae un bitmap incrustado, lo saca."""
    for dic, ancho, alto, crudo, canales in imagenes:
        bits = valor_entero(dic, '/BitsPerComponent') or 8

        if b'DCTDecode' in dic:          # JPEG: se guarda tal cual
            open(salida.replace('.png', '.jpg'), 'wb').write(crudo)
            print(f'{salida[:-4]}.jpg: JPEG {ancho}x{alto}')
            return True

        if b'FlateDecode' not in dic:
            continue

        try:
            pix = zlib.decompress(crudo)
        except zlib.error:
            try:
                pix = zlib.decompressobj().decompress(crudo)
            except zlib.error:
                continue

        factor = max(1, ancho // ancho_px)
        if factor > 1 and bits == 8:
            pix, ancho, alto = reducir(pix, ancho, alto, canales, factor)

        escribir_png(salida, ancho, alto, bits, canales, pix)
        print(f'{salida}: bitmap {ancho}x{alto} {bits}bit {canales}ch')
        return True
    return False


if __name__ == '__main__':
    entrada, salida = sys.argv[1], sys.argv[2]
    ancho_px = int(sys.argv[3]) if len(sys.argv) > 3 else 1100
    data = open(entrada, 'rb').read()

    tabla = objetos(data)
    pags = paginas(tabla)
    if not pags:
        print(f'{salida}: NO SE ENCONTRARON PAGINAS')
        sys.exit(1)

    fallos = 0
    for i, p in enumerate(pags, 1):
        destino = salida if len(pags) == 1 else salida[:-4] + f'-p{i}.png'
        w, h = medidas(tabla, p)
        if not como_tinta(contenido_de(tabla, p), w, h, destino, ancho_px):
            if not como_imagen(imagenes_de(tabla, p), destino, ancho_px):
                print(f'{destino}: NO SE PUDO EXTRAER')
                fallos += 1

    sys.exit(1 if fallos == len(pags) else 0)
