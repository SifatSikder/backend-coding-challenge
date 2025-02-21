import Redis from "ioredis";

const redis = new Redis({
  host: "redis",
  port: 6379,
});

export const addToBlacklist = async (token: string, expirySeconds: number) => {
  await redis.set(`bl_${token}`, "1", "EX", expirySeconds);
};

export const isBlacklisted = async (token: string): Promise<boolean> => {
  const exists = await redis.exists(`bl_${token}`);
  return exists === 1;
};
