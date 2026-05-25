import { DataSource } from 'typeorm';

import { env } from '../config/env';
import { FinanceLoanBillEntity } from '../modules/finance/entities/finance-loan-bill.entity';
import { FinanceLoanPlatformEntity } from '../modules/finance/entities/finance-loan-platform.entity';
import { FinanceLoanRepaymentEntity } from '../modules/finance/entities/finance-loan-repayment.entity';
import { FinanceLoanSettingEntity } from '../modules/finance/entities/finance-loan-setting.entity';
import { FinanceRentChannelEntity } from '../modules/finance/entities/finance-rent-channel.entity';
import { FinanceRentRecordEntity } from '../modules/finance/entities/finance-rent-record.entity';
import { FinanceRentSettingEntity } from '../modules/finance/entities/finance-rent-setting.entity';
import { FinanceShoppingImportBatchEntity } from '../modules/finance/entities/finance-shopping-import-batch.entity';
import { FinanceShoppingLedgerEntity } from '../modules/finance/entities/finance-shopping-ledger.entity';
import { FinanceShoppingPlatformEntity } from '../modules/finance/entities/finance-shopping-platform.entity';
import { FinanceShoppingRecordEntity } from '../modules/finance/entities/finance-shopping-record.entity';
import { FinanceShoppingSettingEntity } from '../modules/finance/entities/finance-shopping-setting.entity';
import { FinanceSubscriptionCategoryEntity } from '../modules/finance/entities/finance-subscription-category.entity';
import { FinanceSubscriptionRecordEntity } from '../modules/finance/entities/finance-subscription-record.entity';
import { FinanceSubscriptionSettingEntity } from '../modules/finance/entities/finance-subscription-setting.entity';
import { FinanceTravelBookEntity } from '../modules/finance/entities/finance-travel-book.entity';
import { FinanceTravelExpenseRecordEntity } from '../modules/finance/entities/finance-travel-expense-record.entity';
import { FinanceTravelImportBatchEntity } from '../modules/finance/entities/finance-travel-import-batch.entity';
import { FinanceTravelPayChannelEntity } from '../modules/finance/entities/finance-travel-pay-channel.entity';
import { FinanceTravelSettingEntity } from '../modules/finance/entities/finance-travel-setting.entity';
import { HealthCheckupRecordEntity } from '../modules/health/entities/health-checkup-record.entity';
import { HealthCheckupSettingEntity } from '../modules/health/entities/health-checkup-setting.entity';
import { HealthCheckupTemplateEntity } from '../modules/health/entities/health-checkup-template.entity';
import { HealthCheckupTemplateItemEntity } from '../modules/health/entities/health-checkup-template-item.entity';
import { HealthFitnessDietRecordEntity } from '../modules/health/entities/health-fitness-diet-record.entity';
import { HealthFitnessExerciseRecordEntity } from '../modules/health/entities/health-fitness-exercise-record.entity';
import { HealthFitnessSettingEntity } from '../modules/health/entities/health-fitness-setting.entity';
import { HealthFitnessShoppingRecordEntity } from '../modules/health/entities/health-fitness-shopping-record.entity';
import { HealthFitnessWeightRecordEntity } from '../modules/health/entities/health-fitness-weight-record.entity';
import { HealthMedicationPurchaseEntity } from '../modules/health/entities/health-medication-purchase.entity';
import { HealthMedicationRecordEntity } from '../modules/health/entities/health-medication-record.entity';
import { HealthMedicationSettingEntity } from '../modules/health/entities/health-medication-setting.entity';
import { HealthMedicationSummaryEntity } from '../modules/health/entities/health-medication-summary.entity';
import { HealthMedicationThresholdEntity } from '../modules/health/entities/health-medication-threshold.entity';
import { HealthStepRecordEntity } from '../modules/health/entities/health-step-record.entity';
import { HealthStepSettingEntity } from '../modules/health/entities/health-step-setting.entity';
import { InvestmentForexCapitalFlowEntity } from '../modules/investment/entities/investment-forex-capital-flow.entity';
import { InvestmentForexImportBatchEntity } from '../modules/investment/entities/investment-forex-import-batch.entity';
import { InvestmentForexSettingEntity } from '../modules/investment/entities/investment-forex-setting.entity';
import { InvestmentForexTradeRecordEntity } from '../modules/investment/entities/investment-forex-trade-record.entity';
import { LifeCardBillImportBatchEntity } from '../modules/life/entities/life-card-bill-import-batch.entity';
import { LifeCardBillRecordEntity } from '../modules/life/entities/life-card-bill-record.entity';
import { LifeCardCarrierEntity } from '../modules/life/entities/life-card-carrier.entity';
import { LifeCardRechargeRecordEntity } from '../modules/life/entities/life-card-recharge-record.entity';
import { LifeCardRecordEntity } from '../modules/life/entities/life-card-record.entity';
import { LifeCardSettingEntity } from '../modules/life/entities/life-card-setting.entity';
import { LifeStorageItemEntity } from '../modules/life/entities/life-storage-item.entity';
import { LifeStorageSettingEntity } from '../modules/life/entities/life-storage-setting.entity';
import { LifeTodoSettingEntity } from '../modules/life/entities/life-todo-setting.entity';
import { LifeTodoTaskEntity } from '../modules/life/entities/life-todo-task.entity';
import { NotificationCenterChannelEntity } from '../modules/notifications/entities/notification-center-channel.entity';
import { NotificationCenterLogEntity } from '../modules/notifications/entities/notification-center-log.entity';
import { NotificationCenterSceneChannelEntity } from '../modules/notifications/entities/notification-center-scene-channel.entity';
import { NotificationCenterSceneEntity } from '../modules/notifications/entities/notification-center-scene.entity';
import { NotificationCenterTemplateEntity } from '../modules/notifications/entities/notification-center-template.entity';
import { SystemAuthSessionEntity } from '../modules/system/entities/system-auth-session.entity';
import { SystemUserAccountEntity } from '../modules/system/entities/system-user-account.entity';
import { SystemUserProfileEntity } from '../modules/system/entities/system-user-profile.entity';

export const appDataSource = new DataSource({
  type: 'mysql',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
  synchronize: env.DB_SYNCHRONIZE,
  migrations: ['dist/db/migrations/*.js'],
  entities: [
    SystemUserAccountEntity,
    SystemUserProfileEntity,
    SystemAuthSessionEntity,
    NotificationCenterChannelEntity,
    NotificationCenterSceneEntity,
    NotificationCenterTemplateEntity,
    NotificationCenterLogEntity,
    NotificationCenterSceneChannelEntity,
    HealthStepRecordEntity,
    HealthStepSettingEntity,
    HealthFitnessDietRecordEntity,
    HealthFitnessExerciseRecordEntity,
    HealthFitnessShoppingRecordEntity,
    HealthFitnessWeightRecordEntity,
    HealthFitnessSettingEntity,
    HealthCheckupRecordEntity,
    HealthCheckupTemplateEntity,
    HealthCheckupTemplateItemEntity,
    HealthCheckupSettingEntity,
    HealthMedicationRecordEntity,
    HealthMedicationPurchaseEntity,
    HealthMedicationSummaryEntity,
    HealthMedicationSettingEntity,
    HealthMedicationThresholdEntity,
    FinanceShoppingRecordEntity,
    FinanceShoppingLedgerEntity,
    FinanceShoppingPlatformEntity,
    FinanceShoppingSettingEntity,
    FinanceShoppingImportBatchEntity,
    FinanceTravelBookEntity,
    FinanceTravelExpenseRecordEntity,
    FinanceTravelPayChannelEntity,
    FinanceTravelSettingEntity,
    FinanceTravelImportBatchEntity,
    FinanceLoanPlatformEntity,
    FinanceLoanBillEntity,
    FinanceLoanRepaymentEntity,
    FinanceLoanSettingEntity,
    FinanceSubscriptionRecordEntity,
    FinanceSubscriptionCategoryEntity,
    FinanceSubscriptionSettingEntity,
    FinanceRentRecordEntity,
    FinanceRentChannelEntity,
    FinanceRentSettingEntity,
    LifeTodoTaskEntity,
    LifeTodoSettingEntity,
    LifeCardRecordEntity,
    LifeCardBillRecordEntity,
    LifeCardRechargeRecordEntity,
    LifeCardCarrierEntity,
    LifeCardSettingEntity,
    LifeCardBillImportBatchEntity,
    LifeStorageItemEntity,
    LifeStorageSettingEntity,
    InvestmentForexTradeRecordEntity,
    InvestmentForexCapitalFlowEntity,
    InvestmentForexSettingEntity,
    InvestmentForexImportBatchEntity,
  ],
});
