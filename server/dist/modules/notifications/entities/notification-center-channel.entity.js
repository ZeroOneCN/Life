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
exports.NotificationCenterChannelEntity = void 0;
const typeorm_1 = require("typeorm");
const user_scoped_entity_1 = require("../../../shared/persistence/user-scoped.entity");
let NotificationCenterChannelEntity = class NotificationCenterChannelEntity extends user_scoped_entity_1.UserScopedEntity {
};
exports.NotificationCenterChannelEntity = NotificationCenterChannelEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], NotificationCenterChannelEntity.prototype, "channel_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], NotificationCenterChannelEntity.prototype, "label", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 1 }),
    __metadata("design:type", Boolean)
], NotificationCenterChannelEntity.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, default: 'ready' }),
    __metadata("design:type", String)
], NotificationCenterChannelEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], NotificationCenterChannelEntity.prototype, "config_json", void 0);
exports.NotificationCenterChannelEntity = NotificationCenterChannelEntity = __decorate([
    (0, typeorm_1.Entity)('notification_center_channel')
], NotificationCenterChannelEntity);
