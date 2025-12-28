# 🎯 Unánimo Party - Digital

Juego web multiplayer tipo "Unánimo" donde los jugadores deben pensar palabras que coincidan con las de los demás para ganar puntos.

## 📋 Características

- Juego multijugador en tiempo real (3+ jugadores)
- Sistema de salas con códigos únicos generados desde el diccionario
- Actualizaciones en tiempo real usando Server-Sent Events (SSE)
- Interfaz optimizada para Smart TV (host) y móviles (jugadores)
- Sistema de puntuación basado en coincidencias
- Personalización con colores para cada jugador
- Modo desarrollo con debugging y reportes de bugs
- Analytics básico opcional

## 🚀 Instalación

### Requisitos

- PHP 7.4 o superior
- Servidor web (Apache/Nginx)
- Permisos de escritura en el directorio

### Pasos

1. Clona o descarga el repositorio
2. Sube los archivos a tu servidor web
3. Asegúrate que el directorio tenga permisos de escritura (755 o 775)
4. El sistema creará automáticamente la carpeta `game_states/` para almacenar partidas
5. (Opcional) Configura un cron job para limpieza automática:
   ```bash
   0 */6 * * * php /ruta/a/cleanup-cron.php
   ```

## 🎮 Cómo Jugar

### Para el Anfitrión
1. Abre `index.html` en un Smart TV o pantalla grande
2. Haz clic en "Crear Partida"
3. Se generará un código de sala único (palabra de 5 letras o menos del diccionario)
4. Los jugadores se unirán usando ese código
5. Presiona `ENTER` o haz clic en "Iniciar Ronda" cuando todos estén listos (mínimo 3 jugadores)
6. Presiona `C` para mostrar/ocultar controles durante el juego

### Para Jugadores

1. Abre `index.html` en tu celular o navegador
2. Ingresa el código de sala mostrado en la TV
3. Elige tu nombre (2-20 caracteres) y color favorito
4. Espera a que el anfitrión inicie la ronda
5. Escribe hasta 6 palabras relacionadas con la palabra mostrada
6. Envía tus respuestas antes de que termine el tiempo (2 minutos)
7. Ganas puntos por cada palabra que coincida con otros jugadores
   - 2 jugadores coinciden = 2 puntos cada uno
   - 3 jugadores coinciden = 3 puntos cada uno
   - etc.

## 📡 API Endpoints

### `api-action.php`

Todas las peticiones son POST con JSON body.

#### `create_game`
Crea una nueva partida.
```json
{
  "action": "create_game"
}
```
Respuesta:
```json
{
  "success": true,
  "game_id": "PLAYA",
  "state": { ... }
}
```

#### `join_game`
Unirse a una partida existente.
```json
{
  "action": "join_game",
  "game_id": "PLAYA",
  "player_id": "player_123",
  "name": "Juan",
  "color": "#667eea,#764ba2"
}
```

#### `start_round`
Iniciar nueva ronda (solo host).
```json
{
  "action": "start_round",
  "game_id": "PLAYA",
  "word": "CASA",
  "duration": 120
}
```

#### `submit_answers`
Enviar respuestas del jugador.
```json
{
  "action": "submit_answers",
  "game_id": "PLAYA",
  "player_id": "player_123",
  "answers": ["PUERTA", "VENTANA", "TECHO"]
}
```

#### `end_round`
Finalizar ronda y calcular puntos.
```json
{
  "action": "end_round",
  "game_id": "PLAYA"
}
```

#### `reset_game`
Reiniciar partida manteniendo jugadores.
```json
{
  "action": "reset_game",
  "game_id": "PLAYA"
}
```

#### `leave_game`
Salir de la partida.
```json
{
  "action": "leave_game",
  "game_id": "PLAYA",
  "player_id": "player_123"
}
```

#### `get_state`
Obtener estado actual.
```json
{
  "action": "get_state",
  "game_id": "PLAYA"
}
```

#### `get_words`
Obtener lista de todas las palabras del diccionario.
```json
{
  "action": "get_words"
}
```

#### `get_stats` (solo en modo desarrollo)
Obtener estadísticas del sistema.
```json
{
  "action": "get_stats"
}
```

### `sse-stream.php`

Server-Sent Events para actualizaciones en tiempo real.

**URL**: `sse-stream.php?game_id=PLAYA`

Eventos:
- `update`: Se envía cuando cambia el estado del juego
- `game_ended`: El juego finalizó o expiró
- Heartbeat cada 15 segundos para mantener conexión

## ⚙️ Configuración

Edita `settings.php` para configurar el sistema:

```php
// MODO DE DESARROLLO
define('DEV_MODE', false); // Cambiar a true para activar modo desarrollo

// CONFIGURACIÓN DEL JUEGO
define('MIN_PLAYERS', 3);              // Mínimo de jugadores para empezar
define('MAX_PLAYERS', 20);             // Máximo de jugadores permitidos
define('DEFAULT_ROUND_DURATION', 120); // Duración de ronda en segundos
define('DEFAULT_TOTAL_ROUNDS', 3);     // Número de rondas por partida
define('MAX_WORDS_PER_PLAYER', 6);     // Máximo de palabras por jugador
define('MAX_WORD_LENGTH', 30);         // Longitud máxima de palabra
define('MAX_CODE_LENGTH', 5);          // Longitud máxima código de sala

// CONFIGURACIÓN DE LIMPIEZA
define('MAX_GAME_AGE', 86400);         // 24 horas en segundos
define('CLEANUP_PROBABILITY', 0.01);   // 1% de probabilidad de limpieza automática

// CONFIGURACIÓN SSE
define('SSE_TIMEOUT', 1800);           // 30 minutos
define('SSE_HEARTBEAT_INTERVAL', 15);  // Heartbeat cada 15 segundos
```

## 📊 Analytics

El sistema puede guardar estadísticas básicas en `analytics.json`:

- Acciones realizadas en cada partida
- Timestamps de eventos
- Número de jugadores por partida
- Mantiene solo las últimas 1000 entradas

En modo desarrollo, el analytics NO se guarda para evitar llenado de datos de prueba.

## 🐛 Modo Desarrollo

Activa el modo desarrollo en `settings.php`:

```php
define('DEV_MODE', true);
```

Características en modo desarrollo:
- Logs detallados en consola del navegador y PHP
- Sistema de reporte de bugs (`reportBug()` en JavaScript)
- Endpoint adicional `get_stats` disponible
- No se guarda analytics (evita basura de pruebas)
- Muestra errores PHP en pantalla
- Archivo `debug.log` con todos los errores

## 📁 Estructura de Archivos

```
talcual/
├── index.html           # Página principal (crear/unirse)
├── host.html           # Interfaz del anfitrión (Smart TV)
├── player.html         # Interfaz del jugador (móvil)
├── styles.css          # Estilos compartidos
├── game-client.js      # Cliente JavaScript (SSE + API)
├── api-action.php      # API principal del juego
├── sse-stream.php      # Server-Sent Events
├── config.php          # Funciones del servidor
├── settings.php        # Constantes configurables
├── diccionario.json    # Palabras del juego por categorías
├── cleanup-cron.php    # Script de limpieza (cron)
├── .htaccess           # Configuración Apache
├── game_states/        # Estados de partidas (creado automáticamente)
│   └── *.json         # Archivos de estado de cada partida
├── analytics.json      # Estadísticas del sistema (opcional)
├── debug.log           # Log de desarrollo (solo en DEV_MODE)
└── README.md          # Este archivo
```

## 🔒 Seguridad

- Validación y sanitización estricta de todas las entradas
- Códigos de sala aleatorios y únicos (palabras del diccionario)
- Locks para prevenir race conditions en escritura de archivos
- Expiración automática de partidas inactivas (24 horas)
- Validación de formatos de colores
- Límites en longitud de nombres y palabras
- Sin almacenamiento de datos personales
- Protección contra inyección de código

## 🛠️ Solución de Problemas

### Las actualizaciones no llegan en tiempo real
- Verifica que tu servidor soporte SSE
- Revisa que el firewall no bloquee conexiones largas
- Comprueba la consola del navegador (F12) para errores
- Intenta recargar la página (F5)

### Error al crear partida
- Verifica permisos de escritura en el directorio (755 o 775)
- Asegúrate que PHP tenga acceso para crear carpetas
- Revisa el archivo `debug.log` si estás en modo desarrollo

### Los jugadores no pueden unirse
- Verifica que el código de sala sea correcto (distingue mayúsculas)
- Confirma que la partida no haya expirado (24h sin actividad)
- Comprueba que no se haya alcanzado el límite de jugadores (20 máx)

### SSE se desconecta constantemente
- Tu servidor puede tener un timeout muy corto para conexiones
- Intenta aumentar `max_execution_time` en PHP
- Verifica que no haya proxies o balanceadores que corten la conexión

## 📝 Mejoras Implementadas

- ✅ Seguridad: Validación y sanitización de entradas
- ✅ Race conditions: Sistema de locks en archivos
- ✅ SSE mejorado: Detección de desconexiones y heartbeat optimizado
- ✅ Reconexiones: Exponential backoff y límite de reintentos
- ✅ Validaciones: Colores, palabras, nombres, longitudes
- ✅ Códigos automáticos: Generados desde palabras cortas del diccionario
- ✅ Versionado de estado: Para futuras migraciones
- ✅ Modo desarrollo: Con debugging y reportes
- ✅ Analytics básico: Tracking opcional de eventos
- ✅ Documentación: README completo y API documentada
- ✅ Logs estructurados: Sistema de logging mejorado
- ✅ Sin código redundante: Eliminadas funciones duplicadas

## 📝 Licencia

Proyecto personal de código abierto.

## 🤝 Contribuciones

Este es un proyecto personal, pero las sugerencias son bienvenidas a través de issues o pull requests.

## 📧 Contacto

Desarrollado por Jonatan Pintos - [GitHub](https://github.com/muyunicos)
