// =============================================================================
// takeStorage.ts · IndexedDB Encrypted Client Storage for Assessment Session (/take)
// Provides full offline resilience:
//   - Local assessment package caching
//   - Real-time encrypted storage of answers, flags and positioning
//   - Network sync queue with auto-submission when connectivity returns
// =============================================================================

const DB_NAME = 'dvla_take_db_v1';
const DB_VERSION = 1;

interface SyncQueueItem {
  id?: number;
  attemptId: number;
  type: 'response' | 'flag' | 'time' | 'submit';
  payload: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
}

function getIndexedDB(): IDBFactory | null {
  if (typeof window === 'undefined') return null;
  return window.indexedDB || (window as any).mozIndexedDB || (window as any).webkitIndexedDB;
}

export function openTakeDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb = getIndexedDB();
    if (!idb) return reject(new Error('IndexedDB not supported in this environment'));

    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e: any) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('packages')) {
        db.createObjectStore('packages', { keyPath: 'assessmentId' });
      }
      if (!db.objectStoreNames.contains('attempts')) {
        db.createObjectStore('attempts', { keyPath: 'attemptId' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const sq = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        sq.createIndex('attemptId', 'attemptId', { unique: false });
        sq.createIndex('status', 'status', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ===== ENCRYPTION HELPERS =====
// Encrypts data with AES-GCM using Web Crypto Subtle API when available,
// with safe fallback to encoded JSON in environments without SubtleCrypto.
async function deriveKey(saltStr: string): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) return null;
  try {
    const enc = new TextEncoder();
    const rawKey = enc.encode('dvla-offline-secret-key-salt-' + saltStr).slice(0, 32);
    // Pad to 32 bytes if shorter
    const buf = new Uint8Array(32);
    buf.set(rawKey.subarray(0, 32));
    return await window.crypto.subtle.importKey('raw', buf, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  } catch (err) {
    return null;
  }
}

export async function encryptData(data: any, attemptId: number): Promise<string> {
  const jsonStr = JSON.stringify(data);
  try {
    const key = await deriveKey(String(attemptId));
    if (!key || !window.crypto || !window.crypto.subtle) {
      return btoa(unescape(encodeURIComponent(jsonStr)));
    }
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(jsonStr)
    );
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return 'enc:' + btoa(binary);
  } catch (e) {
    return btoa(unescape(encodeURIComponent(jsonStr)));
  }
}

export async function decryptData(cipherStr: string, attemptId: number): Promise<any> {
  if (!cipherStr) return null;
  try {
    if (!cipherStr.startsWith('enc:')) {
      return JSON.parse(decodeURIComponent(escape(atob(cipherStr))));
    }
    const rawB64 = cipherStr.slice(4);
    const binary = atob(rawB64);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);

    const key = await deriveKey(String(attemptId));
    if (!key || !window.crypto || !window.crypto.subtle) {
      return null;
    }
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (e) {
    console.warn('[takeStorage] Decryption fallback or error:', e);
    return null;
  }
}

// ===== ASSESSMENT PACKAGE CACHING =====
export async function cacheAssessmentPackage(assessmentId: number, packageData: any): Promise<void> {
  try {
    const db = await openTakeDb();
    const tx = db.transaction('packages', 'readwrite');
    const store = tx.objectStore('packages');
    store.put({
      assessmentId,
      data: packageData,
      cachedAt: Date.now(),
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[takeStorage] Unable to cache assessment package:', err);
  }
}

export async function getCachedAssessmentPackage(assessmentId: number): Promise<any | null> {
  try {
    const db = await openTakeDb();
    const tx = db.transaction('packages', 'readonly');
    const store = tx.objectStore('packages');
    const req = store.get(assessmentId);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

// ===== REAL-TIME ENCRYPTED ATTEMPT STORAGE =====
export async function saveAttemptStateEncrypted(
  attemptId: number,
  state: { assessmentId: number; answers: Record<string | number, any>; flags: Record<string | number, boolean>; position: number; isSubmitted?: boolean }
): Promise<void> {
  try {
    const encryptedPayload = await encryptData(state, attemptId);
    const db = await openTakeDb();
    const tx = db.transaction('attempts', 'readwrite');
    const store = tx.objectStore('attempts');
    store.put({
      attemptId,
      assessmentId: state.assessmentId,
      payload: encryptedPayload,
      updatedAt: Date.now(),
      isSubmitted: !!state.isSubmitted,
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[takeStorage] Failed to save encrypted attempt state:', err);
  }
}

export async function getAttemptStateEncrypted(attemptId: number): Promise<any | null> {
  try {
    const db = await openTakeDb();
    const tx = db.transaction('attempts', 'readonly');
    const store = tx.objectStore('attempts');
    const req = store.get(attemptId);
    const item: any = await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (!item || !item.payload) return null;
    return await decryptData(item.payload, attemptId);
  } catch (err) {
    return null;
  }
}

// ===== SYNC QUEUE MANAGEMENT =====
export async function enqueueSyncItem(attemptId: number, type: 'response' | 'flag' | 'time' | 'submit', payload: any): Promise<number | null> {
  try {
    const db = await openTakeDb();
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const item: SyncQueueItem = {
      attemptId,
      type,
      payload,
      timestamp: Date.now(),
      status: 'pending',
    };
    const req = store.add(item);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as number);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[takeStorage] Failed to enqueue sync item:', err);
    return null;
  }
}

export async function getPendingSyncQueue(attemptId: number): Promise<SyncQueueItem[]> {
  try {
    const db = await openTakeDb();
    const tx = db.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const index = store.index('attemptId');
    const req = index.getAll(attemptId);
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const items = req.result || [];
        resolve(items.filter((it: SyncQueueItem) => it.status === 'pending' || it.status === 'failed'));
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

export async function removeSyncItem(id: number): Promise<void> {
  try {
    const db = await openTakeDb();
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    store.delete(id);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    // ignore
  }
}

export async function clearAttemptSync(attemptId: number): Promise<void> {
  try {
    const db = await openTakeDb();
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const index = store.index('attemptId');
    const req = index.getAllKeys(attemptId);
    req.onsuccess = () => {
      const keys = req.result;
      for (const k of keys) store.delete(k);
    };
  } catch (err) {
    // ignore
  }
}
