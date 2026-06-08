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
exports.LifeTodoTaskEntity = void 0;
const typeorm_1 = require("typeorm");
const user_scoped_entity_1 = require("../../../shared/persistence/user-scoped.entity");
let LifeTodoTaskEntity = class LifeTodoTaskEntity extends user_scoped_entity_1.UserScopedEntity {
};
exports.LifeTodoTaskEntity = LifeTodoTaskEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], LifeTodoTaskEntity.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], LifeTodoTaskEntity.prototype, "description_markdown", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], LifeTodoTaskEntity.prototype, "due_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'medium' }),
    __metadata("design:type", String)
], LifeTodoTaskEntity.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], LifeTodoTaskEntity.prototype, "tags_json", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 0 }),
    __metadata("design:type", Boolean)
], LifeTodoTaskEntity.prototype, "is_daily", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'none' }),
    __metadata("design:type", String)
], LifeTodoTaskEntity.prototype, "recurrence_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], LifeTodoTaskEntity.prototype, "recurrence_config", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', width: 1, default: 0 }),
    __metadata("design:type", Boolean)
], LifeTodoTaskEntity.prototype, "completed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], LifeTodoTaskEntity.prototype, "completed_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], LifeTodoTaskEntity.prototype, "last_completed_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], LifeTodoTaskEntity.prototype, "trashed_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], LifeTodoTaskEntity.prototype, "sort_order", void 0);
exports.LifeTodoTaskEntity = LifeTodoTaskEntity = __decorate([
    (0, typeorm_1.Entity)('life_todo_task')
], LifeTodoTaskEntity);
