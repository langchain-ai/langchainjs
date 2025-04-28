import { createClient, RedisClientOptions } from "redis";

// A minimalistic connection pool to avoid creating multiple connections
class RedisConnectionPool {
  clients = new Map();

  getClient(config: RedisClientOptions = {}) {
    if (!this.clients.has(config))
      this.clients.set(config, createClient(config));
    return this.clients.get(config);
  }
}

export const pool = new RedisConnectionPool();
