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
exports.HealthStepRecordEntity = void 0;
const typeorm_1 = require("typeorm");
const user_scoped_entity_1 = require("../../../shared/persistence/user-scoped.entity");
let HealthStepRecordEntity = class HealthStepRecordEntity extends user_scoped_entity_1.UserScopedEntity {
};
exports.HealthStepRecordEntity = HealthStepRecordEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], HealthStepRecordEntity.prototype, "steps", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], HealthStepRecordEntity.prototype, "hour", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], HealthStepRecordEntity.prototype, "record_time", void 0);
exports.HealthStepRecordEntity = HealthStepRecordEntity = __decorate([
    (0, typeorm_1.Entity)('health_step_record')
], HealthStepRecordEntity);
