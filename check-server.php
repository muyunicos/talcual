<?php
/**
 * Script de verificación de configuración del servidor
 * Para Unánimo Party
 */

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verificación del Servidor</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 900px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        h1 { color: #333; }
        .check {
            background: white;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 5px solid #ccc;
        }
        .check.ok {
            border-left-color: #4caf50;
        }
        .check.warning {
            border-left-color: #ff9800;
        }
        .check.error {
            border-left-color: #f44336;
        }
        .icon {
            font-size: 24px;
            margin-right: 10px;
        }
        .value {
            font-family: monospace;
            background: #f0f0f0;
            padding: 2px 8px;
            border-radius: 3px;
        }
        .section {
            margin: 30px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #6366f1;
            color: white;
        }
    </style>
</head>
<body>
    <h1>🔍 Verificación de Configuración del Servidor</h1>

    <div class="section">
        <h2>📊 Información del Servidor</h2>

        <div class="check">
            <strong>Versión de PHP:</strong> 
            <span class="value"><?php echo phpversion(); ?></span>
        </div>

        <div class="check">
            <strong>Servidor:</strong> 
            <span class="value"><?php echo $_SERVER['SERVER_SOFTWARE'] ?? 'Desconocido'; ?></span>
        </div>

        <div class="check">
            <strong>Sistema Operativo:</strong> 
            <span class="value"><?php echo PHP_OS; ?></span>
        </div>
    </div>

    <div class="section">
        <h2>✅ Verificaciones Críticas para SSE</h2>

        <?php
        // Verificar output_buffering
        $ob = ini_get('output_buffering');
        $ob_ok = ($ob === false || $ob === '' || $ob === 'off' || $ob === '0');
        ?>
        <div class="check <?php echo $ob_ok ? 'ok' : 'error'; ?>">
            <span class="icon"><?php echo $ob_ok ? '✅' : '❌'; ?></span>
            <strong>output_buffering:</strong> 
            <span class="value"><?php echo $ob === false ? 'off' : ($ob ?: 'off'); ?></span>
            <?php if (!$ob_ok): ?>
                <br><small>⚠️ Debe estar en OFF para SSE. Configura en .htaccess o php.ini</small>
            <?php endif; ?>
        </div>

        <?php
        // Verificar max_execution_time
        $met = ini_get('max_execution_time');
        $met_ok = ($met == 0 || $met >= 300);
        ?>
        <div class="check <?php echo $met_ok ? 'ok' : 'warning'; ?>">
            <span class="icon"><?php echo $met_ok ? '✅' : '⚠️'; ?></span>
            <strong>max_execution_time:</strong> 
            <span class="value"><?php echo $met; ?> segundos</span>
            <?php if (!$met_ok): ?>
                <br><small>⚠️ Recomendado: 0 (sin límite) o al menos 300 segundos</small>
            <?php endif; ?>
        </div>

        <?php
        // Verificar zlib.output_compression
        $zlib = ini_get('zlib.output_compression');
        $zlib_ok = ($zlib === false || $zlib === '' || $zlib === 'off' || $zlib === '0');
        ?>
        <div class="check <?php echo $zlib_ok ? 'ok' : 'error'; ?>">
            <span class="icon"><?php echo $zlib_ok ? '✅' : '❌'; ?></span>
            <strong>zlib.output_compression:</strong> 
            <span class="value"><?php echo $zlib === false ? 'off' : ($zlib ?: 'off'); ?></span>
            <?php if (!$zlib_ok): ?>
                <br><small>⚠️ Debe estar en OFF para SSE</small>
            <?php endif; ?>
        </div>

        <?php
        // Verificar directorio game_states
        $game_states_dir = __DIR__ . '/game_states';
        $dir_exists = is_dir($game_states_dir);
        $dir_writable = $dir_exists && is_writable($game_states_dir);
        ?>
        <div class="check <?php echo $dir_writable ? 'ok' : 'error'; ?>">
            <span class="icon"><?php echo $dir_writable ? '✅' : '❌'; ?></span>
            <strong>Directorio game_states:</strong> 
            <?php if ($dir_writable): ?>
                <span class="value">Existe y es escribible</span>
            <?php elseif ($dir_exists): ?>
                <span class="value">Existe pero NO es escribible</span>
                <br><small>⚠️ Ejecuta: chmod 755 game_states/</small>
            <?php else: ?>
                <span class="value">No existe</span>
                <br><small>⚠️ Ejecuta: mkdir game_states && chmod 755 game_states/</small>
            <?php endif; ?>
        </div>

        <?php
        // Verificar si existe .htaccess
        $htaccess_exists = file_exists(__DIR__ . '/.htaccess');
        ?>
        <div class="check <?php echo $htaccess_exists ? 'ok' : 'warning'; ?>">
            <span class="icon"><?php echo $htaccess_exists ? '✅' : '⚠️'; ?></span>
            <strong>Archivo .htaccess:</strong> 
            <span class="value"><?php echo $htaccess_exists ? 'Presente' : 'No encontrado'; ?></span>
            <?php if (!$htaccess_exists): ?>
                <br><small>⚠️ El archivo .htaccess es necesario para configurar SSE</small>
            <?php endif; ?>
        </div>

        <?php
        // Verificar si mod_headers está disponible (Apache)
        $mod_headers = function_exists('apache_get_modules') && 
                       in_array('mod_headers', apache_get_modules());
        ?>
        <div class="check <?php echo $mod_headers ? 'ok' : 'warning'; ?>">
            <span class="icon"><?php echo $mod_headers ? '✅' : '⚠️'; ?></span>
            <strong>mod_headers (Apache):</strong> 
            <span class="value"><?php echo $mod_headers ? 'Habilitado' : 'No detectado'; ?></span>
            <?php if (!$mod_headers): ?>
                <br><small>ℹ️ No se pudo verificar, pero puede estar habilitado</small>
            <?php endif; ?>
        </div>
    </div>

    <div class="section">
        <h2>📋 Configuración PHP Completa</h2>
        <table>
            <thead>
                <tr>
                    <th>Directiva</th>
                    <th>Valor Actual</th>
                    <th>Recomendado para SSE</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>output_buffering</td>
                    <td><?php echo ini_get('output_buffering') ?: 'off'; ?></td>
                    <td>off</td>
                </tr>
                <tr>
                    <td>max_execution_time</td>
                    <td><?php echo ini_get('max_execution_time'); ?></td>
                    <td>0 o 300+</td>
                </tr>
                <tr>
                    <td>zlib.output_compression</td>
                    <td><?php echo ini_get('zlib.output_compression') ?: 'off'; ?></td>
                    <td>off</td>
                </tr>
                <tr>
                    <td>implicit_flush</td>
                    <td><?php echo ini_get('implicit_flush') ?: 'off'; ?></td>
                    <td>on (opcional)</td>
                </tr>
                <tr>
                    <td>memory_limit</td>
                    <td><?php echo ini_get('memory_limit'); ?></td>
                    <td>128M+ (suficiente)</td>
                </tr>
                <tr>
                    <td>post_max_size</td>
                    <td><?php echo ini_get('post_max_size'); ?></td>
                    <td>8M+ (suficiente)</td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>📁 Archivos del Proyecto</h2>
        <?php
        $required_files = [
            'index.html',
            'host.html',
            'player.html',
            'api-action.php',
            'sse-stream.php',
            'config.php',
            'game-client.js',
            'styles.css',
            '.htaccess'
        ];

        echo '<table><thead><tr><th>Archivo</th><th>Estado</th></tr></thead><tbody>';
        foreach ($required_files as $file) {
            $exists = file_exists(__DIR__ . '/' . $file);
            $icon = $exists ? '✅' : '❌';
            $status = $exists ? 'Presente' : 'Falta';
            echo "<tr><td>$file</td><td>$icon $status</td></tr>";
        }
        echo '</tbody></table>';
        ?>
    </div>

    <div class="section">
        <h2>🧪 Pruebas Disponibles</h2>
        <div class="check">
            <a href="test-sse.html" style="color: #6366f1; text-decoration: none; font-weight: bold;">
                🔗 Abrir prueba de SSE (test-sse.html)
            </a>
        </div>
        <div class="check">
            <a href="index.html" style="color: #6366f1; text-decoration: none; font-weight: bold;">
                🎮 Abrir juego (index.html)
            </a>
        </div>
    </div>

    <div class="section">
        <h2>💡 Recomendaciones</h2>
        <?php
        $issues = [];

        if (!$ob_ok) {
            $issues[] = "Deshabilitar output_buffering en php.ini o .htaccess";
        }
        if (!$met_ok) {
            $issues[] = "Aumentar max_execution_time a 0 o 300+ segundos";
        }
        if (!$zlib_ok) {
            $issues[] = "Deshabilitar zlib.output_compression";
        }
        if (!$dir_writable) {
            $issues[] = "Crear directorio game_states con permisos 755";
        }
        if (!$htaccess_exists) {
            $issues[] = "Subir archivo .htaccess al servidor";
        }

        if (empty($issues)):
        ?>
            <div class="check ok">
                <span class="icon">🎉</span>
                <strong>¡Todo está correctamente configurado!</strong>
                <br>Puedes proceder a usar el juego sin problemas.
            </div>
        <?php else: ?>
            <div class="check error">
                <strong>Acciones requeridas:</strong>
                <ul>
                    <?php foreach ($issues as $issue): ?>
                        <li><?php echo $issue; ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>
    </div>

    <div style="margin-top: 50px; padding: 20px; background: #e3f2fd; border-radius: 5px;">
        <p><strong>ℹ️ Nota:</strong> Si estás en Hostinger Plan Negocios y ves errores, 
        contacta al soporte técnico para que te ayuden a configurar output_buffering y 
        max_execution_time en el php.ini del servidor.</p>
    </div>
</body>
</html>