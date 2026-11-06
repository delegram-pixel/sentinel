export type DomainFailure = {
  ok: false;
  code: string;
  message: string;
};

export type DomainResult<T> = { ok: true; value: T } | DomainFailure;

export function failure(code: string, message: string): DomainFailure {
  return { ok: false, code, message };
}
