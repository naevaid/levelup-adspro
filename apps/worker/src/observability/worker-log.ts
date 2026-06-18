export type WorkerLogLevel = 'log' | 'warn' | 'error';

type WorkerLogPayload = {
  event: string;
  app_env?: string;
  queue_name?: string;
  job_id?: string | null;
  job_name?: string | null;
  [key: string]: unknown;
};

export function writeWorkerLog(
  level: WorkerLogLevel,
  payload: WorkerLogPayload,
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'worker',
    ...payload,
  };
  const serialized = JSON.stringify(entry);

  if (level === 'error') {
    console.error(serialized);
    return;
  }

  if (level === 'warn') {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}
