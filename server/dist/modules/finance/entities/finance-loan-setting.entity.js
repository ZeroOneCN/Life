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
exports.FinanceLoanSettingEntity = void 0;
const typeorm_1 = require("typeorm");
const user_setting_entity_1 = require("../../../shared/persistence/user-setting.entity");
let FinanceLoanSettingEntity = class FinanceLoanSettingEntity extends user_setting_entity_1.UserSettingEntity {
};
exports.FinanceLoanSettingEntity = FinanceLoanSettingEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], FinanceLoanSettingEntity.prototype, "active_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], FinanceLoanSettingEntity.prototype, "bills_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], FinanceLoanSettingEntity.prototype, "repayments_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], FinanceLoanSettingEntity.prototype, "statistics_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 1 }),
    __metadata("design:type", Boolean)
], FinanceLoanSettingEntity.prototype, "repayment_reminder_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 1 }),
    __metadata("design:type", Boolean)
], FinanceLoanSettingEntity.prototype, "overdue_reminder_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 1 }),
    __metadata("design:type", Boolean)
], FinanceLoanSettingEntity.prototype, "auto_repayment_on_mark_paid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'daily' }),
    __metadata("design:type", String)
], FinanceLoanSettingEntity.prototype, "notification_frequency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 7 }),
    __metadata("design:type", Number)
], FinanceLoanSettingEntity.prototype, "upcoming_days", void 0);
exports.FinanceLoanSettingEntity = FinanceLoanSettingEntity = __decorate([
    (0, typeorm_1.Entity)('finance_loan_setting')
], FinanceLoanSettingEntity);
