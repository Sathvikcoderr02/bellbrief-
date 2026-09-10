import bcrypt from 'bcryptjs'

const COST = 12

export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, COST)
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plaintext, hash)
  } catch {
    // A malformed stored hash is a failed login, not a server error.
    return false
  }
}
