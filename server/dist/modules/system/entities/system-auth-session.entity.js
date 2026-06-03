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
exports.SystemAuthSessionEntity = void 0;
const typeorm_1 = require("typeorm");
const user_scoped_entity_1 = require("../../../shared/persistence/user-scoped.entity");
let SystemAuthSessionEntity = class SystemAuthSessionEntity extends user_scoped_entity_1.UserScopedEntity {
};
exports.SystemAuthSessionEntity = SystemAuthSessionEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128, unique: true }),
    __metadata("design:type", String)
], SystemAuthSessionEntity.prototype, "session_token", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], SystemAuthSessionEntity.prototype, "refresh_token_hash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SystemAuthSessionEntity.prototype, "expires_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", Object)
], SystemAuthSessionEntity.prototype, "device_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], SystemAuthSessionEntity.prototype, "ip_address", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 0 }),
    __metadata("design:type", Boolean)
], SystemAuthSessionEntity.prototype, "revoked", void 0);
exports.SystemAuthSessionEntity = SystemAuthSessionEntity = __decorate([
    (0, typeorm_1.Entity)('system_auth_session')
], SystemAuthSessionEntity);
