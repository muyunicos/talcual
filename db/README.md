# 🎯 TalCual Party

**TalCual Party** es un juego web multijugador en tiempo real inspirado en mecánicas de coincidencia mental (tipo *100 Argentinos Dicen*). El objetivo es sincronizar tu mente con la de los demás: debes escribir palabras que coincidan con las de los otros jugadores para sumar puntos.

> **Estado:** En desarrollo (Versión 0.04)

## 📋 Características Principales

- **Multijugador Real-Time:** Soporte para múltiples jugadores (1+) conectados simultáneamente.
- **Salas Semánticas:** Los códigos de sala son únicos y se generan usando palabras reales del diccionario (`data/talcual.db`) basadas en la categoría seleccionada.
- **Tecnología SSE:** Actualizaciones en tiempo real mediante *Server-Sent Events*, optimizando la comunicación sin la sobrecarga de WebSockets.
- **Interfaz Híbrida:** Optimizada para **Smart TV** (Vista Anfitrión/Host) y **Móviles** (Controlador de Jugador).
- **Motor de Coincidencias:** Sistema inteligente de puntuación (`js/core/WordEngine.js`) que detecta coincidencias totales o parciales (género, plurales, sinónimos) dando un puntaje variable según el tipo de coincidencia.
- **Personalización:** Sistema de **Auras** (gradientes de color) para identificar a cada jugador.
- **Configuración Total:** Control granular de las mecánicas y el servidor.

## 🧩 Sistema de Modales (UI)

El juego implementa una arquitectura de interfaz robusta mediante un **Modal Manager** centralizado (`js/ModalSystem.js`). Este sistema gestiona las ventanas emergentes utilizando una pila (stack) con **3 capas jerárquicas**, permitiendo superponer alertas críticas sin cerrar los menús de configuración:

1.  **Capa PRIMARY:** Modales base del flujo de juego (ej. *Crear Partida*, *Unirse*).
2.  **Capa SECONDARY:** Formularios y opciones sobre la capa base (ej. *Configuración*, *Editar Nombre*).
3.  **Capa CONFIRMATION:** Alertas de sistema y confirmaciones críticas que requieren atención inmediata.

## ⚙️ Configuración (.env)

El juego es altamente personalizable mediante el archivo `.env`.

> **💡 Nota Importante:** Los valores definidos aquí funcionan como **configuración por defecto** al levantar el servidor. Sin embargo, el **Anfitrión (Host)** tiene control total para modificar parámetros como la duración o cantidad de rondas desde el **Menú de Opciones** de la interfaz, ya sea **antes de crear la partida o durante el transcurso de la misma**.

### 🎮 Mecánicas de Juego (Valores por Defecto)
| Variable | Descripción | Default |
| :--- | :--- | :--- |
| `MIN_PLAYERS` | Mínimo de jugadores para poder iniciar una ronda. | `1` |
| `MAX_PLAYERS` | Capacidad máxima de la sala. | `20` |
| `ROUND_DURATION` | Duración total de la ronda (en segundos). | `90` |
| `TOTAL_ROUNDS` | Cantidad de rondas antes de mostrar la tabla final. | `3` |
| `START_COUNTDOWN` | Tiempo de cuenta regresiva antes de empezar. | `5` |
| `HURRY_UP_THRESHOLD` | Tiempo al que baja el reloj al activar "Remate". | `10` |
| `MAX_WORDS_PER_PLAYER` | Máximo de palabras que un jugador puede enviar. | `6` |
| `MAX_WORD_LENGTH` | Longitud máxima permitida por palabra. | `30` |
| `MAX_CODE_LENGTH` | Longitud máxima para los códigos de sala generados. | `6` |

### 🛠️ Sistema y Mantenimiento
| Variable | Descripción | Default |
| :--- | :--- | :--- |
| `DEV_MODE` | Activa logs detallados para depuración (`true`/`false`). | `true` |
| `MAX_GAME_AGE` | Tiempo (segundos) tras el cual una partida inactiva se borra. | `86400` |
| `CLEANUP_PROBABILITY` | Probabilidad (0-1) de ejecutar limpieza en cada petición. | `0.05` |
| `SSE_TIMEOUT` | Tiempo máximo de conexión para eventos SSE. | `900` |
| `SSE_HEARTBEAT_INTERVAL` | Frecuencia de "latidos" para mantener la conexión viva. | `15` |

## 🎮 Guía de Juego

### 📺 Para el Anfitrión (Host)
1. Abre `index.html` en un Smart TV o monitor grande.
2. Haz clic en **"Crear Partida"**.
3. El sistema elegirá una **Categoría** al azar y generará un código de sala único (basado en una palabra de esa categoría). *Puedes modificar el código si lo deseas antes de iniciar el juego*.
4. Espera a que los jugadores se unan.
5. Cuando todos estén listos, presiona `ENTER` o haz clic en **"Iniciar Ronda"**.
6. **Botón Remate:** Durante la ronda, si el juego se estanca, puedes usar el botón "Remate". Esto bajará el temporizador inmediatamente a `HURRY_UP_THRESHOLD` segundos para presionar a los jugadores.
7. Al finalizar la partida, puedes iniciar una nueva con otra categoría (manteniendo el mismo código de sala).

### 📱 Para los Jugadores
1. Abre `index.html` en tu celular o navegador.
2. Haz clic en **"Unirse"**.
3. Ingresa el código de sala que ves en la TV.
4. Elige tu **Nombre** y selecciona tu **Aura** favorita.
5. Espera el inicio. Verás una cuenta regresiva (`START_COUNTDOWN`).
6. **Juego:** Escribe palabras relacionadas con la consigna.
   - Puedes **editar** una palabra enviada tocando el icono del lápiz ✏️.
   - Si terminas antes de tiempo, usa el botón **"Terminé/Paso"**.
7. Al final de cada ronda, verás si alguna de tus palabras coincidió y generó puntos. Al final de la partida veras la tabla de coincidencias completa de todas las rondas y puntuación acumulada.

## ⏳ Dinámica de la Ronda (Paso a Paso)

1. **Countdown Sincronizado:** Al iniciar, todas las pantallas muestran el mensaje "¿Preparados?" seguido de un conteo de 3, 2, 1.
2. **Tiempo de Juego:** El temporizador se ajusta al tiempo definido y comienza la ronda.
3. **Validación en Cliente:** A medida que escribes, el sistema verifica que no repitas palabras o uses términos muy similares ("¡Probá con otra! 😅").
4. **Límite de Palabras:** Al llegar a `MAX_WORDS_PER_PLAYER`, el input se bloquea. Solo podrás editar las palabras ya escritas o enviar tu turno.
5. **Edición:** Tocar el lápiz elimina la palabra de la lista y la devuelve al campo de texto para que puedas corregirla y volver a enviarla.
6. **Finalización Voluntaria:** El botón "Terminé/Paso" cambia de estado. Si la lista está vacía dice "Paso", si tiene palabras dice "Terminé". Al pulsarlo, finalizas tu turno.
7. **Sanción / Remate Automático:** Si queda un solo jugador activo y el tiempo restante es mayor al de remate, el reloj se reduce automáticamente a `HURRY_UP_THRESHOLD` segundos.
8. **Envío Automático:** Si el tiempo llega a 0 y tenías una palabra escrita en el input sin enviar, esta se valida y se envía automáticamente.
9. **Cálculo de Puntos:** El servidor notifica al final de cada ronda las respuestas de los jugadores a los clientes, estos calculan y muestran el resultado, al final de la partida se envian los resultados de todas las rondas.

## 🛠️ Menú de Opciones

El juego cuenta con un menú hamburguesa con opciones específicas según el rol:

### En el Host
* **Configuración:** Ajustes de partida (mín/máx jugadores, duración, remate automático, etc.).
* **Reiniciar Ronda:** Anula el progreso de la ronda actual y permite volver a jugar la misma ronda desde cero.
* **Reiniciar Partida:** Borra todo el progreso acumulado y comienza de nuevo desde la Ronda 1.
* **Elegir Categoría:** Finaliza la partida actual y abre el selector de categorías para comenzar un nuevo juego sin desconectar a los jugadores.
* **Salir:** Cierra la sala, desconecta a todos los jugadores y vuelve al inicio.

### En el Jugador
* **Personalizar:** Permite cambiar el nombre de usuario y el Aura.
* **Retirarse:** Abandona la partida actual y regresa al inicio (el jugador desaparece de la lista del Host).

## 🤝 Contribuciones

Este es un proyecto personal en desarrollo. Las sugerencias son bienvenidas a través de Issues o Pull Requests.

## 📧 Créditos

Desarrollado por **Jonatan Pintos** - [GitHub](https://github.com/muyunicos)