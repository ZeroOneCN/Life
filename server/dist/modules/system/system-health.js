"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemHealthSnapshot = getSystemHealthSnapshot;
const data_source_1 = require("../../db/data-source");
const env_1 = require("../../config/env");
const bootstrap_1 = require("../../db/bootstrap");
const system_user_account_entity_1 = require("./entities/system-user-account.entity");
function getSchemaMode() {
    if (env_1.env.DB_SYNCHRONIZE) {
        return 'synchronize';
    }
    if (env_1.env.DB_AUTO_BOOTSTRAP) {
        return 'auto_bootstrap';
    }
    return 'migration_only';
}
async function getSystemHealthSnapshot() {
    const schemaState = await (0, bootstrap_1.inspectDatabaseSchema)();
    if (!schemaState.hasCoreTable) {
        return {
            status: 'degraded',
            databaseReady: false,
            bootstrapRequired: true,
            hasUsers: false,
            registrationMode: 'first_admin_only',
            entityCount: data_source_1.appDataSource.entityMetadatas.length,
            schemaMode: getSchemaMode(),
            reason: 'core_table_missing',
            coreTable: bootstrap_1.CORE_TABLE,
        };
    }
    const accountRepo = data_source_1.appDataSource.getRepository(system_user_account_entity_1.SystemUserAccountEntity);
    const userCount = await accountRepo.count();
    const hasUsers = userCount > 0;
    return {
        status: 'ok',
        databaseReady: true,
        bootstrapRequired: !hasUsers,
        hasUsers,
        registrationMode: 'first_admin_only',
        entityCount: data_source_1.appDataSource.entityMetadatas.length,
        schemaMode: getSchemaMode(),
        reason: null,
        coreTable: bootstrap_1.CORE_TABLE,
    };
}
