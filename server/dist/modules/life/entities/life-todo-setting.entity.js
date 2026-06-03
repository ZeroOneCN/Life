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
exports.LifeTodoSettingEntity = void 0;
const typeorm_1 = require("typeorm");
const user_setting_entity_1 = require("../../../shared/persistence/user-setting.entity");
let LifeTodoSettingEntity = class LifeTodoSettingEntity extends user_setting_entity_1.UserSettingEntity {
};
exports.LifeTodoSettingEntity = LifeTodoSettingEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 1 }),
    __metadata("design:type", Boolean)
], LifeTodoSettingEntity.prototype, "reminder_enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 8, default: '09:00' }),
    __metadata("design:type", String)
], LifeTodoSettingEntity.prototype, "reminder_time", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 3 }),
    __metadata("design:type", Number)
], LifeTodoSettingEntity.prototype, "lead_days", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 1 }),
    __metadata("design:type", Boolean)
], LifeTodoSettingEntity.prototype, "include_daily_tasks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 1 }),
    __metadata("design:type", Boolean)
], LifeTodoSettingEntity.prototype, "include_overdue_tasks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], LifeTodoSettingEntity.prototype, "last_auto_reminder_date", void 0);
exports.LifeTodoSettingEntity = LifeTodoSettingEntity = __decorate([
    (0, typeorm_1.Entity)('life_todo_setting')
], LifeTodoSettingEntity);
