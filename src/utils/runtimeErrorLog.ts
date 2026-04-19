const STORAGE_KEY = 'geofield_runtime_error_log';
const MAX_LOGS = 50;

export interface RuntimeErrorLogEntry {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

const safeParseLogs = (): RuntimeErrorLogEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as RuntimeErrorLogEntry[] : [];
  } catch {
    return [];
  }
};

const persistLogs = (logs: RuntimeErrorLogEntry[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)));
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || 'Unknown error',
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  return { message: 'Unknown runtime error' };
};

export const recordRuntimeError = (
  source: string,
  error: unknown,
  metadata?: Record<string, unknown>
) => {
  try {
    const logs = safeParseLogs();
    const normalized = normalizeError(error);
    logs.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      source,
      message: normalized.message,
      stack: normalized.stack,
      metadata,
    });
    persistLogs(logs);
  } catch {
  }
};

export const listRuntimeErrors = (): RuntimeErrorLogEntry[] => safeParseLogs();

export const clearRuntimeErrors = () => {
  localStorage.removeItem(STORAGE_KEY);
};
