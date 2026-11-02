import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let limiters: { ip: Ratelimit; email: Ratelimit } | undefined;

function getLimiters() {
  if (limiters) return limiters;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for login rate limiting');
  }

  const redis = new Redis({ url, token });
  limiters = {
    ip: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '15 m'),
      prefix: 'event-finance:login:ip',
    }),
    email: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      prefix: 'event-finance:login:email',
    }),
  };
  return limiters;
}

export async function allowLoginAttempt(request: Request, email: string) {
  const forwardedIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = request.headers.get('x-real-ip')?.trim() || forwardedIp;
  if (!ip) throw new Error('Unable to determine client IP for login rate limiting');

  const emailKey = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  const { ip: ipLimiter, email: emailLimiter } = getLimiters();

  const ipResult = await ipLimiter.limit(ip);
  if (!ipResult.success) return false;

  const emailResult = await emailLimiter.limit(emailKey);
  return emailResult.success;
}
