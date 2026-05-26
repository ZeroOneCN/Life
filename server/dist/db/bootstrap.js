"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDatabaseSchema = ensureDatabaseSchema;
const data_source_1 = require("./data-source");
const env_1 = require("../config/env");
const CORE_TABLE = 'system_user_account';
async function ensureDatabaseSchema(options) {
    const queryRunner = data_source_1.appDataSource.createQueryRunner();
    try {
        const hasCoreTable = await queryRunner.hasTable(CORE_TABLE);
        if (hasCoreTable) {
            return {
                synchronized: false,
                reason: 'core_table_exists',
            };
        }
    }
    finally {
        await queryRunner.release();
    }
    const shouldSynchronize = options?.forceSync || env_1.env.DB_SYNCHRONIZE || env_1.env.DB_AUTO_BOOTSTRAP;
    if (!shouldSynchronize) {
        throw new Error(`Database schema is missing core table "${CORE_TABLE}". ` +
            'Enable DB_SYNCHRONIZE=true, set DB_AUTO_BOOTSTRAP=true, or provide migrations before startup.');
    }
    await data_source_1.appDataSource.synchronize();
    return {
        synchronized: true,
        reason: 'core_table_missing',
    };
}
