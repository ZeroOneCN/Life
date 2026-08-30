/**
 * Swagger/OpenAPI 文档配置。
 * 访问地址：http://localhost:3100/api-docs
 */
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LifeOS2 API',
      version: '0.1.0',
      description: 'LifeOS2 全栈个人生活管理系统 API 文档',
    },
    servers: [
      { url: '/api', description: 'API 基础路径' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ApiSuccessResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 0 },
            message: { type: 'string', example: 'ok' },
            data: { type: 'object' },
          },
        },
        ApiErrorResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 400 },
            message: { type: 'string', example: '参数错误' },
            data: { type: 'object', nullable: true },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/modules/**/*.router.ts'],
};

export function setupSwagger(app: Express) {
  const swaggerSpec = swaggerJsdoc(options);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'LifeOS2 API 文档',
  }));
}