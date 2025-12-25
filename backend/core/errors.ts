export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class NameConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NameConflictError';
    }
}

export class InvalidMoveError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidMoveError';
    }
}

export class ForbiddenOperationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ForbiddenOperationError';
    }
}
