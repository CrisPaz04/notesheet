"""
Convierte a PNG una pagina de partitura, venga como venga.

El repertorio es mixto: unos PDF son fotos escaneadas (un bitmap incrustado) y
otros son tinta vectorial de una app de tableta (miles de trazos m/l/S). Este
script detecta cual es cada uno y hace lo que toque.

Uso:  python scripts/pdf-a-imagen.py entrada.pdf salida.png [ancho]
"""

import re
import sys
import zlib
import struct


def objetos_stream(data):
    """Devuelve (diccionario, bytes) de cada stream, usando /Length del dict."""
    for m in re.finditer(rb'stream\r?\n', data):
        # El diccionario es lo que hay entre el `<<` mas cercano y `stream`
        d0 = data.rfind(b'<<', max(0, m.start() - 2000), m.start())
        if d0 < 0:
            continue
        dic = data[d0:m.start()]

        largo = re.search(rb'/Length\s+(\d+)', dic)
        ini = m.end()
        if largo:
            fin = ini + int(largo.group(1))
        else:
            fin = data.find(b'endstream', ini)
        yield dic, data[ini:fin]


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


def como_imagen(data, salida, ancho_px):
    """Si la pagina trae un bitmap incrustado, lo saca."""
    mejor = None
    for dic, crudo in objetos_stream(data):
        if b'/Image' not in dic or b'/Subtype' not in dic:
            continue
        ancho, alto = valor_entero(dic, '/Width'), valor_entero(dic, '/Height')
        if not ancho or not alto:
            continue
        if not mejor or ancho * alto > mejor[1] * mejor[2]:
            mejor = (dic, ancho, alto, crudo)

    if not mejor:
        return False

    dic, ancho, alto, crudo = mejor
    bits = valor_entero(dic, '/BitsPerComponent') or 8
    canales = 3 if b'/DeviceRGB' in dic else (4 if b'/DeviceCMYK' in dic else 1)

    if b'DCTDecode' in dic:          # JPEG: se guarda tal cual
        open(salida.replace('.png', '.jpg'), 'wb').write(crudo)
        print(f'{salida[:-4]}.jpg: JPEG {ancho}x{alto}')
        return True

    if b'FlateDecode' not in dic:
        return False

    try:
        pix = zlib.decompress(crudo)
    except zlib.error:
        try:
            pix = zlib.decompressobj().decompress(crudo)
        except zlib.error:
            return False

    factor = max(1, ancho // ancho_px)
    if factor > 1 and bits == 8:
        pix, ancho, alto = reducir(pix, ancho, alto, canales, factor)

    escribir_png(salida, ancho, alto, bits, canales, pix)
    print(f'{salida}: bitmap {ancho}x{alto} {bits}bit {canales}ch')
    return True


# --- Tinta vectorial ---------------------------------------------------------

def paginas_de_tinta(data):
    """Streams de contenido, vengan comprimidos o no.

    Algunos PDF guardan el contenido sin comprimir (`<< /Length N >>` a secas),
    asi que no basta con quedarse con los que inflan.
    """
    paginas = []
    for dic, crudo in objetos_stream(data):
        if b'/Image' in dic:
            continue
        try:
            s = zlib.decompress(crudo)
        except zlib.error:
            # Sin comprimir: se reconoce porque son operadores en texto plano
            s = crudo if re.match(rb'^[\sQq/\d.\-]', crudo[:1] or b'') else b''
        if len(s) > 2000 and b' l' in s:
            paginas.append(s)
    return paginas


def como_tinta(data, salida, ancho_px):
    paginas = paginas_de_tinta(data)
    contenido = max(paginas, key=len) if paginas else b''

    if not contenido:
        return False

    m = re.search(rb'/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)', data)
    w, h = (abs(float(m.group(3)) - float(m.group(1))),
            abs(float(m.group(4)) - float(m.group(2)))) if m else (1752.0, 2800.0)

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

    escribir_png(salida, lienzo, ancho_px, ah) if False else None
    # escribir_png espera (ruta, ancho, alto, bits, canales, datos)
    escribir_png(salida, ancho_px, ah, 8, 1, bytes(lienzo))
    print(f'{salida}: tinta {len(segs)} trazos -> {ancho_px}x{ah}')
    return True


if __name__ == '__main__':
    entrada, salida = sys.argv[1], sys.argv[2]
    ancho_px = int(sys.argv[3]) if len(sys.argv) > 3 else 1100
    data = open(entrada, 'rb').read()

    if not como_tinta(data, salida, ancho_px):
        if not como_imagen(data, salida, ancho_px):
            print(f'{salida}: NO SE PUDO EXTRAER')
            sys.exit(1)
