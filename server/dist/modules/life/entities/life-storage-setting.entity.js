"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LifeStorageSettingEntity = void 0;
const typeorm_1 = require("typeorm");
const user_setting_entity_1 = require("../../../shared/persistence/user-setting.entity");
let LifeStorageSettingEntity = class LifeStorageSettingEntity extends user_setting_entity_1.UserSettingEntity {
};
exports.LifeStorageSettingEntity = LifeStorageSettingEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 1 }),
    __metadata("design:type", Boolean)
], LifeStorageSettingEntity.prototype, "include_archived_in_dashboard", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, default: 'latest' }),
    __metadata("design:type", String)
], LifeStorageSettingEntity.prototype, "default_sort", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'all' }),
    __metadata("design:type", String)
], LifeStorageSettingEntity.prototype, "default_dashboard_range", void 0);
exports.LifeStorageSettingEntity = LifeStorageSettingEntity = __decorate([
    (0, typeorm_1.Entity)('life_storage_setting')
], LifeStorageSettingEntity);
