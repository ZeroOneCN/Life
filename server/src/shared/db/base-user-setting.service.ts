import { DeepPartial, EntityTarget, Repository } from 'typeorm';

import { appDataSource } from '../../db/data-source';

export class BaseUserSettingService<TEntity extends { user_id: string }> {
  protected readonly repository: Repository<TEntity>;

  constructor(entity: EntityTarget<TEntity>) {
    this.repository = appDataSource.getRepository(entity);
  }

  async getOrCreate(userId: string, defaults: DeepPartial<TEntity>) {
    const current = await this.repository.findOne({
      where: {
        user_id: userId,
      } as never,
    });

    if (current) {
      return current;
    }

    return this.repository.save(this.repository.create({
      ...defaults,
      user_id: userId,
    } as DeepPartial<TEntity>));
  }

  async update(userId: string, patch: DeepPartial<TEntity>, defaults: DeepPartial<TEntity>) {
    const current = await this.getOrCreate(userId, defaults);
    return this.repository.save(this.repository.create({
      ...current,
      ...patch,
      user_id: userId,
    } as DeepPartial<TEntity>));
  }
}
