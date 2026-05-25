import dayjs from 'dayjs';

import {
  buildCheckupOverview,
  buildDueFollowUps,
  buildInitialCheckupState,
  normalizeCheckupPageState,
} from './checkup';
import {
  buildLifeCardDueNotifications,
  buildLifeCardMonthlyTrend,
  buildLifeCardOverview,
  buildLifeCardRanking,
  buildInitialCardState,
  normalizeCardPageState,
} from './card';
import {
  buildFitnessOverviewSummary,
  buildInitialFitnessState,
  filterRecordsByUserId,
  normalizeFitnessPageState,
} from './fitness';
import {
  buildForexDashboardSummary,
  buildForexDailyPnlTrend,
  buildForexInstrumentSummary,
  buildInitialForexState,
  normalizeForexPageState,
} from './forex';
import {
  buildInitialLoanState,
  buildLoanOverview,
  filterLoanBills,
  getLoanBillStatus,
  normalizeLoanPageState,
} from './loan';
import {
  buildInitialMedicationState,
  buildMedicationLowStockItems,
  buildMedicationOverview,
  normalizeMedicationPageState,
} from './medication';
import { getNotificationCenterState } from './notificationCenter';
import {
  buildInitialRentState,
  buildRentCostBreakdown,
  buildRentOverview,
  normalizeRentPageState,
} from './rent';
import {
  buildInitialShoppingState,
  buildShoppingLedgerSummary,
  buildShoppingMonthlyTrend,
  buildShoppingOverview,
  normalizeShoppingPageState,
} from './shopping';
import {
  buildInitialStepState,
  buildStepMonthCompare,
  filterStepRecordsByUserId,
  normalizeStepPageState,
} from './stepRecords';
import {
  buildInitialStorageState,
  buildStorageCostRanking,
  buildStorageOverview,
  buildStoragePurchaseTrend,
  normalizeStoragePageState,
} from './storage';
import {
  buildDueSubscriptionReminders,
  buildInitialSubscriptionState,
  buildSubscriptionCategoryBreakdown,
  buildSubscriptionExpiryTimeline,
  buildSubscriptionOverview,
  normalizeSubscriptionPageState,
} from './subscription';
import {
  buildInitialTodoState,
  buildTodoOverview,
  normalizeTodoPageState,
} from './todo';
import {
  buildInitialTravelState,
  buildTravelBookSummaries,
  buildTravelDailyTrend,
  buildTravelSummary,
  filterTravelRecords,
  normalizeTravelPageState,
} from './travel';
import type { LifeCardPageState } from '../types/card';
import type { CheckupPageState } from '../types/checkup';
import type {
  DashboardAgendaItem,
  DashboardModuleSnapshot,
  DashboardNotificationSnapshot,
  DashboardOverviewCard,
  DashboardPageSummary,
  DashboardSnapshotChartPoint,
  DashboardSnapshotListItem,
  DashboardSnapshotMetric,
} from '../types/dashboard';
import type { ForexPageState } from '../types/forex';
import type { FitnessPageState } from '../types/fitness';
import type { StepPageState } from '../types/health';
import type { LoanPageState } from '../types/loan';
import type { MedicationPageState } from '../types/medication';
import type { NotificationSceneId } from '../types/notifications';
import type { RentPageState } from '../types/rent';
import type { ShoppingPageState } from '../types/shopping';
import type { StoragePageState } from '../types/storage';
import type { SubscriptionPageState } from '../types/subscription';
import type { TodoPageState, TodoTaskRecord } from '../types/todo';
import type { TravelPageState } from '../types/travel';
import { readStorage } from '../utils/storage';

const STORAGE_KEYS = {
  step: 'lifeos_health_step_page',
  fitness: 'lifeos_health_fitness_page',
  checkup: 'lifeos_health_checkup_page',
  medication: 'lifeos_health_medication_page',
  shopping: 'lifeos_finance_shopping_page',
  travel: 'lifeos_finance_travel_page',
  loan: 'lifeos_finance_loan_page',
  subscription: 'lifeos_finance_subscription_page',
  rent: 'lifeos_finance_rent_page',
  todo: 'lifeos_life_todo_page',
  card: 'lifeos_life_card_page',
  storage: 'lifeos_life_storage_page',
  forex: 'lifeos_investment_forex_page',
} as const;

const COLOR_SUCCESS = 'var(--color-success)';
const COLOR_DANGER = 'var(--color-danger)';
const COLOR_WARNING = 'var(--color-warning)';
const COLOR_PRIMARY = 'var(--color-primary)';
const CONNECTED_MODULE_COUNT = 14;
const TODO_PRIORITY_LABELS = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
} as const;

function loadState<T>(key: string, fallbackFactory: () => T) {
  return readStorage<T>(key, fallbackFactory());
}

function formatMoney(value: number) {
  return `¥${value.toFixed(2)}`;
}

function formatSignedMoney(value: number) {
  return `${value >= 0 ? '+' : '-'}¥${Math.abs(value).toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCount(value: number, unit = '项') {
  return `${value} ${unit}`;
}

function relativeDateLabel(targetDate: string) {
  const today = dayjs().startOf('day');
  const date = dayjs(targetDate).startOf('day');
  if (!date.isValid()) {
    return targetDate || '暂无日期';
  }

  const diff = date.diff(today, 'day');
  if (diff < 0) {
    return `已逾期 ${Math.abs(diff)} 天`;
  }
  if (diff === 0) {
    return '今天';
  }
  if (diff <= 7) {
    return `${diff} 天后`;
  }
  return date.format('YYYY-MM-DD');
}

function agendaSeverityRank(value: DashboardAgendaItem['severity']) {
  if (value === 'high') {
    return 0;
  }
  if (value === 'medium') {
    return 1;
  }
  return 2;
}

function agendaDateRank(targetDate: string) {
  const today = dayjs().startOf('day');
  const date = dayjs(targetDate).startOf('day');
  if (!date.isValid()) {
    return Number.MAX_SAFE_INTEGER;
  }

  const diff = date.diff(today, 'day');
  if (diff < 0) {
    return -1000 + diff;
  }
  if (diff === 0) {
    return 0;
  }
  if (diff <= 7) {
    return diff;
  }
  return 100 + diff;
}

function loadStepState() {
  return normalizeStepPageState(loadState<StepPageState>(STORAGE_KEYS.step, buildInitialStepState));
}

function loadFitnessState() {
  return normalizeFitnessPageState(loadState<FitnessPageState>(STORAGE_KEYS.fitness, buildInitialFitnessState));
}

function loadCheckupState() {
  return normalizeCheckupPageState(loadState<CheckupPageState>(STORAGE_KEYS.checkup, buildInitialCheckupState));
}

function loadMedicationState() {
  return normalizeMedicationPageState(loadState<MedicationPageState>(STORAGE_KEYS.medication, buildInitialMedicationState));
}

function loadShoppingState() {
  return normalizeShoppingPageState(loadState<ShoppingPageState>(STORAGE_KEYS.shopping, buildInitialShoppingState));
}

function loadTravelState() {
  return normalizeTravelPageState(loadState<TravelPageState>(STORAGE_KEYS.travel, buildInitialTravelState));
}

function loadLoanState() {
  return normalizeLoanPageState(loadState<LoanPageState>(STORAGE_KEYS.loan, buildInitialLoanState));
}

function loadSubscriptionState() {
  return normalizeSubscriptionPageState(loadState<SubscriptionPageState>(STORAGE_KEYS.subscription, buildInitialSubscriptionState));
}

function loadRentState() {
  return normalizeRentPageState(loadState<RentPageState>(STORAGE_KEYS.rent, buildInitialRentState));
}

function loadTodoState() {
  return normalizeTodoPageState(loadState<TodoPageState>(STORAGE_KEYS.todo, buildInitialTodoState));
}

function loadCardState() {
  return normalizeCardPageState(loadState<LifeCardPageState>(STORAGE_KEYS.card, buildInitialCardState));
}

function loadStorageState() {
  return normalizeStoragePageState(loadState<StoragePageState>(STORAGE_KEYS.storage, buildInitialStorageState));
}

function loadForexState() {
  return normalizeForexPageState(loadState<ForexPageState>(STORAGE_KEYS.forex, buildInitialForexState));
}

function buildTodoAgenda(tasks: TodoTaskRecord[]): DashboardAgendaItem[] {
  const today = dayjs().startOf('day');

  return tasks
    .filter((task) => !task.trashedAt && !task.completed && task.dueDate)
    .filter((task) => dayjs(task.dueDate).diff(today, 'day') <= 7)
    .map((task) => {
      const diff = dayjs(task.dueDate).startOf('day').diff(today, 'day');
      const severity: DashboardAgendaItem['severity'] = diff < 0
        ? 'high'
        : diff === 0 || task.priority === 'high'
          ? 'medium'
          : 'low';

      return {
        id: `todo:${task.id}`,
        module: '待办',
        title: task.title,
        summary: `${TODO_PRIORITY_LABELS[task.priority]} · ${task.isDaily ? '每日任务' : '普通任务'} · ${relativeDateLabel(task.dueDate)}`,
        severity,
        targetDate: task.dueDate,
        href: '/life/todo?todoTab=tasks',
      };
    });
}

function buildSubscriptionAgenda(state: SubscriptionPageState): DashboardAgendaItem[] {
  return buildDueSubscriptionReminders(state.records, state.settings).map((item) => ({
    id: `subscription:${item.recordId}:${item.sceneId}`,
    module: '订阅',
    title: item.serviceName,
    summary: item.sceneId === 'subscription.expired'
      ? `已到期 · ${relativeDateLabel(item.endDate)}`
      : `即将到期 · ${relativeDateLabel(item.endDate)}`,
    severity: item.sceneId === 'subscription.expired' ? 'high' : 'medium',
    targetDate: item.endDate,
    href: '/finance/subscription?subscriptionTab=records',
  }));
}

function buildLoanAgenda(state: LoanPageState): DashboardAgendaItem[] {
  const today = dayjs();

  return filterLoanBills(state.bills, state.settings.activeUserId)
    .filter((bill) => !bill.isPaid)
    .filter((bill) => dayjs(bill.dueDate).diff(today, 'day') <= state.settings.upcomingDays)
    .map((bill) => {
      const overdue = getLoanBillStatus(bill, today) === 'overdue';
      return {
        id: `loan:${bill.id}`,
        module: '贷款',
        title: bill.platformName,
        summary: `${overdue ? '已逾期' : '待还'} · 应还 ${formatMoney(bill.amount)} · 利息 ${formatMoney(bill.interest)}`,
        severity: overdue ? 'high' : 'medium',
        targetDate: bill.dueDate,
        href: '/finance/loan?loanTab=bills',
      };
    });
}

function buildCardAgenda(state: LifeCardPageState): DashboardAgendaItem[] {
  return buildLifeCardDueNotifications(state.cards, state.settings).map((item) => ({
    id: `card:${item.cardId}:${item.sceneId}`,
    module: '号卡',
    title: item.phoneNumber,
    summary: item.sceneId === 'card.balance_low' ? '低余额提醒窗口' : '账单日前提醒窗口',
    severity: item.sceneId === 'card.balance_low' ? 'high' : 'medium',
    targetDate: dayjs().format('YYYY-MM-DD'),
    href: '/life/card?cardTab=settings',
  }));
}

function buildCheckupAgenda(state: CheckupPageState): DashboardAgendaItem[] {
  return buildDueFollowUps(
    state.records,
    state.settings.insightUserId,
    state.settings.followUpLeadDays,
  ).map((item) => ({
    id: `checkup:${item.id}`,
    module: '体检',
    title: item.testName,
    summary: `${item.testType} · ${item.status === 'abnormal' ? '异常关注' : '复查临近'} · ${relativeDateLabel(item.followUpDate)}`,
    severity: item.daysUntilDue < 0 ? 'high' : item.status === 'abnormal' ? 'medium' : 'low',
    targetDate: item.followUpDate,
    href: '/health/checkup?checkupTab=insights',
  }));
}

function buildMedicationAgenda(state: MedicationPageState): DashboardAgendaItem[] {
  return buildMedicationLowStockItems(
    state.records,
    state.purchases,
    state.settings.activeUserId,
    state.settings.defaultStockThreshold,
    state.settings.medicineThresholds,
  ).map((item) => ({
    id: `medication:${item.medicineName}`,
    module: '用药',
    title: item.medicineName,
    summary: `低库存 · 剩余 ${item.remainingQuantity ?? 0}${item.unit ?? ''} · 阈值 ${item.threshold}${item.unit ?? ''}`,
    severity: 'medium',
    targetDate: dayjs().format('YYYY-MM-DD'),
    href: '/health/medication?medicationTab=summary',
  }));
}

export function buildDashboardAgenda() {
  return [
    ...buildTodoAgenda(loadTodoState().tasks),
    ...buildSubscriptionAgenda(loadSubscriptionState()),
    ...buildLoanAgenda(loadLoanState()),
    ...buildCardAgenda(loadCardState()),
    ...buildCheckupAgenda(loadCheckupState()),
    ...buildMedicationAgenda(loadMedicationState()),
  ].sort((left, right) => {
    const severityDiff = agendaSeverityRank(left.severity) - agendaSeverityRank(right.severity);
    if (severityDiff !== 0) {
      return severityDiff;
    }

    const dateDiff = agendaDateRank(left.targetDate) - agendaDateRank(right.targetDate);
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return left.title.localeCompare(right.title, 'zh-CN');
  });
}

export function buildDashboardNotificationSnapshot(): DashboardNotificationSnapshot {
  const state = getNotificationCenterState();
  const enabledChannels = Object.values(state.channels).filter((item) => item.enabled).length;
  const enabledScenes = Object.values(state.scenes).filter((item) => item.enabled).length;
  const sceneCounter = new Map<string, number>();

  state.logs.forEach((log) => {
    const key = log.sceneId ?? 'manual';
    sceneCounter.set(key, (sceneCounter.get(key) ?? 0) + 1);
  });

  const mostActiveSceneId = [...sceneCounter.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? '';
  const mostActiveSceneLabel = mostActiveSceneId && mostActiveSceneId !== 'manual'
    ? state.scenes[mostActiveSceneId as NotificationSceneId]?.label ?? mostActiveSceneId
    : '暂无活跃场景';

  return {
    enabledChannels,
    enabledScenes,
    logCount: state.logs.length,
    mostActiveSceneLabel,
    recentLogs: state.logs.slice(0, 8),
  };
}

export function buildDashboardHealthSnapshot(): DashboardModuleSnapshot {
  const stepState = loadStepState();
  const fitnessState = loadFitnessState();
  const checkupState = loadCheckupState();
  const medicationState = loadMedicationState();

  const stepRecords = filterStepRecordsByUserId(stepState.records, stepState.settings.activeUserId);
  const stepCompare = buildStepMonthCompare(stepRecords, stepState.settings.strideLength);
  const latestStep = stepRecords[0];

  const fitnessUserId = fitnessState.settings.dashboardUserId || fitnessState.settings.activeUserId;
  const fitnessOverview = buildFitnessOverviewSummary(
    filterRecordsByUserId(fitnessState.dietRecords, fitnessUserId),
    filterRecordsByUserId(fitnessState.exerciseRecords, fitnessUserId),
    filterRecordsByUserId(fitnessState.shoppingRecords, fitnessUserId),
    filterRecordsByUserId(fitnessState.weightRecords, fitnessUserId),
    fitnessState.settings.defaultHeightCm ?? 170,
  );

  const checkupOverview = buildCheckupOverview(
    checkupState.records,
    checkupState.settings.activeUserId,
    checkupState.settings.followUpLeadDays,
  );

  const lowStockItems = buildMedicationLowStockItems(
    medicationState.records,
    medicationState.purchases,
    medicationState.settings.activeUserId,
    medicationState.settings.defaultStockThreshold,
    medicationState.settings.medicineThresholds,
  );

  const medicationOverview = buildMedicationOverview(
    medicationState.records,
    medicationState.purchases,
    medicationState.settings.activeUserId,
  );

  return {
    title: '健康中心摘要',
    subtitle: '从步数、热量、复查和药品库存里抽出首页最值得盯的健康信号。',
    metrics: [
      { label: '最近步数', value: latestStep ? `${latestStep.steps} 步` : '0 步', helper: stepCompare.currentLabel },
      { label: '今日净热量', value: `${Math.round(fitnessOverview.todayNetCalories)} kcal`, helper: `近 7 天均值 ${Math.round(fitnessOverview.weekAverageNetCalories)} kcal` },
      { label: '待复查', value: formatCount(checkupOverview.dueFollowUpCount), helper: `异常 ${checkupOverview.abnormalCount} 项` },
      { label: '低库存药品', value: formatCount(lowStockItems.length), helper: `今日服药 ${medicationOverview.todayDosage} 次` },
    ],
    chartTitle: '健康高信号指标',
    chartDescription: '首页保留 4 个最有决策价值的健康指标，不把子页面完整搬过来。',
    chartKind: 'bar',
    chartData: [
      { id: 'steps', label: '步数', value: stepCompare.currentSteps, secondaryValue: stepCompare.previousSteps, color: COLOR_PRIMARY },
      { id: 'net-calorie', label: '净热量', value: fitnessOverview.todayNetCalories, color: fitnessOverview.todayNetCalories > 0 ? COLOR_WARNING : COLOR_SUCCESS },
      { id: 'followup', label: '复查', value: checkupOverview.dueFollowUpCount, color: COLOR_WARNING },
      { id: 'stock', label: '低库存', value: lowStockItems.length, color: COLOR_DANGER },
    ],
    listTitle: '近期重点',
    listDescription: '看最近步数、待复查和药品库存是否需要立刻跟进。',
    listItems: [
      {
        id: 'step-latest',
        title: '最新步数记录',
        meta: latestStep ? `${dayjs(latestStep.recordTime).format('MM-DD HH:mm')} · ${latestStep.steps} 步` : '暂无记录',
        value: latestStep ? `${((latestStep.steps * stepState.settings.strideLength) / 1000).toFixed(2)} km` : '',
      },
      {
        id: 'checkup-risk',
        title: '体检风险',
        meta: `异常 ${checkupOverview.abnormalCount} 项 · 关注 ${checkupOverview.attentionCount} 项`,
        value: `${checkupOverview.dueFollowUpCount} 项待处理`,
        accent: checkupOverview.dueFollowUpCount ? COLOR_WARNING : undefined,
      },
      {
        id: 'medication-risk',
        title: '药品库存',
        meta: `活跃药品 ${medicationOverview.activeMedicineCount} 种`,
        value: `${lowStockItems.length} 项偏低`,
        accent: lowStockItems.length ? COLOR_WARNING : undefined,
      },
    ],
  };
}

export function buildDashboardFinanceSnapshot(): DashboardModuleSnapshot {
  const shoppingState = loadShoppingState();
  const travelState = loadTravelState();
  const loanState = loadLoanState();
  const subscriptionState = loadSubscriptionState();
  const rentState = loadRentState();

  const shoppingOverview = buildShoppingOverview(
    shoppingState.records,
    shoppingState.settings.dashboardUserId,
    shoppingState.settings.dashboardLedgerId,
  );
  const travelRecords = filterTravelRecords(
    travelState.records,
    travelState.settings.activeUserId,
    travelState.settings.statsBookId,
  );
  const travelSummary = buildTravelSummary(travelRecords, travelState.payChannels);
  const loanOverview = buildLoanOverview(
    loanState.bills,
    loanState.repayments,
    loanState.settings.activeUserId,
  );
  const subscriptionOverview = buildSubscriptionOverview(
    subscriptionState.records,
    subscriptionState.settings.leadDays,
  );
  const rentOverview = buildRentOverview(
    rentState.records,
    rentState.channels,
    rentState.settings.statisticsUserId,
  );
  const rentBreakdown = buildRentCostBreakdown(rentState.records, rentState.settings.statisticsUserId);
  const travelBooks = buildTravelBookSummaries(
    travelState.books,
    travelState.records,
    travelState.settings.activeUserId,
  );

  const monthSpend = shoppingOverview.currentMonthAmount
    + travelSummary.totalPaidAmount
    + subscriptionOverview.monthlyEstimate
    + rentOverview.avgMonthlyCost;

  return {
    title: '财务中心摘要',
    subtitle: '购物、旅行、贷款、订阅和住房成本按各自当前上下文汇总成首页月度视角。',
    metrics: [
      { label: '本月综合支出', value: formatMoney(monthSpend), helper: '购物 + 旅行 + 订阅月均 + 住房月均' },
      { label: '贷款待还', value: formatMoney(loanOverview.totalUnpaid), helper: `逾期 ${loanOverview.overdueCount} 项`, accent: loanOverview.overdueCount ? COLOR_DANGER : undefined },
      { label: '活跃订阅', value: formatCount(subscriptionOverview.activeCount), helper: `即将到期 ${subscriptionOverview.upcomingCount} 项` },
      { label: '活跃账本', value: `${travelBooks.length + shoppingState.ledgers.length} 个`, helper: `购物平台 ${shoppingOverview.activePlatformCount} 个` },
    ],
    chartTitle: '财务支出构成',
    chartDescription: '首页只保留四类高信号支出口径，用来判断本月压力集中在哪一块。',
    chartKind: 'bar',
    chartData: [
      { id: 'shopping', label: '购物', value: shoppingOverview.currentMonthAmount, color: COLOR_PRIMARY },
      { id: 'travel', label: '旅行', value: travelSummary.totalPaidAmount, color: '#1eaedb' },
      { id: 'subscription', label: '订阅', value: subscriptionOverview.monthlyEstimate, color: '#27a644' },
      { id: 'rent', label: '住房', value: rentOverview.avgMonthlyCost, color: '#f59e0b' },
    ],
    listTitle: '财务关注项',
    listDescription: '贷款、订阅、住房和旅行账本各留一个高信号条目，首页看完就能知道重点。',
    listItems: [
      {
        id: 'loan-risk',
        title: '贷款提醒',
        meta: `待还 ${formatMoney(loanOverview.totalUnpaid)} · 已还 ${formatMoney(loanOverview.totalPaid)}`,
        value: `${loanOverview.upcomingCount + loanOverview.overdueCount} 项`,
        accent: loanOverview.overdueCount ? COLOR_DANGER : loanOverview.upcomingCount ? COLOR_WARNING : undefined,
      },
      {
        id: 'subscription-risk',
        title: '订阅提醒',
        meta: `活跃 ${subscriptionOverview.activeCount} 项 · 自动续费 ${subscriptionOverview.autoRenewCount} 项`,
        value: `${subscriptionOverview.upcomingCount + subscriptionOverview.expiredCount} 项`,
        accent: subscriptionOverview.expiredCount ? COLOR_DANGER : subscriptionOverview.upcomingCount ? COLOR_WARNING : undefined,
      },
      {
        id: 'rent-cost',
        title: '住房成本',
        meta: `在住 ${rentOverview.activeRecords} 处 · 总成本 ${formatMoney(rentOverview.totalCost)}`,
        value: `${formatMoney(rentOverview.avgDailyCost)}/天`,
      },
      {
        id: 'travel-book',
        title: '当前旅行账本',
        meta: travelBooks[0] ? `${travelBooks[0].bookName} · ${travelBooks[0].totalCount} 笔` : '暂无旅行账本',
        value: travelBooks[0] ? formatMoney(travelBooks[0].totalPaidAmount) : '',
      },
    ],
  };
}

export function buildDashboardLifeSnapshot(): DashboardModuleSnapshot {
  const todoState = loadTodoState();
  const storageState = loadStorageState();
  const cardState = loadCardState();

  const todoOverview = buildTodoOverview(todoState.tasks);
  const storageOverview = buildStorageOverview(storageState.items, storageState.settings);
  const storageRanking = buildStorageCostRanking(storageState.items, storageState.settings).slice(0, 3);
  const cardOverview = buildLifeCardOverview(
    cardState.cards,
    cardState.bills,
    cardState.recharges,
    cardState.settings,
  );
  const cardRanking = buildLifeCardRanking(cardState.cards, cardState.bills, cardState.recharges).slice(0, 2);

  return {
    title: '生活中心摘要',
    subtitle: '待办、物品追踪和号卡中心被压成一个高信号的日常运营视角。',
    metrics: [
      { label: '未完成待办', value: formatCount(todoOverview.activeCount), helper: `今日到期 ${todoOverview.dueTodayCount} 项` },
      { label: '使用中物品', value: `${storageOverview.activeCount} 件`, helper: `当前总日均成本 ${formatMoney(storageOverview.currentDailyCostTotal)}` },
      { label: '低余额号卡', value: formatCount(cardOverview.lowBalanceCount), helper: `总余额 ${formatMoney(cardOverview.totalBalance)}` },
      { label: '每日任务', value: formatCount(todoOverview.dailyCount), helper: `高优先级 ${todoOverview.highPriorityCount} 项` },
    ],
    chartTitle: '生活中心活跃事项',
    chartDescription: '把待办、物品和号卡三块压缩成首页最关键的活动量指标。',
    chartKind: 'bar',
    chartData: [
      { id: 'todo', label: '待办', value: todoOverview.activeCount, color: COLOR_PRIMARY },
      { id: 'storage', label: '物品', value: storageOverview.activeCount, color: '#1eaedb' },
      { id: 'card', label: '低余额', value: cardOverview.lowBalanceCount, color: '#e5484d' },
      { id: 'daily', label: '每日任务', value: todoOverview.dailyCount, color: '#27a644' },
    ],
    listTitle: '日常关注',
    listDescription: '先看最费钱的物品、号码支出排行和待办压力。',
    listItems: [
      ...storageRanking.map((item) => ({
        id: `storage:${item.id}`,
        title: item.itemName,
        meta: `${item.usageDays} 天 · 购入 ${formatMoney(item.purchasePrice)}`,
        value: `${formatMoney(item.dailyCost)}/天`,
      })),
      ...cardRanking.map((item) => ({
        id: `card:${item.simId}`,
        title: item.phoneNumber,
        meta: `${item.carrierName} · 账单 ${item.billCount} 条`,
        value: formatMoney(item.totalBillAmount),
      })),
    ],
  };
}

export function buildDashboardInvestmentSnapshot(): DashboardModuleSnapshot {
  const forexState = loadForexState();
  const summary = buildForexDashboardSummary(
    forexState.trades,
    forexState.capitalFlows,
    forexState.settings.dashboardStartDate,
    forexState.settings.dashboardEndDate,
  );
  const trend = buildForexDailyPnlTrend(
    forexState.trades,
    forexState.settings.dashboardStartDate,
    forexState.settings.dashboardEndDate,
  ).slice(-8);
  const instruments = buildForexInstrumentSummary(
    forexState.trades,
    forexState.settings.dashboardStartDate,
    forexState.settings.dashboardEndDate,
  );

  return {
    title: '投资中心摘要',
    subtitle: '投资首页本轮以贵金属交易中心为真实数据源，其余投资模块只保留接入状态。',
    metrics: [
      { label: '净收益', value: formatSignedMoney(summary.realizedNetPnl), helper: `毛盈亏 ${formatSignedMoney(summary.grossPnl)}`, accent: summary.realizedNetPnl >= 0 ? COLOR_SUCCESS : COLOR_DANGER },
      { label: '胜率', value: formatPercent(summary.winRate), helper: `盈亏比 ${summary.profitLossRatio.toFixed(2)}` },
      { label: '净入金', value: formatMoney(summary.netCapital), helper: `净值 ${formatMoney(summary.equity)}` },
      { label: '活跃交易', value: `${summary.tradeCount} 笔`, helper: `XAU ${summary.xauCount} / XAG ${summary.xagCount}` },
    ],
    chartTitle: '最近净收益趋势',
    chartDescription: '首页只保留最近几天的净收益走势，足够判断当前交易节奏是否健康。',
    chartKind: 'line',
    chartData: trend.map((point) => ({
      id: point.date,
      label: dayjs(point.date).format('MM-DD'),
      value: point.netPnl,
      secondaryValue: point.grossPnl,
      color: point.netPnl >= 0 ? COLOR_SUCCESS : COLOR_DANGER,
    })),
    listTitle: '品种快照',
    listDescription: '把 XAUUSD / XAGUSD 的高信号对比压成简短列表，首页看完就够用。',
    listItems: instruments.map((item) => ({
      id: item.instrument,
      title: item.instrument,
      meta: `${item.tradeCount} 笔 · 胜率 ${formatPercent(item.winRate)} · 做多 ${item.longCount} / 做空 ${item.shortCount}`,
      value: formatSignedMoney(item.netPnl),
      accent: item.netPnl >= 0 ? COLOR_SUCCESS : COLOR_DANGER,
    })),
  };
}

export function buildDashboardOverviewCards(summary?: DashboardPageSummary): DashboardOverviewCard[] {
  const source = summary ?? buildDashboardSummary();

  return [
    {
      id: 'modules',
      label: '已接入模块数',
      value: `${source.connectedModuleCount}`,
      helper: '健康、财务、生活、投资与通知中心都已纳入首页聚合',
    },
    {
      id: 'scenes',
      label: '启用通知场景数',
      value: `${source.notifications.enabledScenes}`,
      helper: `启用渠道 ${source.notifications.enabledChannels} 个`,
    },
    {
      id: 'logs',
      label: '最近通知日志数',
      value: `${source.notifications.logCount}`,
      helper: `最活跃场景：${source.notifications.mostActiveSceneLabel}`,
    },
    {
      id: 'agenda',
      label: '统一待处理总数',
      value: `${source.agenda.length}`,
      helper: source.agenda.length
        ? `高风险 ${source.agenda.filter((item) => item.severity === 'high').length} 项`
        : '当前没有临近待处理事项',
      accent: source.agenda.some((item) => item.severity === 'high') ? COLOR_WARNING : undefined,
    },
    {
      id: 'health',
      label: '健康中心今日关注数',
      value: source.health.metrics[2]?.value ?? '0 项',
      helper: `低库存药品 ${source.health.metrics[3]?.value ?? '0 项'}`,
    },
    {
      id: 'finance',
      label: '财务中心本月支出/待还',
      value: source.finance.metrics[0]?.value ?? '¥0.00',
      helper: `待还 ${source.finance.metrics[1]?.value ?? '¥0.00'}`,
    },
    {
      id: 'life',
      label: '生活中心活跃事项数',
      value: source.life.metrics[0]?.value ?? '0 项',
      helper: `使用中物品 ${source.life.metrics[1]?.value ?? '0 件'}`,
    },
    {
      id: 'investment',
      label: '投资中心净收益摘要',
      value: source.investment.metrics[0]?.value ?? '¥0.00',
      helper: source.investment.metrics[3]?.value
        ? `活跃交易 ${source.investment.metrics[3].value}`
        : '暂无交易',
      accent: source.investment.metrics[0]?.accent,
    },
  ];
}

export function buildDashboardSummary(): DashboardPageSummary {
  const health = buildDashboardHealthSnapshot();
  const finance = buildDashboardFinanceSnapshot();
  const life = buildDashboardLifeSnapshot();
  const investment = buildDashboardInvestmentSnapshot();
  const notifications = buildDashboardNotificationSnapshot();
  const agenda = buildDashboardAgenda();

  const summary: DashboardPageSummary = {
    overviewCards: [],
    agenda,
    health,
    finance,
    life,
    investment,
    notifications,
    connectedModuleCount: CONNECTED_MODULE_COUNT,
  };

  summary.overviewCards = buildDashboardOverviewCards(summary);
  return summary;
}
