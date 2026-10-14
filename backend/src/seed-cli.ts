import { AppDataSource, ensureDatabase } from './data-source';
import { seedIfEmpty } from './seed';

(async () => {
  await ensureDatabase();
  await AppDataSource.initialize();
  await seedIfEmpty();
  await AppDataSource.destroy();
})();
