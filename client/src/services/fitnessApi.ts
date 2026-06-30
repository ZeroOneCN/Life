import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type {
  DietRecord,
  DietRecordDraft,
  ExerciseRecord,
  ExerciseRecordDraft,
  FitnessInsight,
  FitnessOverviewSummary,
  FitnessPageState,
  FitnessShoppingRecord,
  FitnessShoppingRecordDraft,
  WeightRecord,
  WeightRecordDraft,
} from '../types/fitness';

export const fitnessApi = {
  listDietRecords(params?: { page?: number; page_size?: number; userId?: string }) {
    return apiGet<PaginatedResponse<DietRecord>>('/health/fitness/diet-records', undefined, params as Record<string, unknown> | undefined);
  },

  createDietRecord(body: DietRecordDraft) {
    return apiPost<DietRecord, DietRecordDraft>('/health/fitness/diet-records', body);
  },

  updateDietRecord(recordId: string, body: Partial<DietRecordDraft>) {
    return apiPatch<DietRecord, Partial<DietRecordDraft>>(`/health/fitness/diet-records/${recordId}`, body);
  },

  deleteDietRecord(recordId: string) {
    return apiDelete<{ ok: true }>(`/health/fitness/diet-records/${recordId}`);
  },

  listExerciseRecords(params?: { page?: number; page_size?: number; userId?: string }) {
    return apiGet<PaginatedResponse<ExerciseRecord>>('/health/fitness/exercise-records', undefined, params as Record<string, unknown> | undefined);
  },

  createExerciseRecord(body: ExerciseRecordDraft) {
    return apiPost<ExerciseRecord, ExerciseRecordDraft>('/health/fitness/exercise-records', body);
  },

  updateExerciseRecord(recordId: string, body: Partial<ExerciseRecordDraft>) {
    return apiPatch<ExerciseRecord, Partial<ExerciseRecordDraft>>(`/health/fitness/exercise-records/${recordId}`, body);
  },

  deleteExerciseRecord(recordId: string) {
    return apiDelete<{ ok: true }>(`/health/fitness/exercise-records/${recordId}`);
  },

  listShoppingRecords(params?: { page?: number; page_size?: number; userId?: string }) {
    return apiGet<PaginatedResponse<FitnessShoppingRecord>>('/health/fitness/shopping-records', undefined, params as Record<string, unknown> | undefined);
  },

  createShoppingRecord(body: FitnessShoppingRecordDraft) {
    return apiPost<FitnessShoppingRecord, FitnessShoppingRecordDraft>('/health/fitness/shopping-records', body);
  },

  updateShoppingRecord(recordId: string, body: Partial<FitnessShoppingRecordDraft>) {
    return apiPatch<FitnessShoppingRecord, Partial<FitnessShoppingRecordDraft>>(`/health/fitness/shopping-records/${recordId}`, body);
  },

  deleteShoppingRecord(recordId: string) {
    return apiDelete<{ ok: true }>(`/health/fitness/shopping-records/${recordId}`);
  },

  listWeightRecords(params?: { page?: number; page_size?: number; userId?: string }) {
    return apiGet<PaginatedResponse<WeightRecord>>('/health/fitness/weight-records', undefined, params as Record<string, unknown> | undefined);
  },

  createWeightRecord(body: WeightRecordDraft) {
    return apiPost<WeightRecord, WeightRecordDraft>('/health/fitness/weight-records', body);
  },

  updateWeightRecord(recordId: string, body: Partial<WeightRecordDraft>) {
    return apiPatch<WeightRecord, Partial<WeightRecordDraft>>(`/health/fitness/weight-records/${recordId}`, body);
  },

  deleteWeightRecord(recordId: string) {
    return apiDelete<{ ok: true }>(`/health/fitness/weight-records/${recordId}`);
  },

  getSummary(params?: { userId?: string }) {
    return apiGet<FitnessOverviewSummary>('/health/fitness/summary', undefined, params as Record<string, unknown> | undefined);
  },

  getInsights(params?: { userId?: string }) {
    return apiGet<FitnessInsight[]>('/health/fitness/insights', undefined, params as Record<string, unknown> | undefined);
  },

  getSettings() {
    return apiGet<FitnessPageState['settings']>('/health/fitness/settings');
  },

  updateSettings(body: Partial<FitnessPageState['settings']>) {
    return apiPatch<FitnessPageState['settings'], Partial<FitnessPageState['settings']>>('/health/fitness/settings', body);
  },
};
