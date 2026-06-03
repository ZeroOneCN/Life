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
exports.HealthMedicationSettingEntity = void 0;
const typeorm_1 = require("typeorm");
const user_setting_entity_1 = require("../../../shared/persistence/user-setting.entity");
let HealthMedicationSettingEntity = class HealthMedicationSettingEntity extends user_setting_entity_1.UserSettingEntity {
};
exports.HealthMedicationSettingEntity = HealthMedicationSettingEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], HealthMedicationSettingEntity.prototype, "active_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], HealthMedicationSettingEntity.prototype, "records_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], HealthMedicationSettingEntity.prototype, "purchase_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], HealthMedicationSettingEntity.prototype, "analysis_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36, nullable: true }),
    __metadata("design:type", Object)
], HealthMedicationSettingEntity.prototype, "summary_user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 1 }),
    __metadata("design:type", Boolean)
], HealthMedicationSettingEntity.prototype, "dose_reminder_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 1 }),
    __metadata("design:type", Boolean)
], HealthMedicationSettingEntity.prototype, "stock_reminder_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 8, default: '08:00' }),
    __metadata("design:type", String)
], HealthMedicationSettingEntity.prototype, "breakfast_reminder_time", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 8, default: '12:00' }),
    __metadata("design:type", String)
], HealthMedicationSettingEntity.prototype, "lunch_reminder_time", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 8, default: '19:00' }),
    __metadata("design:type", String)
], HealthMedicationSettingEntity.prototype, "dinner_reminder_time", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 3 }),
    __metadata("design:type", Number)
], HealthMedicationSettingEntity.prototype, "default_stock_threshold", void 0);
exports.HealthMedicationSettingEntity = HealthMedicationSettingEntity = __decorate([
    (0, typeorm_1.Entity)('health_medication_setting')
], HealthMedicationSettingEntity);
