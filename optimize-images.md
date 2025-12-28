# Guía de Optimización de Imágenes

## Problema Actual

El archivo `icon.webp` tiene un tamaño de **515KB**, lo cual es excesivo para un favicon y puede afectar los tiempos de carga.

## Solución Recomendada

### Para icon.webp (favicon)

**Tamaño objetivo:** Máximo 50KB
**Dimensiones recomendadas:** 512x512px (o 256x256px)

#### Opciones de optimización:

1. **Online (sin instalar nada)**
   - Usar [Squoosh.app](https://squoosh.app)
   - Cargar icon.webp
   - Ajustar calidad a 75-80%
   - Redimensionar a 512x512 si es mayor
   - Descargar optimizada

2. **Usando ImageMagick (si tienes acceso)**
   ```bash
   convert icon.webp -resize 512x512 -quality 80 icon-optimized.webp
   ```

3. **Usando cwebp (herramienta de Google)**
   ```bash
   cwebp -q 80 -resize 512 512 icon.webp -o icon-optimized.webp
   ```

### Para bg.webp (textura)

**Tamaño actual:** 111KB (aceptable, pero puede mejorarse)
**Objetivo:** 50-80KB

- Si es un patrón repetitivo, considera hacer el tile más pequeño
- Ajustar calidad a 75%

### Para logo.webp

**Tamaño actual:** 30KB (excelente, no necesita optimización)

## Uso de CDN (Opcional)

Para mejorar aún más el rendimiento, considera:

1. **Cloudflare Images** (gratuito en plan básico)
2. **jsDelivr** (CDN gratuito para archivos de GitHub)
3. **ImgIX** o **Cloudinary** (tienen planes gratuitos)

### Ejemplo con jsDelivr:

```html
<!-- En lugar de -->
<link rel="icon" href="icon.webp" type="image/webp">

<!-- Usar -->
<link rel="icon" href="https://cdn.jsdelivr.net/gh/muyunicos/talcual@main/icon.webp" type="image/webp">
```

## Checklist de Implementación

- [ ] Optimizar icon.webp a menos de 50KB
- [ ] (Opcional) Optimizar bg.webp a 50-80KB
- [ ] Reemplazar archivos en el repositorio
- [ ] Probar carga en diferentes conexiones
- [ ] (Opcional) Implementar CDN

## Resultado Esperado

- **Reducción:** ~90% en el tamaño de icon.webp (de 515KB a ~50KB)
- **Mejora:** Carga inicial 400-500ms más rápida
- **Beneficio:** Mejor experiencia en conexiones lentas
