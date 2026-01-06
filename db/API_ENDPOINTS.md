# TalCual Admin Database API

Complete API documentation for `dmanager.php` - the administrative database management tool for TalCual game.

## Overview

Base URL: `/db/dmanager.php`

All responses are JSON format:
```json
{
  "success": true|false,
  "message": "Human-readable message",
  "data": { ... } | null
}
```

---

## Dictionary Management (Categories & Prompts)

### GET `/db/dmanager.php?action=get-categories`
Fetch all categories in the dictionary.

**Response:**
```json
{
  "success": true,
  "message": "Categorías cargadas",
  "data": [
    { "id": 1, "name": "Cosas de Cocina" },
    { "id": 2, "name": "Marcas de Autos" }
  ]
}
```

### POST `/db/dmanager.php?action=add-category`
Create a new category.

**Request Body:**
```json
{
  "name": "Frutas Tropicales"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Categoría agregada",
  "data": {
    "id": 3,
    "name": "Frutas Tropicales"
  }
}
```

### POST `/db/dmanager.php?action=delete-category`
Delete a category (cascades to related prompts).

**Request Body:**
```json
{
  "id": 3
}
```

### GET `/db/dmanager.php?action=get-prompts`
Fetch all prompts in the dictionary.

**Query Parameters (optional):**
- `category_id` - Filter by category

**Response:**
```json
{
  "success": true,
  "message": "Consignas cargadas",
  "data": [
    {
      "id": 1,
      "text": "Utensilios de madera",
      "category_ids": [1]
    },
    {
      "id": 2,
      "text": "Marcas japonesas",
      "category_ids": [2]
    }
  ]
}
```

### POST `/db/dmanager.php?action=add-prompt`
Create a new prompt with associated words.

**Request Body:**
```json
{
  "text": "Cosas rojas",
  "category_id": 5,
  "words": ["manzana", "tomate", "fuego", "sangre"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Consigna agregada",
  "data": {
    "prompt_id": 42
  }
}
```

### POST `/db/dmanager.php?action=delete-prompt`
Delete a prompt (cascades to valid words).

**Request Body:**
```json
{
  "id": 42
}
```

---

## Game Management

### GET `/db/dmanager.php?action=get-games`
Fetch recent games with pagination.

**Query Parameters (optional):**
- `limit` - Number of results (default: 100)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "message": "Partidas cargadas",
  "data": [
    {
      "id": "ABCD",
      "status": "finished",
      "current_round": 3,
      "current_category": "Cosas de Cocina",
      "selected_category": null,
      "updated_at": 1735948000,
      "created_at": 1735947000,
      "total_rounds": 3,
      "round_duration": 60000,
      "player_count": 4
    }
  ]
}
```

### GET `/db/dmanager.php?action=get-game&code=ABCD`
Fetch details for a specific game.

**Response:**
```json
{
  "success": true,
  "message": "Partida cargada",
  "data": {
    "id": "ABCD",
    "status": "finished",
    "current_round": 3,
    "current_category": "Cosas de Cocina",
    "selected_category": null,
    "updated_at": 1735948000,
    "created_at": 1735947000,
    "total_rounds": 3,
    "round_duration": 60000,
    "player_count": 4
  }
}
```

### GET `/db/dmanager.php?action=get-game-players&game_id=ABCD`
Fetch all players in a game with their current state.

**Response:**
```json
{
  "success": true,
  "message": "Jugadores cargados",
  "data": [
    {
      "id": "player_uuid_1",
      "game_id": "ABCD",
      "name": "Alice",
      "color": "#FF6B6B",
      "avatar": "cat",
      "status": "playing",
      "score": 24,
      "disconnected": false,
      "current_answers": ["cuchara", "tenedor"],
      "round_history": {
        "1": { "words": ["cuchara"], "points": 5 },
        "2": { "words": ["tenedor"], "points": 7 },
        "3": { "words": [], "points": 0 }
      }
    }
  ]
}
```

### GET `/db/dmanager.php?action=get-player-stats&game_id=ABCD&player_id=player_uuid_1`
Fetch specific player statistics for a game.

**Response:**
```json
{
  "success": true,
  "message": "Estadísticas del jugador",
  "data": {
    "id": "player_uuid_1",
    "name": "Alice",
    "score": 24,
    "status": "playing",
    "round_history": { ... },
    "current_answers": [ ... ]
  }
}
```

### POST `/db/dmanager.php?action=delete-game`
Delete a game and all associated player records.

**Request Body:**
```json
{
  "game_id": "ABCD"
}
```

### POST `/db/dmanager.php?action=delete-player`
Remove a player from a game.

**Request Body:**
```json
{
  "game_id": "ABCD",
  "player_id": "player_uuid_1"
}
```

### POST `/db/dmanager.php?action=update-player-status`
Update player connection/game status.

**Request Body:**
```json
{
  "game_id": "ABCD",
  "player_id": "player_uuid_1",
  "status": "disconnected"
}
```

**Status Values:**
- `connected` - Player is connected
- `ready` - Player is ready to start
- `playing` - Active in current round
- `disconnected` - Connection lost

---

## Database Utilities

### GET `/db/dmanager.php?action=inspect`
Quick health check and statistics.

**Response:**
```json
{
  "success": true,
  "message": "Inspección de base de datos",
  "data": {
    "stats": {
      "categorias": 12,
      "total_palabras": 3847,
      "palabras_codigo": 3847,
      "categorias_detalle": {
        "Cosas de Cocina": 156,
        "Marcas de Autos": 89
      }
    },
    "status": "HEALTHY",
    "database_file": "/data/talcual.db",
    "timestamp": "2026-01-06 01:47:42"
  }
}
```

### GET `/db/dmanager.php?action=get-db`
Full database dump (dictionary only, no games).

**Response:**
```json
{
  "success": true,
  "message": "Base de datos cargada",
  "data": {
    "categories": [ ... ],
    "prompts": [ ... ],
    "words": [ ... ],
    "games": [ ... ],
    "players": [ ... ],
    "stats": { ... }
  }
}
```

### GET `/db/dmanager.php?action=diagnose`
Detailed database integrity check.

**Response:**
```json
{
  "success": true,
  "message": "Diagnóstico completado",
  "data": {
    "db_file_exists": true,
    "db_file_readable": true,
    "db_file_writable": true,
    "is_valid_sqlite": true,
    "tables_ok": true,
    "table_count": 6,
    "integrity_ok": true,
    "indexes_ok": true,
    "index_count": 6,
    "errors": []
  }
}
```

### POST `/db/dmanager.php?action=optimize`
Clean up database (remove orphaned data, vacuum).

**Response:**
```json
{
  "success": true,
  "message": "Base de datos optimizada",
  "data": {
    "before": { "categorias": 12, "total_palabras": 3847 },
    "issues": [
      "Consignas huérfanas eliminadas: 3",
      "Referencias muertas limpiadas: 5"
    ],
    "after": { "categorias": 12, "total_palabras": 3839 }
  }
}
```

### POST `/db/dmanager.php?action=repair`
Repair corrupted database (integrity check + rebuild if needed).

### POST `/db/dmanager.php?action=nuke`
Wipe and recreate database (DESTRUCTIVE - use with caution).

### GET `/db/dmanager.php?action=export`
Export dictionary as JSON for backup/import.

**Response:**
```json
{
  "success": true,
  "message": "Exportación completada",
  "data": {
    "categorias": [ ... ],
    "prompts": [ ... ]
  }
}
```

### POST `/db/dmanager.php?action=import`
Import dictionary from JSON file.

**Request Body:**
```json
{
  "categorias": {
    "Cosas de Cocina": {
      "consignas": [1, 2, 3]
    }
  },
  "consignas": {
    "1": {
      "pregunta": "Utensilios de madera",
      "respuestas": ["cuchara", "tenedor"]
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Base de datos importada",
  "data": {
    "categories_added": 5,
    "categories_existing": 7,
    "prompts_added": 32,
    "prompts_existing": 0,
    "words_added": 847,
    "words_existing": 0
  }
}
```

### POST `/db/dmanager.php?action=save`
Save (merge) dictionary data to database.

---

## Error Responses

All errors return HTTP 400 with:
```json
{
  "success": false,
  "message": "Error description"
}
```

Common errors:
- `Empty input` - Request body is missing
- `Missing [field]` - Required field not provided
- `JSON inválido` - Request body is not valid JSON
- `Game not found` - Specified game doesn't exist
- `Player not found` - Specified player doesn't exist

---

## Administration Workflow

### Daily Operations

1. **Monitor Database Health**
   ```bash
   curl 'http://localhost/db/dmanager.php?action=inspect'
   ```

2. **Add New Dictionary Content**
   ```bash
   curl -X POST 'http://localhost/db/dmanager.php?action=add-category' \
     -H 'Content-Type: application/json' \
     -d '{"name": "New Category"}'
   ```

3. **Optimize Database (Weekly)**
   ```bash
   curl -X POST 'http://localhost/db/dmanager.php?action=optimize'
   ```

### Maintenance

1. **Backup Dictionary**
   ```bash
   curl 'http://localhost/db/dmanager.php?action=export' > backup.json
   ```

2. **Repair if Corrupted**
   ```bash
   curl -X POST 'http://localhost/db/dmanager.php?action=repair'
   ```

3. **Diagnose Issues**
   ```bash
   curl 'http://localhost/db/dmanager.php?action=diagnose'
   ```

### Game Analytics

1. **View Recent Games**
   ```bash
   curl 'http://localhost/db/dmanager.php?action=get-games?limit=50'
   ```

2. **Inspect Game Details**
   ```bash
   curl 'http://localhost/db/dmanager.php?action=get-game&code=ABCD'
   curl 'http://localhost/db/dmanager.php?action=get-game-players&game_id=ABCD'
   ```

3. **Clean Up Old Games**
   ```bash
   curl -X POST 'http://localhost/db/dmanager.php?action=delete-game' \
     -H 'Content-Type: application/json' \
     -d '{"game_id": "ABCD"}'
   ```

---

## Logging

All operations are logged to `/logs/dmanager.log`:
```
[2026-01-06 01:47:42] [INFO] New database created successfully at /data/talcual.db
[2026-01-06 01:48:10] [INFO] Categoría agregada
[2026-01-06 01:49:30] [WARN] Consignas huérfanas eliminadas: 3
[2026-01-06 01:50:00] [ERROR] Error adding valid word: Duplicate entry
```

Log levels:
- `INFO` - Normal operations
- `WARN` - Non-critical issues (orphaned data, etc.)
- `ERROR` - Recoverable errors
- `FATAL` - Unrecoverable errors (PHP exceptions)
