# 🎯 TalCual Party

Juego web multiplayer tipo 100 Argentinos Dicen donde los jugadores deben pensar palabras que coincidan con las de los demás para ganar puntos.

## 📋 Características

- Juego multijugador en tiempo real (3+ jugadores)
- Sistema de salas con códigos únicos generados desde el diccionario principal
- Actualizaciones en tiempo real usando Server-Sent Events (SSE)
- Interfaz optimizada para Smart TV (host) y móviles (jugadores)
- Sistema de puntuación basado en coincidencias
- Personalización con colores para cada jugador
- Modo desarrollo con debugging y reportes de bugs

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

## 🎮 Cómo Jugar

### Para el Anfitrión
1. Abre `index.html` en un Smart TV o pantalla grande
2. Haz clic en "Crear Partida"
3. Se generará un código de sala único (palabra de 5 letras o menos del diccionario) que puedes modificar
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

## 📝 Licencia

Proyecto personal de código abierto.

## 🤝 Contribuciones

Este es un proyecto personal, pero las sugerencias son bienvenidas a través de issues o pull requests.

## 📧 Contacto

Desarrollado por Jonatan Pintos - [GitHub](https://github.com/muyunicos)
