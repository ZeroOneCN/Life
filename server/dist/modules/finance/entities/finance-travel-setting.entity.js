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
exports.FinanceTravelSettingEntity = void 0;
const typeorm_1 = require("typeorm");
const user_setting_entity_1 = require("../../../shared/persistence/user-setting.entity");
let FinanceTravelSettingEntity = class FinanceTravelSettingEntity extends user_setting_entity_1.UserSettingEntity {
};
exports.FinanceTravelSettingEntity = FinanceTravelSettingEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], FinanceTravelSettingEntity.prototype, "active_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], FinanceTravelSettingEntity.prototype, "active_book_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], FinanceTravelSettingEntity.prototype, "details_book_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], FinanceTravelSettingEntity.prototype, "stats_book_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], FinanceTravelSettingEntity.prototype, "report_book_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], FinanceTravelSettingEntity.prototype, "leaderboard_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], FinanceTravelSettingEntity.prototype, "report_columns_json", void 0);
exports.FinanceTravelSettingEntity = FinanceTravelSettingEntity = __decorate([
    (0, typeorm_1.Entity)('finance_travel_setting')
], FinanceTravelSettingEntity);
