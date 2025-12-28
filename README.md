# 🎯 Unánimo Party - Digital

> Juego multijugador en tiempo real donde debes pensar igual que los demás. Basado en el clásico juego de mesa Unánimo.

## 🎮 Cómo Jugar

1. **Crear Partida**: Un anfitrión crea una nueva partida desde `index.html`
2. **Unirse**: Los jugadores se unen usando el código de sala de 4-5 letras
3. **Jugar**: En cada ronda, todos ven la misma palabra y deben escribir hasta 6 palabras relacionadas
4. **Puntuar**: Ganas puntos por cada palabra que coincida con otros jugadores
   - 2 jugadores coinciden = 2 puntos cada uno
   - 3 jugadores coinciden = 3 puntos cada uno
   - Y así sucesivamente...
5. **Ganar**: El jugador con más puntos después de todas las rondas gana

## 🛠️ Instalación

### Requisitos
- PHP 7.4 o superior
- Servidor web (Apache, Nginx, etc.)
- Permisos de escritura en el directorio del proyecto

### Pasos de Instalación

1. **Clonar o descargar** el repositorio:
```bash
git clone https://github.com/muyunicos/talcual.git
cd talcual
```

2. **Configurar permisos**:
```bash
chmod 755 game_states/
chmod 644 *.php
chmod 644 *.json
```

3. **Configurar settings** (opcional):
Edita `settings.php` para cambiar:
- Modo desarrollo (DEV_MODE)
- Duración de rondas
- Número de jugadores
- Otras configuraciones

4. **Probar**:
- Abre `index.html` en tu navegador
- Crea una partida
- Abre otra pestaña y únete con otro jugador

## 📁 Estructura de Archivos

```
talcual/
├── index.html          # Página principal (crear/unirse)
├── host.html           # Pantalla del anfitrión (TV/proyector)
├── player.html         # Pantalla de jugadores (móviles)
├── game-client.js      # Cliente JavaScript (SSE + API)
├── styles.css          # Estilos (poco usado, estilos inline en HTML)
├── api-action.php      # API REST para acciones del juego
├── sse-stream.php      # Server-Sent Events (actualizaciones en tiempo real)
├── config.php          # Funciones principales del sistema
├── settings.php        # Configuración global
├── diccionario.json    # Palabras del juego (15+ categorías)
├── cleanup-cron.php    # Script para limpiar juegos antiguos
├── analytics.php       # API de analytics (solo DEV_MODE)
├── dev-panel.html      # Panel de desarrollo (solo DEV_MODE)
├── test-suite.php      # Suite de tests (solo DEV_MODE)
├── .htaccess           # Configuración Apache
├── game_states/        # Estados de juegos activos (JSON)
└── analytics.json      # Datos de analytics
```

## 🔌 API Endpoints

### POST /api-action.php

Todas las acciones del juego se envían a este endpoint:

#### Crear Juego
```json
{
  "action": "create_game"
}
```

#### Unirse al Juego
```json
{
  "action": "join_game",
  "game_id": "PLAYA",
  "player_id": "player_123",
  "name": "Juan",
  "color": "#667eea,#764ba2"
}
```

#### Iniciar Ronda
```json
{
  "action": "start_round",
  "game_id": "PLAYA",
  "word": "PERRO",
  "duration": 120
}
```

#### Enviar Respuestas
```json
{
  "action": "submit_answers",
  "game_id": "PLAYA",
  "player_id": "player_123",
  "answers": ["COLA", "LADRIDO", "MASCOTA", "HUESO", "PASEO"]
}
```

#### Finalizar Ronda
```json
{
  "action": "end_round",
  "game_id": "PLAYA"
}
```

#### Otras Acciones
- `get_state` - Obtener estado actual
- `get_words` - Obtener lista de palabras
- `reset_game` - Reiniciar juego
- `leave_game` - Salir del juego
- `get_stats` - Estadísticas (solo DEV_MODE)

### GET /sse-stream.php?game_id=PLAYA

Conexión Server-Sent Events para recibir actualizaciones en tiempo real.

## ⚙️ Configuración

### settings.php

```php
// Modo de desarrollo
define('DEV_MODE', false); // true para activar herramientas de desarrollo

// Configuración del juego
define('MIN_PLAYERS', 3);              // Mínimo de jugadores
define('MAX_PLAYERS', 20);             // Máximo de jugadores
define('DEFAULT_ROUND_DURATION', 120); // Duración de ronda (segundos)
define('DEFAULT_TOTAL_ROUNDS', 3);     // Número de rondas
define('MAX_WORDS_PER_PLAYER', 6);     // Máximo de palabras por jugador
define('MAX_WORD_LENGTH', 30);         // Longitud máxima de palabra
```

## 📊 Analytics y Desarrollo

### Activar Modo Desarrollo

En `settings.php`, cambiar:
```php
define('DEV_MODE', true);
```

Esto habilita:
- **Panel de Desarrollo** (`dev-panel.html`): Estadísticas, herramientas, reportes de bugs
- **Suite de Tests** (`test-suite.php`): Tests automatizados
- **Analytics API** (`analytics.php`): Tracking de eventos
- **Logs detallados**: Todos los eventos se registran

### Ver Analytics

1. Activar DEV_MODE
2. Abrir `dev-panel.html`
3. Ver estadísticas en tiempo real:
   - Juegos creados/finalizados
   - Total de jugadores
   - Rondas jugadas
   - Eventos recientes

### Ejecutar Tests

1. Activar DEV_MODE
2. Abrir `test-suite.php` o hacer clic en "Ejecutar Tests" en dev-panel
3. Ver resultados de:
   - Sanitización de inputs
   - Validación de palabras
   - Generación de códigos
   - Guardado/carga de estados
   - Y más...

## 🔒 Seguridad

### Implementaciones de Seguridad

1. **Sanitización de Inputs**
   - Game IDs validados (solo alfanuméricos, 3-6 caracteres)
   - Player IDs validados (alfanuméricos + guion bajo)
   - Colores validados (formato hex RGB)

2. **Validación de Palabras**
   - Longitud máxima (30 caracteres)
   - Sin espacios
   - No puede ser la palabra actual

3. **Protección de Archivos**
   - `.htaccess` protege archivos sensibles (`.json`, `.log`, `.lock`)
   - Analytics solo accesible en DEV_MODE

4. **Race Conditions**
   - Sistema de locks para escritura de archivos
   - Locks automáticos con cleanup

5. **Limpieza Automática**
   - Juegos antiguos (>24h) se eliminan automáticamente
   - Locks huérfanos (>5min) se limpian

## 🐞 Troubleshooting

### Los jugadores no ven actualizaciones
- Verificar que SSE esté funcionando (abrir console del navegador)
- Verificar permisos de escritura en `game_states/`
- Revisar logs del servidor

### Código de sala no funciona
- Verificar que existan palabras cortas (≤5 letras) en `diccionario.json`
- Ver stats en dev-panel: "Palabras para código"

### Errores de conexión
- Verificar que `api-action.php` y `sse-stream.php` sean accesibles
- Revisar configuración CORS si estás en dominios diferentes

### Juegos no se limpian

1. **Automático**: Se limpia con 1% de probabilidad en cada request
2. **Manual**: Configurar cron job:
   ```bash
   0 */6 * * * php /ruta/a/cleanup-cron.php
   ```

## 🛣️ Roadmap

### Mejoras Futuras
- [ ] Sistema de salas privadas con contraseña
- [ ] Selección de categorías específicas
- [ ] Modo de juego personalizado
- [ ] Sonidos y notificaciones
- [ ] Historial de partidas por jugador
- [ ] Leaderboard global
- [ ] Modo offline (PWA)
- [ ] Chat entre jugadores
- [ ] Sistema de reportes de palabras inapropiadas

## 📝 Changelog

### v2.0.0 (2024-12-27) - Mejoras Masivas
- ✅ 31 correcciones y mejoras implementadas
- ✅ Seguridad: Sanitización completa de inputs
- ✅ Race conditions: Sistema de locks mejorado
- ✅ Validación: Palabras, colores, límites
- ✅ Retry logic: Reintentos automáticos en errores de red
- ✅ Analytics: Sistema básico de tracking
- ✅ Dev Mode: Panel de desarrollo y tests
- ✅ Diccionario: Eliminado codigos_sala, auto-generación
- ✅ SSE: Mejor detección de desconexiones
- ✅ Docs: README completo

### v1.0.0 (2024-12-XX) - Release Inicial
- ✅ Sistema básico de juego
- ✅ SSE para tiempo real
- ✅ Pantalla de host y jugadores
- ✅ 15+ categorías de palabras

## 🤝 Contribuir

¿Encontraste un bug? ¿Tienes una idea?

1. **Modo Desarrollo**: Activa DEV_MODE y usa el panel de desarrollo
2. **Tests**: Ejecuta test-suite.php antes de cambios importantes
3. **Pull Requests**: Bienvenidos! Asegúrate de:
   - Documentar cambios
   - Pasar todos los tests
   - Seguir el estilo de código existente

## 📜 Licencia

MIT License - Ver archivo LICENSE

## 👤 Autor

Creado por [Jonatan Pintos](https://github.com/muyunicos)

---

🎯 **¡Diviértete jugando Unánimo Party!**