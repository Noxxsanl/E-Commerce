import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const TOKEN_ROUNDS = 10;

export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, TOKEN_ROUNDS);
}

export async function verifyToken(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateToken(): string {
  return uuidv4();
}
