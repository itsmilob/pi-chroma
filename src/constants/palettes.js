export const COLOR_PALETTES = [
  {
    id: 'spectral',
    name: 'Spectral Rainbow',
    description: 'Vibrant, distinct spectrum across all 10 digits',
    colors: [
      '#EF4444', // 0 - Red
      '#F97316', // 1 - Orange
      '#FBBF24', // 2 - Amber
      '#84CC16', // 3 - Lime
      '#10B981', // 4 - Emerald
      '#06B6D4', // 5 - Cyan
      '#3B82F6', // 6 - Blue
      '#6366F1', // 7 - Indigo
      '#8B5CF6', // 8 - Violet
      '#EC4899', // 9 - Pink
    ],
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Electric glowing neon hues for a futuristic vibe',
    colors: [
      '#FF0055', // 0
      '#FF5400', // 1
      '#FFBD00', // 2
      '#00F5D4', // 3
      '#00BBF9', // 4
      '#7B2CBF', // 5
      '#F72585', // 6
      '#4CC9F0', // 7
      '#7209B7', // 8
      '#3F37C9', // 9
    ],
  },
  {
    id: 'sunset',
    name: 'Solar Sunset',
    description: 'Warm fiery gradient from deep crimson to sun gold',
    colors: [
      '#370617', // 0
      '#6A040F', // 1
      '#9D0208', // 2
      '#D00000', // 3
      '#DC2F02', // 4
      '#E85D04', // 5
      '#F48C06', // 6
      '#FAA307', // 7
      '#FFBA08', // 8
      '#FFE49E', // 9
    ],
  },
  {
    id: 'ocean',
    name: 'Ocean Abyssal',
    description: 'Graduating from midnight navy to glacial ice blue',
    colors: [
      '#03045E', // 0
      '#023E8A', // 1
      '#0077B6', // 2
      '#0096C7', // 3
      '#00B4D8', // 4
      '#48CAE4', // 5
      '#90E0EF', // 6
      '#ADE8F4', // 7
      '#CAF0F8', // 8
      '#E0FBFC', // 9
    ],
  },
  {
    id: 'thermal',
    name: 'Thermal Magma',
    description: 'Inferno / blackbody scientific visualization palette',
    colors: [
      '#0D0887', // 0
      '#46039F', // 1
      '#7201A8', // 2
      '#9C179E', // 3
      '#BD3786', // 4
      '#D8576B', // 5
      '#ED7953', // 6
      '#FA9E3B', // 7
      '#FDC926', // 8
      '#F0F921', // 9
    ],
  },
  {
    id: 'matrix',
    name: 'Retro Terminal',
    description: 'Digital phosphor green shades straight out of 1984',
    colors: [
      '#052E16', // 0
      '#064E3B', // 1
      '#065F46', // 2
      '#047857', // 3
      '#059669', // 4
      '#10B981', // 5
      '#34D399', // 6
      '#6EE7B7', // 7
      '#A7F3D0', // 8
      '#ECFDF5', // 9
    ],
  },
  {
    id: 'pastels',
    name: 'Pastel Dream',
    description: 'Soft soothing macaron tones',
    colors: [
      '#FFB3BA', // 0
      '#FFDFBA', // 1
      '#FFFFBA', // 2
      '#BAFFC9', // 3
      '#BAE1FF', // 4
      '#D7BAFF', // 5
      '#FFBAF1', // 6
      '#FFC6FF', // 7
      '#BDB2FF', // 8
      '#A0C4FF', // 9
    ],
  },
  {
    id: 'forest',
    name: 'Deep Forest',
    description: 'Earthy botanical moss, foliage and bark tones',
    colors: [
      '#1B4332', // 0
      '#2D6A4F', // 1
      '#40916C', // 2
      '#52B788', // 3
      '#74C69D', // 4
      '#95D5B2', // 5
      '#B7E4C7', // 6
      '#D8F3DC', // 7
      '#8A7968', // 8
      '#584B3D', // 9
    ],
  },
  {
    id: 'monochrome',
    name: 'Monochrome Grayscale',
    description: 'Clean luminosity ramp from deep charcoal to pure white',
    colors: [
      '#18181B', // 0
      '#27272A', // 1
      '#3F3F46', // 2
      '#52525B', // 3
      '#71717A', // 4
      '#A1A1AA', // 5
      '#D4D4D8', // 6
      '#E4E4E7', // 7
      '#F4F4F5', // 8
      '#FFFFFF', // 9
    ],
  },
];

// Famous patterns in Pi for instant discovery
export const FAMOUS_PATTERNS = [
  {
    label: 'Feynman Point',
    pattern: '999999',
    description: 'Six consecutive 9s at decimal position 762 (Feynman joked he wanted to memorize Pi up to here and say "and so on...")',
    tag: 'Famous',
  },
  {
    label: 'Initial Pi',
    pattern: '14159265',
    description: 'The iconic start of decimals right after 3.',
    tag: 'Classic',
  },
  {
    label: 'Counting Up',
    pattern: '123456',
    description: 'Sequential digits 1 through 6',
    tag: 'Sequence',
  },
  {
    label: 'Counting Down',
    pattern: '654321',
    description: 'Descending sequence',
    tag: 'Sequence',
  },
  {
    label: 'Triple Lucky',
    pattern: '777',
    description: 'Triple sevens occurrence',
    tag: 'Repeats',
  },
  {
    label: 'Quad Zeros',
    pattern: '0000',
    description: 'Four consecutive zeros',
    tag: 'Repeats',
  },
  {
    label: 'Golden Ratio (approx)',
    pattern: '161803',
    description: 'The golden ratio Phi (φ = 1.61803...) hidden within Pi',
    tag: 'Math',
  },
  {
    label: 'Euler’s Number e',
    pattern: '271828',
    description: 'The base of the natural logarithm hidden within Pi',
    tag: 'Math',
  },
  {
    label: 'Symmetric Palindrome',
    pattern: '8228',
    description: 'Mirror palindrome in the stream',
    tag: 'Symmetry',
  },
  {
    label: 'The Answer',
    pattern: '4242',
    description: 'The ultimate answer to life, universe, and everything',
    tag: 'Fun',
  },
];
