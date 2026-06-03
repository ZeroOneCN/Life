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
exports.FinanceShoppingPlatformEntity = void 0;
const typeorm_1 = require("typeorm");
const timestamped_entity_1 = require("../../../shared/persistence/timestamped.entity");
let FinanceShoppingPlatformEntity = class FinanceShoppingPlatformEntity extends timestamped_entity_1.TimestampedEntity {
};
exports.FinanceShoppingPlatformEntity = FinanceShoppingPlatformEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128 }),
    __metadata("design:type", String)
], FinanceShoppingPlatformEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], FinanceShoppingPlatformEntity.prototype, "color_token", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 0 }),
    __metadata("design:type", Boolean)
], FinanceShoppingPlatformEntity.prototype, "is_built_in", void 0);
exports.FinanceShoppingPlatformEntity = FinanceShoppingPlatformEntity = __decorate([
    (0, typeorm_1.Entity)('finance_shopping_platform')
], FinanceShoppingPlatformEntity);
