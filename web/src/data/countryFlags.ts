/**
 * Comprehensive country flags and metadata for all 224 Brasfoot countries.
 * Ensures authentic emoji flags across all UI screens (MainMenu, TeamEditor, etc.).
 */

export const COUNTRY_FLAGS: Record<number, string> = {
  0: '🇦🇫', // Afeganistão
  1: '🇿🇦', // África do Sul
  2: '🇦🇱', // Albânia
  3: '🇩🇪', // Alemanha
  4: '🇦🇩', // Andorra
  5: '🇦🇴', // Angola
  6: '🇦🇮', // Anguilla
  7: '🇦🇬', // Antígua e Barbuda
  8: '🇨🇼', // Curaçao
  9: '🇸🇦', // Arábia Saudita
  10: '🇩🇿', // Argélia
  11: '🇦🇷', // Argentina
  12: '🇦🇲', // Armênia
  13: '🇦🇼', // Aruba
  14: '🇦🇺', // Austrália
  15: '🇦🇹', // Áustria
  16: '🇦🇿', // Azerbaijão
  17: '🇧🇸', // Bahamas
  18: '🇧🇭', // Bahrein
  19: '🇧🇩', // Bangladesh
  20: '🇧🇧', // Barbados
  21: '🇧🇪', // Bélgica
  22: '🇧🇿', // Belize
  23: '🇧🇯', // Benin
  24: '🇧🇲', // Bermudas
  25: '🇧🇾', // Belarus
  26: '🇧🇴', // Bolívia
  27: '🇧🇦', // Bósnia
  28: '🇧🇼', // Botsuana
  29: '🇧🇷', // Brasil
  30: '🇧🇳', // Brunei
  31: '🇧🇬', // Bulgária
  32: '🇧🇫', // Burkina Faso
  33: '🇧🇮', // Burundi
  34: '🇧🇹', // Butão
  35: '🇨🇻', // Cabo Verde
  36: '🇨🇲', // Camarões
  37: '🇰🇭', // Camboja
  38: '🇨🇦', // Canadá
  39: '🇶🇦', // Catar
  40: '🇰🇿', // Cazaquistão
  41: '🇹🇩', // Chade
  42: '🇨🇱', // Chile
  43: '🇨🇳', // China
  44: '🇨🇾', // Chipre
  45: '🇹🇱', // Timor-Leste
  46: '🇨🇴', // Colômbia
  47: '🇨🇬', // Congo
  48: '🇰🇵', // Coreia do Norte
  49: '🇰🇷', // Coreia do Sul
  50: '🇨🇮', // Costa do Marfim
  51: '🇨🇷', // Costa Rica
  52: '🇭🇷', // Croácia
  53: '🇨🇺', // Cuba
  54: '🇩🇰', // Dinamarca
  55: '🇩🇯', // Djibuti
  56: '🇩🇲', // Dominica
  57: '🇪🇬', // Egito
  58: '🇸🇻', // El Salvador
  59: '🇦🇪', // Emirados Árabes
  60: '🇪🇨', // Equador
  61: '🇪🇷', // Eritreia
  62: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', // Escócia
  63: '🇸🇰', // Eslováquia
  64: '🇸🇮', // Eslovênia
  65: '🇪🇸', // Espanha
  66: '🇪🇪', // Estônia
  67: '🇪🇹', // Etiópia
  68: '🇺🇸', // Estados Unidos / EUA
  69: '🇫🇯', // Fiji
  70: '🇫🇮', // Finlândia
  71: '🇵🇭', // Filipinas
  72: '🇫🇷', // França
  73: '🇬🇦', // Gabão
  74: '🇬🇲', // Gâmbia
  75: '🇬🇭', // Gana
  76: '🇬🇪', // Geórgia
  77: '🇬🇩', // Granada
  78: '🇬🇷', // Grécia
  79: '🇬🇹', // Guatemala
  80: '🇬🇾', // Guiana
  81: '🇬🇳', // Guiné
  82: '🇬🇼', // Guiné-Bissau
  83: '🇬🇶', // Guiné Equatorial
  84: '🇭🇹', // Haiti
  85: '🇳🇱', // Holanda
  86: '🇭🇳', // Honduras
  87: '🇭🇰', // Hong Kong
  88: '🇭🇺', // Hungria
  89: '🇾🇪', // Iêmen
  90: '🇰🇾', // Ilhas Cayman
  91: '🇨🇰', // Ilhas Cook
  92: '🇫🇴', // Ilhas Faroé
  93: '🇸🇧', // Ilhas Salomão
  94: '🇻🇬', // Ilhas Virgens Britânicas
  95: '🇮🇳', // Índia
  96: '🇮🇩', // Indonésia
  97: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', // Inglaterra
  98: '🇮🇷', // Irã
  99: '🇮🇶', // Iraque
  100: '🇮🇪', // Irlanda
  101: '🇬🇧', // Irlanda do Norte
  102: '🇮🇸', // Islândia
  103: '🇮🇱', // Israel
  104: '🇮🇹', // Itália
  105: '🇲🇪', // Montenegro
  106: '🇯🇲', // Jamaica
  107: '🇯🇵', // Japão
  108: '🇯🇴', // Jordânia
  109: '🇰🇪', // Quênia
  110: '🇽🇰', // Kosovo
  111: '🇰🇼', // Kuwait
  112: '🇱🇦', // Laos
  113: '🇱🇸', // Lesoto
  114: '🇱🇻', // Letônia
  115: '🇱🇧', // Líbano
  116: '🇱🇾', // Líbia
  117: '🇱🇷', // Libéria
  118: '🇱🇮', // Liechtenstein
  119: '🇱🇹', // Lituânia
  120: '🇱🇺', // Luxemburgo
  121: '🇲🇴', // Macau
  122: '🇲🇰', // Macedônia do Norte
  123: '🇲🇬', // Madagascar
  124: '🇲🇾', // Malásia
  125: '🇲🇼', // Malawi
  126: '🇲🇻', // Maldivas
  127: '🇲🇱', // Mali
  128: '🇲🇹', // Malta
  129: '🇲🇦', // Marrocos
  130: '🇲🇷', // Mauritânia
  131: '🇲🇽', // México
  132: '🇲🇲', // Mianmar
  133: '🇲🇿', // Moçambique
  134: '🇲🇩', // Moldávia
  135: '🇲🇨', // Mônaco
  136: '🇲🇳', // Mongólia
  137: '🇳🇦', // Namíbia
  138: '🇳🇵', // Nepal
  139: '🇳🇮', // Nicarágua
  140: '🇳🇪', // Níger
  141: '🇳🇬', // Nigéria
  142: '🇳🇴', // Noruega
  143: '🇳🇿', // Nova Zelândia
  144: '🇴🇲', // Omã
  145: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', // País de Gales
  146: '🇵🇸', // Palestina
  147: '🇵🇦', // Panamá
  148: '🇵🇬', // Papua Nova Guiné
  149: '🇵🇰', // Paquistão
  150: '🇵🇾', // Paraguai
  151: '🇵🇪', // Peru
  152: '🇵🇱', // Polônia
  153: '🇵🇷', // Porto Rico
  154: '🇵🇹', // Portugal
  155: '🇰🇬', // Quirguistão
  156: '🇨🇫', // Rep. Centro-Africana
  157: '🇨🇩', // Rep. Dem. Congo
  158: '🇩🇴', // Rep. Dominicana
  159: '🇨🇿', // República Tcheca
  160: '🇷🇴', // Romênia
  161: '🇷🇼', // Ruanda
  162: '🇷🇺', // Rússia
  163: '🇼🇸', // Samoa
  164: '🇸🇲', // San Marino
  165: '🇱🇨', // Santa Lúcia
  166: '🇰🇳', // São Cristóvão e Neves
  167: '🇸🇹', // São Tomé e Príncipe
  168: '🇻🇨', // São Vicente e Granadinas
  169: '🇸🇳', // Senegal
  170: '🇸🇱', // Serra Leoa
  171: '🇷🇸', // Sérvia
  172: '🇸🇨', // Seychelles
  173: '🇸🇬', // Singapura
  174: '🇸🇾', // Síria
  175: '🇸🇴', // Somália
  176: '🇱🇰', // Sri Lanka
  177: '🇸🇿', // Essuatíni
  178: '🇸🇩', // Sudão
  179: '🇸🇪', // Suécia
  180: '🇨🇭', // Suíça
  181: '🇸🇷', // Suriname
  182: '🇹🇯', // Tadjiquistão
  183: '🇹🇭', // Tailândia
  184: '🇵🇫', // Taiti
  185: '🇹🇼', // Taipé Chinês
  186: '🇹🇿', // Tanzânia
  187: '🇹🇬', // Togo
  188: '🇹🇴', // Tonga
  189: '🇹🇹', // Trinidad e Tobago
  190: '🇹🇳', // Tunísia
  191: '🇹🇲', // Turcomenistão
  192: '🇹🇷', // Turquia
  193: '🇺🇦', // Ucrânia
  194: '🇺🇬', // Uganda
  195: '🇺🇾', // Uruguai
  196: '🇺🇿', // Uzbequistão
  197: '🇻🇺', // Vanuatu
  198: '🇻🇪', // Venezuela
  199: '🇻🇳', // Vietnã
  200: '🇿🇲', // Zâmbia
  201: '🇿🇼', // Zimbábue
  202: '🇰🇲', // Comores
  203: '🇫🇲', // Micronésia
  204: '🇲🇭', // Ilhas Marshall
  205: '🇲🇺', // Maurícia
  206: '🇳🇷', // Nauru
  207: '🇵🇼', // Palau
  208: '🇰🇮', // Kiribati
  209: '🇸🇸', // Sudão do Sul
  210: '🇹🇻', // Tuvalu
  211: '🇻🇮', // Ilhas Virgens Americanas
  212: '🇲🇸', // Montserrat
  213: '🇹🇨', // Ilhas Turks e Caicos
  214: '🇦🇸', // Samoa Americana
  215: '🇳🇨', // Nova Caledônia
  216: '🇬🇮', // Gibraltar
  217: '🇬🇵', // Guadalupe
  218: '🇬🇺', // Guam
  219: '🇲🇶', // Martinica
  220: '🇬🇫', // Guiana Francesa
  221: '🇧🇶', // Bonaire
  222: '🇲🇫', // São Martinho Francês
  223: '🇸🇽', // São Martinho Holandês
};

/**
 * Returns the authentic emoji flag for any Brasfoot country ID.
 * Defaults to '🌐' if countryId is unknown or undefined.
 */
export function getCountryFlag(countryId?: number | null): string {
  if (countryId == null) return '🌐';
  return COUNTRY_FLAGS[countryId] || '🌐';
}

/**
 * Curated list of popular quick-selection countries.
 */
export const POPULAR_COUNTRIES = [
  { id: 29, name: 'Brasil', flag: '🇧🇷' },
  { id: 154, name: 'Portugal', flag: '🇵🇹' },
  { id: 65, name: 'Espanha', flag: '🇪🇸' },
  { id: 97, name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 11, name: 'Argentina', flag: '🇦🇷' },
  { id: 104, name: 'Itália', flag: '🇮🇹' },
  { id: 3, name: 'Alemanha', flag: '🇩🇪' },
  { id: 72, name: 'França', flag: '🇫🇷' },
  { id: 85, name: 'Holanda', flag: '🇳🇱' },
  { id: 131, name: 'México', flag: '🇲🇽' },
  { id: 68, name: 'Estados Unidos', flag: '🇺🇸' },
  { id: 195, name: 'Uruguai', flag: '🇺🇾' },
];
