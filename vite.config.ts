import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
              if (id.includes('lucide-react') || id.includes('motion')) return 'vendor-ui';
              if (id.includes('sql.js')) return 'vendor-sql';
              return undefined;
            }
            if (id.includes('/src/engineering/') || id.includes('/src/utils/stereonet') || id.includes('/src/utils/stereonetRocscience')) return 'engineering';
            if (id.includes('/src/screens/QuickLog') || id.includes('/src/screens/Mapping') || id.includes('/src/screens/InvestigationLog') || id.includes('/src/screens/SlopeAssessment')) return 'field-logging';
            if (id.includes('/src/screens/StructuralAssessment') || id.includes('/src/screens/WedgeFoSView') || id.includes('/src/screens/StereonetView')) return 'rock-engineering';
            if (id.includes('/src/screens/BearingCapacity') || id.includes('/src/screens/EarthPressure') || id.includes('/src/screens/SettlementScreening') || id.includes('/src/screens/RetainingWallCheck') || id.includes('/src/screens/SoilSlopeStability')) return 'soil-engineering';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
