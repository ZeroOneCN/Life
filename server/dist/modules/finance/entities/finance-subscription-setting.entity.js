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
exports.FinanceSubscriptionSettingEntity = void 0;
const typeorm_1 = require("typeorm");
const user_setting_entity_1 = require("../../../shared/persistence/user-setting.entity");
let FinanceSubscriptionSettingEntity = class FinanceSubscriptionSettingEntity extends user_setting_entity_1.UserSettingEntity {
};
exports.FinanceSubscriptionSettingEntity = FinanceSubscriptionSettingEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, default: '' }),
    __metadata("design:type", String)
], FinanceSubscriptionSettingEntity.prototype, "records_keyword", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, default: 'all' }),
    __metadata("design:type", String)
], FinanceSubscriptionSettingEntity.prototype, "records_category_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'all' }),
    __metadata("design:type", String)
], FinanceSubscriptionSettingEntity.prototype, "records_status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'all' }),
    __metadata("design:type", String)
], FinanceSubscriptionSettingEntity.prototype, "records_auto_renew_filter", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], FinanceSubscriptionSettingEntity.prototype, "records_expiry_start_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], FinanceSubscriptionSettingEntity.prototype, "records_expiry_end_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 90 }),
    __metadata("design:type", Number)
], FinanceSubscriptionSettingEntity.prototype, "dashboard_range_days", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 1 }),
    __metadata("design:type", Boolean)
], FinanceSubscriptionSettingEntity.prototype, "reminder_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 1 }),
    __metadata("design:type", Boolean)
], FinanceSubscriptionSettingEntity.prototype, "expiry_day_reminder_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 7 }),
    __metadata("design:type", Number)
], FinanceSubscriptionSettingEntity.prototype, "lead_days", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 0 }),
    __metadata("design:type", Boolean)
], FinanceSubscriptionSettingEntity.prototype, "include_auto_renew_in_reminders", void 0);
exports.FinanceSubscriptionSettingEntity = FinanceSubscriptionSettingEntity = __decorate([
    (0, typeorm_1.Entity)('finance_subscription_setting')
], FinanceSubscriptionSettingEntity);
