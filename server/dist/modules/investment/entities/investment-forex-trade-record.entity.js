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
exports.InvestmentForexTradeRecordEntity = void 0;
const typeorm_1 = require("typeorm");
const user_scoped_entity_1 = require("../../../shared/persistence/user-scoped.entity");
let InvestmentForexTradeRecordEntity = class InvestmentForexTradeRecordEntity extends user_scoped_entity_1.UserScopedEntity {
};
exports.InvestmentForexTradeRecordEntity = InvestmentForexTradeRecordEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], InvestmentForexTradeRecordEntity.prototype, "sort_order", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], InvestmentForexTradeRecordEntity.prototype, "trade_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16 }),
    __metadata("design:type", String)
], InvestmentForexTradeRecordEntity.prototype, "instrument", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16 }),
    __metadata("design:type", String)
], InvestmentForexTradeRecordEntity.prototype, "order_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 14, scale: 4 }),
    __metadata("design:type", Number)
], InvestmentForexTradeRecordEntity.prototype, "open_price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], InvestmentForexTradeRecordEntity.prototype, "lot_size", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], InvestmentForexTradeRecordEntity.prototype, "commission", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 14, scale: 4 }),
    __metadata("design:type", Number)
], InvestmentForexTradeRecordEntity.prototype, "close_price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], InvestmentForexTradeRecordEntity.prototype, "pnl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16 }),
    __metadata("design:type", String)
], InvestmentForexTradeRecordEntity.prototype, "open_time", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16 }),
    __metadata("design:type", String)
], InvestmentForexTradeRecordEntity.prototype, "close_time", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], InvestmentForexTradeRecordEntity.prototype, "hold_time", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], InvestmentForexTradeRecordEntity.prototype, "remark", void 0);
exports.InvestmentForexTradeRecordEntity = InvestmentForexTradeRecordEntity = __decorate([
    (0, typeorm_1.Entity)('investment_forex_trade_record')
], InvestmentForexTradeRecordEntity);
