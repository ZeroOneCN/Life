"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appDataSource = void 0;
const typeorm_1 = require("typeorm");
const env_1 = require("../config/env");
const finance_loan_bill_entity_1 = require("../modules/finance/entities/finance-loan-bill.entity");
const finance_loan_platform_entity_1 = require("../modules/finance/entities/finance-loan-platform.entity");
const finance_loan_repayment_entity_1 = require("../modules/finance/entities/finance-loan-repayment.entity");
const finance_loan_setting_entity_1 = require("../modules/finance/entities/finance-loan-setting.entity");
const finance_rent_channel_entity_1 = require("../modules/finance/entities/finance-rent-channel.entity");
const finance_rent_record_entity_1 = require("../modules/finance/entities/finance-rent-record.entity");
const finance_rent_setting_entity_1 = require("../modules/finance/entities/finance-rent-setting.entity");
const finance_shopping_import_batch_entity_1 = require("../modules/finance/entities/finance-shopping-import-batch.entity");
const finance_shopping_ledger_entity_1 = require("../modules/finance/entities/finance-shopping-ledger.entity");
const finance_shopping_platform_entity_1 = require("../modules/finance/entities/finance-shopping-platform.entity");
const finance_shopping_record_entity_1 = require("../modules/finance/entities/finance-shopping-record.entity");
const finance_shopping_setting_entity_1 = require("../modules/finance/entities/finance-shopping-setting.entity");
const finance_subscription_category_entity_1 = require("../modules/finance/entities/finance-subscription-category.entity");
const finance_subscription_record_entity_1 = require("../modules/finance/entities/finance-subscription-record.entity");
const finance_subscription_setting_entity_1 = require("../modules/finance/entities/finance-subscription-setting.entity");
const finance_travel_book_entity_1 = require("../modules/finance/entities/finance-travel-book.entity");
const finance_travel_expense_record_entity_1 = require("../modules/finance/entities/finance-travel-expense-record.entity");
const finance_travel_import_batch_entity_1 = require("../modules/finance/entities/finance-travel-import-batch.entity");
const finance_travel_pay_channel_entity_1 = require("../modules/finance/entities/finance-travel-pay-channel.entity");
const finance_travel_setting_entity_1 = require("../modules/finance/entities/finance-travel-setting.entity");
const health_checkup_record_entity_1 = require("../modules/health/entities/health-checkup-record.entity");
const health_checkup_setting_entity_1 = require("../modules/health/entities/health-checkup-setting.entity");
const health_checkup_template_entity_1 = require("../modules/health/entities/health-checkup-template.entity");
const health_checkup_template_item_entity_1 = require("../modules/health/entities/health-checkup-template-item.entity");
const health_fitness_diet_record_entity_1 = require("../modules/health/entities/health-fitness-diet-record.entity");
const health_fitness_exercise_record_entity_1 = require("../modules/health/entities/health-fitness-exercise-record.entity");
const health_fitness_setting_entity_1 = require("../modules/health/entities/health-fitness-setting.entity");
const health_fitness_shopping_record_entity_1 = require("../modules/health/entities/health-fitness-shopping-record.entity");
const health_fitness_weight_record_entity_1 = require("../modules/health/entities/health-fitness-weight-record.entity");
const health_medication_purchase_entity_1 = require("../modules/health/entities/health-medication-purchase.entity");
const health_medication_record_entity_1 = require("../modules/health/entities/health-medication-record.entity");
const health_medication_setting_entity_1 = require("../modules/health/entities/health-medication-setting.entity");
const health_medication_summary_entity_1 = require("../modules/health/entities/health-medication-summary.entity");
const health_medication_threshold_entity_1 = require("../modules/health/entities/health-medication-threshold.entity");
const health_step_record_entity_1 = require("../modules/health/entities/health-step-record.entity");
const health_step_setting_entity_1 = require("../modules/health/entities/health-step-setting.entity");
const investment_forex_capital_flow_entity_1 = require("../modules/investment/entities/investment-forex-capital-flow.entity");
const investment_forex_import_batch_entity_1 = require("../modules/investment/entities/investment-forex-import-batch.entity");
const investment_forex_setting_entity_1 = require("../modules/investment/entities/investment-forex-setting.entity");
const investment_forex_trade_record_entity_1 = require("../modules/investment/entities/investment-forex-trade-record.entity");
const life_card_bill_import_batch_entity_1 = require("../modules/life/entities/life-card-bill-import-batch.entity");
const life_card_bill_record_entity_1 = require("../modules/life/entities/life-card-bill-record.entity");
const life_card_carrier_entity_1 = require("../modules/life/entities/life-card-carrier.entity");
const life_card_recharge_record_entity_1 = require("../modules/life/entities/life-card-recharge-record.entity");
const life_card_record_entity_1 = require("../modules/life/entities/life-card-record.entity");
const life_card_setting_entity_1 = require("../modules/life/entities/life-card-setting.entity");
const life_storage_item_entity_1 = require("../modules/life/entities/life-storage-item.entity");
const life_storage_setting_entity_1 = require("../modules/life/entities/life-storage-setting.entity");
const life_todo_setting_entity_1 = require("../modules/life/entities/life-todo-setting.entity");
const life_todo_task_entity_1 = require("../modules/life/entities/life-todo-task.entity");
const notification_center_channel_entity_1 = require("../modules/notifications/entities/notification-center-channel.entity");
const notification_center_log_entity_1 = require("../modules/notifications/entities/notification-center-log.entity");
const notification_center_scene_channel_entity_1 = require("../modules/notifications/entities/notification-center-scene-channel.entity");
const notification_center_scene_entity_1 = require("../modules/notifications/entities/notification-center-scene.entity");
const notification_center_template_entity_1 = require("../modules/notifications/entities/notification-center-template.entity");
const system_auth_session_entity_1 = require("../modules/system/entities/system-auth-session.entity");
const system_user_account_entity_1 = require("../modules/system/entities/system-user-account.entity");
const system_user_profile_entity_1 = require("../modules/system/entities/system-user-profile.entity");
exports.appDataSource = new typeorm_1.DataSource({
    type: 'mysql',
    host: env_1.env.DB_HOST,
    port: env_1.env.DB_PORT,
    username: env_1.env.DB_USERNAME,
    password: env_1.env.DB_PASSWORD,
    database: env_1.env.DB_DATABASE,
    synchronize: env_1.env.DB_SYNCHRONIZE,
    migrations: ['dist/db/migrations/*.js'],
    entities: [
        system_user_account_entity_1.SystemUserAccountEntity,
        system_user_profile_entity_1.SystemUserProfileEntity,
        system_auth_session_entity_1.SystemAuthSessionEntity,
        notification_center_channel_entity_1.NotificationCenterChannelEntity,
        notification_center_scene_entity_1.NotificationCenterSceneEntity,
        notification_center_template_entity_1.NotificationCenterTemplateEntity,
        notification_center_log_entity_1.NotificationCenterLogEntity,
        notification_center_scene_channel_entity_1.NotificationCenterSceneChannelEntity,
        health_step_record_entity_1.HealthStepRecordEntity,
        health_step_setting_entity_1.HealthStepSettingEntity,
        health_fitness_diet_record_entity_1.HealthFitnessDietRecordEntity,
        health_fitness_exercise_record_entity_1.HealthFitnessExerciseRecordEntity,
        health_fitness_shopping_record_entity_1.HealthFitnessShoppingRecordEntity,
        health_fitness_weight_record_entity_1.HealthFitnessWeightRecordEntity,
        health_fitness_setting_entity_1.HealthFitnessSettingEntity,
        health_checkup_record_entity_1.HealthCheckupRecordEntity,
        health_checkup_template_entity_1.HealthCheckupTemplateEntity,
        health_checkup_template_item_entity_1.HealthCheckupTemplateItemEntity,
        health_checkup_setting_entity_1.HealthCheckupSettingEntity,
        health_medication_record_entity_1.HealthMedicationRecordEntity,
        health_medication_purchase_entity_1.HealthMedicationPurchaseEntity,
        health_medication_summary_entity_1.HealthMedicationSummaryEntity,
        health_medication_setting_entity_1.HealthMedicationSettingEntity,
        health_medication_threshold_entity_1.HealthMedicationThresholdEntity,
        finance_shopping_record_entity_1.FinanceShoppingRecordEntity,
        finance_shopping_ledger_entity_1.FinanceShoppingLedgerEntity,
        finance_shopping_platform_entity_1.FinanceShoppingPlatformEntity,
        finance_shopping_setting_entity_1.FinanceShoppingSettingEntity,
        finance_shopping_import_batch_entity_1.FinanceShoppingImportBatchEntity,
        finance_travel_book_entity_1.FinanceTravelBookEntity,
        finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity,
        finance_travel_pay_channel_entity_1.FinanceTravelPayChannelEntity,
        finance_travel_setting_entity_1.FinanceTravelSettingEntity,
        finance_travel_import_batch_entity_1.FinanceTravelImportBatchEntity,
        finance_loan_platform_entity_1.FinanceLoanPlatformEntity,
        finance_loan_bill_entity_1.FinanceLoanBillEntity,
        finance_loan_repayment_entity_1.FinanceLoanRepaymentEntity,
        finance_loan_setting_entity_1.FinanceLoanSettingEntity,
        finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity,
        finance_subscription_category_entity_1.FinanceSubscriptionCategoryEntity,
        finance_subscription_setting_entity_1.FinanceSubscriptionSettingEntity,
        finance_rent_record_entity_1.FinanceRentRecordEntity,
        finance_rent_channel_entity_1.FinanceRentChannelEntity,
        finance_rent_setting_entity_1.FinanceRentSettingEntity,
        life_todo_task_entity_1.LifeTodoTaskEntity,
        life_todo_setting_entity_1.LifeTodoSettingEntity,
        life_card_record_entity_1.LifeCardRecordEntity,
        life_card_bill_record_entity_1.LifeCardBillRecordEntity,
        life_card_recharge_record_entity_1.LifeCardRechargeRecordEntity,
        life_card_carrier_entity_1.LifeCardCarrierEntity,
        life_card_setting_entity_1.LifeCardSettingEntity,
        life_card_bill_import_batch_entity_1.LifeCardBillImportBatchEntity,
        life_storage_item_entity_1.LifeStorageItemEntity,
        life_storage_setting_entity_1.LifeStorageSettingEntity,
        investment_forex_trade_record_entity_1.InvestmentForexTradeRecordEntity,
        investment_forex_capital_flow_entity_1.InvestmentForexCapitalFlowEntity,
        investment_forex_setting_entity_1.InvestmentForexSettingEntity,
        investment_forex_import_batch_entity_1.InvestmentForexImportBatchEntity,
    ],
});
