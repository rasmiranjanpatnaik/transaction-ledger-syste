import { ValidationError } from './errors.js';

/**
 * Converts a decimal dollar/currency amount to integer cents.
 * Ensures the amount is positive, finite, and does not exceed 2 decimal places.
 */
export function toCents(amount: number): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new ValidationError('Amount must be a valid finite number');
  }

  if (amount <= 0) {
    throw new ValidationError('Amount must be greater than 0');
  }

  // Check decimal places (financial amounts must not exceed 2 decimal places)
  const rounded = Math.round(amount * 100);
  const diff = Math.abs(amount * 100 - rounded);
  if (diff > 1e-6) {
    throw new ValidationError('Amount cannot have more than 2 decimal places');
  }

  return rounded;
}

/**
 * Converts integer cents back to decimal currency amount.
 */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}
