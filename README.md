# 🎯 Unánimo Party - Versión Digital

Juego de palabras multijugador estilo "Unánimo" donde los jugadores deben pensar palabras relacionadas y ganar puntos cuando coinciden con otros jugadores.

## 🚀 Características

- **Multijugador en tiempo real** usando Server-Sent Events (SSE)
- **Sin base de datos**: Sistema basado en archivos JSON
- **Responsive**: Funciona en móviles, tablets y Smart TVs
- **Múltiples categorías**: Más de 400 palabras en 15 categorías
- **Modo Host/Jugador**: Pantalla para anfitriones y jugadores separadas
- **Analytics**: Sistema de estadísticas en modo desarrollo

## 💻 Instalación

### Requisitos
- PHP 7.4 o superior
- Servidor web (Apache, Nginx, etc.)
- Soporte para SSE (Server-Sent Events)

### Pasos

1. Clonar el repositorio
2. Configurar permisos: `chmod 777 game_states`
3. Opcional: Configurar cron job para `cleanup-cron.php`
4. Abrir `index.html` en navegador

## ⚙️ Configuración

Editar `settings.php` para personalizar el juego.

## 🎮 Cómo Jugar

### Anfitriones
1. Crear Partida
2. Compartir código
3. Presionar ENTER para iniciar

### Jugadores
1. Ingresar código y nombre
2. Escribir palabras relacionadas
3. Ganar puntos por coincidencias

## 🔌 API Endpoints

Ver documentación completa en el código fuente.

Principal: `POST /api-action.php`

Acciones: create_game, join_game, start_round, submit_answers, end_round, reset_game, leave_game, get_state, get_words

## 🐛 Soporte

[Reportar problemas](https://github.com/muyunicos/talcual/issues)