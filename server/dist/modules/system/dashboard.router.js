"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDashboardRouter = createDashboardRouter;
const express_1 = require("express");
const dayjs_1 = __importDefault(require("dayjs"));
const data_source_1 = require("../../db/data-source");
const async_handler_1 = require("../../shared/http/async-handler");
const request_1 = require("../../shared/http/request");
const response_1 = require("../../shared/http/response");
const finance_loan_bill_entity_1 = require("../finance/entities/finance-loan-bill.entity");
const finance_subscription_record_entity_1 = require("../finance/entities/finance-subscription-record.entity");
const health_checkup_record_entity_1 = require("../health/entities/health-checkup-record.entity");
const health_fitness_diet_record_entity_1 = require("../health/entities/health-fitness-diet-record.entity");
const health_fitness_exercise_record_entity_1 = require("../health/entities/health-fitness-exercise-record.entity");
const health_fitness_weight_record_entity_1 = require("../health/entities/health-fitness-weight-record.entity");
const health_medication_purchase_entity_1 = require("../health/entities/health-medication-purchase.entity");
const health_medication_record_entity_1 = require("../health/entities/health-medication-record.entity");
const health_medication_threshold_entity_1 = require("../health/entities/health-medication-threshold.entity");
const health_step_record_entity_1 = require("../health/entities/health-step-record.entity");
const investment_forex_capital_flow_entity_1 = require("../investment/entities/investment-forex-capital-flow.entity");
const investment_forex_trade_record_entity_1 = require("../investment/entities/investment-forex-trade-record.entity");
const life_card_record_entity_1 = require("../life/entities/life-card-record.entity");
const life_storage_item_entity_1 = require("../life/entities/life-storage-item.entity");
const life_todo_task_entity_1 = require("../life/entities/life-todo-task.entity");
const notification_center_channel_entity_1 = require("../notifications/entities/notification-center-channel.entity");
const notification_center_log_entity_1 = require("../notifications/entities/notification-center-log.entity");
const notification_center_scene_entity_1 = require("../notifications/entities/notification-center-scene.entity");
function calculateMedicationLowStockCount(records, purchases, thresholds, defaultThreshold = 3) {
    const usedMap = new Map();
    const purchasedMap = new Map();
    const thresholdMap = new Map(thresholds.map((item) => [item.medicine_name, Number(item.threshold)]));
    records.forEach((record) => {
        usedMap.set(record.medicine_name, (usedMap.get(record.medicine_name) ?? 0) + Number(record.breakfast) + Number(record.lunch) + Number(record.dinner));
    });
    purchases.forEach((purchase) => {
        purchasedMap.set(purchase.medicine_name, (purchasedMap.get(purchase.medicine_name) ?? 0) + Number(purchase.quantity));
    });
    return Array.from(new Set([...usedMap.keys(), ...purchasedMap.keys()]))
        .filter((name) => {
        const remaining = (purchasedMap.get(name) ?? 0) - (usedMap.get(name) ?? 0);
        return remaining <= (thresholdMap.get(name) ?? defaultThreshold);
    }).length;
}
function buildForexSummary(trades, capitalFlows) {
    const grossPnl = trades.reduce((sum, item) => sum + Number(item.pnl), 0);
    const totalCommission = trades.reduce((sum, item) => sum + Number(item.commission), 0);
    const realizedNetPnl = grossPnl + totalCommission;
    const deposits = capitalFlows.filter((item) => item.flow_type === 'deposit').reduce((sum, item) => sum + Number(item.amount), 0);
    const withdrawals = capitalFlows.filter((item) => item.flow_type === 'withdrawal').reduce((sum, item) => sum + Number(item.amount), 0);
    const winners = trades.filter((item) => Number(item.pnl) > 0).length;
    return {
        netPnl: Number(realizedNetPnl.toFixed(2)),
        winRate: trades.length ? winners / trades.length : 0,
        activeTradeCount: trades.length,
        netCapital: Number((deposits - withdrawals).toFixed(2)),
    };
}
function buildAgendaItems(input) {
    const today = (0, dayjs_1.default)().startOf('day');
    const agenda = [];
    input.todos
        .filter((task) => !task.completed && !task.trashed_at)
        .forEach((task) => {
        const targetDate = task.due_date ?? '';
        const due = targetDate ? (0, dayjs_1.default)(targetDate).startOf('day') : null;
        let severity = task.priority === 'high' ? 'high' : task.priority === 'medium' ? 'medium' : 'low';
        if (due && due.isBefore(today)) {
            severity = 'high';
        }
        agenda.push({
            id: `todo-${task.id}`,
            module: 'todo',
            title: task.title,
            summary: task.description_markdown || '待处理任务',
            severity,
            targetDate,
            href: '/life/todo?todoTab=tasks',
        });
    });
    input.subscriptions.forEach((record) => {
        const diff = (0, dayjs_1.default)(record.end_date).startOf('day').diff(today, 'day');
        if (diff <= 7) {
            agenda.push({
                id: `subscription-${record.id}`,
                module: 'subscription',
                title: record.service_name,
                summary: diff < 0 ? '订阅已逾期，请尽快处理。' : '订阅即将到期，请关注续费。',
                severity: diff < 0 ? 'high' : diff === 0 ? 'high' : 'medium',
                targetDate: record.end_date,
                href: '/finance/subscription?subscriptionTab=records',
            });
        }
    });
    input.loans
        .filter((bill) => !bill.is_paid)
        .forEach((bill) => {
        const diff = (0, dayjs_1.default)(bill.due_date).startOf('day').diff(today, 'day');
        if (diff <= 7) {
            agenda.push({
                id: `loan-${bill.id}`,
                module: 'loan',
                title: bill.platform_name,
                summary: diff < 0 ? '贷款账单已逾期。' : '贷款账单临近还款日。',
                severity: diff < 0 ? 'high' : diff === 0 ? 'high' : 'medium',
                targetDate: bill.due_date,
                href: '/finance/loan?loanTab=bills',
            });
        }
    });
    input.cards
        .filter((card) => Number(card.balance) <= 10)
        .forEach((card) => {
        agenda.push({
            id: `card-${card.id}`,
            module: 'card',
            title: card.phone_number,
            summary: '号卡余额已低于提醒阈值。',
            severity: 'medium',
            targetDate: '',
            href: '/life/card?cardTab=cards',
        });
    });
    input.checkups
        .filter((record) => record.follow_up_date && (record.status === 'abnormal' || record.status === 'attention'))
        .forEach((record) => {
        const diff = (0, dayjs_1.default)(record.follow_up_date).startOf('day').diff(today, 'day');
        if (diff <= 7) {
            agenda.push({
                id: `checkup-${record.id}`,
                module: 'checkup',
                title: record.test_name,
                summary: diff < 0 ? '体检复查已逾期。' : '体检项目进入复查窗口。',
                severity: diff < 0 ? 'high' : 'medium',
                targetDate: record.follow_up_date ?? '',
                href: '/health/checkup',
            });
        }
    });
    const lowStockCount = calculateMedicationLowStockCount(input.medicationRecords, input.medicationPurchases, input.medicationThresholds);
    if (lowStockCount > 0) {
        agenda.push({
            id: 'medication-stock',
            module: 'medication',
            title: '药品库存提醒',
            summary: `当前有 ${lowStockCount} 种药品低于库存阈值。`,
            severity: 'medium',
            targetDate: '',
            href: '/health/medication',
        });
    }
    return agenda
        .sort((left, right) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        const severityDiff = severityOrder[left.severity] - severityOrder[right.severity];
        if (severityDiff !== 0) {
            return severityDiff;
        }
        const leftDate = left.targetDate ? (0, dayjs_1.default)(left.targetDate).valueOf() : Number.MAX_SAFE_INTEGER;
        const rightDate = right.targetDate ? (0, dayjs_1.default)(right.targetDate).valueOf() : Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate;
    })
        .slice(0, 20);
}
function createDashboardRouter() {
    const router = (0, express_1.Router)();
    router.get('/summary', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const [todos, subscriptions, loans, cards, storageItems, logs, scenes, channels, stepRecords, fitnessDietRecords, fitnessExerciseRecords, fitnessWeightRecords, medicationRecords, medicationPurchases, medicationThresholds, checkups, forexTrades, forexCapitalFlows,] = await Promise.all([
            data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(life_card_record_entity_1.LifeCardRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(life_storage_item_entity_1.LifeStorageItemEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(notification_center_log_entity_1.NotificationCenterLogEntity).find({ where: { user_id: userId }, order: { created_at: 'DESC' }, take: 8 }),
            data_source_1.appDataSource.getRepository(notification_center_scene_entity_1.NotificationCenterSceneEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(notification_center_channel_entity_1.NotificationCenterChannelEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_step_record_entity_1.HealthStepRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_fitness_diet_record_entity_1.HealthFitnessDietRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_fitness_exercise_record_entity_1.HealthFitnessExerciseRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_fitness_weight_record_entity_1.HealthFitnessWeightRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_record_entity_1.HealthMedicationRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_purchase_entity_1.HealthMedicationPurchaseEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_threshold_entity_1.HealthMedicationThresholdEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_checkup_record_entity_1.HealthCheckupRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(investment_forex_trade_record_entity_1.InvestmentForexTradeRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(investment_forex_capital_flow_entity_1.InvestmentForexCapitalFlowEntity).find({ where: { user_id: userId } }),
        ]);
        const pendingTodos = todos.filter((task) => !task.completed && !task.trashed_at).length;
        const dueTodayTodos = todos.filter((task) => !task.completed && !task.trashed_at && task.due_date && (0, dayjs_1.default)(task.due_date).isSame((0, dayjs_1.default)(), 'day')).length;
        const activeStorageCount = storageItems.filter((item) => item.status === 'active').length;
        const lowBalanceCards = cards.filter((card) => Number(card.balance) <= 10).length;
        const overdueLoans = loans.filter((bill) => !bill.is_paid && (0, dayjs_1.default)(bill.due_date).isBefore((0, dayjs_1.default)(), 'day')).length;
        const upcomingSubscriptions = subscriptions.filter((record) => {
            const diff = (0, dayjs_1.default)(record.end_date).startOf('day').diff((0, dayjs_1.default)().startOf('day'), 'day');
            return diff >= 0 && diff <= 7;
        }).length;
        const stepToday = stepRecords.filter((item) => (0, dayjs_1.default)(item.record_time).isSame((0, dayjs_1.default)(), 'day')).reduce((sum, item) => sum + item.steps, 0);
        const lowMedicationCount = calculateMedicationLowStockCount(medicationRecords, medicationPurchases, medicationThresholds);
        const dueCheckups = checkups.filter((record) => record.follow_up_date && (0, dayjs_1.default)(record.follow_up_date).diff((0, dayjs_1.default)(), 'day') <= 7).length;
        const forexSummary = buildForexSummary(forexTrades, forexCapitalFlows);
        const agenda = buildAgendaItems({
            todos,
            subscriptions,
            loans,
            cards,
            checkups,
            medicationRecords,
            medicationPurchases,
            medicationThresholds,
        });
        const financeMonthSpend = subscriptions.reduce((sum, item) => {
            if (item.billing_cycle === 'monthly')
                return sum + Number(item.cycle_price);
            if (item.billing_cycle === 'quarterly')
                return sum + (Number(item.cycle_price) / 3);
            if (item.billing_cycle === 'yearly')
                return sum + (Number(item.cycle_price) / 12);
            return sum;
        }, 0);
        response.json((0, response_1.successResponse)({
            overviewCards: [
                { key: 'modules', label: '已接入模块数', value: 17 },
                { key: 'scenes', label: '启用通知场景数', value: scenes.filter((scene) => scene.enabled).length },
                { key: 'logs', label: '最近通知日志数', value: logs.length },
                { key: 'agenda', label: '统一待处理总数', value: agenda.length },
                { key: 'health', label: '健康中心今日关注数', value: dueCheckups + lowMedicationCount + (stepToday > 0 ? 1 : 0) },
                { key: 'finance', label: '财务中心本月支出/待还摘要', value: Number((financeMonthSpend + loans.filter((bill) => !bill.is_paid).reduce((sum, item) => sum + Number(item.amount), 0)).toFixed(2)) },
                { key: 'life', label: '生活中心活跃事项数', value: pendingTodos + activeStorageCount + lowBalanceCards },
                { key: 'investment', label: '投资中心净收益摘要', value: forexSummary.netPnl },
            ],
            agenda,
            health: {
                title: '健康中心摘要',
                stats: {
                    todayStepCount: stepToday,
                    latestWeight: fitnessWeightRecords.sort((a, b) => (0, dayjs_1.default)(b.date).valueOf() - (0, dayjs_1.default)(a.date).valueOf())[0]?.weight ?? null,
                    todayCalorieNet: Number((fitnessDietRecords.filter((item) => item.date === (0, dayjs_1.default)().format('YYYY-MM-DD')).reduce((sum, item) => sum + Number(item.calories), 0)
                        - fitnessExerciseRecords.filter((item) => item.date === (0, dayjs_1.default)().format('YYYY-MM-DD')).reduce((sum, item) => sum + Number(item.calories), 0)).toFixed(1)),
                    checkupPendingCount: dueCheckups,
                    medicationLowStockCount: lowMedicationCount,
                },
                trend: Array.from({ length: 7 }, (_, index) => {
                    const date = (0, dayjs_1.default)().subtract(6 - index, 'day');
                    return {
                        date: date.format('YYYY-MM-DD'),
                        label: date.format('MM-DD'),
                        steps: stepRecords.filter((item) => (0, dayjs_1.default)(item.record_time).isSame(date, 'day')).reduce((sum, item) => sum + item.steps, 0),
                    };
                }),
            },
            finance: {
                title: '财务中心摘要',
                stats: {
                    upcomingSubscriptionCount: upcomingSubscriptions,
                    overdueLoanCount: overdueLoans,
                    activeSubscriptionCount: subscriptions.length,
                    totalUnpaidLoanAmount: Number(loans.filter((bill) => !bill.is_paid).reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2)),
                },
                trend: Array.from({ length: 6 }, (_, index) => {
                    const month = (0, dayjs_1.default)().subtract(5 - index, 'month').format('YYYY-MM');
                    return {
                        month,
                        label: (0, dayjs_1.default)(`${month}-01`).format('MM月'),
                        subscriptionCount: subscriptions.filter((item) => (0, dayjs_1.default)(item.end_date).format('YYYY-MM') === month).length,
                        loanAmount: Number(loans.filter((item) => item.billing_month === month).reduce((sum, bill) => sum + Number(bill.amount), 0).toFixed(2)),
                    };
                }),
            },
            life: {
                title: '生活中心摘要',
                stats: {
                    pendingTodoCount: pendingTodos,
                    dueTodayTodoCount: dueTodayTodos,
                    activeStorageCount,
                    lowBalanceCardCount: lowBalanceCards,
                },
                trend: [
                    { key: 'todo', label: '未完成待办', value: pendingTodos },
                    { key: 'storage', label: '使用中物品', value: activeStorageCount },
                    { key: 'card', label: '低余额号卡', value: lowBalanceCards },
                ],
            },
            investment: {
                title: '投资中心摘要',
                stats: {
                    netPnl: forexSummary.netPnl,
                    winRate: forexSummary.winRate,
                    netCapital: forexSummary.netCapital,
                    activeTradeCount: forexSummary.activeTradeCount,
                },
                trend: Array.from({ length: 7 }, (_, index) => {
                    const date = (0, dayjs_1.default)().subtract(6 - index, 'day').format('YYYY-MM-DD');
                    const scoped = forexTrades.filter((item) => item.trade_date === date);
                    return {
                        date,
                        label: (0, dayjs_1.default)(date).format('MM-DD'),
                        netPnl: Number(scoped.reduce((sum, item) => sum + Number(item.pnl) + Number(item.commission), 0).toFixed(2)),
                        tradeCount: scoped.length,
                    };
                }),
            },
            notifications: {
                enabledChannelCount: channels.filter((channel) => channel.enabled).length,
                enabledSceneCount: scenes.filter((scene) => scene.enabled).length,
                recentLogs: logs,
                hottestSceneId: logs[0]?.scene_id ?? '',
            },
        }));
    }));
    router.get('/agenda', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const [todos, subscriptions, loans, cards, checkups, medicationRecords, medicationPurchases, medicationThresholds,] = await Promise.all([
            data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(life_card_record_entity_1.LifeCardRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_checkup_record_entity_1.HealthCheckupRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_record_entity_1.HealthMedicationRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_purchase_entity_1.HealthMedicationPurchaseEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_threshold_entity_1.HealthMedicationThresholdEntity).find({ where: { user_id: userId } }),
        ]);
        response.json((0, response_1.successResponse)(buildAgendaItems({
            todos,
            subscriptions,
            loans,
            cards,
            checkups,
            medicationRecords,
            medicationPurchases,
            medicationThresholds,
        })));
    }));
    router.get('/health-snapshot', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const [stepRecords, weightRecords, dietRecords, exerciseRecords, checkups, medicationRecords, medicationPurchases, medicationThresholds] = await Promise.all([
            data_source_1.appDataSource.getRepository(health_step_record_entity_1.HealthStepRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_fitness_weight_record_entity_1.HealthFitnessWeightRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_fitness_diet_record_entity_1.HealthFitnessDietRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_fitness_exercise_record_entity_1.HealthFitnessExerciseRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_checkup_record_entity_1.HealthCheckupRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_record_entity_1.HealthMedicationRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_purchase_entity_1.HealthMedicationPurchaseEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_threshold_entity_1.HealthMedicationThresholdEntity).find({ where: { user_id: userId } }),
        ]);
        response.json((0, response_1.successResponse)({
            title: '健康中心摘要',
            stats: {
                todayStepCount: stepRecords.filter((item) => (0, dayjs_1.default)(item.record_time).isSame((0, dayjs_1.default)(), 'day')).reduce((sum, item) => sum + item.steps, 0),
                latestWeight: weightRecords.sort((a, b) => (0, dayjs_1.default)(b.date).valueOf() - (0, dayjs_1.default)(a.date).valueOf())[0]?.weight ?? null,
                todayCalorieNet: Number((dietRecords.filter((item) => item.date === (0, dayjs_1.default)().format('YYYY-MM-DD')).reduce((sum, item) => sum + Number(item.calories), 0)
                    - exerciseRecords.filter((item) => item.date === (0, dayjs_1.default)().format('YYYY-MM-DD')).reduce((sum, item) => sum + Number(item.calories), 0)).toFixed(1)),
                checkupPendingCount: checkups.filter((record) => record.follow_up_date && (0, dayjs_1.default)(record.follow_up_date).diff((0, dayjs_1.default)(), 'day') <= 7).length,
                medicationLowStockCount: calculateMedicationLowStockCount(medicationRecords, medicationPurchases, medicationThresholds),
            },
            trend: Array.from({ length: 7 }, (_, index) => {
                const date = (0, dayjs_1.default)().subtract(6 - index, 'day');
                return {
                    date: date.format('YYYY-MM-DD'),
                    label: date.format('MM-DD'),
                    steps: stepRecords.filter((item) => (0, dayjs_1.default)(item.record_time).isSame(date, 'day')).reduce((sum, item) => sum + item.steps, 0),
                };
            }),
        }));
    }));
    router.get('/finance-snapshot', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const [loans, subscriptions] = await Promise.all([
            data_source_1.appDataSource.getRepository(finance_loan_bill_entity_1.FinanceLoanBillEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity).find({ where: { user_id: userId } }),
        ]);
        response.json((0, response_1.successResponse)({
            title: '财务中心摘要',
            stats: {
                loanCount: loans.length,
                unpaidLoanAmount: Number(loans.filter((bill) => !bill.is_paid).reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2)),
                subscriptionCount: subscriptions.length,
            },
            trend: [],
        }));
    }));
    router.get('/life-snapshot', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const [todos, cards, storageItems] = await Promise.all([
            data_source_1.appDataSource.getRepository(life_todo_task_entity_1.LifeTodoTaskEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(life_card_record_entity_1.LifeCardRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(life_storage_item_entity_1.LifeStorageItemEntity).find({ where: { user_id: userId } }),
        ]);
        response.json((0, response_1.successResponse)({
            title: '生活中心摘要',
            stats: {
                pendingTodoCount: todos.filter((task) => !task.completed && !task.trashed_at).length,
                activeStorageCount: storageItems.filter((item) => item.status === 'active').length,
                lowBalanceCardCount: cards.filter((card) => Number(card.balance) <= 10).length,
            },
            trend: [],
        }));
    }));
    router.get('/investment-snapshot', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const [trades, capitalFlows] = await Promise.all([
            data_source_1.appDataSource.getRepository(investment_forex_trade_record_entity_1.InvestmentForexTradeRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(investment_forex_capital_flow_entity_1.InvestmentForexCapitalFlowEntity).find({ where: { user_id: userId } }),
        ]);
        const summary = buildForexSummary(trades, capitalFlows);
        response.json((0, response_1.successResponse)({
            title: '投资中心摘要',
            stats: summary,
            trend: Array.from({ length: 7 }, (_, index) => {
                const date = (0, dayjs_1.default)().subtract(6 - index, 'day').format('YYYY-MM-DD');
                return {
                    date,
                    label: (0, dayjs_1.default)(date).format('MM-DD'),
                    netPnl: Number(trades.filter((item) => item.trade_date === date).reduce((sum, item) => sum + Number(item.pnl) + Number(item.commission), 0).toFixed(2)),
                };
            }),
        }));
    }));
    router.get('/notification-snapshot', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const [scenes, channels, logs] = await Promise.all([
            data_source_1.appDataSource.getRepository(notification_center_scene_entity_1.NotificationCenterSceneEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(notification_center_channel_entity_1.NotificationCenterChannelEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(notification_center_log_entity_1.NotificationCenterLogEntity).find({ where: { user_id: userId }, order: { created_at: 'DESC' }, take: 8 }),
        ]);
        response.json((0, response_1.successResponse)({
            enabledChannelCount: channels.filter((channel) => channel.enabled).length,
            enabledSceneCount: scenes.filter((scene) => scene.enabled).length,
            recentLogs: logs,
            hottestSceneId: logs[0]?.scene_id ?? '',
        }));
    }));
    return router;
}
