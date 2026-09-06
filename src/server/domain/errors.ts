export type DomainErrorCode =
  | "conflict"
  | "forbidden"
  | "invalid"
  | "not_found";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly fields: Array<{ field: string; message: string }> | undefined;

  constructor(
    code: DomainErrorCode,
    message: string,
    fields?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.fields = fields;
  }
}
