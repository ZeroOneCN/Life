<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Eye, Pencil, Trash2, Search, RotateCcw } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { housingApi } from '@/services/api'
import api from '@/services/api'
import dayjs from 'dayjs'

const router = useRouter()
const housingRecords = ref([])
const loading = ref(false)
const currentRecord = ref(null)

// 分页相关
const pagination = ref({
  page: 1,
  limit: 10,
  total: 0
})

// 搜索相关
const searchKeyword = ref('')
const searchChannel = ref('')
const housingChannels = ref([])

// 自定义弹窗
const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

// 删除确认弹窗
const showDeleteConfirm = ref(false)
const deleteRecordId = ref(null)

// 详情弹窗
const showDetailModal = ref(false)

const showMessage = (msg, type = 'success') => {
  toastMessage.value = msg
  toastType.value = type
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 2000)
}

const confirmDelete = (id) => {
  deleteRecordId.value = id
  showDeleteConfirm.value = true
}

const handleDeleteConfirm = async () => {
  if (!deleteRecordId.value) return
  try {
    await housingApi.delete(deleteRecordId.value)
    showMessage('删除成功', 'success')
    fetchHousingRecords()
  } catch (error) {
    showMessage('删除失败', 'error')
  }
  showDeleteConfirm.value = false
  deleteRecordId.value = null
}

const handleDeleteCancel = () => {
  showDeleteConfirm.value = false
  deleteRecordId.value = null
}

// 查看详情
const viewDetail = (record) => {
  currentRecord.value = record
  showDetailModal.value = true
}

// 计算月度租金和季度租金
const monthlyRentRef = computed(() => {
  const r = currentRecord.value
  if (!r) return 0
  const days = Number(r.stay_days || 0)
  const rent = Number(r.rent || 0)
  return days > 0 ? (rent * 30) / days : 0
})

const quarterlyRentRef = computed(() => {
  return monthlyRentRef.value * 3
})

const fetchHousingRecords = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit
    }
    if (searchKeyword.value) params.keyword = searchKeyword.value
    if (searchChannel.value) params.channel = searchChannel.value

    const response = await housingApi.getAll(params)
    housingRecords.value = response.data.data.map(r => ({
      ...r,
      moveInDate: r.move_in_date ? dayjs(r.move_in_date).format('YYYY-MM-DD') : '',
      moveOutDate: r.move_out_date ? dayjs(r.move_out_date).format('YYYY-MM-DD') : '',
      channel: r.housing_channel || '未知'
    }))
    pagination.value.total = response.data.total
  } catch (error) {
    showMessage('加载失败', 'error')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.value.page = 1
  fetchHousingRecords()
}

// 重置搜索
const resetSearch = () => {
  searchKeyword.value = ''
  searchChannel.value = ''
  pagination.value.page = 1
  fetchHousingRecords()
}

// 分页变化
const handlePageChange = (newPage) => {
  pagination.value.page = newPage
  fetchHousingRecords()
}

// 加载渠道列表
const fetchChannels = async () => {
  try {
    const response = await api.get('/channels')
    housingChannels.value = response.data
  } catch (error) {
    console.error('加载渠道失败:', error)
  }
}

// 格式化日期
const formatDate = (date) => {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD')
}

onMounted(() => {
  fetchChannels()
  fetchHousingRecords()
})
</script>

<template>
  <div style="padding: 0;">
    <!-- 自定义 Toast -->
    <transition name="toast">
      <div v-if="showToast" class="toast" :class="toastType">
        <span>{{ toastMessage }}</span>
      </div>
    </transition>

    <!-- 删除确认弹窗 -->
    <transition name="fade">
      <div v-if="showDeleteConfirm" class="modal-overlay" @click="handleDeleteCancel">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <span class="modal-title">确认删除</span>
          </div>
          <div class="modal-body">
            确定要删除这条住房记录吗？此操作不可恢复。
          </div>
          <div class="modal-footer">
            <Button variant="outline" @click="handleDeleteCancel" style="border-color: #d9d9d9;">取消</Button>
            <Button @click="handleDeleteConfirm" style="background-color: #ff4d4f; border-color: #ff4d4f;">删除</Button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 页面标题 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 24px 32px; background: white; border-radius: 12px; border: 1px solid #e8e8e8; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
      <div>
        <h1 style="margin: 0; font-size: 28px; color: #333; font-weight: 600; letter-spacing: 0.5px;">住房记录</h1>
        <p style="margin: 8px 0 0 0; color: #999; font-size: 16px;">查看和管理您的住房记录</p>
      </div>
      <Button @click="router.push('/add')" style="font-size: 16px; padding: 12px 28px; border-radius: 8px; background-color: #0066FF; border-color: #0066FF; font-weight: 500; box-shadow: 0 2px 8px rgba(0,102,255,0.25);">
        <Plus style="width: 20px; height: 20px; margin-right: 8px;" />
        新增记录
      </Button>
    </div>

    <!-- 搜索栏 -->
    <div style="display: flex; gap: 12px; margin-bottom: 20px; padding: 20px 24px; background: white; border-radius: 12px; border: 1px solid #e8e8e8; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
      <div style="flex: 1; position: relative;">
        <input
          v-model="searchKeyword"
          placeholder="搜索地址..."
          @keyup.enter="handleSearch"
          style="width: 100%; padding: 10px 16px 10px 40px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 14px; box-sizing: border-box;"
        />
        <Search style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: #999;" />
      </div>
      <select
        v-model="searchChannel"
        style="padding: 10px 16px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 14px; background: white; min-width: 150px;"
      >
        <option value="">全部渠道</option>
        <option v-for="channel in housingChannels" :key="channel.id" :value="channel.name">
          {{ channel.name }}
        </option>
      </select>
      <Button @click="handleSearch" style="font-size: 14px; padding: 10px 20px; border-radius: 8px; background-color: #0066FF; border-color: #0066FF; font-weight: 500;">
        <Search style="width: 16px; height: 16px; margin-right: 6px;" />
        搜索
      </Button>
      <Button variant="outline" @click="resetSearch" style="font-size: 14px; padding: 10px 20px; border-radius: 8px; border-color: #d9d9d9;">
        <RotateCcw style="width: 16px; height: 16px; margin-right: 6px;" />
        重置
      </Button>
    </div>

    <!-- 表格卡片 -->
    <div v-if="loading" style="padding: 60px; background: white; border-radius: 12px; border: 1px solid #e8e8e8; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center; color: #999; font-size: 18px;">
      加载中...
    </div>

    <div v-else-if="housingRecords.length > 0" style="background: white; border-radius: 12px; border: 1px solid #e8e8e8; box-shadow: 0 2px 8px rgba(0,0,0,0.04); overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead style="background: #fafafa; border-bottom: 1px solid #e8e8e8;">
          <tr>
            <th style="padding: 18px 24px; text-align: left; font-weight: 600; color: #333; font-size: 16px;">地址</th>
            <th style="padding: 18px 24px; text-align: left; font-weight: 600; color: #333; font-size: 16px;">渠道</th>
            <th style="padding: 18px 24px; text-align: left; font-weight: 600; color: #333; font-size: 16px;">入住日期</th>
            <th style="padding: 18px 24px; text-align: left; font-weight: 600; color: #333; font-size: 16px;">退房日期</th>
            <th style="padding: 18px 24px; text-align: left; font-weight: 600; color: #333; font-size: 16px;">总花费</th>
            <th style="padding: 18px 24px; text-align: left; font-weight: 600; color: #333; font-size: 16px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in housingRecords" :key="record.id" style="border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" @mouseenter="$event.currentTarget.style.background = '#fafafa'" @mouseleave="$event.currentTarget.style.background = ''">
            <td style="padding: 18px 24px; color: #333; font-size: 16px; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ record.address }}</td>
            <td style="padding: 18px 24px; color: #666; font-size: 16px;">{{ record.channel }}</td>
            <td style="padding: 18px 24px; color: #666; font-size: 16px;">{{ record.moveInDate }}</td>
            <td style="padding: 18px 24px; color: #666; font-size: 16px;">{{ record.moveOutDate || '至今' }}</td>
            <td style="padding: 18px 24px; color: #0066FF; font-size: 16px; font-weight: 600;">¥{{ Number(record.total_cost || 0).toFixed(2) }}</td>
            <td style="padding: 18px 24px;">
              <Button variant="ghost" size="icon" @click="viewDetail(record)" style="margin-right: 8px; width: 36px; height: 36px; padding: 0; border-color: #0066FF; color: #0066FF;">
                <Eye style="width: 18px; height: 18px;" />
              </Button>
              <Button variant="ghost" size="icon" @click="router.push('/edit/' + record.id)" style="margin-right: 8px; width: 36px; height: 36px; padding: 0; border-color: #0066FF; color: #0066FF;">
                <Pencil style="width: 18px; height: 18px;" />
              </Button>
              <Button variant="ghost" size="icon" @click="confirmDelete(record.id)" style="width: 36px; height: 36px; padding: 0; border-color: #ff4d4f; color: #ff4d4f;">
                <Trash2 style="width: 18px; height: 18px;" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-if="pagination.total > 0" style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 16px 24px; background: white; border-radius: 12px; border: 1px solid #e8e8e8;">
      <div style="color: #666; font-size: 14px;">
        共 {{ pagination.total }} 条记录，第 {{ pagination.page }} 页
      </div>
      <div style="display: flex; gap: 8px;">
        <Button 
          variant="outline" 
          @click="handlePageChange(pagination.page - 1)" 
          :disabled="pagination.page <= 1"
          style="font-size: 14px; padding: 8px 16px; border-radius: 8px;"
        >
          上一页
        </Button>
        <Button 
          variant="outline" 
          @click="handlePageChange(pagination.page + 1)" 
          :disabled="pagination.page * pagination.limit >= pagination.total"
          style="font-size: 14px; padding: 8px 16px; border-radius: 8px;"
        >
          下一页
        </Button>
      </div>
    </div>

    <!-- 空状态提示 -->
    <div v-if="!loading && pagination.total === 0" style="padding: 80px; background: white; border-radius: 12px; border: 1px solid #e8e8e8; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center; color: #999; font-size: 18px;">
      <div style="font-size: 64px; margin-bottom: 16px;">📭</div>
      <div style="font-size: 20px; margin-bottom: 8px;">暂无住房记录</div>
      <div style="font-size: 16px; color: #bbb;">点击上方按钮添加第一条记录</div>
    </div>

    <!-- 详情弹窗 -->
    <transition name="fade">
      <div v-if="showDetailModal" class="modal-overlay" @click="showDetailModal = false">
        <div class="modal-large" @click.stop>
          <div class="modal-header-large">
            <div>
              <span class="modal-title">记录详情</span>
              <p class="modal-subtitle">{{ currentRecord?.address }}</p>
            </div>
            <Button variant="ghost" size="icon" @click="showDetailModal = false" style="width: 36px; height: 36px; padding: 0;">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </Button>
          </div>
          
          <div class="modal-body-scroll">
            <!-- 基本信息 -->
            <div class="section">
              <h3 class="section-title">基本信息</h3>
              <div class="grid-3">
                <div class="info-card">
                  <div class="info-label">住房渠道</div>
                  <div class="info-value">{{ currentRecord?.housing_channel || '未知' }}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">入住日期</div>
                  <div class="info-value">{{ formatDate(currentRecord?.move_in_date) }}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">退房日期</div>
                  <div class="info-value">{{ formatDate(currentRecord?.move_out_date) || '至今' }}</div>
                </div>
              </div>
            </div>

            <!-- 费用汇总 -->
            <div class="section">
              <h3 class="section-title">费用汇总</h3>
              <div class="grid-5">
                <div class="stat-card">
                  <div class="stat-label">居住天数</div>
                  <div class="stat-value">{{ currentRecord?.stay_days || 0 }} 天</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">总费用</div>
                  <div class="stat-value-primary">¥{{ Number(currentRecord?.total_cost || 0).toFixed(2) }}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">单日花费</div>
                  <div class="stat-value-primary">¥{{ Number(currentRecord?.daily_cost || 0).toFixed(2) }}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">单月租金</div>
                  <div class="stat-value">{{ monthlyRentRef.toFixed(2) }}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">季度租金</div>
                  <div class="stat-value">{{ quarterlyRentRef.toFixed(2) }}</div>
                </div>
              </div>
            </div>

            <!-- 费用明细 -->
            <div class="section">
              <h3 class="section-title">费用明细</h3>
              <div class="grid-4">
                <div class="fee-card">
                  <div class="fee-label">房租</div>
                  <div class="fee-value">¥{{ Number(currentRecord?.rent || 0).toFixed(2) }}</div>
                </div>
                <div class="fee-card">
                  <div class="fee-label">押金</div>
                  <div class="fee-value">¥{{ Number(currentRecord?.deposit || 0).toFixed(2) }}</div>
                </div>
                <div class="fee-card">
                  <div class="fee-label">中介费</div>
                  <div class="fee-value">¥{{ Number(currentRecord?.agency_fee || 0).toFixed(2) }}</div>
                </div>
                <div class="fee-card">
                  <div class="fee-label">电费</div>
                  <div class="fee-value">¥{{ Number(currentRecord?.electricity_fee || 0).toFixed(2) }}</div>
                </div>
                <div class="fee-card">
                  <div class="fee-label">水费</div>
                  <div class="fee-value">¥{{ Number(currentRecord?.water_fee || 0).toFixed(2) }}</div>
                </div>
                <div class="fee-card">
                  <div class="fee-label">燃气费</div>
                  <div class="fee-value">¥{{ Number(currentRecord?.gas_fee || 0).toFixed(2) }}</div>
                </div>
                <div class="fee-card">
                  <div class="fee-label">卫生费</div>
                  <div class="fee-value">¥{{ Number(currentRecord?.cleaning_fee || 0).toFixed(2) }}</div>
                </div>
                <div class="fee-card">
                  <div class="fee-label">洗衣费</div>
                  <div class="fee-value">¥{{ Number(currentRecord?.laundry_fee || 0).toFixed(2) }}</div>
                </div>
                <div class="fee-card">
                  <div class="fee-label">服务费</div>
                  <div class="fee-value">¥{{ Number(currentRecord?.service_fee || 0).toFixed(2) }}</div>
                </div>
              </div>
            </div>

            <!-- 备注 -->
            <div v-if="currentRecord?.notes" class="section">
              <h3 class="section-title">备注</h3>
              <div class="notes-card">{{ currentRecord.notes }}</div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style>
.toast-success {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #52c41a;
}

.toast-error {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  color: #ff4d4f;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}

.modal-large {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}

.modal-header {
  padding: 24px 32px;
  border-bottom: 1px solid #e8e8e8;
}

.modal-header-large {
  padding: 24px 32px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
  border-radius: 12px 12px 0 0;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.modal-subtitle {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: #999;
}

.modal-body {
  padding: 32px;
  font-size: 16px;
  color: #666;
  line-height: 1.6;
}

.modal-body-scroll {
  padding: 32px;
}

.modal-footer {
  padding: 20px 32px;
  border-top: 1px solid #e8e8e8;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.section {
  margin-bottom: 32px;
}

.section-title {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #333;
  font-weight: 600;
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.grid-5 {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.info-card, .fee-card {
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}

.info-label, .fee-label, .stat-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.info-value {
  font-size: 16px;
  color: #333;
  font-weight: 500;
}

.fee-value {
  font-size: 18px;
  color: #333;
  font-weight: 600;
}

.stat-card {
  padding: 20px;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #0066FF;
}

.stat-value-primary {
  font-size: 28px;
  font-weight: 700;
  color: #0066FF;
}

.notes-card {
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  font-size: 15px;
  color: #666;
  line-height: 1.6;
}
</style>
