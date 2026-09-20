#!/bin/bash
# Valida los tests de scores.js rompiendo el codigo a proposito (CLAUDE.md).
# Cada mutacion DEBE hacer fallar algun test. Si alguna pasa, ese test no
# esta comprobando lo que dice comprobar.
set -u

SRC=packages/core/src/music/scores.js
BAK=$(mktemp)
cp "$SRC" "$BAK"

fallos=0

probar() {
  local nombre="$1"; shift
  cp "$BAK" "$SRC"
  "$@"
  if npx vitest run --root apps/web src/test/scores.test.js >/dev/null 2>&1; then
    echo "SOBREVIVE  $nombre"
    fallos=$((fallos + 1))
  else
    echo "detectada  $nombre"
  fi
}

m1() { perl -0pi -e "s/song\?\.format === SONG_FORMAT_PDF \? SONG_FORMAT_PDF : SONG_FORMAT_CHORDS/SONG_FORMAT_PDF/" "$SRC"; }
m2() { perl -0pi -e "s/const variantFallback = !casilla\[requestedVariant\];/const variantFallback = false;/" "$SRC"; }
m3() { perl -0pi -e "s/if \(variants\.length === 0\) return;//" "$SRC"; }
m4() { perl -0pi -e "s/delete resultado\[instrumentId\];/resultado[instrumentId] = porVoz;/" "$SRC"; }
m5() { perl -0pi -e "s/if \(!elegida && instrument\)/if (false \&\& instrument)/" "$SRC"; }
m6() { perl -0pi -e "s/const variantFinal = variantFallback \? elegida\.variants\[0\] : requestedVariant;/const variantFinal = requestedVariant;/" "$SRC"; }
m7() { perl -0pi -e "s/\`partituras\/\\\$\{songId\}\//\`partituras\//" "$SRC"; }
m8() { perl -0pi -e "s/delete porVoz\[voz\];/porVoz[voz] = casilla;/" "$SRC"; }
m9() { perl -0pi -e "s/SCORE_VARIANTS\.filter\(\(v\) => porVoz\[voiceNumber\]\?\.\[v\]\)/Object.keys(porVoz[voiceNumber] || {})/" "$SRC"; }
m10() { perl -0pi -e "s/\.sort\(compareVoiceNumbers\)/.sort()/" "$SRC"; }
m11() { perl -0pi -e "s/if \(Number\.isFinite\(na\) && Number\.isFinite\(nb\)\) return na - nb;\n  return 0;/return -1;/" "$SRC"; }

probar "getSongFormat siempre dice pdf"            m1
probar "variantFallback nunca se marca"            m2
probar "no se omiten las casillas vacias"          m3
probar "el instrumento vacio no desaparece"        m4
probar "se ignora el instrumento del musico"       m5
probar "no se cae a la variante que existe"        m6
probar "la ruta no lleva el songId"                m7
probar "la casilla vacia no desaparece"            m8
probar "se aceptan variantes desconocidas"         m9
probar "las voces se ordenan como texto"           m10
probar "el orden de Object.keys no se respeta"     m11

cp "$BAK" "$SRC"
rm -f "$BAK"

echo "---"
if [ "$fallos" -eq 0 ]; then
  echo "Las 11 mutaciones las detecta algun test."
else
  echo "$fallos mutacion(es) SOBREVIVEN: hay tests que no comprueban lo que dicen."
fi
exit "$fallos"
