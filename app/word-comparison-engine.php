<?php
declare(strict_types=1);

/**
 * @file word-comparison-engine.php
 * @description Motor inteligente de comparación de palabras V2.
 * Incluye caché, normalización unicode real y mejor manejo de plurales.
 */

class WordEquivalenceEngine {
    private static ?self $instance = null;
    private array $dictionary = [];
    private array $equivalenceTable = [];
    
    // Configuración
    private const CACHE_FILE = __DIR__ . '/word-engine.cache';
    private const USE_CACHE = true;
    private const FUZZY_TOLERANCE = 1; // 0 = exacto, 1 = permite 1 letra de error

    public static function getInstance(): self {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        // Intentar cargar desde caché primero para mejorar performance
        if (self::USE_CACHE && $this->loadFromCache()) {
            return;
        }

        $this->loadAndProcessDictionary();
        
        if (self::USE_CACHE) {
            $this->saveToCache();
        }
    }

    /**
     * Carga el diccionario JSON y construye la tabla.
     */
    private function loadAndProcessDictionary(): void {
        $file = defined('DICTIONARY_FILE') ? DICTIONARY_FILE : (__DIR__ . '/diccionario.json');

        if (!file_exists($file)) {
            $this->log('Diccionario no encontrado: ' . $file, 'WARNING');
            return;
        }

        $json = file_get_contents($file);
        $data = json_decode($json, true);

        if (!$data) {
            $this->log('Error decodificando diccionario JSON.', 'ERROR');
            return;
        }

        $this->dictionary = $data;
        $this->buildEquivalenceTable($data);
    }

    /**
     * Procesa la estructura del diccionario para aplanar las relaciones.
     */
    private function buildEquivalenceTable(array $data): void {
        $this->equivalenceTable = [];

        // Detección automática de formato (Legacy vs Nuevo)
        $iterator = new RecursiveIteratorIterator(
            new RecursiveArrayIterator($data),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $key => $value) {
            // Buscamos strings que contengan palabras (hojas del árbol o arrays de strings)
            if (is_string($value) && !empty($value)) {
                $this->processWordEntry($value);
            }
        }
        
        $this->log('Tabla construida con ' . count($this->equivalenceTable) . ' entradas.', 'DEBUG');
    }

    /**
     * Genera variaciones para una entrada de diccionario (ej: "Perro|Can")
     */
    private function processWordEntry(string $entry): void {
        $synonyms = explode('|', $entry);
        $synonyms = array_map('trim', $synonyms);
        
        // La primera palabra es la "Canónica" (la verdad absoluta)
        $canonical = $this->normalizeWord($synonyms[0]);

        foreach ($synonyms as $word) {
            $normalizedBase = $this->normalizeWord($word);
            
            // 1. Mapeo directo
            $this->addMapping($normalizedBase, $canonical);

            // 2. Variaciones de Género (y sus plurales)
            $genderVariants = $this->generateGenderVariants($normalizedBase);
            foreach ($genderVariants as $gVariant) {
                $this->addMapping($gVariant, $canonical);
                
                // Plurales del cambio de género (ej: Actor -> Actriz -> Actrices)
                $gNumberVariants = $this->generateNumberVariants($gVariant);
                foreach ($gNumberVariants as $gnVariant) {
                    $this->addMapping($gnVariant, $canonical);
                }
            }

            // 3. Variaciones de Número directas (Singular <-> Plural)
            $numberVariants = $this->generateNumberVariants($normalizedBase);
            foreach ($numberVariants as $nVariant) {
                $this->addMapping($nVariant, $canonical);
            }
        }
    }

    private function addMapping(string $variant, string $canonical): void {
        // Solo agregamos si no existe, o si queremos sobreescribir lógica
        if (!isset($this->equivalenceTable[$variant])) {
            $this->equivalenceTable[$variant] = $canonical;
        }
    }

    /**
     * Normalización robusta que funciona sin extensión Intl.
     */
    private function normalizeWord(string $word): string {
        // 1. Convertir a Mayúsculas primero para estandarizar
        $word = mb_strtoupper($word, 'UTF-8');

        // 2. Reemplazo manual de tildes (Método infalible si fallan las librerías)
        $replacements = [
            'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U',
            'À' => 'A', 'È' => 'E', 'Ì' => 'I', 'Ò' => 'O', 'Ù' => 'U',
            'Ä' => 'A', 'Ë' => 'E', 'Ï' => 'I', 'Ö' => 'O', 'Ü' => 'U',
            'Â' => 'A', 'Ê' => 'E', 'Î' => 'I', 'Ô' => 'O', 'Û' => 'U',
            'Ñ' => 'N', 'Ç' => 'C'
        ];
        
        $word = strtr($word, $replacements);

        // 3. Intento secundario con iconv si está disponible (para caracteres raros)
        if (function_exists('iconv')) {
            $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $word);
            if ($converted) {
                $word = $converted;
            }
        }

        // 4. Limpieza final: dejar solo letras A-Z y números
        $word = preg_replace('/[^A-Z0-9 ]/', '', $word);
        
        // 5. Quitar espacios dobles
        $word = preg_replace('/\s+/', ' ', trim($word));
        
        return $word;
    }

    /**
     * Genera variantes de género basadas en reglas heurísticas del español.
     */
    private function generateGenderVariants(string $word): array {
        $variants = [];
        
        $rules = [
            '/O$/' => 'A',       // ChicO -> ChicA
            '/A$/' => 'O',       // ChicA -> ChicO (bidireccional)
            '/TOR$/' => 'TRIZ',  // AcTOR -> AcTRIZ
            '/ON$/' => 'ONA',    // CampeON -> CampeONA
            '/IN$/' => 'INA',    // BailarIN -> BailarINA
        ];

        foreach ($rules as $pattern => $replacement) {
            if (preg_match($pattern, $word)) {
                $variants[] = preg_replace($pattern, $replacement, $word);
            }
        }

        return $variants;
    }

    /**
     * Genera variantes de número (Singular <-> Plural).
     * Corrige el bug de "CANCIONES" -> "CANCIONE".
     */
    private function generateNumberVariants(string $word): array {
        $variants = [];

        // A. De Singular a Plural
        if (preg_match('/[AEIOU]$/', $word)) {
            $variants[] = $word . 'S';
        } elseif (preg_match('/[DHLMNRSTJ]$/', $word)) { // Consonantes comunes
            $variants[] = $word . 'ES';
        } elseif (preg_match('/Z$/', $word)) {
            $variants[] = substr($word, 0, -1) . 'CES'; // Luz -> Luces
        }

        // B. De Plural a Singular (Heurística inversa mejorada)
        if (substr($word, -3) === 'CES') {
            $variants[] = substr($word, 0, -3) . 'Z'; // Luces -> Luz
        } elseif (substr($word, -2) === 'ES') {
            // Cuidado aquí: "Lunes" termina en ES pero es singular. 
            // Esta lógica es simple, para un juego suele bastar.
            $variants[] = substr($word, 0, -2); // Canciones -> Cancion
        } elseif (substr($word, -1) === 'S') {
             // Evitar quitar S si la palabra termina en SS (raro en español) o es muy corta
            if (strlen($word) > 3) {
                $variants[] = substr($word, 0, -1); // Gatos -> Gato
            }
        }

        return array_unique($variants); // Eliminar duplicados
    }

    // ================= PÚBLICO =================

    public function getCanonicalWord(string $playerWord): ?string {
        $normalized = $this->normalizeWord($playerWord);

        // 1. Búsqueda Exacta (O(1))
        if (isset($this->equivalenceTable[$normalized])) {
            return $this->equivalenceTable[$normalized];
        }

        // 2. Búsqueda Fuzzy (Levenshtein) - Opcional, solo si no hay match exacto
        if (self::FUZZY_TOLERANCE > 0 && strlen($normalized) > 3) {
            foreach ($this->equivalenceTable as $key => $canonical) {
                if (levenshtein($normalized, (string)$key) <= self::FUZZY_TOLERANCE) {
                    return $canonical;
                }
            }
        }

        return null;
    }

    public function areEquivalent(string $word1, string $word2): bool {
        $c1 = $this->getCanonicalWord($word1) ?? $this->normalizeWord($word1);
        $c2 = $this->getCanonicalWord($word2) ?? $this->normalizeWord($word2);
        return $c1 === $c2;
    }

    public function getDictionary(): array {
        return $this->dictionary;
    }

    // ================= CACHÉ & UTILS =================

    private function loadFromCache(): bool {
        if (file_exists(self::CACHE_FILE)) {
            $cacheTime = filemtime(self::CACHE_FILE);
            $dictTime = file_exists(__DIR__ . '/diccionario.json') ? filemtime(__DIR__ . '/diccionario.json') : 0;

            if ($cacheTime > $dictTime) {
                $data = unserialize(file_get_contents(self::CACHE_FILE));
                if ($data) {
                    $this->equivalenceTable = $data['table'];
                    $this->dictionary = $data['dict'];
                    return true;
                }
            }
        }
        return false;
    }

    private function saveToCache(): void {
        $data = [
            'table' => $this->equivalenceTable,
            'dict' => $this->dictionary
        ];
        file_put_contents(self::CACHE_FILE, serialize($data));
    }

    private function log(string $msg, string $level = 'INFO'): void {
        // Integración simple con logs existentes o error_log por defecto
        if (function_exists('logMessage')) {
            logMessage("[WordEngine] $msg", $level);
        } else {
            error_log("[$level] [WordEngine] $msg");
        }
    }
}

// Helpers globales para mantener compatibilidad
function compareWords(string $w1, string $w2): bool {
    return WordEquivalenceEngine::getInstance()->areEquivalent($w1, $w2);
}

function getCanonicalWord(string $w): string {
    $engine = WordEquivalenceEngine::getInstance();
    $canonical = $engine->getCanonicalWord($w);
    return $canonical ?? mb_strtoupper(trim($w), 'UTF-8');
}
?>
