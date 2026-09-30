import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const getJwtSecret = (name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string => {
  const secret = process.env[name];
  if (!secret) throw new Error(`${name} must be configured`);
  return secret;
};

export interface TokenPayload {
  userId: number;
  email: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, getJwtSecret('JWT_SECRET'), { expiresIn: '7d' });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, getJwtSecret('JWT_REFRESH_SECRET'), { expiresIn: '30d' });
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, getJwtSecret('JWT_SECRET')) as TokenPayload;
  } catch (error) {
    return null;
  }
};

export const verifyRefreshToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, getJwtSecret('JWT_REFRESH_SECRET')) as TokenPayload;
  } catch (error) {
    return null;
  }
};

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
