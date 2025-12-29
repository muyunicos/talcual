# 🤓 TESTING GUIDE - CSS Refactoring

**Fecha:** 29 de diciembre, 2025  
**PR:** #19  
**Branch:** `fix/host-interface-responsive`

---

## 💺 Quick Checklist

- [ ] Host layout NO rompe en 1200px
- [ ] Host layout NO rompe en 1400px
- [ ] Player auras se muestran con colores correctos
- [ ] Modales centrados en todos los tamaños
- [ ] Player cards tienen bordes visibles
- [ ] Estados de player cards funcionan (ready, answered, disconnected)
- [ ] No hay estilos inline en HTML
- [ ] Scrollbars de paneles son visibles

---

## 💯 Prueba #1: HOST LAYOUT RESPONSIVENESS

### Objetivo
Verificar que el layout de host NO rompe en pantallas intermedias (1200-1400px).

### Pasos

1. **Abre DevTools (F12)**
2. **Presiona Ctrl+Shift+M** (Responsive Design Mode)
3. **Prueba en estos viewport widths:**

#### Prueba 1A: 768px (Tablet Vertical)
```
Viewport: 768x1024
Esperado:
- Todo visible en 1 columna
- Ranking y Top Palabras HIDDEN
- Jugadores fluyen abajo
Verificación:
- [ ] Palabra se ve clara
- [ ] Jugadores caben en pantalla
- [ ] No hay overflow horizontal
```

#### Prueba 1B: 1024px (Tablet Horizontal / iPad)
```
Viewport: 1024x768
Esperado:
- Grid con 3 columnas
- Ranking izq | Centro | Top Palabras der
- Pero RANKING y TOP WORDS están hidden (@media 1024px)
Verificación:
- [ ] Centro se expande bien
- [ ] Jugadores visibles abajo
- [ ] Elementos NO se superponen
- [ ] Sin scrollbars innecesarios
```

#### Prueba 1C: 1200px (iPad PRO / Laptops)
```
Viewport: 1200x800
Esperado:
- Grid con 3 columnas VISIBLES
- Ranking izq | Centro (más grande) | Top Palabras der
- CRITICAL: Éste es el breakpoint que fallaba antes
Verificación:
- [ ] Ranking visible y proporcional
- [ ] Centro NO se aprieta
- [ ] Top Palabras visible
- [ ] Jugadores caben sin scroll
- [ ] Cálculos:
  - Viewport: 1200px
  - Padding: 10px * 2 = 20px
  - Gap: 15px * 2 = 30px
  - Disponible: 1200 - 20 - 30 = 1150px
  - Centro debería ser: 1150 * (2/(1+2+1)) = 575px (ültimamente era 530px, era el bug)
```

#### Prueba 1D: 1400px (Desktop Standard)
```
Viewport: 1400x900
Esperado:
- Grid 3 columnas bien distribuidas
- Todos los paneles visibles
- Sin problemas de espacio
Verificación:
- [ ] Layout simétrico
- [ ] Padding y gap proporcionales
- [ ] Todo legible
```

#### Prueba 1E: 1920px (Full HD Desktop)
```
Viewport: 1920x1080
Esperado:
- Grid fluido en pantalla grande
- Mucho espacio alrededor
- Todo bien distribuido
Verificación:
- [ ] No hay elementos gigantes
- [ ] Espacios utilizados correctamente
- [ ] Usar clamp() evita que se salga de control
```

#### Prueba 1F: 2560px (4K / TV Grande)
```
Viewport: 2560x1440
Esperado:
- Grid sigue siendo proporcional
- Elementos crecen pero no demasiado
Verificación:
- [ ] Logo no se hace gigante (max-height limitado)
- [ ] Fuentes siguen siendo legibles
- [ ] Gaps no se vuelven enormes
```

### Cómo Verificar Más Precisamente

**En DevTools > Elements, selecciona `.tv-layout`:**

```css
/* Busca en el inspector: */
grid-template-columns: minmax(200px, 1fr) minmax(400px, 2fr) minmax(200px, 1fr)

/* Ésto debe estar presente, NO: */
/* grid-template-columns: 300px 1fr 300px; ← VIEJO, ROTO */
```

---

## 💯 Prueba #2: INLINE STYLES REMOVED

### Objetivo
Verificar que NO hay estilos inline en el HTML.

### Pasos

1. **Abre `host.html` en navegador**
2. **DevTools > Elements**
3. **Busca `style="`**

```html
<!-- INCORRECTO (Viejo, NO debería existir): -->
<div id="status-message" style="text-align: center; margin-top: 20px; font-size: 1.1em;"></div>

<!-- CORRECTO (Nuevo): -->
<div id="status-message" class="status-message-modal"></div>
```

### Verificación

- [ ] `host.html`: NO hay `style="..."` excepto en SVG/Canvas (no aplica)
- [ ] `play.html`: NO hay `style="..."` excepto en SVG/Canvas
- [ ] Todos los estilos están en archivos `.css`

### Por Qué Importa

```javascript
// ANTES (conflictivo):
element.style.display = 'block';  // Inline style, hard to override

// DESPUÉS (correcto):
element.classList.remove('hidden');  // Uses CSS class
```

Si usas inline styles en HTML, tu JavaScript va a entrar en conflicto de especificidad.

---

## 💯 Prueba #3: AURA COLORS

### Objetivo
Verificar que los Aura circles muestran los colores correctos sin inline styles.

### Pasos

1. **Abre `play.html`**
2. **Llena el formulario y elige auras**
3. **Verifica cada uno:**

```html
<!-- HTML CORRECTO (Nuevo): -->
<div class="aura-circle aura-fire selected"></div>
<div class="aura-circle aura-ice"></div>
<div class="aura-circle aura-candy"></div>
<div class="aura-circle aura-mystic"></div>
<div class="aura-circle aura-electric"></div>
<div class="aura-circle aura-toxic"></div>

<!-- NO debería ver style="background: linear-gradient(...)" -->
```

### Colores a Verificar

| Aura | Esperado | Verificación |
|------|----------|----------------|
| **Fire** | Rojo/Naranja | [ ] `linear-gradient(135deg, #FF9966, #FF5E62)` |
| **Ice** | Verde/Azul | [ ] `linear-gradient(135deg, #00F260, #0575E6)` |
| **Candy** | Naranja/Amarillo | [ ] `linear-gradient(135deg, #F37335, #FDC830)` |
| **Mystic** | Púrpura/Azul | [ ] `linear-gradient(135deg, #8E2DE2, #4A00E0)` |
| **Electric** | Cian/Rojo | [ ] `linear-gradient(135deg, #12c2e9, #f64f59)` |
| **Toxic** | Verde/Amarillo | [ ] `linear-gradient(135deg, #DCE35B, #45B649)` |

### Cómo Verificar en Inspector

**DevTools > Elements > Selecciona un `.aura-circle`:**

```css
/* Deberás ver en computed styles: */
background: linear-gradient(135deg, #FF9966, #FF5E62);

/* Viene de la clase CSS: */
.aura-fire { background: linear-gradient(...) !important; }

/* NO debería tener style="..." en el elemento HTML */
```

---

## 💯 Prueba #4: PLAYER CARD STATES

### Objetivo
Verificar que las tarjetas de jugador tienen bordes definidos y estados visuales.

### Setup para Prueba

1. **Host debe estar corriendo localmente**
2. **Abre DevTools > Console**
3. **Ejecuta este código para forzar estados:**

```javascript
// Busca los elementos player-squarcle
const cards = document.querySelectorAll('.player-squarcle');

// Aplica diferentes estados
if (cards[0]) cards[0].classList.add('ready');
if (cards[1]) cards[1].classList.add('answered');
if (cards[2]) cards[2].classList.add('disconnected');
if (cards[3]) cards[3].classList.add('connected');
```

### Verificación Visual

#### Estado NORMAL
```css
border: 4px solid rgba(255, 255, 255, 0.3);
/* Borde blanco sutil, ligeramente transparente */
```
- [ ] Visible borde blanco alrededor
- [ ] No muy opaco, elegante

#### Estado READY
```css
border-color: var(--amarillo);
animation: readyPulse 1s infinite;
box-shadow: 0 0 20px rgba(255,237,46,0.7), 4px 4px 0px #000;
```
- [ ] Borde amarillo brillante
- [ ] Tiene efecto de pulso (brilla/se oscurece)
- [ ] Indica "listo para jugar"

#### Estado ANSWERED
```css
border-color: var(--cian);
box-shadow: 0 0 15px rgba(0, 240, 255, 0.5), 4px 4px 0px #000;
```
- [ ] Borde cian (azul claro)
- [ ] Glow sutil
- [ ] Indica "ya respondió"

#### Estado DISCONNECTED
```css
opacity: 0.5;
border-color: #FF4444;
box-shadow: 0 0 15px rgba(255, 68, 68, 0.3), 4px 4px 0px #000;
```
- [ ] Tarjeta se ve semi-transparente
- [ ] Borde rojo
- [ ] Indica "desconectado"

#### Estado CONNECTED (NUEVO)
```css
border-color: #00FF00;
box-shadow: 0 0 15px rgba(0, 255, 0, 0.5), 4px 4px 0px #000;
```
- [ ] Borde verde brillante
- [ ] Indica "conectado y activo"

### Hover Effect

```javascript
// En DevTools, ejecuta esto:
const card = document.querySelector('.player-squarcle');
card.style.transform = 'scale(1.08) rotate(2deg)';
card.style.boxShadow = '0 0 30px currentColor, 6px 6px 0px #000';
```

- [ ] Tarjeta crece ligeramente (108%)
- [ ] Gira 2 grados
- [ ] Shadow se hace más grande

---

## 💯 Prueba #5: MODAL CENTERING

### Objetivo
Verificar que modales están centrados en todos los tamaños.

### Pasos

1. **En host.html, abre DevTools**
2. **Console:**

```javascript
const modal = document.getElementById('modal-create-game');
modal.classList.add('active');
```

3. **Prueba en diferentes viewport sizes:**

| Viewport | Modal Está Centrado |
|----------|----------------------|
| 480px | [ ] Sí |
| 768px | [ ] Sí |
| 1024px | [ ] SÍ |
| 1200px | [ ] Sí |
| 1920px | [ ] Sí |

### Cómo Verificar

```css
/* El modal-overlay usa flexbox: */
.modal-overlay.active {
    display: flex;
    justify-content: center;  /* Centrado horizontalmente */
    align-items: center;      /* Centrado verticalmente */
}
```

- [ ] Modal no se pega a bordes
- [ ] Centro perfecto en todos los tamaños
- [ ] Backdrop (oscuridad) cubre toda la pantalla

---

## 💯 Prueba #6: SCROLLBARS STYLED

### Objetivo
Verificar que los paneles (ranking, top-words, players-grid) tienen scrollbars estilizados.

### Pasos

1. **Host con muchos jugadores (simular)**
2. **Busca elementos con overflow:**

```javascript
// En Console:
document.querySelector('.ranking-panel').scrollTop = 50; // Fuerza scroll
```

3. **Verifica que la scrollbar sea visible y estilizada:**

```css
.ranking-panel::-webkit-scrollbar {
    width: 8px;  /* Thin scrollbar */
}

.ranking-panel::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);  /* Semi-transparent white */
    border-radius: 10px;
}
```

- [ ] Scrollbar visible cuando hay overflow
- [ ] Color blanco semi-transparente
- [ ] Thin (8px de ancho)
- [ ] Rounded corners

---

## 💯 Prueba #7: RESPONSIVE FONT SIZES

### Objetivo
Verificar que `clamp()` mantiene fuentes legibles en todos los tamaños.

### Ejemplo

```css
/* Usa clamp() para fluidez */
.timer-display {
    font-size: clamp(2.5em, 8vw, 4em);
    /* Mínimo: 2.5em (40px en 16px base)
       Preferido: 8vw (responsive al viewport)
       Máximo: 4em (64px)*/
}
```

### Verificación

| Viewport | Timer Size | Legible |
|----------|----------|----------|
| 480px | ~38px | [ ] Sí |
| 768px | ~62px | [ ] Sí |
| 1024px | ~82px | [ ] Sí |
| 1200px | ~96px | [ ] Sí |
| 1920px | 64px (máx) | [ ] Sí |

- [ ] En viewport pequeño: no demasiado gigante
- [ ] En viewport grande: no se hace incontrolable
- [ ] Siempre legible

---

## 💯 Prueba #8: NO BREAKING CHANGES

### Objetivo
Verificar que la funcionalidad NO se rompió.

### Funcionalidades Críticas

- [ ] **Host: Crear partida** funciona
- [ ] **Host: Timer cuenta hacia atrás** correctamente
- [ ] **Host: Palabra se muestra** cuando inicia ronda
- [ ] **Player: Unirse a partida** funciona
- [ ] **Player: Ingresar palabras** funciona
- [ ] **Player: Ver ranking** funciona
- [ ] **Responsive:** Sin layout shifts al cambiar viewport

---

## 📋 Test Report Template

```markdown
# Test Report - CSS Refactoring PR #19

**Fecha de Prueba:** [FECHA]
**Tester:** [NOMBRE]
**Browser:** [Chrome/Firefox/Safari]
**OS:** [Windows/Mac/Linux]

## Resultados

### Host Layout (Prueba #1)
- [ ] 768px - PASS
- [ ] 1024px - PASS
- [ ] 1200px - PASS (CRITICAL)
- [ ] 1400px - PASS
- [ ] 1920px - PASS

### Inline Styles Removed (Prueba #2)
- [ ] host.html - PASS
- [ ] play.html - PASS

### Aura Colors (Prueba #3)
- [ ] Fire - PASS
- [ ] Ice - PASS
- [ ] Candy - PASS
- [ ] Mystic - PASS
- [ ] Electric - PASS
- [ ] Toxic - PASS

### Player Card States (Prueba #4)
- [ ] Normal - PASS
- [ ] Ready - PASS
- [ ] Answered - PASS
- [ ] Disconnected - PASS
- [ ] Connected - PASS
- [ ] Hover Effect - PASS

### Modal Centering (Prueba #5)
- [ ] 480px - PASS
- [ ] 1024px - PASS
- [ ] 1920px - PASS

### Scrollbars Styled (Prueba #6)
- [ ] Ranking Panel - PASS
- [ ] Top Words Panel - PASS
- [ ] Players Grid - PASS

### Responsive Fonts (Prueba #7)
- [ ] Timer Display - PASS
- [ ] Word Display - PASS
- [ ] Countdown - PASS

### No Breaking Changes (Prueba #8)
- [ ] Crear Partida - PASS
- [ ] Timer - PASS
- [ ] Palabras - PASS
- [ ] Ranking - PASS

## Observaciones

[AGREGAR CUALQUIER PROBLEMA ENCONTRADO]

## Conclusión

- [ ] PASS - Todo funciona correctamente
- [ ] FAIL - Hay problemas (describir arriba)
- [ ] NEEDS REVISION - Hay cosas para mejorar
```

---

## 🐛 Debugging Tips

### Si el layout sigue roto:

1. **Verifica que estás en la rama correcta:**
   ```bash
   git branch -a  # Debería mostrar fix/host-interface-responsive
   ```

2. **Limpia cache del navegador:**
   - DevTools > Network > Disable cache
   - Ctrl+Shift+R (Hard refresh)

3. **Inspecciona el grid:**
   ```javascript
   const layout = document.querySelector('.tv-layout');
   console.log(getComputedStyle(layout).gridTemplateColumns);
   // Debería mostrar: minmax(200px, 1fr) minmax(400px, 2fr) minmax(200px, 1fr)
   ```

4. **Verifica breakpoints activos:**
   ```javascript
   console.log(window.innerWidth);  // Ancho actual del viewport
   ```

### Si los estilos no se aplican:

1. **Verifica el orden de importación de CSS:**
   ```html
   <link rel="stylesheet" href="css/1-global.css">
   <link rel="stylesheet" href="css/4-components.css">  <!-- Debe venir ANTES -->
   <link rel="stylesheet" href="css/3-host.css">       <!-- Especificidad más alta -->
   ```

2. **Busca conflictos de clase:**
   ```javascript
   document.querySelector('.btn-back').className;  // Ver qué clases tiene
   ```

---

## 🙋 Preguntas Frecuentes

**P: ¿Por qué usar `clamp()` en lugar de media queries?**  
R: `clamp()` es más fluido. Los valores crecen/decrecen continuamente, no saltando en breakpoints.

**P: ¿Por qué `minmax()` en grid columns?**  
R: Asegura que cada columna tenga un espacio mínimo pero pueda crecer. Evita que se aprieten.

**P: ¿Qué pasa si tengo 100 jugadores?**  
R: El `.players-grid` tiene `overflow-y: auto` con scrollbar estilizado. Fluirá correctamente.

**P: ¿Los estilos inline funcionanán si los dejo?**  
R: Sí, pero crean problemas de especificidad y mantenibilidad. Es una mala práctica.

---

**Última actualización:** 29 de diciembre, 2025  
**Status:** 🙋 Ready for Testing
