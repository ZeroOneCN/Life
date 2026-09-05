import { Router } from 'express';
import { ZipArchive, Archiver } from 'archiver';
import { appDataSource } from '../../db/data-source';
import { requireJwtAuth, AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { asyncHandler } from '../../shared/http/async-handler';
import { AppError } from '../../shared/errors/app-error';

/**
 * 模块数据导出配置
 * 每个模块包含多个实体（数据表）
 */
export interface ExportModuleConfig {
  moduleName: string;
  entities: Array<{
    fileName: string;
    entity: any;
  }>;
}

/**
 * 所有可导出的模块配置
 * 按照项目模块组织
 */
const exportModules: ExportModuleConfig[] = [
  {
    moduleName: 'finance',
    entities: [
      { fileName: 'rent-records', entity: require('../finance/entities/finance-rent-record.entity').FinanceRentRecordEntity },
      { fileName: 'rent-utility-bills', entity: require('../finance/entities/finance-rent-utility-bill.entity').FinanceRentUtilityBillEntity },
      { fileName: 'rent-channels', entity: require('../finance/entities/finance-rent-channel.entity').FinanceRentChannelEntity },
      { fileName: 'rent-setting', entity: require('../finance/entities/finance-rent-setting.entity').FinanceRentSettingEntity },
      { fileName: 'loan-bills', entity: require('../finance/entities/finance-loan-bill.entity').FinanceLoanBillEntity },
      { fileName: 'loan-platforms', entity: require('../finance/entities/finance-loan-platform.entity').FinanceLoanPlatformEntity },
      { fileName: 'loan-repayments', entity: require('../finance/entities/finance-loan-repayment.entity').FinanceLoanRepaymentEntity },
      { fileName: 'loan-setting', entity: require('../finance/entities/finance-loan-setting.entity').FinanceLoanSettingEntity },
      { fileName: 'budgets', entity: require('../finance/entities/finance-budget.entity').FinanceBudgetEntity },
      { fileName: 'budget-categories', entity: require('../finance/entities/finance-budget-category.entity').FinanceBudgetCategoryEntity },
      { fileName: 'budget-history', entity: require('../finance/entities/finance-budget-history.entity').FinanceBudgetHistoryEntity },
      { fileName: 'goals', entity: require('../finance/entities/finance-goal.entity').FinanceGoalEntity },
      { fileName: 'goal-contributions', entity: require('../finance/entities/finance-goal-contribution.entity').FinanceGoalContributionEntity },
      { fileName: 'bill-reminder-settings', entity: require('../finance/entities/finance-bill-reminder-setting.entity').FinanceBillReminderSettingEntity },
      { fileName: 'shopping-records', entity: require('../finance/entities/finance-shopping-record.entity').FinanceShoppingRecordEntity },
      { fileName: 'shopping-ledger', entity: require('../finance/entities/finance-shopping-ledger.entity').FinanceShoppingLedgerEntity },
      { fileName: 'shopping-platforms', entity: require('../finance/entities/finance-shopping-platform.entity').FinanceShoppingPlatformEntity },
      { fileName: 'shopping-import-batches', entity: require('../finance/entities/finance-shopping-import-batch.entity').FinanceShoppingImportBatchEntity },
      { fileName: 'shopping-setting', entity: require('../finance/entities/finance-shopping-setting.entity').FinanceShoppingSettingEntity },
      { fileName: 'travel-books', entity: require('../finance/entities/finance-travel-book.entity').FinanceTravelBookEntity },
      { fileName: 'travel-expenses', entity: require('../finance/entities/finance-travel-expense-record.entity').FinanceTravelExpenseRecordEntity },
      { fileName: 'travel-pay-channels', entity: require('../finance/entities/finance-travel-pay-channel.entity').FinanceTravelPayChannelEntity },
      { fileName: 'travel-import-batches', entity: require('../finance/entities/finance-travel-import-batch.entity').FinanceTravelImportBatchEntity },
      { fileName: 'travel-setting', entity: require('../finance/entities/finance-travel-setting.entity').FinanceTravelSettingEntity },
      { fileName: 'subscription-records', entity: require('../finance/entities/finance-subscription-record.entity').FinanceSubscriptionRecordEntity },
      { fileName: 'subscription-categories', entity: require('../finance/entities/finance-subscription-category.entity').FinanceSubscriptionCategoryEntity },
      { fileName: 'subscription-setting', entity: require('../finance/entities/finance-subscription-setting.entity').FinanceSubscriptionSettingEntity },
    ],
  },
  {
    moduleName: 'health',
    entities: [
      { fileName: 'step-records', entity: require('../health/entities/health-step-record.entity').HealthStepRecordEntity },
      { fileName: 'step-setting', entity: require('../health/entities/health-step-setting.entity').HealthStepSettingEntity },
      { fileName: 'fitness-weight-records', entity: require('../health/entities/health-fitness-weight-record.entity').HealthFitnessWeightRecordEntity },
      { fileName: 'fitness-exercise-records', entity: require('../health/entities/health-fitness-exercise-record.entity').HealthFitnessExerciseRecordEntity },
      { fileName: 'fitness-diet-records', entity: require('../health/entities/health-fitness-diet-record.entity').HealthFitnessDietRecordEntity },
      { fileName: 'fitness-shopping-records', entity: require('../health/entities/health-fitness-shopping-record.entity').HealthFitnessShoppingRecordEntity },
      { fileName: 'fitness-setting', entity: require('../health/entities/health-fitness-setting.entity').HealthFitnessSettingEntity },
      { fileName: 'sleep-records', entity: require('../health/entities/health-sleep-record.entity').HealthSleepRecordEntity },
      { fileName: 'vital-records', entity: require('../health/entities/health-vital-record.entity').HealthVitalRecordEntity },
      { fileName: 'checkup-records', entity: require('../health/entities/health-checkup-record.entity').HealthCheckupRecordEntity },
      { fileName: 'checkup-templates', entity: require('../health/entities/health-checkup-template.entity').HealthCheckupTemplateEntity },
      { fileName: 'checkup-template-items', entity: require('../health/entities/health-checkup-template-item.entity').HealthCheckupTemplateItemEntity },
      { fileName: 'checkup-setting', entity: require('../health/entities/health-checkup-setting.entity').HealthCheckupSettingEntity },
      { fileName: 'medication-records', entity: require('../health/entities/health-medication-record.entity').HealthMedicationRecordEntity },
      { fileName: 'medication-purchases', entity: require('../health/entities/health-medication-purchase.entity').HealthMedicationPurchaseEntity },
      { fileName: 'medication-summary', entity: require('../health/entities/health-medication-summary.entity').HealthMedicationSummaryEntity },
      { fileName: 'medication-thresholds', entity: require('../health/entities/health-medication-threshold.entity').HealthMedicationThresholdEntity },
      { fileName: 'medication-setting', entity: require('../health/entities/health-medication-setting.entity').HealthMedicationSettingEntity },
      { fileName: 'food-nutrition-cache', entity: require('../health/entities/health-food-nutrition-cache.entity').HealthFoodNutritionCacheEntity },
      { fileName: 'exercise-calorie-cache', entity: require('../health/entities/health-exercise-calorie-cache.entity').HealthExerciseCalorieCacheEntity },
    ],
  },
  {
    moduleName: 'life',
    entities: [
      { fileName: 'card-records', entity: require('../life/entities/life-card-record.entity').LifeCardRecordEntity },
      { fileName: 'card-bills', entity: require('../life/entities/life-card-bill-record.entity').LifeCardBillRecordEntity },
      { fileName: 'card-carriers', entity: require('../life/entities/life-card-carrier.entity').LifeCardCarrierEntity },
      { fileName: 'card-recharges', entity: require('../life/entities/life-card-recharge-record.entity').LifeCardRechargeRecordEntity },
      { fileName: 'card-import-batches', entity: require('../life/entities/life-card-bill-import-batch.entity').LifeCardBillImportBatchEntity },
      { fileName: 'card-setting', entity: require('../life/entities/life-card-setting.entity').LifeCardSettingEntity },
      { fileName: 'schedule-events', entity: require('../life/entities/life-schedule-event.entity').LifeScheduleEventEntity },
      { fileName: 'schedule-setting', entity: require('../life/entities/life-schedule-setting.entity').LifeScheduleSettingEntity },
      { fileName: 'storage-items', entity: require('../life/entities/life-storage-item.entity').LifeStorageItemEntity },
      { fileName: 'storage-setting', entity: require('../life/entities/life-storage-setting.entity').LifeStorageSettingEntity },
      { fileName: 'todo-tasks', entity: require('../life/entities/life-todo-task.entity').LifeTodoTaskEntity },
      { fileName: 'todo-setting', entity: require('../life/entities/life-todo-setting.entity').LifeTodoSettingEntity },
    ],
  },
  {
    moduleName: 'notifications',
    entities: [
      { fileName: 'notification-templates', entity: require('../notifications/entities/notification-center-template.entity').NotificationCenterTemplateEntity },
      { fileName: 'notification-scenes', entity: require('../notifications/entities/notification-center-scene.entity').NotificationCenterSceneEntity },
      { fileName: 'notification-channels', entity: require('../notifications/entities/notification-center-channel.entity').NotificationCenterChannelEntity },
      { fileName: 'notification-scene-channels', entity: require('../notifications/entities/notification-center-scene-channel.entity').NotificationCenterSceneChannelEntity },
      { fileName: 'notification-logs', entity: require('../notifications/entities/notification-center-log.entity').NotificationCenterLogEntity },
    ],
  },
  {
    moduleName: 'system',
    entities: [
      { fileName: 'audit-logs', entity: require('./entities/system-audit-log.entity').SystemAuditLogEntity },
      { fileName: 'assistant-usage-logs', entity: require('./entities/system-assistant-usage-log.entity').SystemAssistantUsageLogEntity },
      { fileName: 'users', entity: require('./entities/system-user-account.entity').SystemUserAccountEntity },
      { fileName: 'user-profiles', entity: require('./entities/system-user-profile.entity').SystemUserProfileEntity },
      { fileName: 'auth-sessions', entity: require('./entities/system-auth-session.entity').SystemAuthSessionEntity },
    ],
  },
  {
    moduleName: 'investment',
    entities: [
      { fileName: 'forex-trade-records', entity: require('../investment/entities/investment-forex-trade-record.entity').InvestmentForexTradeRecordEntity },
      { fileName: 'forex-capital-flows', entity: require('../investment/entities/investment-forex-capital-flow.entity').InvestmentForexCapitalFlowEntity },
      { fileName: 'forex-import-batches', entity: require('../investment/entities/investment-forex-import-batch.entity').InvestmentForexImportBatchEntity },
      { fileName: 'forex-setting', entity: require('../investment/entities/investment-forex-setting.entity').InvestmentForexSettingEntity },
    ],
  },
];

/**
 * 将对象数组转换为 CSV 格式字符串
 * 扁平化处理嵌套对象，支持中文（含 BOM 头），自动转义特殊字符
 * @param data 对象数组
 * @param columns 可选的列名列表，不传则从第一个对象的 key 自动提取
 * @returns UTF-8 BOM 编码的 CSV 字符串
 */
function convertToCsv(data: Record<string, any>[], columns?: string[]): string {
  if (!data || data.length === 0) {
    // 空数据只返回表头
    const headers = columns ?? [];
    return '\uFEFF' + headers.map(escapeCsvField).join(',') + '\n';
  }

  // 确定列名
  const headers = columns ?? Object.keys(data[0]);

  // 构建 CSV 行
  const rows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];
        return escapeCsvField(formatCsvValue(value));
      })
      .join(',');
  });

  // UTF-8 BOM + 表头 + 数据行
  return '\uFEFF' + headers.map(escapeCsvField).join(',') + '\n' + rows.join('\n') + '\n';
}

/**
 * 格式化 CSV 字段值
 * 将各种类型转为字符串，嵌套对象/数组序列化为 JSON
 */
function formatCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    // Date 类型转为 ISO 字符串
    if (value instanceof Date) {
      return value.toISOString().slice(0, 19).replace('T', ' ');
    }
    // 数组或对象序列化为 JSON
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * 转义 CSV 字段（处理逗号、引号、换行符）
 */
function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

/**
 * 获取所有可导出的模块信息
 * 返回模块名称和每个模块下的实体列表
 */
export function getExportableModules() {
  return exportModules.map(module => ({
    moduleName: module.moduleName,
    entities: module.entities.map(e => e.fileName),
    totalEntities: module.entities.length,
  }));
}

/**
 * 创建数据导出路由
 * 支持局域网访问，一键导出所有选中模块的数据为 ZIP 包
 * 每个模块一个目录，每个数据表一个 JSON 文件
 */
export function createExportRouter() {
  const router = Router();

  // GET: 获取所有可导出的模块列表
  router.get('/modules', requireJwtAuth, asyncHandler(async (_req, res) => {
    const modules = getExportableModules();
    const totalEntities = modules.reduce((sum, m) => sum + m.totalEntities, 0);
    res.json({
      code: 0,
      message: 'ok',
      data: {
        modules,
        totalEntities,
      },
    });
  }));

  // POST: 导出选中模块的数据为 ZIP 包
  router.post('/export', requireJwtAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { modules: selectedModules, format = 'json' } = req.body;

    if (!selectedModules || !Array.isArray(selectedModules) || selectedModules.length === 0) {
      throw new AppError('请选择至少一个要导出的模块', 400);
    }

    if (format !== 'json' && format !== 'csv') {
      throw new AppError('不支持的导出格式，仅支持 json 或 csv', 400);
    }

    // 验证选择的模块是否存在
    const validModules = exportModules.filter(m => selectedModules.includes(m.moduleName));
    if (validModules.length === 0) {
      throw new AppError('选择的模块不存在', 400);
    }

    // 设置响应头
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `lifeos-export-${timestamp}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // 创建 ZIP 压缩包
    const archive = new ZipArchive({
      zlib: { level: 9 }, // 最高压缩率
    });

    // 将压缩流 pipe 到响应
    archive.pipe(res);

    // 遍历每个选中的模块
    for (const moduleConfig of validModules) {
      // 遍历模块中的每个实体
      for (const entityConfig of moduleConfig.entities) {
        const repository = appDataSource.getRepository(entityConfig.entity);
        // 查询该实体的所有数据（不分页，全量导出）
        const allData = await repository.find();

        const fileExtension = format === 'csv' ? '.csv' : '.json';
        let fileContent: string;

        if (format === 'csv') {
          const plainData = allData.map((record) => {
            // 扁平化：只保留顶层基础属性，排除函数和原型链
            const plain: Record<string, any> = {};
            for (const key of Object.keys(record)) {
              plain[key] = (record as any)[key];
            }
            return plain;
          });
          fileContent = convertToCsv(plainData);
        } else {
          // 格式化 JSON，添加缩进便于阅读
          fileContent = JSON.stringify(allData, null, 2);
        }

        // 添加到 ZIP 包中：模块名/文件名.json/csv
        archive.append(fileContent, {
          name: `${moduleConfig.moduleName}/${entityConfig.fileName}${fileExtension}`,
        });
      }
    }

    // 添加元数据文件
    const metadata = {
      exportTime: new Date().toISOString(),
      exportedBy: req.auth?.userId,
      exportedModules: validModules.map(m => m.moduleName),
      totalEntities: validModules.reduce((sum, m) => sum + m.entities.length, 0),
      version: '1.0',
      format: `${format}-per-table`,
      description: format === 'csv'
        ? 'LifeOS 全量数据导出，每个数据表一个 CSV 文件，可直接用 Excel 打开'
        : 'LifeOS 全量数据导出，每个数据表一个 JSON 文件，便于数据迁移',
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

    // 完成打包
    await archive.finalize();
  }));

  return router;
}
