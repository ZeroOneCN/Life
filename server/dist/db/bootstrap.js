"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORE_TABLE = void 0;
exports.inspectDatabaseSchema = inspectDatabaseSchema;
exports.ensureDatabaseSchema = ensureDatabaseSchema;
const data_source_1 = require("./data-source");
const env_1 = require("../config/env");
exports.CORE_TABLE = 'system_user_account';
async function inspectDatabaseSchema() {
    const queryRunner = data_source_1.appDataSource.createQueryRunner();
    try {
        const hasCoreTable = await queryRunner.hasTable(exports.CORE_TABLE);
        return {
            coreTable: exports.CORE_TABLE,
            hasCoreTable,
            databaseReady: hasCoreTable,
            synchronized: false,
            reason: hasCoreTable ? 'core_table_exists' : 'core_table_missing',
        };
    }
    finally {
        await queryRunner.release();
    }
}
async function ensureDatabaseSchema(options) {
    const schemaState = await inspectDatabaseSchema();
    if (schemaState.hasCoreTable) {
        return schemaState;
    }
    const shouldSynchronize = options?.forceSync || env_1.env.DB_SYNCHRONIZE || env_1.env.DB_AUTO_BOOTSTRAP;
    if (!shouldSynchronize) {
        return schemaState;
    }
    await data_source_1.appDataSource.synchronize();
    return {
        coreTable: exports.CORE_TABLE,
        hasCoreTable: true,
        databaseReady: true,
        synchronized: true,
        reason: 'core_table_missing',
    };
}
