<?php
/**
 * @file word-comparison-engine.php
 * @description Motor inteligente de comparación de palabras con soporte para:
 *              - Sinónimos (definidos en diccionario con |)
 *              - Variaciones de género (masculino/femenino)
 *              - Variaciones de número (singular/plural)
 *              - Palabras compuestas (espacios normalizados)
 * 
 * UBICACIÓN: app/word-comparison-engine.php
 * INTEGRACIÓN: Reemplazar funciones en config.php
 */

// ============================================================================
// SISTEMA DE CACHÉ PARA EQUIVALENCIAS
// ============================================================================

class WordEquivalenceEngine {
    private static $instance = null;
    private $dictionary = null;
    private $equivalenceTable = null;
    private $genderVariations = [];
    private $numberVariations = [];
    
    /**
     * Singleton pattern
     */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        $this->loadAndProcessDictionary();
        $this->setupGenderRules();
        $this->setupNumberRules();
    }
    
    /**
     * Carga diccionario y crea tabla de equivalencias
     */
    private function loadAndProcessDictionary() {
        global $DICTIONARY_FILE;
        
        if (!file_exists($DICTIONARY_FILE)) {
            logMessage('[WordEngine] Diccionario no encontrado: ' . $DICTIONARY_FILE, 'WARNING');
            $this->equivalenceTable = [];
            return;
        }
        
        $json = file_get_contents($DICTIONARY_FILE);
        $this->dictionary = json_decode($json, true);
        
        if (!$this->dictionary) {
            logMessage('[WordEngine] Error decodificando diccionario: ' . json_last_error_msg(), 'ERROR');
            $this->equivalenceTable = [];
            return;
        }
        
        $this->buildEquivalenceTable();
    }
    
    /**
     * Construye tabla de equivalencias desde diccionario
     * Estructura esperada:
     * {
     *   "CATEGORIA": [
     *     { "CONSIGNA": ["Palabra1|Sinonimo1|Var1", "Palabra2|Var2"] }
     *   ]
     * }
     */
    private function buildEquivalenceTable() {
        $this->equivalenceTable = [];
        
        if (!is_array($this->dictionary)) {
            return;
        }
        
        foreach ($this->dictionary as $category => $items) {
            if (!is_array($items)) {
                continue;
            }
            
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }
                
                foreach ($item as $prompt => $words) {
                    if (!is_array($words)) {
                        continue;
                    }
                    
                    // Procesar cada palabra/sinónimo
                    foreach ($words as $wordEntry) {
                        $this->processWordEntry($wordEntry);
                    }
                }
            }
        }
        
        logMessage('[WordEngine] Tabla de equivalencias construida con ' . count($this->equivalenceTable) . ' entradas', 'DEBUG');
    }
    
    /**
     * Procesa una entrada de palabra (puede contener sinónimos con |)
     * Ejemplo: "Flores|Ramo|Ramillete"
     */
    private function processWordEntry($entry) {
        if (!is_string($entry) || empty(trim($entry))) {
            return;
        }
        
        // Dividir por | para obtener sinónimos
        $synonyms = array_map('trim', explode('|', $entry));
        
        // Crear palabra canónica (primera palabra del grupo)
        $canonical = $this->normalizeWord($synonyms[0]);
        
        // Registrar todas las variantes apuntando a la canónica
        foreach ($synonyms as $synonym) {
            $normalized = $this->normalizeWord($synonym);
            $this->equivalenceTable[$normalized] = $canonical;
            
            // También agregar variaciones de género y número
            $genderVariants = $this->applyGenderVariations($normalized);
            foreach ($genderVariants as $variant) {
                $this->equivalenceTable[$variant] = $canonical;
            }
            
            $numberVariants = $this->applyNumberVariations($normalized);
            foreach ($numberVariants as $variant) {
                $this->equivalenceTable[$variant] = $canonical;
            }
            
            // Combinar género + número
            foreach ($genderVariants as $genderVar) {
                $combinedVariants = $this->applyNumberVariations($genderVar);
                foreach ($combinedVariants as $combined) {
                    $this->equivalenceTable[$combined] = $canonical;
                }
            }
        }
    }
    
    /**
     * Normaliza una palabra:
     * - Mayúsculas
     * - Trim
     * - Espacios múltiples → espacio simple
     */
    private function normalizeWord($word) {
        if (!is_string($word)) {
            return '';
        }
        
        $word = trim($word);
        $word = strtoupper($word);
        $word = preg_replace('/\s+/', ' ', $word); // Espacios múltiples a uno
        
        return $word;
    }
    
    /**
     * Reglas de variaciones de género (español)
     */
    private function setupGenderRules() {
        // Terminaciones comunes
        $this->genderVariations = [
            // O → A (gato → gata)
            ['pattern' => '/O$/', 'replacement' => 'A'],
            
            // O → A con diminutivo (gordito → gordita)
            ['pattern' => '/ITO$/', 'replacement' => 'ITA'],
            
            // O → A con diminutivo (flaco → flaca, flaquito → flaquita)
            ['pattern' => '/UCO$/', 'replacement' => 'UCA'],
            
            // E → A (príncipe → princesa - caso especial)
            ['pattern' => '/INE$/', 'replacement' => 'INA'],
            
            // Rey → Reina (caso especial)
            ['pattern' => '/EY$/', 'replacement' => 'EINA'],
            
            // Agente → Agenta (mozo → moza)
            ['pattern' => '/OZ$/', 'replacement' => 'OZA'],
        ];
    }
    
    /**
     * Reglas de variaciones de número (español)
     */
    private function setupNumberRules() {
        // Terminaciones vocálicas + s
        // vocales → vocales + s
        // consonantes finales + es
        $this->numberVariations = [
            // Vocal final (a, o, e) → Agregar S
            ['pattern' => '/(A|O|E)$/', 'replacement' => '$1S'],
            
            // Consonantes finales → Agregar ES
            // Z → CES (pez → peces)
            ['pattern' => '/Z$/', 'replacement' => 'CES'],
            
            // D, L, N, R, T, J → + ES
            ['pattern' => '/(D|L|N|R|T|J)$/', 'replacement' => '$1ES'],
        ];
    }
    
    /**
     * Aplica variaciones de género a una palabra
     */
    private function applyGenderVariations($word) {
        $variants = [];
        
        foreach ($this->genderVariations as $rule) {
            if (preg_match($rule['pattern'], $word)) {
                $variant = preg_replace($rule['pattern'], $rule['replacement'], $word);
                if ($variant !== $word && !in_array($variant, $variants)) {
                    $variants[] = $variant;
                }
            }
        }
        
        return $variants;
    }
    
    /**
     * Aplica variaciones de número a una palabra
     */
    private function applyNumberVariations($word) {
        $variants = [];
        
        // Si termina en S, quitar S (plural → singular)
        if (substr($word, -1) === 'S' && strlen($word) > 1) {
            $singular = substr($word, 0, -1);
            if ($singular !== $word && !in_array($singular, $variants)) {
                $variants[] = $singular;
            }
        }
        
        // Aplicar reglas de singular → plural
        foreach ($this->numberVariations as $rule) {
            if (preg_match($rule['pattern'], $word)) {
                $variant = preg_replace($rule['pattern'], $rule['replacement'], $word);
                if ($variant !== $word && !in_array($variant, $variants)) {
                    $variants[] = $variant;
                }
            }
        }
        
        return $variants;
    }
    
    /**
     * Obtiene la palabra canónica para una respuesta del jugador
     * 
     * @param string $playerWord - Palabra escrita por el jugador
     * @return string|null - Palabra canónica o null si no coincide
     */
    public function getCanonicalWord($playerWord) {
        $normalized = $this->normalizeWord($playerWord);
        
        if (isset($this->equivalenceTable[$normalized])) {
            return $this->equivalenceTable[$normalized];
        }
        
        return null;
    }
    
    /**
     * Verifica si dos palabras son equivalentes
     * 
     * @param string $word1
     * @param string $word2
     * @return bool
     */
    public function areEquivalent($word1, $word2) {
        $canonical1 = $this->getCanonicalWord($word1);
        $canonical2 = $this->getCanonicalWord($word2);
        
        return $canonical1 !== null && $canonical1 === $canonical2;
    }
    
    /**
     * Obtiene todos los sinónimos de una palabra canónica
     * 
     * @param string $canonicalWord
     * @return array
     */
    public function getSynonyms($canonicalWord) {
        $canonical = $this->normalizeWord($canonicalWord);
        $synonyms = [];
        
        foreach ($this->equivalenceTable as $word => $canonical_ref) {
            if ($canonical_ref === $canonical) {
                $synonyms[] = $word;
            }
        }
        
        return array_unique($synonyms);
    }
    
    /**
     * Debug: Obtener tabla de equivalencias (DEV ONLY)
     */
    public function getEquivalenceTable() {
        return $this->equivalenceTable;
    }
    
    /**
     * Debug: Obtener diccionario cargado
     */
    public function getDictionary() {
        return $this->dictionary;
    }
}

// ============================================================================
// FUNCIONES DE INTEGRACIÓN
// ============================================================================

/**
 * Compara dos palabras considerando:
 * - Sinónimos del diccionario
 * - Variaciones de género
 * - Variaciones de número
 * 
 * @param string $playerWord - Palabra escrita por jugador
 * @param string $otherPlayerWord - Palabra de otro jugador (para comparación)
 * @return bool - Son equivalentes
 */
function compareWords($playerWord, $otherPlayerWord) {
    $engine = WordEquivalenceEngine::getInstance();
    return $engine->areEquivalent($playerWord, $otherPlayerWord);
}

/**
 * Obtiene palabra canónica para normalizar respuestas
 * 
 * @param string $word
 * @return string - Palabra canónica o la palabra original normalizada
 */
function getCanonicalWord($word) {
    $engine = WordEquivalenceEngine::getInstance();
    $canonical = $engine->getCanonicalWord($word);
    
    // Si no está en diccionario, devolver palabra normalizada
    if ($canonical === null) {
        return strtoupper(trim($word));
    }
    
    return $canonical;
}

logMessage('[✅] word-comparison-engine.php cargado - Motor inteligente de comparación de palabras', 'DEBUG');
?>