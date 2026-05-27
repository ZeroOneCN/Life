"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const bootstrap_1 = require("./bootstrap");
const data_source_1 = require("./data-source");
const system_health_1 = require("../modules/system/system-health");
async function seed() {
    await data_source_1.appDataSource.initialize();
    await (0, bootstrap_1.ensureDatabaseSchema)({ forceSync: true });
    const snapshot = await (0, system_health_1.getSystemHealthSnapshot)();
    await data_source_1.appDataSource.destroy();
    // eslint-disable-next-line no-console
    console.log(`Seed completed. databaseReady=${snapshot.databaseReady} hasUsers=${snapshot.hasUsers} ` +
        'No demo user is created by default.');
}
void seed();
