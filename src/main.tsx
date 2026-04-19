import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initDatabase, resetDatabase } from './db/db';
import { refRepo } from './repositories/refRepo';
import { checkMediaStoreHealthy } from './media/mediaStore';
import { shouldAutoBackup, saveAutoBackupZip } from './utils/autoBackup';
import { checkPersisted, requestPersist } from './utils/storageSafety';
import { isAutoBackupEnabled } from './state/userPreferences';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { recordRuntimeError } from './utils/runtimeErrorLog';

const installRuntimeErrorHandlers = () => {
  window.addEventListener('error', (event) => {
    recordRuntimeError('window.error', event.error ?? event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    recordRuntimeError('window.unhandledrejection', event.reason);
  });

  (window as any).geofieldScopedReset = async () => {
    try {
      await resetDatabase();
    } catch (error) {
      recordRuntimeError('window.resetDatabase', error);
      alert(`Failed to reset local app data: ${error}`);
    }
  };
};

async function start() {
  let lastCompletedStep = 'Started';
  
  const attemptCount = parseInt(localStorage.getItem('geofield_init_attempt_count') || '0', 10);
  localStorage.setItem('geofield_init_attempt_count', (attemptCount + 1).toString());

  const timeout = setTimeout(() => {
    const root = document.getElementById('root');
    if (root && root.innerHTML.includes('Loading GeoField AU...')) {
      let timeoutActionHtml = `
        <button 
          onclick="window.geofieldScopedReset()"
          class="rounded-xl bg-red-600 px-6 py-3 font-bold text-white shadow-lg shadow-red-100"
        >
          Reset Local DB & Reload
        </button>
      `;

      if (attemptCount > 2) {
        timeoutActionHtml = `
          <div class="flex flex-col gap-2 w-full max-w-xs">
            <p class="text-xs text-red-500 font-bold">Multiple failures detected. Safe mode enabled.</p>
            <button 
              onclick="window.geofieldScopedReset()"
              class="w-full rounded-xl bg-red-600 px-6 py-3 font-bold text-white shadow-lg shadow-red-100"
            >
              Hard Reset Local DB
            </button>
            <label class="w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-6 py-3 font-bold text-zinc-600 shadow-sm text-center">
              Import Backup
              <input type="file" accept=".zip" class="hidden" id="timeoutImportBackupInput" />
            </label>
          </div>
        `;
      }

      root.innerHTML = `
        <div class="flex h-screen flex-col items-center justify-center gap-6 p-10 text-center">
          <div class="flex flex-col gap-2">
            <h1 class="text-xl font-bold text-zinc-900">Initialization is taking longer than expected</h1>
            <p class="text-sm text-zinc-500">This might be due to a database corruption or network issue.</p>
            <p class="text-xs font-mono text-zinc-400 mt-2">Last completed step: ${lastCompletedStep}</p>
          </div>
          ${timeoutActionHtml}
        </div>
      `;

      if (attemptCount > 2) {
        const input = document.getElementById('timeoutImportBackupInput') as HTMLInputElement;
        if (input) {
          input.addEventListener('change', async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              try {
                const { importBackupZip } = await import('./utils/backupBundle');
                await importBackupZip(file);
              } catch (importErr) {
                alert('Failed to import backup: ' + importErr);
              }
            }
          });
        }
      }
    }
  }, 12000);

  try {
    console.log('App start: Initializing database...');
    await initDatabase();
    lastCompletedStep = 'Database initialized';
    
    console.log('App start: Preloading reference tables...');
    await refRepo.preloadRefTables();
    lastCompletedStep = 'Reference tables preloaded';
    
    clearTimeout(timeout);
    
    localStorage.setItem('geofield_init_attempt_count', '0');
    
    console.log('App start: Rendering React app...');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </StrictMode>,
    );

    setTimeout(async () => {
      console.log('[INIT] media async start');
      try {
        const healthy = await checkMediaStoreHealthy();
        if (healthy) {
          console.log('[INIT] media async success');
        } else {
          console.log('[INIT] media async fail (unhealthy)');
        }
      } catch (err) {
        console.error('[INIT] media async fail', err);
      }

      try {
        if (isAutoBackupEnabled() && await shouldAutoBackup()) {
           await saveAutoBackupZip();
        }
      } catch (err) {
        console.error('[INIT] auto-backup async fail', err);
      }

      try {
        await checkPersisted();
      } catch (err) {
        console.error('[INIT] storage check async fail', err);
      }
    }, 1000);

  } catch (err) {
    clearTimeout(timeout);
    console.error('Failed to initialize app:', err);
    recordRuntimeError('app.init', err, { lastCompletedStep });
    
    let actionHtml = `
      <button 
        onclick="window.geofieldScopedReset()"
        class="rounded-xl bg-zinc-900 px-6 py-3 font-bold text-white shadow-lg"
      >
        Reset Local DB & Retry
      </button>
    `;

    if (attemptCount > 2) {
      actionHtml = `
        <div class="flex flex-col gap-2 w-full max-w-xs">
          <p class="text-xs text-red-500 font-bold">Multiple failures detected. Safe mode enabled.</p>
          <button 
            onclick="window.geofieldScopedReset()"
            class="w-full rounded-xl bg-red-600 px-6 py-3 font-bold text-white shadow-lg shadow-red-100"
          >
            Hard Reset Local DB
          </button>
          <label class="w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-6 py-3 font-bold text-zinc-600 shadow-sm text-center">
            Import Backup
            <input type="file" accept=".zip" class="hidden" id="importBackupInput" />
          </label>
        </div>
      `;
    }

    document.getElementById('root')!.innerHTML = `
      <div class="flex h-screen flex-col items-center justify-center gap-6 p-10 text-center">
        <div class="flex flex-col gap-2">
          <h1 class="text-xl font-bold text-red-600">Failed to initialize app</h1>
          <p class="text-sm text-zinc-500">${err}</p>
          <p class="text-xs font-mono text-zinc-400 mt-2">Last completed step: ${lastCompletedStep}</p>
        </div>
        ${actionHtml}
      </div>
    `;

    if (attemptCount > 2) {
      const input = document.getElementById('importBackupInput') as HTMLInputElement;
      if (input) {
        input.addEventListener('change', async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            try {
              const { importBackupZip } = await import('./utils/backupBundle');
              await importBackupZip(file);
            } catch (importErr) {
              alert('Failed to import backup: ' + importErr);
            }
          }
        });
      }
    }
  }
}

installRuntimeErrorHandlers();
start();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[PWA] ServiceWorker registered:', reg.scope);
    }).catch((err) => {
      console.error('[PWA] ServiceWorker registration failed:', err);
    });
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  console.log('[PWA] beforeinstallprompt fired');
  e.preventDefault();
  (window as any).deferredPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-installable'));
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installed');
  (window as any).deferredPrompt = null;
});
