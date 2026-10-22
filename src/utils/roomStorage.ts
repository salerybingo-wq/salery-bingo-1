const LEGACY_LOCAL_ROOM_ID = /^LOCAL-\d+$/i;

function clearLegacyRoomIdFrom(storage: Storage, storageName: string) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key || !/room/i.test(key)) continue;

    const value = storage.getItem(key);
    if (value && LEGACY_LOCAL_ROOM_ID.test(value.trim())) {
      storage.removeItem(key);
      console.info(`Removed stale local room ID from ${storageName}:`, key);
    }
  }
}

export function clearLegacyLocalRoomId() {
  if (typeof window === 'undefined') return;

  for (const storageName of ['localStorage', 'sessionStorage'] as const) {
    try {
      clearLegacyRoomIdFrom(window[storageName], storageName);
    } catch (error) {
      console.error(`Could not clear stale room IDs from ${storageName}:`, error);
    }
  }
}
