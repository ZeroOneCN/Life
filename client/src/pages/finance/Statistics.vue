<script setup>
import { ref, onMounted, computed } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { housingApi } from '@/services/api'
import dayjs from 'dayjs'

const loading = ref(false)
const housingRecords = ref([])
const stats = ref({})

// 自定义弹窗
const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref('success')

const showMessage = (msg, type = 'success') => {
  toastMessage.value = msg
  toastType.value = type
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 2000)
}

const loadData = async () => {
  loading.value = true
  try {
    const [recordsResponse, statsResponse] = await Promise.all([
      housingApi.getAll(),
      housingApi.getStats()
    ])

    const rows = recordsResponse.data?.data || []
    housingRecords.value = rows.map(r => ({
      ...r,
      stay_days: Number(r.stay_days ?? 0),
      total_cost: Number(r.total_cost ?? 0),
      daily_cost: Number(r.daily_cost ?? 0),
      rent: Number(r.rent ?? 0),
      electricity_fee: Number(r.electricity_fee ?? 0),
      water_fee: Number(r.water_fee ?? 0),
      gas_fee: Number(r.gas_fee ?? 0),
      agency_fee: Number(r.agency_fee ?? 0),
      cleaning_fee: Number(r.cleaning_fee ?? 0),
      laundry_fee: Number(r.laundry_fee ?? 0),
      service_fee: Number(r.service_fee ?? 0),
      housing_channel: r.housing_channel ?? '未知'
    }))

    stats.value = statsResponse.data?.data || {}
  } catch (error) {
    showMessage('加载统计信息失败', 'error')
  } finally {
    loading.value = false
  }
}

const costBreakdown = computed(() => {
  const rentTotal = housingRecords.value.reduce((sum, record) => sum + (Number(record.rent) || 0), 0)
  const agencyFeeTotal = housingRecords.value.reduce((sum, record) => sum + (Number(record.agency_fee) || 0), 0)
  const electricityFeeTotal = housingRecords.value.reduce((sum, record) => sum + (Number(record.electricity_fee) || 0), 0)
  const waterFeeTotal = housingRecords.value.reduce((sum, record) => sum + (Number(record.water_fee) || 0), 0)
  const gasFeeTotal = housingRecords.value.reduce((sum, record) => sum + (Number(record.gas_fee) || 0), 0)
  const cleaningFeeTotal = housingRecords.value.reduce((sum, record) => sum + (Number(record.cleaning_fee) || 0), 0)
  const laundryFeeTotal = housingRecords.value.reduce((sum, record) => sum + (Number(record.laundry_fee) || 0), 0)
  const serviceFeeTotal = housingRecords.value.reduce((sum, record) => sum + (Number(record.service_fee) || 0), 0)
  
  const itemsTotal = rentTotal + agencyFeeTotal + electricityFeeTotal + waterFeeTotal + gasFeeTotal + cleaningFeeTotal + laundryFeeTotal + serviceFeeTotal
  
  if (itemsTotal === 0) return []

  const breakdown = [
    { label: '房租', value: rentTotal, color: '#0066FF' },
    { label: '中介费', value: agencyFeeTotal, color: '#FF9500' },
    { label: '电费', value: electricityFeeTotal, color: '#FFC107' },
    { label: '水费', value: waterFeeTotal, color: '#00BCD4' },
    { label: '燃气费', value: gasFeeTotal, color: '#9C27B0' },
    { label: '卫生费', value: cleaningFeeTotal, color: '#E91E63' },
    { label: '洗衣费', value: laundryFeeTotal, color: '#FF5722' },
    { label: '服务费', value: serviceFeeTotal, color: '#673AB7' }
  ]

  return breakdown
    .map(item => ({
      ...item,
      percentage: itemsTotal > 0 ? (item.value / itemsTotal) * 100 : 0
    }))
    .filter(item => item.value > 0)
})

const channelStats = computed(() => {
  const channels = {}
  housingRecords.value.forEach(record => {
    const channel = record.housing_channel || '未知'
    channels[channel] = (channels[channel] || 0) + 1
  })

  return Object.entries(channels)
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count)
})

const avgMonthlyCost = computed(() => {
  const totalDays = housingRecords.value.reduce((sum, r) => sum + (r.stay_days || 0), 0)
  const totalCost = housingRecords.value.reduce((sum, r) => sum + (r.total_cost || 0), 0)
  if (totalDays <= 0) return 0
  return totalCost / (totalDays / 30)
})

onMounted(() => {
  loadData()
})
</script>

<template>
  <div style="padding: 0;">
    <!-- 自定义 Toast -->
    <transition name="toast">
      <div v-if="showToast" style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); padding: 14px 28px; background: white; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); display: flex; align-items: center; z-index: 9999; font-size: 16px; font-weight: 500;" :style="{ border: toastType === 'success' ? '1px solid #b7eb8f' : '1px solid #ffccc7', color: toastType === 'success' ? '#52c41a' : '#ff4d4f', backgroundColor: toastType === 'success' ? '#f6ffed' : '#fff2f0' }">
        <span>{{ toastMessage }}</span>
      </div>
    </transition>

    <!-- 页面标题 -->
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 32px; padding: 24px 32px; background: white; border-radius: 12px; border: 1px solid #e8e8e8; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
      <div>
        <h1 style="margin: 0; font-size: 28px; color: #333; font-weight: 600; letter-spacing: 0.5px;">统计信息</h1>
        <p style="margin: 8px 0 0 0; color: #999; font-size: 16px;">住房记录数据分析</p>
      </div>
    </div>

    <!-- 总体统计卡片 -->
    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; margin-bottom: 32px;">
      <div style="padding: 28px; background: white; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center;">
        <div style="font-size: 16px; color: #999; margin-bottom: 12px; font-weight: 500;">总记录数</div>
        <div style="font-size: 36px; font-weight: 700; color: #0066FF;">{{ stats.total_records ?? 0 }}</div>
      </div>
      <div style="padding: 28px; background: white; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center;">
        <div style="font-size: 16px; color: #999; margin-bottom: 12px; font-weight: 500;">总居住天数</div>
        <div style="font-size: 36px; font-weight: 700; color: #0066FF;">{{ stats.total_days ?? 0 }}</div>
      </div>
      <div style="padding: 28px; background: white; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center;">
        <div style="font-size: 16px; color: #999; margin-bottom: 12px; font-weight: 500;">总花费</div>
        <div style="font-size: 36px; font-weight: 700; color: #0066FF;">¥{{ Number(stats.total_cost || 0).toFixed(2) }}</div>
      </div>
      <div style="padding: 28px; background: white; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center;">
        <div style="font-size: 16px; color: #999; margin-bottom: 12px; font-weight: 500;">平均单日花费</div>
        <div style="font-size: 36px; font-weight: 700; color: #0066FF;">¥{{ Number(stats.avg_daily_cost || 0).toFixed(2) }}</div>
      </div>
      <div style="padding: 28px; background: white; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: center;">
        <div style="font-size: 16px; color: #999; margin-bottom: 12px; font-weight: 500;">平均单月花费</div>
        <div style="font-size: 36px; font-weight: 700; color: #0066FF;">¥{{ avgMonthlyCost.toFixed(2) }}</div>
      </div>
    </div>

    <!-- 费用分布和渠道分布 -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 32px;">
      <div style="padding: 28px; background: white; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: #333; font-weight: 600;">费用类型分布</h3>
        <div v-if="costBreakdown.length > 0" style="display: flex; flex-direction: column; gap: 16px;">
          <div v-for="(item, index) in costBreakdown" :key="index" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 16px;">
              <span style="color: #333; font-weight: 500;">{{ item.label }}</span>
              <span style="color: #333; font-weight: 600;">¥{{ item.value.toFixed(2) }}</span>
            </div>
            <div style="height: 10px; background: #f0f0f0; border-radius: 5px; overflow: hidden;">
              <div :style="{ width: item.percentage + '%', height: '100%', background: item.color, transition: 'width 0.3s', borderRadius: '5px' }"></div>
            </div>
            <div style="text-align: right; font-size: 14px; color: #999; font-weight: 500;">{{ item.percentage.toFixed(1) }}%</div>
          </div>
        </div>
        <div v-else style="text-align: center; padding: 40px; color: #bbb; font-size: 18px;">暂无数据</div>
      </div>

      <div style="padding: 28px; background: white; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: #333; font-weight: 600;">住房渠道分布</h3>
        <div v-if="channelStats.length > 0" style="display: flex; flex-direction: column; gap: 12px;">
          <div v-for="(item, index) in channelStats" :key="index" style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #fafafa; border-radius: 8px;">
            <span style="color: #333; font-weight: 600; font-size: 16px;">{{ item.channel }}</span>
            <div style="display: flex; align-items: center; gap: 16px;">
              <span style="color: #666; font-size: 16px; font-weight: 500;">{{ item.count }} 次</span>
              <span style="padding: 4px 12px; background: #e6f4ff; color: #0066FF; border-radius: 6px; font-size: 14px; font-weight: 600;">{{ ((item.count / housingRecords.length) * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
        <div v-else style="text-align: center; padding: 40px; color: #bbb; font-size: 18px;">暂无数据</div>
      </div>
    </div>
  </div>
</template>

<style>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style>
