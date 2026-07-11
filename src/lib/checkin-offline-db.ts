import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type CachedGuestRow = {
  id: string;
  name: string;
  email: string | null;
  /** Absent on caches written before phone was added to the cache. */
  phone?: string | null;
  /** Absent on caches written before onsite profile fields were added. */
  company?: string | null;
  jobTitle?: string | null;
  repId: string | null;
  qrCode: string | null;
  status: string;
  checkedInAt: string | null;
};

type QueueItem = {
  id: string;
  eventId: string;
  guestId: string;
  method: "qr" | "manual";
  createdAt: number;
};

interface CheckInOfflineSchema extends DBSchema {
  guests: {
    key: string;
    value: { eventId: string; updatedAt: number; rows: CachedGuestRow[] };
  };
  queue: {
    key: string;
    value: QueueItem;
  };
}

const DB_NAME = "eventflow-checkin-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CheckInOfflineSchema>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<CheckInOfflineSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("guests")) {
          db.createObjectStore("guests", { keyPath: "eventId" });
        }
        if (!db.objectStoreNames.contains("queue")) {
          db.createObjectStore("queue", { keyPath: "id" });
        }
      }
    });
  }
  return dbPromise;
}

export async function putGuestCache(eventId: string, rows: CachedGuestRow[]) {
  const db = await getDb();
  await db.put("guests", { eventId, updatedAt: Date.now(), rows });
}

export async function getGuestCache(eventId: string): Promise<CachedGuestRow[] | null> {
  const db = await getDb();
  const row = await db.get("guests", eventId);
  return row?.rows ?? null;
}

export async function updateCachedGuestStatus(eventId: string, guestId: string, status: string) {
  const db = await getDb();
  const row = await db.get("guests", eventId);
  if (!row) return;
  const next = row.rows.map((g) =>
    g.id === guestId ? { ...g, status, checkedInAt: new Date().toISOString() } : g
  );
  await db.put("guests", { ...row, updatedAt: Date.now(), rows: next });
}

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function enqueueOfflineCheckIn(eventId: string, guestId: string, method: "qr" | "manual") {
  const db = await getDb();
  const item: QueueItem = {
    id: randomId(),
    eventId,
    guestId,
    method,
    createdAt: Date.now()
  };
  await db.add("queue", item);
}

export async function listQueuedForEvent(
  eventId: string
): Promise<Pick<QueueItem, "id" | "guestId" | "method">[]> {
  const db = await getDb();
  const all = await db.getAll("queue");
  return all.filter((q) => q.eventId === eventId).map(({ id, guestId, method }) => ({ id, guestId, method }));
}

export async function removeQueueItem(id: string) {
  const db = await getDb();
  await db.delete("queue", id);
}
