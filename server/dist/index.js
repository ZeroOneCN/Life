"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const app_1 = require("./app");
const env_1 = require("./config/env");
const bootstrap_1 = require("./db/bootstrap");
const data_source_1 = require("./db/data-source");
async function bootstrap() {
    try {
        await data_source_1.appDataSource.initialize();
        if (!data_source_1.appDataSource.entityMetadatas.length) {
            throw new Error('No entity metadata discovered during startup.');
        }
        // eslint-disable-next-line no-console
        console.log(`LifeOS entity metadata loaded: ${data_source_1.appDataSource.entityMetadatas.length}`);
        const schemaState = await (0, bootstrap_1.ensureDatabaseSchema)();
        if (schemaState.synchronized) {
            // eslint-disable-next-line no-console
            console.log('LifeOS database schema synchronized automatically on startup.');
        }
        const app = (0, app_1.createApp)();
        app.listen(env_1.env.PORT, () => {
            // Keep startup logging minimal until a real logger is wired in.
            // eslint-disable-next-line no-console
            console.log(`LifeOS server listening on :${env_1.env.PORT}`);
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error('LifeOS server failed to start.', error);
        process.exit(1);
    }
}
void bootstrap();
