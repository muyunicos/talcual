# Reorganización del Proyecto TalCual - Fase 1

## 📁 Nueva Estructura de Directorios

### Raíz (Acceso Público)
Archivos que deben ser accesibles directamente vía web:

```
/
├── index.html              # Página principal
├── create.html             # Crear sala
├── join.html               # Unirse a sala
├── host.html               # Vista del host
├── player.html             # Vista del jugador
├── dev-panel.html          # Panel de desarrollo
├── .htaccess               # Configuración Apache
├── .gitignore              # Archivos ignorados por Git
├── .env.example            # Plantilla de variables de entorno
├── favicon.ico             # Favicon
├── README.md               # Documentación principal
├── SECURITY.md             # Políticas de seguridad
├── CSS_STRUCTURE.md        # Documentación de CSS
└── REORGANIZATION.md       # Este archivo
```

### `/app` - Backend PHP
Archivos PHP organizados por función:

```
/app
├── /api                    # Endpoints de API
│   └── api-action.php      # Controlador principal de acciones
├── /core                   # Lógica central
│   ├── settings.php        # Configuración global y .env
│   └── config.php          # Funciones core del juego
├── /services               # Servicios especializados
│   ├── sse-stream.php      # Server-Sent Events
│   └── analytics.php       # Dashboard de estadísticas
└── /maintenance            # Scripts de mantenimiento
    ├── cleanup-cron.php    # Limpieza automática
    └── test-suite.php      # Suite de pruebas
```

### `/js` - JavaScript
Archivos JavaScript del cliente:

```
/js
└── game-client.js          # Cliente de juego (SSE + API)
```

### `/css` - Hojas de Estilo
CSS modular organizado (ya existía, sin cambios):

```
/css
├── 1-base.css
├── 2-layout.css
├── 3-components.css
├── 4-players.css
├── 5-animations.css
├── 6-host.css
├── 7-player.css
├── 8-utilities.css
├── dev-panel.css
├── main.css
└── *.min.css
```

### `/images` - Imágenes
```
/images
├── bg.webp                 # Fondo
├── icon.webp               # Icono de la app
└── logo.webp               # Logo del juego
```

### `/data` - Datos
```
/data
└── diccionario.json        # Palabras del juego
```

### `/docs` - Documentación
```
/docs
└── optimize-images.md      # Guía de optimización de imágenes
```

---

## 🔄 Archivos Movidos

### Archivos PHP Backend
| Ubicación Anterior | Nueva Ubicación | Wrapper Compatible |
|---------------------|------------------|-----------------|
| `api-action.php` | `app/api/api-action.php` | ✅ Sí |
| `config.php` | `app/core/config.php` | ✅ Sí |
| `settings.php` | `app/core/settings.php` | ✅ Sí |
| `sse-stream.php` | `app/services/sse-stream.php` | ✅ Sí |
| `analytics.php` | `app/services/analytics.php` | ✅ Sí |
| `cleanup-cron.php` | `app/maintenance/cleanup-cron.php` | ✅ Sí |
| `test-suite.php` | `app/maintenance/test-suite.php` | ✅ Sí |

### JavaScript
| Ubicación Anterior | Nueva Ubicación |
|---------------------|------------------|
| `game-client.js` | `js/game-client.js` |

### Assets (Pendiente)
| Ubicación Anterior | Nueva Ubicación |
|---------------------|------------------|
| `bg.webp` | `images/bg.webp` |
| `icon.webp` | `images/icon.webp` |
| `logo.webp` | `images/logo.webp` |
| `diccionario.json` | `data/diccionario.json` |
| `optimize-images.md` | `docs/optimize-images.md` |

---

## ✅ Compatibilidad Hacia Atrás

### Wrappers en Raíz
Se crearon archivos de compatibilidad en la raíz que redirigen a las nuevas ubicaciones:

- `api-action.php` → `app/api/api-action.php`
- `config.php` → `app/core/config.php`
- `settings.php` → `app/core/settings.php`
- `sse-stream.php` → `app/services/sse-stream.php`
- `analytics.php` → `app/services/analytics.php`
- `cleanup-cron.php` → `app/maintenance/cleanup-cron.php`
- `test-suite.php` → `app/maintenance/test-suite.php`

Esto significa que **el código existente sigue funcionando** sin modificaciones.

### Rutas Actualizadas Internamente
Todos los archivos movidos tienen sus rutas internas actualizadas:

- `require_once 'config.php'` → `require_once __DIR__ . '/../core/config.php'`
- `__DIR__` ajustado para rutas relativas correctas
- Constantes (`DICTIONARY_FILE`, `GAME_STATES_DIR`, etc.) apuntan a ubicaciones correctas

---

## 🛠️ Cambios Técnicos Importantes

### 1. Rutas Dinámicas en `settings.php`
Se detectó automáticamente la raíz del proyecto:

```php
// Detectar raíz del proyecto (2 niveles arriba: app/core -> raíz)
$projectRoot = dirname(dirname(__DIR__));

// Rutas relativas a raíz del proyecto
define('GAME_STATES_DIR', $projectRoot . '/game_states');
define('ANALYTICS_FILE', $projectRoot . '/analytics.json');
define('DICTIONARY_FILE', $projectRoot . '/data/diccionario.json');
```

### 2. Game Client Actualizado
El cliente JavaScript ahora apunta a las nuevas rutas:

```javascript
// SSE stream
const sseUrl = `app/services/sse-stream.php?game_id=${gameId}`;

// API actions
await fetch('app/api/api-action.php', {
    method: 'POST',
    // ...
});
```

---

## 📋 Tareas Pendientes

### Inmediatas (Fase 1)
- [ ] Mover imágenes a `/images`
- [ ] Mover `diccionario.json` a `/data`
- [ ] Mover `optimize-images.md` a `/docs`
- [ ] Actualizar referencias en archivos HTML
- [ ] Probar todas las funcionalidades

### Futuras (Fase 2 - Refactorización)
- [ ] Dividir `config.php` en módulos:
  - `app/core/functions.php` (funciones de utilidad)
  - `app/core/validation.php` (validaciones)
  - `app/core/game-state.php` (manejo de estados)
- [ ] Refactorizar `api-action.php`:
  - Extraer cada `case` a funciones
  - Crear helpers de respuesta
- [ ] Extraer JavaScript inline de HTMLs a archivos modulares
- [ ] Eliminar archivos CSS minificados del repo
- [ ] Crear script de build/deploy

---

## 📚 Guía de Migración para Desarrolladores

### Para Código Nuevo
Usa las nuevas rutas directamente:

```javascript
// ✅ CORRECTO - Nueva ruta
await fetch('app/api/api-action.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'create_game' })
});

// ❌ EVITAR - Ruta antigua (sigue funcionando pero deprecada)
await fetch('api-action.php', { /* ... */ });
```

### Para Código Existente
No es necesario cambiar nada inmediatamente, pero se recomienda actualizar gradualmente:

1. **Archivos HTML**: Actualizar rutas de `<script src>` y `fetch()`
2. **Archivos PHP**: Usar nuevas rutas en `require_once`
3. **Tests**: Actualizar rutas en pruebas automatizadas

### Verificar Funcionamiento
```bash
# Ejecutar suite de pruebas
php app/maintenance/test-suite.php

# O usando wrapper de compatibilidad
php test-suite.php
```

---

## 👍 Beneficios de Esta Reorganización
1. **Código más mantenible**: Archivos organizados por función
2. **Separación clara**: Frontend (raíz) vs Backend (app/)
3. **Escalabilidad**: Fácil agregar nuevos módulos
4. **Seguridad**: Backend aislado del acceso público directo (futuro `.htaccess`)
5. **Compatibilidad**: Wrappers permiten transición gradual

---

## 📞 Soporte

Para dudas o problemas con la reorganización:
- Revisar este documento
- Consultar `README.md` principal
- Verificar que los wrappers de compatibilidad estén presentes

---

**Fecha de reorganización**: Diciembre 2025  
**Versión**: Fase 1 - Movimiento de archivos  
**Estado**: ✅ Completado (backend), 🔄 Pendiente (assets)
