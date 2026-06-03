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
exports.FinanceTravelPayChannelEntity = void 0;
const typeorm_1 = require("typeorm");
const timestamped_entity_1 = require("../../../shared/persistence/timestamped.entity");
let FinanceTravelPayChannelEntity = class FinanceTravelPayChannelEntity extends timestamped_entity_1.TimestampedEntity {
};
exports.FinanceTravelPayChannelEntity = FinanceTravelPayChannelEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], FinanceTravelPayChannelEntity.prototype, "value", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128 }),
    __metadata("design:type", String)
], FinanceTravelPayChannelEntity.prototype, "label", void 0);
exports.FinanceTravelPayChannelEntity = FinanceTravelPayChannelEntity = __decorate([
    (0, typeorm_1.Entity)('finance_travel_pay_channel')
], FinanceTravelPayChannelEntity);
