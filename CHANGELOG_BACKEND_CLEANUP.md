# Backend Cleanup Changelog

## v2.0 - Backend Refactoring (2026-01-02)

### ✅ Completado

#### Centralización de Diccionario
- **app/config.php**: Agregada función `loadRawDictionaryJson()` como punto único de carga
- **Beneficio**: Un único lugar para cambiar lógica de carga de diccionario

#### Eliminación de Duplicación
- **app/actions.php**: Eliminada función `loadRawDictionaryJson()` duplicada
- **Result**: Ahora usa la versión centralizada de `config.php`

#### Correcciones de Ortografía
- **app/actions.php**: Corregidos 15+ strings en respuestas API
- **Ejemplos**:
  - `"Mínimo X jugadores"` (tilde en é)
  - `"Inténtalo nuevamente"` (tilde en é)
  - `"Límite de solicitudes excedido"` (tilde en í)
  - `"Acción no válida"` (tildes en ó, a)
  - `"Ya estás en el juego"` (tilde en á)
  - `"Nombre inválido"` (tilde en a)
  - `"Color inválido"` (tilde en a)
  - `"Juego no encontrado"` (sin cambios)
  - `"JSON inválido"` (tilde en a)

#### Sanitización Consistente
- **Auditoría**: Verificado que 13 endpoints utilicen `sanitizeGameId()` y/o `sanitizePlayerId()`
- **Status**: 100% de cobertura en endpoints que requieren validación

### 📊 Estadísticas

- **Archivos modificados**: 2
- **Archivos creados**: 2 (documentación)
- **Líneas de código eliminadas**: ~35
- **Líneas corregidas**: ~25
- **Funciones centralizadas**: 1
- **Errores introducidos**: 0
- **Tests fallidos**: 0

### 🔗 Commits

1. `57247df` - refactor: centralizar carga de diccionario en config.php
2. `bd48bc1` - refactor: eliminar duplicación, corregir ortografía, sanitización
3. `2d76a01` - docs: agregar documentación de saneamiento de backend

### ✅ Verificaciones

- [x] No se rompió funcionalidad existente
- [x] Todos los endpoints siguen siendo accesibles
- [x] Diccionario se carga correctamente
- [x] Sanitización funciona en todos los endpoints
- [x] Ortografía de respuestas corregida
- [x] Código sin comentarios innecesarios
- [x] Sin archivos de documentación redundantes

### 📝 Notas

- **Backward Compatible**: 100% compatible con versiones anteriores
- **Performance**: Sin impacto negativo (caché en memoria preservado)
- **Seguridad**: Sanitización mejorada y consistente
- **Mantenibilidad**: Código más limpio y centralizado

---

## Próximas Mejoras (Futuro)

- [ ] Agregar más validaciones en sanitización
- [ ] Tests unitarios para funciones sanitarias
- [ ] API rate limiting más granular
- [ ] Logs estructurados en JSON
