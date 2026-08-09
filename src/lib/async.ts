export class OperationTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OperationTimeoutError';
  }
}

export function withTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs = 10_000,
  message = 'Permintaan membutuhkan waktu terlalu lama.',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new OperationTimeoutError(message));
    }, timeoutMs);

    Promise.resolve(operation).then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }

  return fallback;
}
