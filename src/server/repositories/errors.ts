export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryError";
  }
}

export class NotFoundError extends RepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class InvalidRepositoryInputError extends RepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRepositoryInputError";
  }
}

export class DatabaseRowError extends RepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseRowError";
  }
}
