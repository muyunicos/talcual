<?php
declare(strict_types=1);

/**
 * @file word-comparison-engine.php
 * @description Motor V4: Soporte avanzado de Diminutivos, Plurals y Diccionario Inteligente.
 */

class WordEquivalenceEngine {
    private static ?self $instance = null;
    private array $dictionaryMap = [];
    
    private const DICTIONARY_FILE = __DIR__ . '/diccionario.json';

    public static function getInstance(): self {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->loadDictionary();
    }

    private function loadDictionary(): void {
        if (!file_exists(self::DICTIONARY_FILE)) return;

        $json = file_get_contents(self::DICTIONARY_FILE);
        $data = json_decode($json, true);

        if (!$data) return;

        $iterator = new RecursiveIteratorIterator(
            new RecursiveArrayIterator($data),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $value) {
            if (is_string($value) && !empty($value)) {
                $parts = explode('|', $value);
                $canonical = $this->normalize($parts[0]);
                
                foreach ($parts as $word) {
                    $norm = $this->normalize($word);
                    $this->dictionaryMap[$norm] = $canonical;
                }
            }
        }
    }

    private function normalize(string $word): string {
        $word = mb_strtoupper($word, 'UTF-8');
        $replacements = ['Á'=>'A', 'É'=>'E', 'Í'=>'I', 'Ó'=>'O', 'Ú'=>'U', 'Ü'=>'U', 'Ñ'=>'N'];
        $word = strtr($word, $replacements);
        return preg_replace('/[^A-Z0-9]/', '', $word);
    }

    /**
     * Devuelve el ID del diccionario.
     * MEJORA: Si la palabra exacta no está, prueba buscándola en SINGULAR.
     * Esto arregla: Input "Bebitos" -> Busca "Bebitos" (No) -> Busca "Bebito" (SÍ -> "BEBE")
     */
    private function getDictionaryId(string $word): ?string {
        // 1. Búsqueda exacta
        if (isset($this->dictionaryMap[$word])) {
            return $this->dictionaryMap[$word];
        }

        // 2. Búsqueda en singular (si termina en S)
        if (substr($word, -1) === 'S') {
            $singular = substr($word, 0, -1);
            // Manejo especial de -ES (Camiones -> Camion)
            if (substr($word, -2) === 'ES') {
                 $singularEs = substr($word, 0, -2);
                 if (isset($this->dictionaryMap[$singularEs])) return $this->dictionaryMap[$singularEs];
            }
            // Manejo de plural simple
            if (isset($this->dictionaryMap[$singular])) {
                return $this->dictionaryMap[$singular];
            }
        }

        return null;
    }

    /**
     * Obtiene la raíz gramatical agresiva + DIMINUTIVOS.
     */
    private function getStem(string $word): string {
        $stem = $word;

        // 1. Limpieza de Plurales
        if (substr($stem, -3) === 'CES') {
            $stem = substr($stem, 0, -3) . 'Z';
        } elseif (substr($stem, -1) === 'S' && strlen($stem) > 3) {
            $stem = substr($stem, 0, -1);
        }

        // 2. Limpieza de DIMINUTIVOS (Nueva lógica clave)
        // Convierte: BEBITO -> BEB, GATITO -> GAT, PANCITO -> PAN
        // Orden: Primero CITO/CITA (más largos), luego ITO/ITA
        $stem = preg_replace('/(C)?IT[AO]$/', '', $stem);

        // 3. Limpieza de Vocal Final (A, O, E)
        if (strlen($stem) > 2) { 
            $lastChar = substr($stem, -1);
            if ($lastChar === 'A' || $lastChar === 'O' || $lastChar === 'E') {
                $stem = substr($stem, 0, -1);
            }
        }

        return $stem;
    }

    public function areEquivalent(string $word1, string $word2): bool {
        $n1 = $this->normalize($word1);
        $n2 = $this->normalize($word2);

        if ($n1 === $n2) return true;

        // --- ESTRATEGIA 1: DICCIONARIO INTELIGENTE ---
        $id1 = $this->getDictionaryId($n1);
        $id2 = $this->getDictionaryId($n2);

        // A. Ambos están en el diccionario y apuntan a lo mismo
        if ($id1 !== null && $id2 !== null && $id1 === $id2) {
            return true;
        }

        // B. Cruce Diccionario vs Raíz (El caso Beba vs Bebitos)
        // word1 (Beba) -> No en dict -> Raíz "BEB"
        // word2 (Bebitos) -> En dict (vía Bebito) -> ID "BEBE"
        // Comparamos Raíz(word1) vs Raíz(ID_word2)
        $root1 = $this->getStem($n1);
        $root2 = $this->getStem($n2);

        if ($id1 !== null) {
            $dictRoot = $this->getStem($id1); 
            if ($dictRoot === $root2) return true;
        }
        if ($id2 !== null) {
            $dictRoot = $this->getStem($id2); // Raíz de "BEBE" es "BEB"
            if ($dictRoot === $root1) return true; // "BEB" == "BEB" -> MATCH!
        }

        // --- ESTRATEGIA 2: MORFOLOGÍA PURA ---
        // Si nada está en el diccionario, comparamos raíces peladas
        // Ej: Perritos vs Perras (ambos dan raíz PERR)
        if ($root1 === $root2 && strlen($root1) > 2) {
            return true;
        }

        return false;
    }

    public function getDebugInfo(string $word): array {
        $norm = $this->normalize($word);
        $id = $this->getDictionaryId($norm);
        $stem = $this->getStem($norm);
        
        return [
            'original' => $word,
            'normalized' => $norm,
            'dictionary_id' => $id,
            'final_stem' => $stem,
            // Info extra para entender por qué match
            'id_stem' => $id ? $this->getStem($id) : null 
        ];
    }
    
    public function getDictionary(): array {
        return $this->dictionaryMap;
    }
}

function compareWords(string $w1, string $w2): bool {
    return WordEquivalenceEngine::getInstance()->areEquivalent($w1, $w2);
}

function getCanonicalWord(string $w) {
    $info = WordEquivalenceEngine::getInstance()->getDebugInfo($w);
    $out = $info['normalized'];
    if ($info['dictionary_id']) $out .= " [Dict: {$info['dictionary_id']}]";
    $out .= " (Raíz: " . $info['final_stem'] . ")";
    return $out;
}
?>