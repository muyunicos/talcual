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
 */

class WordEquivalenceEngine {
    private static $instance = null;
    private $dictionary = null;
    private $equivalenceTable = null;
    private $genderVariations = [];
    private $numberVariations = [];

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

    private function loadAndProcessDictionary() {
        $file = defined('DICTIONARY_FILE') ? DICTIONARY_FILE : (__DIR__ . '/diccionario.json');

        if (!file_exists($file)) {
            logMessage('[WordEngine] Diccionario no encontrado: ' . $file, 'WARNING');
            $this->equivalenceTable = [];
            return;
        }

        $json = file_get_contents($file);
        $this->dictionary = json_decode($json, true);

        if (!$this->dictionary) {
            logMessage('[WordEngine] Error decodificando diccionario: ' . json_last_error_msg(), 'ERROR');
            $this->equivalenceTable = [];
            return;
        }

        $this->buildEquivalenceTable();
    }

    /**
     * Construye tabla de equivalencias desde diccionario.
     * Soporta:
     * - Legacy: { "categorias": { "GENERAL": ["Flores|Ramo", ...] } }
     * - Nuevo: { "CATEGORIA": [ { "CONSIGNA": ["Flores|Ramo", ...] }, ... ] }
     */
    private function buildEquivalenceTable() {
        $this->equivalenceTable = [];

        if (!is_array($this->dictionary)) {
            return;
        }

        // ===== Legacy format =====
        if (isset($this->dictionary['categorias']) && is_array($this->dictionary['categorias'])) {
            foreach ($this->dictionary['categorias'] as $category => $words) {
                if (!is_array($words)) continue;
                foreach ($words as $wordEntry) {
                    $this->processWordEntry($wordEntry);
                }
            }

            logMessage('[WordEngine] Tabla equivalencias (legacy) con ' . count($this->equivalenceTable) . ' entradas', 'DEBUG');
            return;
        }

        // ===== New format =====
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

                    foreach ($words as $wordEntry) {
                        $this->processWordEntry($wordEntry);
                    }
                }
            }
        }

        logMessage('[WordEngine] Tabla equivalencias (nuevo) con ' . count($this->equivalenceTable) . ' entradas', 'DEBUG');
    }

    private function processWordEntry($entry) {
        if (!is_string($entry) || empty(trim($entry))) {
            return;
        }

        $synonyms = array_map('trim', explode('|', $entry));
        $canonical = $this->normalizeWord($synonyms[0]);

        foreach ($synonyms as $synonym) {
            $normalized = $this->normalizeWord($synonym);
            $this->equivalenceTable[$normalized] = $canonical;

            $genderVariants = $this->applyGenderVariations($normalized);
            foreach ($genderVariants as $variant) {
                $this->equivalenceTable[$variant] = $canonical;
            }

            $numberVariants = $this->applyNumberVariations($normalized);
            foreach ($numberVariants as $variant) {
                $this->equivalenceTable[$variant] = $canonical;
            }

            foreach ($genderVariants as $genderVar) {
                $combinedVariants = $this->applyNumberVariations($genderVar);
                foreach ($combinedVariants as $combined) {
                    $this->equivalenceTable[$combined] = $canonical;
                }
            }
        }
    }

    private function normalizeWord($word) {
        if (!is_string($word)) {
            return '';
        }

        $word = trim($word);

        // Intento de normalizar diacríticos (ÁÉÍÓÚÑ -> AEIOUN) cuando sea posible.
        if (function_exists('iconv')) {
            $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $word);
            if ($converted !== false && is_string($converted) && $converted !== '') {
                $word = $converted;
            }
        }

        $word = strtoupper($word);
        $word = preg_replace('/\s+/', ' ', $word);

        return $word;
    }

    private function setupGenderRules() {
        $this->genderVariations = [
            ['pattern' => '/O$/', 'replacement' => 'A'],
            ['pattern' => '/ITO$/', 'replacement' => 'ITA'],
            ['pattern' => '/UCO$/', 'replacement' => 'UCA'],
            ['pattern' => '/INE$/', 'replacement' => 'INA'],
            ['pattern' => '/EY$/', 'replacement' => 'EINA'],
            ['pattern' => '/OZ$/', 'replacement' => 'OZA'],
        ];
    }

    private function setupNumberRules() {
        $this->numberVariations = [
            ['pattern' => '/(A|O|E)$/', 'replacement' => '$1S'],
            ['pattern' => '/Z$/', 'replacement' => 'CES'],
            ['pattern' => '/(D|L|N|R|T|J)$/', 'replacement' => '$1ES'],
        ];
    }

    private function applyGenderVariations($word) {
        $variants = [];

        foreach ($this->genderVariations as $rule) {
            if (preg_match($rule['pattern'], $word)) {
                $variant = preg_replace($rule['pattern'], $rule['replacement'], $word);
                if ($variant !== $word && !in_array($variant, $variants, true)) {
                    $variants[] = $variant;
                }
            }
        }

        return $variants;
    }

    private function applyNumberVariations($word) {
        $variants = [];

        if (substr($word, -1) === 'S' && strlen($word) > 1) {
            $singular = substr($word, 0, -1);
            if ($singular !== $word && !in_array($singular, $variants, true)) {
                $variants[] = $singular;
            }
        }

        foreach ($this->numberVariations as $rule) {
            if (preg_match($rule['pattern'], $word)) {
                $variant = preg_replace($rule['pattern'], $rule['replacement'], $word);
                if ($variant !== $word && !in_array($variant, $variants, true)) {
                    $variants[] = $variant;
                }
            }
        }

        return $variants;
    }

    public function getCanonicalWord($playerWord) {
        $normalized = $this->normalizeWord($playerWord);

        if (isset($this->equivalenceTable[$normalized])) {
            return $this->equivalenceTable[$normalized];
        }

        return null;
    }

    public function areEquivalent($word1, $word2) {
        $canonical1 = $this->getCanonicalWord($word1);
        $canonical2 = $this->getCanonicalWord($word2);

        return $canonical1 !== null && $canonical1 === $canonical2;
    }

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

    public function getEquivalenceTable() {
        return $this->equivalenceTable;
    }

    public function getDictionary() {
        return $this->dictionary;
    }
}

function compareWords($playerWord, $otherPlayerWord) {
    $engine = WordEquivalenceEngine::getInstance();
    return $engine->areEquivalent($playerWord, $otherPlayerWord);
}

function getCanonicalWord($word) {
    $engine = WordEquivalenceEngine::getInstance();
    $canonical = $engine->getCanonicalWord($word);

    if ($canonical === null) {
        return strtoupper(trim($word));
    }

    return $canonical;
}

logMessage('[✅] word-comparison-engine.php cargado - Motor inteligente de comparación de palabras', 'DEBUG');
?>
