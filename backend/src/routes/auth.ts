import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';
import { AuthRequest, requireAuth, signToken } from '../auth';
import { userDto } from '../dto';

export const authRouter = Router();
const users = () => AppDataSource.getRepository(User);

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ message: 'Adja meg az e-mail címet és a jelszót.' });

  const user = await users().findOneBy({ email: String(email).trim().toLowerCase() });
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    return res.status(401).json({ message: 'Hibás e-mail cím vagy jelszó.' });
  }
  res.json({ token: signToken({ id: user.id, role: user.role }), user: userDto(user) });
});

authRouter.get('/me', requireAuth(), async (req: AuthRequest, res) => {
  const user = await users().findOneBy({ id: req.auth!.id });
  if (!user) return res.status(401).json({ message: 'A felhasználó nem található.' });
  res.json(userDto(user));
});
