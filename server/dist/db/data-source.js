"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appDataSourceGlobs = exports.appDataSource = void 0;
const typeorm_1 = require("typeorm");
const env_1 = require("../config/env");
function toPosixPath(value) {
    return value.replace(/\\/g, '/');
}
const currentDir = toPosixPath(__dirname);
const entityGlob = `${currentDir}/../modules/**/entities/*.entity.{ts,js}`;
const migrationGlob = `${currentDir}/migrations/*.{ts,js}`;
exports.appDataSource = new typeorm_1.DataSource({
    type: 'mysql',
    host: env_1.env.DB_HOST,
    port: env_1.env.DB_PORT,
    username: env_1.env.DB_USERNAME,
    password: env_1.env.DB_PASSWORD,
    database: env_1.env.DB_DATABASE,
    synchronize: env_1.env.DB_SYNCHRONIZE,
    entities: [entityGlob],
    migrations: [migrationGlob],
});
exports.appDataSourceGlobs = {
    entities: [entityGlob],
    migrations: [migrationGlob],
};
