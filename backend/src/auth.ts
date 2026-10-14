import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from './entities/User';

const SECRET = process.env.JWT_SECRET ?? 'dev-secret';

export interface AuthPayload { id: number; role: Role; }

export interface AuthRequest extends Request { auth?: AuthPayload; }

export function signToken(p: AuthPayload): string {
  return jwt.sign(p, SECRET, { expiresIn: '8h' });
}

export function requireAuth(role?: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Bejelentkezés szükséges.' });
    try {
      const payload = jwt.verify(token, SECRET) as AuthPayload;
      if (role && payload.role !== role) {
        return res.status(403).json({ message: 'Ehhez a művelethez nincs jogosultsága.' });
      }
      req.auth = payload;
      next();
    } catch {
      return res.status(401).json({ message: 'A munkamenet lejárt, jelentkezzen be újra.' });
    }
  };
}
