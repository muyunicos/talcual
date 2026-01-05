# Gestor de Diccionario - TalCual Party

**Sistema independiente de gestión de diccionario y partidas**

## Acceso

### Interfaz Web
- **URL**: `http://localhost/talcual/db/`
- **Navegador**: Abre la interfaz visual profesional para gestionar categorías, consignas y palabras válidas

### API REST
- **Base URL**: `http://localhost/talcual/db/api.php?action=ACTION`
- **Métodos**: `GET`, `POST`
- **Respuesta**: JSON

## Funcionalidades

### Categorías
- Crear, editar, eliminar categorías
- Visualizar estadísticas

### Consignas
- Crear consignas con múltiples categorías
- Editar texto y categorías
- Eliminar consignas

### Palabras Válidas
- Añadir palabras aceptadas para cada consigna
- Soporta variantes: `Avengers|Avenger`
- Editar y eliminar

### Gestión de Partidas
- Visualizar lista de partidas activas
- Eliminar partidas
- Ver estadísticas

## Endpoints API

### Categorías
```
GET  /api.php?action=get_categories
POST /api.php?action=add_category&name=Películas
POST /api.php?action=update_category&id=1&name=Films
POST /api.php?action=delete_category&id=1
```

### Consignas
```
GET  /api.php?action=get_prompts&category_id=1
POST /api.php?action=add_prompt&text=Nombra+una+película&category_ids=[1,2]
POST /api.php?action=update_prompt&id=1&text=Nuevo+texto&category_ids=[1]
POST /api.php?action=delete_prompt&id=1
```

### Palabras Válidas
```
GET  /api.php?action=get_words&prompt_id=1
POST /api.php?action=add_word&prompt_id=1&word=Avengers
POST /api.php?action=update_word&id=1&word=Avatar
POST /api.php?action=delete_word&id=1
```

### Estadísticas
```
GET  /api.php?action=get_stats
GET  /api.php?action=get_games
POST /api.php?action=delete_game&code=ABCD
```

### Inspección y Mantenimiento
```
GET  /api.php?action=inspect_db
POST /api.php?action=vacuum_db
```

## Estructura de Base de Datos

### Tablas Principales

**categories**
- `id` (PK)
- `name` (UNIQUE)
- `created_at`

**prompts**
- `id` (PK)
- `text`
- `created_at`
- `updated_at`

**prompt_categories**
- `prompt_id` (FK)
- `category_id` (FK)

**valid_words**
- `id` (PK)
- `prompt_id` (FK)
- `word_entry`
- `created_at`

**games**
- `id` (PK)
- `status`
- `round`
- `current_prompt_id` (FK)
- `created_at`
- `updated_at`

**players**
- `id` (PK)
- `game_id` (FK)
- `name`
- `score`
- `created_at`
- `updated_at`

## Configuración

Edita `db/config.php` para cambiar:
- `APP_ENV`: development | production
- `DB_PATH`: ruta a la base de datos SQLite
- `LOG_PATH`: ruta para logs
- `MAX_GAME_DURATION`: duración máxima de partida (segundos)
- Límites de texto para categorías y palabras

## Seguridad

- ✅ `.db` y `.sql` bloqueados por `.htaccess`
- ✅ Input sanitized y escapado
- ✅ Validación de parámetros
- ✅ Transacciones de base de datos para integridad
- ✅ Foreign keys habilitadas

## Logs

Los logs se guardan en `/db/logs/YYYY-MM-DD.log`

Niveles:
- `INFO`: operaciones normales
- `WARN`: advertencias (no crítico)
- `ERROR`: errores (crítico)
- `DEBUG`: información detallada (dev mode)

## Uso Desde el Juego

El sistema de juego (`/app/`) usa la API de diccionario internamente:

```php
require_once __DIR__ . '/../db/Database.php';
$pdo = Database::getInstance()->getConnection();

// Ejecutar queries
$stmt = $pdo->prepare('SELECT * FROM prompts WHERE id = ?');
$stmt->execute([$promptId]);
$prompt = $stmt->fetch();
```

---

**Separación de responsabilidades:**
- `/db/` → Gestión de diccionario y datos
- `/app/` → Lógica del juego (crear partidas, jugadores, puntuación)
