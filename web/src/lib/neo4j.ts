import neo4j, { type Driver, type Integer } from "neo4j-driver";

/**
 * Server-side only Neo4j driver.
 * Uses credentials from environment — NEVER expose to the client.
 */

let _driver: Driver | null = null;

export function getNeo4jDriver(): Driver {
  if (_driver) return _driver;

  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !username || !password) {
    throw new Error(
      "Missing NEO4J_URI, NEO4J_USERNAME, or NEO4J_PASSWORD environment variables"
    );
  }

  _driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  return _driver;
}

/**
 * Safely convert Neo4j Integer to JS number.
 * Neo4j returns Integer objects, not native numbers.
 */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (neo4j.isInt(value)) return (value as Integer).toNumber();
  return Number(value) || 0;
}
