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
6. Al comenzar cada ronda el Anfitrión puede decidir terminar la ronda antes de tiempo con el botón "Remate" que cambia el temporizador a todos y lo BAJA unicamente a HURRY_UP_THRESHOLD
7. Al finalizar todas las rondas, el anfitrion puede decidir iniciar una nueva con una nueva categoria (el codigo de sala permanece igual durante toda la sesion de juego)

### Para Jugadores

1. Abre `index.html` en tu celular o navegador
2. Haz clic en "Unirse"
3. Ingresa el código de sala mostrado en la TV
4. Elige tu nombre (2-20 caracteres) y podes seleccionar tu Aura favorita
5. Espera a que el anfitrión inicie la ronda, y aguarda el countdow inicial (START_COUNTDOWN)
6. Escribe una palabra relacionada con la consigna mostrada y enviala, cada palabra enviada luego puede aditarse antes de finalizar el tiempo de la ronda
7. Envía tus respuestas antes de que termine el tiempo con el boton "Terminé/Paso" (el mismo botón dice "Paso" cuando no hay respuestas, "Terminé" cuando hay almenos una palabra en la lista)
8. Ganas puntos por cada palabra que coincida totalmente o parcialmente con otros jugadores (basado en similtudes como género, pluralidad, sinónimos predefinidos)
9. Al final de cada ronda podes ver cuantos puntos sumo cada palabra
10. al finalizar la ultima ronda podes ver la tabla completa de coincidencias para conocer con quienes coincidiste y si alguna de tus respuestas coincidió en el rankig mundial

### Composición de cada ronda de la partida
1. Comienza con el countdown (es un tiempo predefinido para dar tiempo a todos a estar sincronizados) el countdown muestra en cada pantalla encima de la interfaz en medio de la pantalla el mensaje "preparados?" y luego 3,2,1 en los ultimos 3 segundos del countdown.
2. Al finalizar el countdows comienza la ronda y el temporizador de juego (arriba en el medio de cada pantalla) se setea en ek tiempo definido.
3. cada respuesta que envia el jugador se verifica del lado del cliente en busca de similtudes con otras palabras ingresadas por el mismo jugador para evitar palabras repetidas en la lista del jugador (si la palabra esta repetida o es similar a otra, se muestra el mensaje "probá con otra! 😅")
4. una vez que el jugador alcanzo el limite de palabras del juego (MAX_WORDS_PER_PLAYER) no podra enviar nuevas palabras pero seguira teniendo la posibilidad de cambiar alguna ya escrita
5. para cambiar una palabra durante la partida el jugador puede tocar en el lapiz a la derecha de una palabra, al hacerlo, la palabra se elimina de la lista y aparece escrita en el campo de ingreso para que el jugador la modifique y vuelva a enviar
6. el jugador puede usar el boton "Terminé/Paso" para finalizar su turno durante cualquier momento de la ronda.
7. cuando el jugador termina su turno ya no puede ver sus palabras y debe esperar a que se termine el tiempo o bien todos terminen su turno para ver los resultados de la ronda
8. si queda solo un jugador que no termino su turno, este es sancionado en caso de que el temporizador sea mayor al tiempo de remate (HURRY_UP_THRESHOLD), y entonces se reducira el tiempo a HURRY_UP_THRESHOLD para terminar la ronda antes de tiempo
9 si al terminarse el temporizador algun jugador no terminó de enviar una palabra, esta se valida y se envia automaticamente (si es valida)
10 al finalizar la ronda el host se encarga de ver los resultados y calcular los puntos, tras tener los resultados les avisa a los clientes
11 los clientes muestran sus puntos al final de la ronda
12 al final de la partida se muestra una tabla mas completa en el host con los resultados
13 el anfitrion puede seleccionar el boton "nuevo juego!" que abre el modal para elegir categoria (el campo de codigo de sala esta deshabilitado ya que no se puede cambiar durante el juego)
14 para finalizar el juego el anfitrion debe elegir la opcion "terminar partida" del menu inferior

### Menu de opciones
esta son las opciones disponibles en el menu:
*
*
*
*
*reiniciar ronda (solo en host, la ronda actual se anula, aparece nuevamente el boton "Iniciar Ronda")
*Configuracion (en host muestra opciones de la partida como numero minimo de jugadores, numero maximo, cantidad de rondas, duracion de la ronda, tiempo de remate, tiempo de countdows inicial, y activar o desactivar el remate automatico al quedar un jugador) (en el jugador, puede cambiar su nombre y aura)
*Salir (en host termina la partida y vuelve al index, todos los jugadores son expulsados de la sala automaticamente) (si lo toca un jugador desde play.html este es expulsado al index y desaparece del host)

## 🤝 Contribuciones

Este es un proyecto personal, pero las sugerencias son bienvenidas a través de issues o pull requests.

## 📧 Contacto

Desarrollado por Jonatan Pintos - [GitHub](https://github.com/muyunicos)
