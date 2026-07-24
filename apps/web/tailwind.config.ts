import tradexPreset from '@tradex/config/tailwind';
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  presets: [tradexPreset],
  content: ['./src/**/*.{ts,tsx}'],
} satisfies Config;
