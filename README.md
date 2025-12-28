# 🎯 Unánimo Party - Digital

Juego web multiplayer tipo "Unánimo" donde los jugadores deben pensar palabras que coincidan con las de los demás para ganar puntos.

## 📋 Características

- Juego multijugador en tiempo real (3+ jugadores)
- Sistema de salas con códigos únicos
- Actualizaciones en tiempo real usando Server-Sent Events (SSE)
- Interfaz optimizada para Smart TV (host) y móviles (jugadores)
- Sistema de puntuación basado en coincidencias
- Personalización con colores para cada jugador

## 🚀 Instalación

### Requisitos

- PHP 7.4 o superior
- Servidor web (Apache/Nginx)
- Permisos de escritura en el directorio

### Pasos

1. Clona o descarga el repositorio
2. Sube los archivos a tu servidor web
3. Asegúrate que el directorio tenga permisos de escritura
4. El sistema creará automáticamente la carpeta `game_states/` para almacenar partidas
5. (Opcional) Configura un cron job para limpieza:
   ```bash
   0 */6 * * * php /ruta/a/cleanup-cron.php
   ```

## 🎮 Cómo Jugar

### Para el Anfitrión

1. Abre `index.html` en un Smart TV o pantalla grande
2. Haz clic en "Crear Partida"
3. Se generará un código de sala único
4. Los jugadores se unirán usando ese código
5. Presiona `ENTER` o haz clic en "Iniciar Ronda" cuando todos estén listos
6. Presiona `C` para mostrar/ocultar controles

### Para Jugadores

1. Abre `index.html` en tu celular
2. Ingresa el código de sala
3. Elige tu nombre y color
4. Espera a que el anfitrión inicie la ronda
5. Escribe hasta 6 palabras relacionadas con la palabra mostrada
6. Envía tus respuestas antes de que termine el tiempo
7. Ganas puntos por cada palabra que coincida con otros jugadores

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

### `sse-stream.php`

Server-Sent Events para actualizaciones en tiempo real.

**URL**: `sse-stream.php?game_id=PLAYA`

Eventos:
- `update`: Se envía cuando cambia el estado del juego
- Heartbeat cada 15 segundos

## ⚙️ Configuración

Edita `constants.php` para configurar el sistema:

```php
// Modo desarrollo (muestra errores, logs detallados)
define('DEV_MODE', true);

// Duración de ronda por defecto (segundos)
define('DEFAULT_ROUND_DURATION', 120);

// Número de rondas por defecto
define('DEFAULT_TOTAL_ROUNDS', 3);

// Máximo de palabras por jugador
define('MAX_WORDS_PER_PLAYER', 6);

// Longitud máxima de cada palabra
define('MAX_WORD_LENGTH', 30);

// Tiempo de expiración de partidas (segundos)
define('GAME_EXPIRATION_TIME', 86400);
```

## 📊 Analytics

El sistema guarda estadísticas en `game_states/analytics.json` (solo en producción):

- Total de partidas creadas
- Total de jugadores únicos
- Duración promedio de partidas
- Palabras más usadas
- Última actualización

## 🐛 Modo Desarrollo

Activa el modo desarrollo en `constants.php`:

```php
define('DEV_MODE', true);
```

Características en modo desarrollo:
- Logs detallados en consola
- Sistema de reporte de bugs
- No se guarda analytics
- Tests activables

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
├── constants.php       # Constantes configurables
├── diccionario.json    # Palabras del juego
├── cleanup-cron.php    # Script de limpieza
├── game_states/        # Estados de partidas (creado automáticamente)
│   ├── *.json         # Archivos de estado de cada partida
│   └── analytics.json # Estadísticas del sistema
└── README.md          # Este archivo
```

## 🔒 Seguridad

- Validación y sanitización de entradas
- Códigos de sala aleatorios y únicos
- Expiración automática de partidas (24 horas)
- Sin almacenamiento de datos personales

## 🛠️ Solución de Problemas

### Las actualizaciones no llegan en tiempo real
- Verifica que tu servidor soporte SSE
- Revisa que el firewall no bloquee conexiones largas
- Intenta recargar la página (F5)

### Error al crear partida
- Verifica permisos de escritura en el directorio
- Asegúrate que PHP tenga acceso para crear carpetas

### Los jugadores no pueden unirse
- Verifica que el código de sala sea correcto (mayúsculas)
- Confirma que la partida no haya expirado (24h)

## 📝 Licencia

Proyecto personal de código abierto.

## 🤝 Contribuciones

Este es un proyecto personal, pero las sugerencias son bienvenidas.

## 📧 Contacto

Desarrollado por Jonatan Pintos - [GitHub](https://github.com/muyunicos)
