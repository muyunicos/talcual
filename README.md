# 🎯 TalCual Party

Juego web multiplayer tipo 100 Argentinos Dicen donde los jugadores deben pensar palabras que coincidan con las de los demás para ganar puntos.

## 📋 Características

- Juego multijugador en tiempo real (1+ jugadores)
- Sistema de salas con códigos únicos generados desde el diccionario principal `app/diccionario.json` usando palabras de la categoria inicial
- Actualizaciones en tiempo real usando Server-Sent Events (SSE)
- Interfaz optimizada para Smart TV (host) y móviles (jugadores)
- Sistema de puntuación basado en coincidencias totales o parciales mediante un motor de comparacion de palabras `js/word-comparison.json`
- Personalización con `Auras` para cada jugador (colores)
- Archivo .env con valores por defecto del juego

## 🚀 Instalación

### Requisitos

- PHP 7.4 o superior
- Servidor web (Apache/Nginx)
- Permisos de escritura en el directorio

## 🎮 Cómo Jugar

### Para el Anfitrión
1. Abre `index.html` en un Smart TV o pantalla grande
2. Haz clic en "Crear Partida"
3. Se seleccionará una categoría inicial aleatoria del menú y se generará un código de sala único (palabra de 5 letras o menos de la categoria seleccionada en el diccionario) que puedes modificar
4. Los jugadores se unirán usando ese código
5. Presiona `ENTER` o haz clic en "Iniciar Ronda" cuando todos los jugadores estén listos
6. Comienza la primer ronda, cada ronda se compone de:
countdown inicial (tiene)

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
