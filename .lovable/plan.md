

# Desdoblado (Unwrap) de la Pieza 3D como Base de Dibujo

## Idea

En vez de dibujar en un rectángulo plano y adivinar dónde caerá en la pieza, primero **desdoblar la superficie 3D** en una forma plana que refleje la silueta real: más ancha donde el radio es mayor, más estrecha donde es menor. Dibujas directamente sobre esa forma y luego se proyecta al 3D.

```text
  Rectángulo actual:          Unwrap propuesto:
  ┌──────────────┐                ╭──────╮
  │              │              ╭─╯      ╰─╮
  │  dibujo     │             │            │  ← bulge
  │              │              ╰─╮      ╭─╯
  └──────────────┘                ╰──────╯
                                   base
```

## Que Cambia

### 1. Generar el contorno del unwrap (`src/lib/surface-unwrap.ts` - nuevo)
- Samplear `getBodyRadius(params, t, 0)` para t=0..1 (ej. 100 puntos)
- Calcular la circunferencia a cada altura: `C(t) = 2 * π * r(t)`
- Normalizar al ancho del canvas: el ancho a cada altura es proporcional a `C(t) / C_max`
- Exportar función `getUnwrapProfile(params): { t: number, widthFraction: number }[]`

### 2. Canvas con forma de unwrap (`src/components/drawing/SurfaceCanvas.tsx`)
- Reemplazar el overlay de silueta actual por un **clip path** y **fondo con forma** que muestre la forma desdoblada
- El canvas Fabric.js sigue siendo rectangular internamente, pero se aplica una máscara visual (overlay canvas) que muestra los bordes del unwrap
- Al exportar puntos UV, ajustar la coordenada U según el ancho real a esa altura: `u_real = u_canvas * widthFraction(v)` para que el mapeo a 3D sea correcto
- Las líneas de silueta actuales (izquierda/derecha) se convierten en el borde real de la forma

### 3. Ajustar la conversión UV → 3D (`src/lib/surface-stroke-generator.ts`)
- En `applyStrokeTransforms`, compensar por el unwrap: los puntos dibujados en el canvas ya están en coordenadas de unwrap, convertirlos a UV uniforme dividiendo U por `widthFraction(v)`
- Esto garantiza que un trazo recto horizontal en el canvas se convierte en un anillo a la misma altura en la pieza

### 4. Overlay visual mejorado
- Dibujar líneas de cuadrícula que sigan la forma del unwrap (horizontales rectas, verticales que se curvan con el contorno)
- Zona sombreada fuera del unwrap para que sea obvio dónde NO se puede dibujar
- Marcadores de altura (25%, 50%, 75%) como antes pero siguiendo la forma

## Archivos

| Archivo | Cambio |
|---------|--------|
| `src/lib/surface-unwrap.ts` | **Nuevo** - función de cálculo del perfil unwrap |
| `src/components/drawing/SurfaceCanvas.tsx` | Overlay con forma de unwrap, clip visual, ajuste de coordenadas UV |
| `src/lib/surface-stroke-generator.ts` | Compensar coordenadas unwrap en `applyStrokeTransforms` |
| `src/components/drawing/ImageToSurfaceStrokes.tsx` | Aplicar misma compensación al convertir foto a trazos |

## Flujo del Usuario

1. Abre Surface Art → ve la forma desdoblada de su pieza (más ancha en el bulge, más estrecha en base/boca)
2. Dibuja directamente sobre esa forma — sabe exactamente dónde quedará cada trazo
3. El trazo aparece en tiempo real grabado en la pieza 3D
4. Si cambia la forma de la pieza, el unwrap se actualiza automáticamente

