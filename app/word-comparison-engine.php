<?php
declare(strict_types=1);

/**
 * @file word-comparison-engine.php
 * @description Motor V3: Soporte de espacios, sinónimos y morfología independiente.
 */

class WordEquivalenceEngine {
    private static ?self $instance = null;
    private array $dictionaryMap = []; // Mapa plano: Palabra -> ID Canónico
    
    // Configuración
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

    /**
     * Carga el diccionario SOLO para sinónimos.
     * Ya no generamos plurales aquí para no inflar la memoria,
     * los plurales se calculan en vivo si no hay coincidencia.
     */
    private function loadDictionary(): void {
        if (!file_exists(self::DICTIONARY_FILE)) {
            return;
        }

        $json = file_get_contents(self::DICTIONARY_FILE);
        $data = json_decode($json, true);

        if (!$data) return;

        // Aplanamos el JSON recursivamente
        $iterator = new RecursiveIteratorIterator(
            new RecursiveArrayIterator($data),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $value) {
            if (is_string($value) && !empty($value)) {
                $parts = explode('|', $value);
                $canonical = $this->normalize($parts[0]); // El primero es el ID
                
                foreach ($parts as $word) {
                    $norm = $this->normalize($word);
                    $this->dictionaryMap[$norm] = $canonical;
                }
            }
        }
    }

    /**
     * NORMALIZACIÓN AGRESIVA (Arregla lo de "dulce de leche")
     * 1. Mayúsculas
     * 2. Quita tildes
     * 3. ELIMINA espacios y símbolos (deja solo letras y números)
     */
    private function normalize(string $word): string {
        // 1. Mayúsculas
        $word = mb_strtoupper($word, 'UTF-8');

        // 2. Reemplazo manual de tildes (Seguro y sin librerías raras)
        $replacements = [
            'Á'=>'A', 'É'=>'E', 'Í'=>'I', 'Ó'=>'O', 'Ú'=>'U', 'Ü'=>'U', 'Ñ'=>'N'
        ];
        $word = strtr($word, $replacements);

        // 3. Dejar SOLO letras y números (Quita espacios, guiones, puntos)
        // dulcedeleche y dulce de leche quedan como DULCEDELECHE
        return preg_replace('/[^A-Z0-9]/', '', $word);
    }

    /**
     * Obtiene la "raíz" de una palabra para comparar Tonto vs Tontas
     * sin necesidad de diccionario.
     */
    private function getStem(string $word): string {
        $stem = $word;

        // 1. Quitar sufijos de plural (S, ES)
        if (substr($stem, -2) === 'ES') {
            // Caso especial: Luces -> Luz
            if (substr($stem, -3) === 'CES') {
                $stem = substr($stem, 0, -3) . 'Z';
            } else {
                $stem = substr($stem, 0, -2);
            }
        } elseif (substr($stem, -1) === 'S') {
            // Evitar quitar S a palabras que terminan en S natural (BUS, GAS)
            // Regla simple: solo si la palabra es larga
            if (strlen($stem) > 3) {
                $stem = substr($stem, 0, -1);
            }
        }

        // 2. Quitar sufijos de género (A, O)
        // Convertimos Tonta -> Tont, Tonto -> Tont
        if (substr($stem, -1) === 'A' || substr($stem, -1) === 'O') {
             $stem = substr($stem, 0, -1);
        }

        return $stem;
    }

    /**
     * FUNCIÓN PRINCIPAL DE COMPARACIÓN
     */
    public function areEquivalent(string $word1, string $word2): bool {
        // Paso 1: Normalización total (quita espacios y acentos)
        $n1 = $this->normalize($word1);
        $n2 = $this->normalize($word2);

        // Si son idénticos tras limpiar (dulce de leche == dulcedeleche) -> TRUE
        if ($n1 === $n2) return true;

        // Paso 2: Verificar Diccionario (Sinónimos explícitos)
        // Si Perro y Can están definidos como sinónimos
        $id1 = $this->dictionaryMap[$n1] ?? null;
        $id2 = $this->dictionaryMap[$n2] ?? null;

        if ($id1 !== null && $id2 !== null && $id1 === $id2) {
            return true;
        }

        // Si una está en el diccionario y la otra no, miramos si la segunda es variante de la primera
        // Ejemplo: Diccionario tiene "PERRO". Usuario mete "PERRITAS".
        // La "raíz" de PERRITAS es PERRIT. La raíz de PERRO es PERR. (No coincide directo)
        // Pero si el usuario mete "PERROS", raíz PERR == PERR. -> OK.
        
        // Paso 3: Comparación Morfológica (Sin diccionario)
        // Aplica para: Tonto == Tontas, Rojo == Rojas
        $root1 = $this->getStem($n1);
        $root2 = $this->getStem($n2);

        if ($root1 === $root2 && strlen($root1) > 2) { // >2 para evitar falsos positivos cortos
            return true;
        }

        // Paso 4: Cruce Híbrido (Raíz vs Diccionario)
        // Si ingresan "Perras" (Raiz: PERR) y en diccionario está "Perro" (Raiz: PERR)
        // Esto permite que el diccionario funcione aunque no definas los plurales en el JSON
        if ($id1 !== null) {
            // Word1 es de diccionario, ¿Word2 tiene su misma raíz?
            $dictRoot = $this->getStem($id1); 
            if ($dictRoot === $root2) return true;
        }
        if ($id2 !== null) {
            $dictRoot = $this->getStem($id2);
            if ($dictRoot === $root1) return true;
        }

        return false;
    }

    // Helpers para debug
    public function getDebugInfo(string $word): array {
        $norm = $this->normalize($word);
        return [
            'original' => $word,
            'normalized' => $norm,
            'dictionary_id' => $this->dictionaryMap[$norm] ?? 'NO ENCONTRADO',
            'stem_root' => $this->getStem($norm)
        ];
    }
    
    public function getDictionary(): array {
        return $this->dictionaryMap;
    }
}

// Funciones globales
function compareWords(string $w1, string $w2): bool {
    return WordEquivalenceEngine::getInstance()->areEquivalent($w1, $w2);
}

// Actualizamos el helper de debug para usar la nueva info
function getCanonicalWord(string $w) {
    // Para mantener compatibilidad con tu test.php, devolvemos un string descriptivo
    $info = WordEquivalenceEngine::getInstance()->getDebugInfo($w);
    return $info['normalized'] . " (Raíz: " . $info['stem_root'] . ")";
}
?>