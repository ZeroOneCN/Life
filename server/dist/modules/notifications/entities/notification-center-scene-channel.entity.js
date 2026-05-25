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
exports.NotificationCenterSceneChannelEntity = void 0;
const typeorm_1 = require("typeorm");
const user_scoped_entity_1 = require("../../../shared/persistence/user-scoped.entity");
let NotificationCenterSceneChannelEntity = class NotificationCenterSceneChannelEntity extends user_scoped_entity_1.UserScopedEntity {
};
exports.NotificationCenterSceneChannelEntity = NotificationCenterSceneChannelEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], NotificationCenterSceneChannelEntity.prototype, "scene_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], NotificationCenterSceneChannelEntity.prototype, "channel_type", void 0);
exports.NotificationCenterSceneChannelEntity = NotificationCenterSceneChannelEntity = __decorate([
    (0, typeorm_1.Entity)('notification_center_scene_channel')
], NotificationCenterSceneChannelEntity);
