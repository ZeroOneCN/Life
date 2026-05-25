"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const app_1 = require("./app");
const env_1 = require("./config/env");
const data_source_1 = require("./db/data-source");
async function bootstrap() {
    await data_source_1.appDataSource.initialize();
    const app = (0, app_1.createApp)();
    app.listen(env_1.env.PORT, () => {
        // Keep startup logging minimal until a real logger is wired in.
        // eslint-disable-next-line no-console
        console.log(`LifeOS server listening on :${env_1.env.PORT}`);
    });
}
void bootstrap();
