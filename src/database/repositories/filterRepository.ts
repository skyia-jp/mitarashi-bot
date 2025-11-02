// Filter repository intentionally removed. Keep a typescript stub so imports resolve during migration.
export function isFilterRepositoryAvailable() {
  return false;
}

export function unsupportedFilterOperation() {
  throw new Error('Filter repository removed: database operations are not available.');
}
