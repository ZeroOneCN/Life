"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseUserSettingService = void 0;
const data_source_1 = require("../../db/data-source");
class BaseUserSettingService {
    constructor(entity) {
        this.repository = data_source_1.appDataSource.getRepository(entity);
    }
    async getOrCreate(userId, defaults) {
        const current = await this.repository.findOne({
            where: {
                user_id: userId,
            },
        });
        if (current) {
            return current;
        }
        return this.repository.save(this.repository.create({
            ...defaults,
            user_id: userId,
        }));
    }
    async update(userId, patch, defaults) {
        const current = await this.getOrCreate(userId, defaults);
        return this.repository.save(this.repository.create({
            ...current,
            ...patch,
            user_id: userId,
        }));
    }
}
exports.BaseUserSettingService = BaseUserSettingService;
