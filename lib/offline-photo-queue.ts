export type QueuedPhoto = {
  id: string;
  userId: string;
  workItemId: string;
  siteId: string;
  memberName: string;
  memo: string;
  imagePath: string;
  imageData?: ArrayBuffer;
  imageBlob?: Blob;
  capturedAt: string;
  status: "pending" | "sending" | "failed";
  attempts?: number;
  lastError?: string;
};

const DATABASE_NAME = "field-note-offline";
const STORE_NAME = "photo-queue";
const DATABASE_VERSION = 1;

function openQueueDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function completeTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function saveQueuedPhoto(photo: QueuedPhoto) {
  const database = await openQueueDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put(photo);
  await completeTransaction(transaction);
  database.close();
}

export async function getQueuedPhotos(userId: string) {
  const database = await openQueueDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const transactionDone = completeTransaction(transaction);
  const request = transaction.objectStore(STORE_NAME).getAll();
  const photos = await new Promise<QueuedPhoto[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as QueuedPhoto[]);
    request.onerror = () => reject(request.error);
  });
  await transactionDone;
  database.close();
  return photos
    .filter(photo => photo.userId === userId)
    .sort((first, second) => first.capturedAt.localeCompare(second.capturedAt));
}

export async function removeQueuedPhoto(id: string) {
  const database = await openQueueDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).delete(id);
  await completeTransaction(transaction);
  database.close();
}

export async function removeQueuedPhotosForUser(userId: string) {
  const database = await openQueueDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const request = store.openCursor();

  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const photo = cursor.value as QueuedPhoto;
      if (photo.userId === userId) cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });

  await completeTransaction(transaction);
  database.close();
}
