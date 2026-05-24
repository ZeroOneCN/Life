<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Plus, Trash2, Edit2 } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { Select, SelectItem } from '@/components/ui/select'
import api from '@/services/api'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()

const formRef = ref()
const loading = ref(false)
const housingChannels = ref([])

// 自定义 Toast
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

const editId = computed(() => route.params.id || route.query.id)
const isEditMode = computed(() => !!editId.value)

const formState = reactive({
  address: '',
  housing_channel_id: null,
  move_in_date: '',
  move_out_date: '',
  rent: 0,
  deposit: 0,
  electricity_fee: 0,
  water_fee: 0,
  gas_fee: 0,
  agency_fee: 0,
  cleaning_fee: 0,
  laundry_fee: 0,
  service_fee: 0,
  notes: ''
})

const errors = ref({})

// 加载渠道列表
const fetchHousingChannels = async () => {
  try {
    const response = await api.get('/channels')
    housingChannels.value = response.data.data || response.data
    console.log('渠道列表加载成功:', housingChannels.value)
  } catch (error) {
    console.error('加载渠道失败:', error)
    showMessage('加载渠道失败', 'error')
  }
}

const validateField = (name, value) => {
  if (name === 'address' && !value) {
    errors.value.address = '请输入地址'
    return false
  }
  if (name === 'move_in_date' && !value) {
    errors.value.move_in_date = '请选择入住日期'
    return false
  }
  delete errors.value[name]
  return true
}

const validateAll = () => {
  const valid = validateField('address', formState.address) &&
                validateField('move_in_date', formState.move_in_date)
  return valid
}

const costPreview = computed(() => {
  const moveIn = formState.move_in_date ? dayjs(formState.move_in_date) : null
  const moveOut = formState.move_out_date ? dayjs(formState.move_out_date) : dayjs()

  const stayDays = moveIn ? Math.ceil(moveOut.diff(moveIn, 'day', true)) : 0

  const totalCost =
    (formState.rent || 0) +
    (formState.electricity_fee || 0) +
    (formState.water_fee || 0) +
    (formState.gas_fee || 0) +
    (formState.agency_fee || 0) +
    (formState.cleaning_fee || 0) +
    (formState.laundry_fee || 0) +
    (formState.service_fee || 0)

  const dailyCost = stayDays > 0 ? totalCost / stayDays : 0
  const monthlyRent = stayDays > 0 ? ((formState.rent || 0) * 30) / stayDays : 0
  const quarterlyRent = monthlyRent * 3

  return {
    stayDays: stayDays > 0 ? stayDays : 0,
    totalCost,
    dailyCost,
    monthlyRent,
    quarterlyRent
  }
})

const handleSubmit = async () => {
  if (!validateAll()) {
    showMessage('请检查表单填写', 'error')
    return
  }

  loading.value = true
  try {
    const submitData = { ...formState }

    if (isEditMode.value) {
      await api.put(`/housing/${editId.value}`, submitData)
      showMessage('住房记录更新成功', 'success')
      // 编辑模式下不跳转，重新加载数据
      loadEditData()
    } else {
      const result = await api.post('/housing', submitData)
      showMessage('住房记录创建成功', 'success')
      // 新增模式下跳转到编辑页面
      const newId = result.data?.data?.id || result.data?.id
      if (newId) {
        router.push('/edit/' + newId)
      } else {
        setTimeout(() => {
          router.push('/')
        }, 1000)
      }
    }
  } catch (error) {
    console.error('提交失败:', error)
    const errorMsg = error.response?.data?.message || error.message || '未知错误'
    showMessage(isEditMode.value ? '更新记录失败：' + errorMsg : '创建记录失败：' + errorMsg, 'error')
  } finally {
    loading.value = false
  }
}

const handleReset = () => {
  Object.assign(formState, {
    address: '',
    housing_channel_id: null,
    move_in_date: '',
    move_out_date: '',
    rent: 0,
    deposit: 0,
    electricity_fee: 0,
    water_fee: 0,
    gas_fee: 0,
    agency_fee: 0,
    cleaning_fee: 0,
    laundry_fee: 0,
    service_fee: 0,
    notes: ''
  })
  errors.value = {}
}

const loadEditData = async () => {
  if (!isEditMode.value || !editId.value) return

  loading.value = true
  try {
    const response = await api.get(`/housing/${editId.value}`)
    const record = response.data?.data || response.data

    Object.assign(formState, {
      address: record.address || '',
      housing_channel_id: record.housing_channel_id || null,
      move_in_date: record.move_in_date ? dayjs(record.move_in_date).format('YYYY-MM-DD') : '',
      move_out_date: record.move_out_date ? dayjs(record.move_out_date).format('YYYY-MM-DD') : '',
      rent: Number(record.rent) || 0,
      deposit: Number(record.deposit) || 0,
      electricity_fee: Number(record.electricity_fee) || 0,
      water_fee: Number(record.water_fee) || 0,
      gas_fee: Number(record.gas_fee) || 0,
      agency_fee: Number(record.agency_fee) || 0,
      cleaning_fee: Number(record.cleaning_fee) || 0,
      laundry_fee: Number(record.laundry_fee) || 0,
      service_fee: Number(record.service_fee) || 0,
      notes: record.notes || ''
    })
  } catch (error) {
    console.error('加载编辑数据失败:', error)
    if (error.status !== 404) {
      showMessage('加载住房记录失败', 'error')
    }
    router.push('/')
  } finally {
    loading.value = false
  }
}

watch(editId, (newId) => {
  if (newId) {
    loadEditData()
  }
})

onMounted(() => {
  fetchHousingChannels()
  if (isEditMode.value) {
    loadEditData()
  }
})
</script>

<template>
  <div style="padding: 0; background: #f5f7fa; min-height: 100vh;">
    <!-- 自定义 Toast -->
    <transition name="toast">
      <div v-if="showToast" style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); padding: 14px 28px; background: white; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); display: flex; align-items: center; z-index: 9999; font-size: 16px; font-weight: 500;" :class="toastType === 'success' ? 'toast-success' : 'toast-error'">
        <span>{{ toastMessage }}</span>
      </div>
    </transition>

    <div style="margin-bottom: 32px; padding: 24px 32px; background: white; border-radius: 12px; border: 1px solid #e8e8e8; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <Button @click="$router.back()" variant="outline" style="font-size: 16px; padding: 10px 18px; border-radius: 8px; border-color: #d9d9d9;">
            <ArrowLeft style="width: 20px; height: 20px; margin-right: 6px;" />
            
          </Button>
          <div>
            <h1 style="margin: 0; font-size: 28px; color: #333; font-weight: 600; letter-spacing: 0.5px;">{{ isEditMode ? '编辑住房记录' : '新增住房记录' }}</h1>
            <p style="margin: 8px 0 0 0; color: #999; font-size: 16px;">{{ isEditMode ? '修改现有住房记录信息' : '录入新的住房信息' }}</p>
          </div>
        </div>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- 住房信息 -->
      <div style="padding: 28px 32px; background: white; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <h3 style="margin: 0 0 20px 0; font-size: 20px; color: #333; font-weight: 600;">住房信息</h3>
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div>
            <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">详细地址 <span style="color: #ff4d4f;">*</span></label>
            <input
              v-model="formState.address"
              placeholder="请输入详细的住房地址"
              style="width: 100%; padding: 12px 16px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; transition: all 0.2s;"
              :style="{ boxShadow: errors.address ? '0 0 0 2px rgba(255,77,79,0.1)' : (formState.address ? '0 0 0 2px rgba(0,102,255,0.1)' : '') }"
            />
            <p v-if="errors.address" style="margin: 8px 0 0 0; font-size: 14px; color: #ff4d4f;">{{ errors.address }}</p>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">入住日期 <span style="color: #ff4d4f;">*</span></label>
              <input
                v-model="formState.move_in_date"
                type="date"
                style="width: 100%; padding: 12px 16px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; background: white; cursor: pointer;"
                :style="{ boxShadow: errors.move_in_date ? '0 0 0 2px rgba(255,77,79,0.1)' : (formState.move_in_date ? '0 0 0 2px rgba(0,102,255,0.1)' : ''), borderColor: errors.move_in_date ? '#ff4d4f' : (formState.move_in_date ? '#0066FF' : '#d9d9d9') }"
              />
              <p v-if="errors.move_in_date" style="margin: 8px 0 0 0; font-size: 14px; color: #ff4d4f;">{{ errors.move_in_date }}</p>
            </div>
            <div>
              <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">退租日期</label>
              <input
                v-model="formState.move_out_date"
                type="date"
                style="width: 100%; padding: 12px 16px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; background: white; cursor: pointer;"
                :style="{ boxShadow: formState.move_out_date ? '0 0 0 2px rgba(0,102,255,0.1)' : '', borderColor: formState.move_out_date ? '#0066FF' : '#d9d9d9' }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 费用信息 -->
      <div style="padding: 28px 32px; background: white; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <h3 style="margin: 0 0 20px 0; font-size: 20px; color: #333; font-weight: 600;">费用信息</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          <div>
            <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">房租</label>
            <div style="position: relative;">
              <input
                v-model.number="formState.rent"
                type="number"
                min="0"
                step="0.01"
                style="width: 100%; padding: 12px 16px; padding-right: 50px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; transition: all 0.2s;"
                :style="{ boxShadow: formState.rent > 0 ? '0 0 0 2px rgba(0,102,255,0.1)' : '' }"
              />
              <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: #999; font-size: 16px;">元</span>
            </div>
          </div>
          <div>
            <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">押金</label>
            <div style="position: relative;">
              <input
                v-model.number="formState.deposit"
                type="number"
                min="0"
                step="0.01"
                style="width: 100%; padding: 12px 16px; padding-right: 50px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; transition: all 0.2s;"
                :style="{ boxShadow: formState.deposit > 0 ? '0 0 0 2px rgba(0,102,255,0.1)' : '' }"
              />
              <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: #999; font-size: 16px;">元</span>
            </div>
          </div>
          <div>
            <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">中介费</label>
            <div style="position: relative;">
              <input
                v-model.number="formState.agency_fee"
                type="number"
                min="0"
                step="0.01"
                style="width: 100%; padding: 12px 16px; padding-right: 50px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; transition: all 0.2s;"
                :style="{ boxShadow: formState.agency_fee > 0 ? '0 0 0 2px rgba(0,102,255,0.1)' : '' }"
              />
              <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: #999; font-size: 16px;">元</span>
            </div>
          </div>
          <div>
            <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">电费</label>
            <div style="position: relative;">
              <input
                v-model.number="formState.electricity_fee"
                type="number"
                min="0"
                step="0.01"
                style="width: 100%; padding: 12px 16px; padding-right: 50px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; transition: all 0.2s;"
                :style="{ boxShadow: formState.electricity_fee > 0 ? '0 0 0 2px rgba(0,102,255,0.1)' : '' }"
              />
              <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: #999; font-size: 16px;">元</span>
            </div>
          </div>
          <div>
            <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">水费</label>
            <div style="position: relative;">
              <input
                v-model.number="formState.water_fee"
                type="number"
                min="0"
                step="0.01"
                style="width: 100%; padding: 12px 16px; padding-right: 50px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; transition: all 0.2s;"
                :style="{ boxShadow: formState.water_fee > 0 ? '0 0 0 2px rgba(0,102,255,0.1)' : '' }"
              />
              <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: #999; font-size: 16px;">元</span>
            </div>
          </div>
          <div>
            <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">燃气费</label>
            <div style="position: relative;">
              <input
                v-model.number="formState.gas_fee"
                type="number"
                min="0"
                step="0.01"
                style="width: 100%; padding: 12px 16px; padding-right: 50px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; transition: all 0.2s;"
                :style="{ boxShadow: formState.gas_fee > 0 ? '0 0 0 2px rgba(0,102,255,0.1)' : '' }"
              />
              <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: #999; font-size: 16px;">元</span>
            </div>
          </div>
          <div>
            <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">卫生费</label>
            <div style="position: relative;">
              <input
                v-model.number="formState.cleaning_fee"
                type="number"
                min="0"
                step="0.01"
                style="width: 100%; padding: 12px 16px; padding-right: 50px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; transition: all 0.2s;"
                :style="{ boxShadow: formState.cleaning_fee > 0 ? '0 0 0 2px rgba(0,102,255,0.1)' : '' }"
              />
              <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: #999; font-size: 16px;">元</span>
            </div>
          </div>
          <div>
            <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">洗衣费</label>
            <div style="position: relative;">
              <input
                v-model.number="formState.laundry_fee"
                type="number"
                min="0"
                step="0.01"
                style="width: 100%; padding: 12px 16px; padding-right: 50px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; transition: all 0.2s;"
                :style="{ boxShadow: formState.laundry_fee > 0 ? '0 0 0 2px rgba(0,102,255,0.1)' : '' }"
              />
              <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: #999; font-size: 16px;">元</span>
            </div>
          </div>
          <div>
            <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">服务费</label>
            <div style="position: relative;">
              <input
                v-model.number="formState.service_fee"
                type="number"
                min="0"
                step="0.01"
                style="width: 100%; padding: 12px 16px; padding-right: 50px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; transition: all 0.2s;"
                :style="{ boxShadow: formState.service_fee > 0 ? '0 0 0 2px rgba(0,102,255,0.1)' : '' }"
              />
              <span style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); color: #999; font-size: 16px;">元</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 其他信息 -->
      <div style="padding: 28px 32px; background: white; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <h3 style="margin: 0 0 20px 0; font-size: 20px; color: #333; font-weight: 600;">其他信息</h3>
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div>
            <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">住房渠道</label>
            <Select v-model="formState.housing_channel_id" placeholder="请选择住房渠道">
              <SelectItem v-for="channel in housingChannels" :key="channel.id" :value="channel.id">
                {{ channel.name }}
              </SelectItem>
            </Select>
          </div>
          <div>
            <label style="display: block; margin-bottom: 10px; font-size: 16px; color: #333; font-weight: 600;">备注信息</label>
            <textarea
              v-model="formState.notes"
              placeholder="请输入备注信息（如居住体验、注意事项等）"
              rows="4"
              style="width: 100%; padding: 12px 16px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; resize: vertical; transition: all 0.2s;"
              :style="{ boxShadow: formState.notes ? '0 0 0 2px rgba(0,102,255,0.1)' : '', borderColor: formState.notes ? '#0066FF' : '#d9d9d9' }"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- 费用预览 -->
      <div style="padding: 28px 32px; background: linear-gradient(135deg, #667eea 0%, #0066FF 100%); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,102,255,0.25);">
        <h3 style="margin: 0 0 24px 0; font-size: 20px; color: white; font-weight: 600;">费用预览</h3>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px;">
          <div style="padding: 20px; background: rgba(255,255,255,0.95); border-radius: 10px; text-align: center;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px; font-weight: 500;">居住天数</div>
            <div style="font-size: 28px; font-weight: 700; color: #333;">{{ costPreview.stayDays }} 天</div>
          </div>
          <div style="padding: 20px; background: rgba(255,255,255,0.95); border-radius: 10px; text-align: center;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px; font-weight: 500;">总费用</div>
            <div style="font-size: 28px; font-weight: 700; color: #0066FF;">¥{{ costPreview.totalCost.toFixed(2) }}</div>
          </div>
          <div style="padding: 20px; background: rgba(255,255,255,0.95); border-radius: 10px; text-align: center;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px; font-weight: 500;">单日花费</div>
            <div style="font-size: 28px; font-weight: 700; color: #333;">¥{{ costPreview.dailyCost.toFixed(2) }}</div>
          </div>
          <div style="padding: 20px; background: rgba(255,255,255,0.95); border-radius: 10px; text-align: center;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px; font-weight: 500;">单月租金</div>
            <div style="font-size: 28px; font-weight: 700; color: #333;">¥{{ costPreview.monthlyRent.toFixed(2) }}</div>
          </div>
          <div style="padding: 20px; background: rgba(255,255,255,0.95); border-radius: 10px; text-align: center;">
            <div style="font-size: 14px; color: #666; margin-bottom: 8px; font-weight: 500;">季度租金</div>
            <div style="font-size: 28px; font-weight: 700; color: #333;">¥{{ costPreview.quarterlyRent.toFixed(2) }}</div>
          </div>
        </div>
      </div>

      <!-- 表单操作 -->
      <div style="display: flex; justify-content: center; gap: 16px; padding: 24px; background: white; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <Button variant="outline" @click="handleReset" style="font-size: 16px; padding: 12px 32px; border-radius: 8px; border-color: #d9d9d9;">重置</Button>
        <Button @click="handleSubmit" :loading="loading" style="font-size: 16px; padding: 12px 32px; border-radius: 8px; background-color: #0066FF; border-color: #0066FF; font-weight: 500; box-shadow: 0 2px 8px rgba(0,102,255,0.25);">
          {{ isEditMode ? '更新记录' : '提交记录' }}
        </Button>
      </div>
    </div>
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

.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
