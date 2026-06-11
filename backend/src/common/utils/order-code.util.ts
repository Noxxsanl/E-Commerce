import { Redis } from 'ioredis';
import { CacheKeys } from '../constants/cache-keys.constant';

export async function generateOrderCode(redis: Redis): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const key = CacheKeys.ORDER_COUNTER(dateStr);
  const counter = await redis.incr(key);

  // TTL 2 days so the key expires after the date changes
  await redis.expire(key, 172800);

  const seq = String(counter).padStart(5, '0');
  return `ORD-${dateStr}-${seq}`;
}
