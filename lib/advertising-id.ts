export const DELETED_ADVERTISING_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Returns true when an Android advertising ID is unavailable or deleted by user action.
 */
export function isDeletedAdvertisingId(advertisingId: string | null | undefined): boolean {
  if (!advertisingId) {
    return true;
  }

  return advertisingId.trim() === DELETED_ADVERTISING_ID;
}

