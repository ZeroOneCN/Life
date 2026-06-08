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
exports.HealthCheckupTemplateItemEntity = void 0;
const typeorm_1 = require("typeorm");
const timestamped_entity_1 = require("../../../shared/persistence/timestamped.entity");
let HealthCheckupTemplateItemEntity = class HealthCheckupTemplateItemEntity extends timestamped_entity_1.TimestampedEntity {
};
exports.HealthCheckupTemplateItemEntity = HealthCheckupTemplateItemEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], HealthCheckupTemplateItemEntity.prototype, "template_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], HealthCheckupTemplateItemEntity.prototype, "sort_order", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128 }),
    __metadata("design:type", String)
], HealthCheckupTemplateItemEntity.prototype, "test_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], HealthCheckupTemplateItemEntity.prototype, "unit", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], HealthCheckupTemplateItemEntity.prototype, "reference_range", void 0);
exports.HealthCheckupTemplateItemEntity = HealthCheckupTemplateItemEntity = __decorate([
    (0, typeorm_1.Entity)('health_checkup_template_item')
], HealthCheckupTemplateItemEntity);
