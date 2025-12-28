# Estructura de CSS - TalCual Party

## Overview

El proyecto ha sido refactorizado para separar todo el CSS en archivos modularizados y bien organizados. Esto mejora:

- **Mantenibilidad**: Cada archivo tiene una responsabilidad específica
- **Escalabilidad**: Fácil de agregar nuevas características
- **Performance**: Mejor cacheo del navegador
- **Reutilización**: Componentes bien definidos

## Jerarquía de Archivos CSS

```
css/
├── main.css              ← IMPORTADOR PRINCIPAL (usar este en HTML)
├── 1-base.css           ← Reset, variables, fuentes
├── 2-layout.css         ← Grids, contenedores, estructura
├── 3-components.css     ← Botones, inputs, cards, modales
├── 4-players.css        ← Squarcles, auras, rankings
├── 5-animations.css     ← Keyframes, transiciones, efectos
├── 6-host.css           ← Estilos pantalla TV (host.html)
├── 7-player.css         ← Estilos pantalla móvil (player.html)
└── 8-utilities.css      ← Utilidades, helpers, responsive
```

## Descripción de Cada Archivo

### 1. `1-base.css` (Reset y Variables)

**Contenido:**
- CSS Reset global (`*`)
- Variables CSS (colores, sombras, fuentes)
- `@import` de Google Fonts
- Estilos base para `html`, `body`
- Textura de fondo del body
- Tipografías base (h1-h6, p, code)

**Uso:** Carga una sola vez al inicio de todo el proyecto

---

### 2. `2-layout.css` (Estructura y Layout)

**Componentes:**
- `.container` - Contenedor base
- `.card` - Tarjeta estándar
- `.tv-layout` - Grid principal del host
- `.welcome-screen` - Pantalla de bienvenida
- `.game-screen` - Pantalla de juego
- `.top-header` - Header fijo superior
- `.bottom-footer` - Footer fijo inferior
- `.center-panel` - Panel central
- `.ranking-panel` - Panel de ranking
- `.top-words-panel` - Panel de top palabras
- `.players-grid` - Grid de jugadores

**Características:**
- Flexbox y CSS Grid
- Estructuras responsivas base
- Media queries para diferentes breakpoints

---

### 3. `3-components.css` (Componentes Reutilizables)

**Elementos:**
- **Botones**: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`
  - `.btn-jackbox` - Estilo Jackbox
  - `.btn-create` - Botón crear
  - `.btn-join` - Botón unirse
  - `.btn-submit` - Botón enviar
  - `.btn-control` - Botón de control

- **Inputs**: `.input-field`, `.input-group`
  - `.input-jackbox` - Estilo Jackbox
  - `.word-input` - Input de palabra
  - Estados focus, disabled

- **Códigos**: `.game-code-sticker`
  - Etiqueta de código de sala

- **Modales**: `.modal-overlay`, `.modal-content`
  - `.modal-title`, `.modal-input`, `.modal-btn`

- **Tarjetas**: `.status-card`, `.results-section`

---

### 4. `4-players.css` (Sistema de Jugadores)

**Tarjetas de Jugadores:**
- `.player-squarcle` - Cuadrado principal del jugador
  - `.player-initial` - Inicial del nombre
  - `.player-name-label` - Etiqueta de nombre
  - `.player-score-badge` - Badge de puntos
  - `.player-status-icon` - Icono de estado
  - `.player-answers-count` - Contador de respuestas

**Sistema de Auras (Colores):**
- `.aura-fire`, `.aura-ice`, `.aura-candy`
- `.aura-mystic`, `.aura-electric`, `.aura-toxic`
- `.aura-selector` - Contenedor de selección
- `.aura-circle` - Círculo seleccionable

**Rankings:**
- `.ranking-item` - Item de ranking
  - `.top-1` - Oro (1er lugar)
  - `.top-2` - Plata (2do lugar)
  - `.top-3` - Bronce (3er lugar)

**Palabras:**
- `.top-word-item` - Item de palabra top
- `.word-item` - Item de palabra en lista
- `.result-item` - Item de resultado
  - `.match` - Coincidencia
  - `.no-match` - Sin coincidencia

---

### 5. `5-animations.css` (Efectos y Transiciones)

**Keyframes:**
- `@keyframes popIn` - Aparición con escala y rotación
- `@keyframes pulse` - Pulso de escala
- `@keyframes glow` - Resplandor de filtro
- `@keyframes countdownPulse` - Pulso countdown especial
- `@keyframes shake` - Sacudida
- `@keyframes bounce` - Rebote
- `@keyframes fadeIn` - Desvanecimiento entrada
- `@keyframes readyBounce` - Rebote "listo"
- `@keyframes selectedPulse` - Pulso seleccionado
- `@keyframes spin` - Rotación continua (loader)
- `@keyframes slideIn` / `@keyframes slideOut` - Deslizamiento
- `@keyframes backgroundShift` - Cambio de fondo
- `@keyframes heartbeat` - Latido
- `@keyframes flip` - Volteo 3D
- `@keyframes ripple` - Efecto onda

**Clases de Utilidad:**
- `.pop-in`, `.pulse`, `.glow`, `.countdown-pulse`
- `.shake`, `.bounce`, `.fade-in`, `.ready-bounce`
- `.selected-pulse`, `.loading-spinner`
- `.hover-lift`, `.hover-scale`, `.hover-glow`

---

### 6. `6-host.css` (Pantalla TV - host.html)

**Elementos Específicos:**
- `.timer-display` - Cronómetro grande
  - `.warning` - Estado de advertencia
- `.word-display` - Palabra actual (muy grande)
- `.countdown-display` - Countdown 3-2-1
- `.status-message` - Mensaje de estado
- `.controls-panel` - Panel de controles
  - `.visible` - Mostrar panel
  - `.btn-start`, `.btn-end`, `.btn-next`

**Media Queries TV:**
- `@media (max-width: 1400px)`
- `@media (max-width: 1024px)`
- `@media (max-width: 768px)`
- `@media (max-width: 480px)`

---

### 7. `7-player.css` (Pantalla Móvil - player.html)

**Elementos Específicos:**
- `.welcome-title` - Título de bienvenida
- `.welcome-subtitle` - Subtítulo
- `.welcome-card` - Tarjeta de bienvenida
- `.header-round` - Indicador de ronda
- `.header-timer.warning` - Timer con advertencia
- `.player-name-section` - Sección del nombre
- `.player-name-display` - Nombre mostrado
- `.btn-edit-name` - Botón editar nombre
- `.btn-exit` - Botón salir
- `.current-word` - Palabra actual (grande)
- `.countdown-overlay` - Overlay de countdown
- `.countdown-number` - Número countdown

**Media Queries Móvil:**
- Ajustes para pantallas pequeñas
- Redimensionamiento de fuentes
- Reordenamiento de elementos

---

### 8. `8-utilities.css` (Utilidades y Responsive)

**Clases de Texto:**
- `.text-center`, `.text-left`, `.text-right`, `.text-justify`
- `.text-uppercase`, `.text-lowercase`, `.text-capitalize`
- `.font-bold`, `.font-semibold`, `.font-normal`
- `.text-small`, `.text-large`

**Espaciado (Margin):**
- `.m-*`, `.mt-*`, `.mb-*`, `.ml-*`, `.mr-*`
- `.mx-auto`, `.my-*`
- Valores: 0, 5, 10, 20, 30

**Espaciado (Padding):**
- `.p-*`, `.pt-*`, `.pb-*`, `.pl-*`, `.pr-*`
- `.px-*`, `.py-*`
- Valores: 0, 5, 10, 20, 30

**Display:**
- `.hidden`, `.visible`, `.block`, `.inline`, `.inline-block`
- `.flex`, `.flex-column`, `.flex-wrap`
- `.flex-center`, `.flex-between`, `.flex-around`
- `.grid`

**Opacidad:**
- `.opacity-0`, `.opacity-25`, `.opacity-50`, `.opacity-75`, `.opacity-100`

**Visibility:**
- `.invisible`, `.visible`

**Overflow:**
- `.overflow-hidden`, `.overflow-auto`, `.overflow-scroll`
- `.overflow-x-hidden`, `.overflow-y-auto`

**Posición:**
- `.relative`, `.absolute`, `.fixed`, `.sticky`, `.static`

**Ancho y Alto:**
- `.w-full`, `.w-auto`, `.w-50`, `.w-75`
- `.h-full`, `.h-auto`, `.min-h-100vh`, `.max-w-full`

**Z-Index:**
- `.z-0`, `.z-10`, `.z-20`, `.z-50`, `.z-100`, `.z-auto`

**Bordes:**
- `.border-none`, `.border-solid`, `.border-dashed`
- `.rounded-0`, `.rounded-5`, `.rounded-10`, `.rounded-15`, `.rounded-20`, `.rounded-full`

**Sombras:**
- `.shadow-none`, `.shadow-small`, `.shadow-medium`, `.shadow-large`, `.shadow-xl`

**Backgrounds:**
- `.bg-transparent`, `.bg-white`, `.bg-black`
- `.bg-primary`, `.bg-accent`, `.bg-warning`

**Cursor:**
- `.cursor-pointer`, `.cursor-default`, `.cursor-not-allowed`, `.cursor-text`, `.cursor-move`

**Animaciones:**
- `.fade-in`, `.fade-out`, `.slide-in`, `.slide-out`
- `.shake`, `.bounce`, `.pulse`, `.spin`

**Media Queries Responsivas:**
- XL (>1400px): `.xl\:hidden`, `.xl\:visible`
- LG (1024px-1399px): `.lg\:hidden`, `.lg\:visible`
- MD (768px-1023px): `.md\:hidden`, `.md\:visible`, `.md\:text-center`, `.md\:flex`, `.md\:block`
- SM (480px-767px): `.sm\:hidden`, `.sm\:visible`, `.sm\:text-center`, `.sm\:w-full`, `.sm\:p-10`
- XS (<480px): `.xs\:hidden`, `.xs\:visible`, `.xs\:w-full`, `.xs\:text-center`, `.xs\:m-0`, `.xs\:p-5`

**Print Styles:**
- Estilos optimizados para impresión

---

## Cómo Usar en HTML

### Opción 1: Usar solo `main.css` (RECOMENDADO)

```html
<head>
    <link rel="stylesheet" href="css/main.css">
</head>
```

Esto importa automáticamente todos los archivos CSS en el orden correcto.

### Opción 2: Importar archivos individuales (para desarrollo)

```html
<head>
    <link rel="stylesheet" href="css/1-base.css">
    <link rel="stylesheet" href="css/2-layout.css">
    <link rel="stylesheet" href="css/3-components.css">
    <link rel="stylesheet" href="css/4-players.css">
    <link rel="stylesheet" href="css/5-animations.css">
    <link rel="stylesheet" href="css/6-host.css">
    <link rel="stylesheet" href="css/7-player.css">
    <link rel="stylesheet" href="css/8-utilities.css">
</head>
```

---

## Orden de Cascada CSS (Importante)

El orden de los archivos es crítico para que CSS cascade correctamente:

1. **1-base.css** - Estilos base y reset
2. **2-layout.css** - Estructura general
3. **3-components.css** - Componentes reutilizables
4. **4-players.css** - Componentes específicos de jugadores
5. **5-animations.css** - Animaciones y transiciones
6. **6-host.css** - Estilos específicos del host
7. **7-player.css** - Estilos específicos del player
8. **8-utilities.css** - Utilidades y helpers (mayor especificidad)

Este orden asegura que:
- Las utilidades sobreescriben estilos base (como es intendido)
- Las animaciones se aplican consistentemente
- Los estilos específicos prevalecen sobre los genéricos
- Los media queries funcionen correctamente

---

## Guía de Colores

Definidos en `1-base.css` como variables CSS:

- **Primario**: `#FF0055` (Magenta/Rosa)
- **Secundario**: `#00F0FF` (Cian)
- **Terciario**: `#FFD700` (Amarillo/Oro)
- **Fondo**: `#2E004E` (Púrpura oscuro)
- **Blanco**: `white`
- **Negro**: `black`

### Auras de Jugadores:
- **Fire**: Rojo-Naranja
- **Ice**: Verde-Azul
- **Candy**: Naranja-Amarillo
- **Mystic**: Púrpura
- **Electric**: Cian-Rojo
- **Toxic**: Verde

---

## Guía de Fuentes

- **Display**: 'Fredoka One', cursive (títulos, displays grandes)
- **Primaria**: 'Nunito', sans-serif (cuerpo, botones)
- **Fallback**: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto

---

## Variables CSS Disponibles

Todas definidas en `1-base.css` en el `:root`:

```css
--magenta: #FF0055
--cian: #00F0FF
--amarillo: #FFD700
--fondo: #2E004E
--font-display: 'Fredoka One', cursive
--font-primary: 'Nunito', sans-serif
--sombra-dura: 4px 4px 0px rgba(0,0,0,0.3)
/* ... y más */
```

---

## Responsive Design

Breakpoints:
- **1400px+**: Desktop grande
- **1024px - 1399px**: Desktop
- **768px - 1023px**: Tablet
- **480px - 767px**: Mobile grande
- **<480px**: Mobile pequeño

Cada archivo responsivo tiene media queries para estos breakpoints.

---

## Performance

**Ventajas de esta estructura:**

✅ **Modularidad**: Cargar solo lo necesario
✅ **Cacheo**: Cambios en un archivo no invalidan todo el caché
✅ **Mantenibilidad**: Fácil encontrar donde cambiar estilos
✅ **Escalabilidad**: Agregar nuevas características sin conflictos
✅ **Especificidad**: Bien controlada y predecible
✅ **Reutilización**: Componentes bien definidos

---

## Próximos Pasos

1. Actualizar todos los HTML para usar `css/main.css`
2. Remover los `<style>` inline de los HTML
3. Minificar en producción usando herramientas como PostCSS
4. Considerar CSS-in-JS si la complejidad aumenta

---

**Última actualización**: 28 de Diciembre, 2025
**Versión**: 1.0
**Estado**: ✅ Producción
