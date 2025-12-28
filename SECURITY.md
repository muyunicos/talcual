# 🛡️ Guía de Seguridad - TalCual Party

## 🔒 Configuración Segura

### Variables de Entorno

**IMPORTANTE**: Nunca subas tu archivo `.env` al repositorio. Este archivo contiene configuración específica de tu servidor.

1. Copia `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edita `.env` con tus valores:
   ```bash
   nano .env
   ```

3. El archivo `.env` está incluido en `.gitignore` y NO se subirá a GitHub.

## 🔐 Seguridad Implementada

### 1. Sanitización de Entradas

Todas las entradas de usuario son validadas y sanitizadas:

- **Códigos de sala**: Solo letras y números, 3-6 caracteres
- **IDs de jugador**: Solo alfanuméricos y guiones bajos, 5-50 caracteres
- **Nombres**: 2-20 caracteres, escapados para JSON
- **Colores**: Validación de formato hexadecimal `#RRGGBB,#RRGGBB`
- **Palabras**: Máximo 30 caracteres, sin espacios, filtrado de vacíos

### 2. Protección contra Race Conditions

Sistema de locks para escritura de archivos:

- Lock exclusivo con `flock()` al guardar estados
- Limpieza automática de locks huérfanos (>5 minutos)
- Timeout en operaciones de escritura

### 3. Prevención de Path Traversal

Los nombres de archivo son sanitizados:

```php
$gameId = sanitizeGameId($input['game_id']);
$file = GAME_STATES_DIR . '/' . $gameId . '.json';
```

No se permite ningún carácter especial que pueda escapar del directorio.

### 4. Limpieza Automática

Archivos viejos (>24h) son eliminados automáticamente:

- Probabilidad configurable (5% por defecto)
- También elimina locks huérfanos
- Cron job opcional para limpieza programada

### 5. Límites de Recursos

Prevención de abuso:

- Máximo 20 jugadores por sala
- Máximo 6 palabras por jugador
- Timeout de SSE: 15 minutos (configurable)
- Tamaño máximo de palabra: 30 caracteres

## 🚨 Configuración de Producción

### Permisos de Archivos

```bash
# Directorio principal
chmod 755 /ruta/a/talcual

# Archivos PHP
chmod 644 *.php

# Directorio de estados (debe ser escribible)
chmod 755 game_states/

# .env (solo lectura para el owner)
chmod 600 .env
```

### Apache/Nginx

**Apache** (.htaccess incluido):
- Deniega acceso a `.env`, `.git`, archivos de lock
- Configuración SSE optimizada

**Nginx** (configuración recomendada):

```nginx
location ~ /\. {
    deny all;
}

location ~ \.(lock|log|env)$ {
    deny all;
}

location ~ \.json$ {
    deny all;
}

location /game_states/ {
    deny all;
}

# SSE endpoint
location ~ ^/(sse-stream|api-action)\.php$ {
    fastcgi_buffering off;
    proxy_buffering off;
    fastcgi_read_timeout 900s;
}
```

### PHP Recomendado

```ini
; php.ini o .user.ini
max_execution_time = 900
memory_limit = 128M
output_buffering = Off
implicit_flush = On
log_errors = On
display_errors = Off
```

## 🛠️ Modo Desarrollo

Para desarrollo local:

```env
DEV_MODE=true
```

**NUNCA actives DEV_MODE en producción** porque:
- Muestra errores detallados
- Expone información del sistema
- Permite acceso al endpoint `get_stats`
- Genera logs muy verbosos

## 📊 Monitoreo

### Logs

En DEV_MODE:
- `debug.log`: Todos los eventos y errores
- Consola del navegador: Logs de cliente

En producción:
- Solo errores críticos en error_log de PHP
- Analytics básico (opcional) en `analytics.json`

### Archivos a Monitorear

```bash
# Tamaño del directorio de estados
du -sh game_states/

# Número de partidas activas
ls -1 game_states/*.json | wc -l

# Locks huérfanos
find game_states/ -name "*.lock" -mmin +5

# Analytics (si está habilitado)
wc -l analytics.json
```

## 🐛 Reporte de Vulnerabilidades

Si encuentras una vulnerabilidad de seguridad:

1. **NO** la reportes públicamente
2. Envía un correo a: [tu-email]
3. Incluye:
   - Descripción detallada
   - Pasos para reproducir
   - Impacto potencial

## 📝 Checklist de Despliegue

Antes de poner en producción:

- [ ] Copiar `.env.example` a `.env` con valores correctos
- [ ] Establecer `DEV_MODE=false` en `.env`
- [ ] Configurar permisos correctos (755/644/600)
- [ ] Verificar que `.gitignore` excluye archivos sensibles
- [ ] Probar SSE con conexiones reales (3+ jugadores)
- [ ] Configurar cron job para limpieza (opcional)
- [ ] Verificar logs de errores PHP
- [ ] Probar que `.env` no es accesible por HTTP
- [ ] Configurar backup de `game_states/` si es necesario
- [ ] Verificar timeouts de servidor para SSE

## 🔗 Referencias

- [OWASP PHP Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/PHP_Configuration_Cheat_Sheet.html)
- [Server-Sent Events - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [File Locking in PHP](https://www.php.net/manual/en/function.flock.php)
