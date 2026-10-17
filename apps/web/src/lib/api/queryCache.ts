/**
 * Actor-Epoch-Aware Client Query Cache
 *
 * Provides in-memory SWR/deduplication scoped per ApiClient instance.
 * Only caches responses when ttlMs > 0.
 * In-flight requests are deduplicated concurrently for the same key + actorKey + client.
 */

export interface CacheEntry<T = unknown> {
  readonly data: T;
  readonly timestamp: number;
  readonly actorKey: string;
}

interface ClientCacheBucket {
  entries: Map<string, CacheEntry<unknown>>;
  inFlight: Map<string, Promise<unknown>>;
}

const clientBuckets = new WeakMap<object, ClientCacheBucket>();
const registeredClientRefs = new Set<WeakRef<object>>();
const defaultClientBucketObj = {};

function getBucket(client: object): ClientCacheBucket {
  let bucket = clientBuckets.get(client);
  if (!bucket) {
    bucket = {
      entries: new Map(),
      inFlight: new Map(),
    };
    clientBuckets.set(client, bucket);
    if (client !== defaultClientBucketObj) {
      registeredClientRefs.add(new WeakRef(client));
    }
  }
  return bucket;
}

export type CacheFetcher<T> = () => Promise<T>;

export function fetchWithActorCache<T>(
  key: string,
  actorKey: string,
  fetcher: CacheFetcher<T>,
  ttlMs?: number,
  client?: object
): Promise<T>;
export function fetchWithActorCache<T>(
  client: object,
  key: string,
  actorKey: string,
  fetcher: CacheFetcher<T>,
  ttlMs?: number
): Promise<T>;
export function fetchWithActorCache<T>(
  firstArg: string | object,
  secondArg: string,
  thirdArg: string | CacheFetcher<T>,
  fourthArg?: CacheFetcher<T> | number,
  fifthArg?: number | object
): Promise<T> {
  let clientTarget: object;
  let cacheKeyName: string;
  let actorKeyName: string;
  let fetcherFn: CacheFetcher<T>;
  let ttl: number;

  if (typeof firstArg === 'object' && firstArg !== null) {
    clientTarget = firstArg;
    cacheKeyName = secondArg;
    actorKeyName = thirdArg as string;
    fetcherFn = fourthArg as CacheFetcher<T>;
    ttl = typeof fifthArg === 'number' && Number.isFinite(fifthArg) ? fifthArg : 0;
  } else {
    cacheKeyName = firstArg as string;
    actorKeyName = secondArg;
    fetcherFn = thirdArg as CacheFetcher<T>;
    ttl = typeof fourthArg === 'number' && Number.isFinite(fourthArg) ? fourthArg : 0;
    clientTarget = typeof fifthArg === 'object' && fifthArg !== null ? fifthArg : defaultClientBucketObj;
  }

  const compositeKey = `${actorKeyName}:${cacheKeyName}`;
  const bucket = getBucket(clientTarget);

  if (ttl > 0) {
    const cached = bucket.entries.get(compositeKey);
    if (cached) {
      const isExpired = Date.now() - cached.timestamp > ttl;
      if (!isExpired && cached.actorKey === actorKeyName) {
        return Promise.resolve(cached.data as T);
      }
      bucket.entries.delete(compositeKey);
    }
  }

  const inFlightPromise = bucket.inFlight.get(compositeKey);
  if (inFlightPromise) {
    return inFlightPromise as Promise<T>;
  }

  const promise = (async () => {
    try {
      const result = await fetcherFn();
      if (ttl > 0) {
        bucket.entries.set(compositeKey, {
          data: result,
          timestamp: Date.now(),
          actorKey: actorKeyName,
        });
      }
      return result;
    } finally {
      bucket.inFlight.delete(compositeKey);
    }
  })();

  bucket.inFlight.set(compositeKey, promise);
  return promise;
}

export function fetchWithActorCacheForClient<T>(
  client: object,
  key: string,
  actorKey: string,
  fetcher: CacheFetcher<T>,
  ttlMs?: number
): Promise<T> {
  return fetchWithActorCache(client, key, actorKey, fetcher, ttlMs);
}

export function invalidateActorCacheForClient(client: object, actorKey?: string): void {
  const bucket = clientBuckets.get(client);
  if (!bucket) return;

  if (!actorKey) {
    bucket.entries.clear();
    bucket.inFlight.clear();
    return;
  }

  for (const [k, entry] of bucket.entries.entries()) {
    if (entry.actorKey === actorKey) {
      bucket.entries.delete(k);
    }
  }

  const prefix = `${actorKey}:`;
  for (const k of bucket.inFlight.keys()) {
    if (k.startsWith(prefix)) {
      bucket.inFlight.delete(k);
    }
  }
}

export function invalidateActorCache(actorKey?: string): void {
  invalidateActorCacheForClient(defaultClientBucketObj, actorKey);

  for (const ref of registeredClientRefs) {
    const client = ref.deref();
    if (client) {
      invalidateActorCacheForClient(client, actorKey);
    } else {
      registeredClientRefs.delete(ref);
    }
  }
}

export function clearQueryCache(): void {
  invalidateActorCache();
  registeredClientRefs.clear();
}
