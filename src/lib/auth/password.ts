import { hash, verify } from "@node-rs/argon2";

/** Argon2id is the library default. The options stay explicit for memory and passes. */
export const ARGON2ID_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2ID_OPTIONS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2ID_OPTIONS);
  } catch {
    return false;
  }
}
