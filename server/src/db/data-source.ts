import { DataSource } from 'typeorm';

import { env } from '../config/env';

function toPosixPath(value: string) {
  return value.replace(/\\/g, '/');
}

const currentDir = toPosixPath(__dirname);
const entityGlob = `${currentDir}/../modules/**/entities/*.entity.{ts,js}`;
const migrationGlob = `${currentDir}/migrations/*.{ts,js}`;

export const appDataSource = new DataSource({
  type: 'mysql',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
  synchronize: env.DB_SYNCHRONIZE,
  entities: [entityGlob],
  migrations: [migrationGlob],
});

export const appDataSourceGlobs = {
  entities: [entityGlob],
  migrations: [migrationGlob],
};
