<script setup>
import { ref, onMounted } from 'vue'
import { Pencil, Trash2 } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import api from '@/services/api'

const channels = ref([])
const isLoading = ref(false)
const isAdding = ref(false)
const newChannelName = ref('')

const isEditModalVisible = ref(false)
const isUpdating = ref(false)
const editingChannel = ref({ id: null, name: '' })

const showDeleteConfirm = ref(false)
const channelToDelete = ref(null)

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

const fetchChannels = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/channels')
    channels.value = response.data.data || response.data
  } catch (error) {
    console.error('加载渠道失败:', error)
    showMessage('加载渠道失败', 'error')
  } finally {
    isLoading.value = false
  }
}

const addChannel = async () => {
  if (!newChannelName.value.trim()) {
    showMessage('渠道名称不能为空', 'error')
    return
  }
  isAdding.value = true
  try {
    const response = await api.post('/channels', { name: newChannelName.value })
    channels.value.unshift(response.data.data)
    newChannelName.value = ''
    showMessage('渠道添加成功', 'success')
  } catch (error) {
    if (error.status === 409) {
      showMessage('渠道名称已存在', 'error')
    } else {
      showMessage('添加渠道失败', 'error')
    }
  } finally {
    isAdding.value = false
  }
}

const editChannel = (channel) => {
  editingChannel.value = { ...channel }
  isEditModalVisible.value = true
}

const handleUpdateChannel = async () => {
  if (!editingChannel.value.name.trim()) {
    showMessage('渠道名称不能为空', 'error')
    return
  }
  isUpdating.value = true
  try {
    await api.put(`/channels/${editingChannel.value.id}`, { name: editingChannel.value.name })
    const index = channels.value.findIndex(c => c.id === editingChannel.value.id)
    if (index !== -1) {
      channels.value[index].name = editingChannel.value.name
    }
    isEditModalVisible.value = false
    showMessage('渠道更新成功', 'success')
  } catch (error) {
    if (error.status === 409) {
      showMessage('渠道名称已存在', 'error')
    } else {
      showMessage('更新渠道失败', 'error')
    }
  } finally {
    isUpdating.value = false
  }
}

const confirmDelete = (channel) => {
  channelToDelete.value = channel
  showDeleteConfirm.value = true
}

const handleDeleteConfirm = async () => {
  if (!channelToDelete.value) return
  try {
    await api.delete(`/channels/${channelToDelete.value.id}`)
    channels.value = channels.value.filter(c => c.id !== channelToDelete.value.id)
    showMessage('渠道删除成功', 'success')
  } catch (error) {
    showMessage('删除渠道失败', 'error')
  }
  showDeleteConfirm.value = false
  channelToDelete.value = null
}

const handleDeleteCancel = () => {
  showDeleteConfirm.value = false
  channelToDelete.value = null
}

onMounted(fetchChannels)
</script>

<template>
  <div style="padding: 0;">
    <!-- 自定义 Toast -->
    <transition name="toast">
      <div v-if="showToast" style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); padding: 14px 28px; background: white; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); display: flex; align-items: center; z-index: 9999; font-size: 16px; font-weight: 500;" :style="{ border: toastType === 'success' ? '1px solid #b7eb8f' : '1px solid #ffccc7', color: toastType === 'success' ? '#52c41a' : '#ff4d4f', backgroundColor: toastType === 'success' ? '#f6ffed' : '#fff2f0' }">
        <span>{{ toastMessage }}</span>
      </div>
    </transition>

    <!-- 删除确认弹窗 -->
    <transition name="fade">
      <div v-if="showDeleteConfirm" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;" @click="handleDeleteCancel">
        <div style="background: white; border-radius: 12px; width: 100%; max-width: 440px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);" @click.stop>
          <div style="padding: 24px 32px; border-bottom: 1px solid #e8e8e8;">
            <span style="font-size: 20px; font-weight: 600; color: #333;">确认删除</span>
          </div>
          <div style="padding: 32px; font-size: 16px; color: #666; line-height: 1.6;">
            确定要删除这个渠道吗？
          </div>
          <div style="padding: 20px 32px; border-top: 1px solid #e8e8e8; display: flex; justify-content: flex-end; gap: 12px;">
            <Button variant="outline" @click="handleDeleteCancel" style="font-size: 16px; padding: 10px 24px; border-radius: 8px; border-color: #d9d9d9;">取消</Button>
            <Button @click="handleDeleteConfirm" style="font-size: 16px; padding: 10px 24px; border-radius: 8px; background-color: #ff4d4f; border-color: #ff4d4f;">删除</Button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 页面标题 -->
    <div style="margin-bottom: 32px; padding: 24px 32px; background: white; border-radius: 12px; border: 1px solid #e8e8e8; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
      <h1 style="margin: 0; font-size: 28px; color: #333; font-weight: 600; letter-spacing: 0.5px;">渠道管理</h1>
      <p style="margin: 8px 0 0 0; color: #999; font-size: 16px;">管理系统中的住房渠道信息</p>
    </div>

    <!-- 添加渠道 -->
    <div style="padding: 28px 32px; background: white; border-radius: 12px; border: 1px solid #e8e8e8; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 24px;">
      <div style="display: flex; gap: 16px; align-items: center;">
        <input
          v-model="newChannelName"
          placeholder="请输入渠道名称"
          @keyup.enter="addChannel"
          style="flex: 1; max-width: 400px; padding: 12px 18px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; transition: all 0.2s;"
          :style="{ boxShadow: newChannelName ? '0 0 0 2px rgba(0,102,255,0.1)' : '' }"
        />
        <Button @click="addChannel" :loading="isAdding" style="font-size: 16px; padding: 12px 32px; border-radius: 8px; background-color: #0066FF; border-color: #0066FF; font-weight: 500; box-shadow: 0 2px 8px rgba(0,102,255,0.25);">添加渠道</Button>
      </div>
    </div>

    <!-- 渠道列表 -->
    <div style="background: white; border-radius: 12px; border: 1px solid #e8e8e8; box-shadow: 0 2px 8px rgba(0,0,0,0.04); overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead style="background: #fafafa; border-bottom: 1px solid #e8e8e8;">
          <tr>
            <th style="padding: 18px 32px; text-align: left; font-weight: 600; color: #333; font-size: 16px;">渠道名称</th>
            <th style="padding: 18px 32px; text-align: center; font-weight: 600; color: #333; font-size: 16px; width: 280px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="channel in channels" :key="channel.id" style="border-bottom: 1px solid #f0f0f0; transition: background 0.2s;" @mouseenter="$event.currentTarget.style.background = '#fafafa'" @mouseleave="$event.currentTarget.style.background = ''">
            <td style="padding: 18px 32px; color: #333; font-size: 16px; font-weight: 500;">{{ channel.name }}</td>
            <td style="padding: 18px 32px; text-align: center;">
              <Button variant="outline" size="sm" @click="editChannel(channel)" style="margin-right: 10px; font-size: 15px; padding: 8px 18px; border-radius: 8px; border-color: #0066FF; color: #0066FF; font-weight: 500;">
                <Pencil style="width: 16px; height: 16px; margin-right: 6px;" />
                编辑
              </Button>
              <Button variant="outline" size="sm" @click="confirmDelete(channel)" style="font-size: 15px; padding: 8px 18px; border-radius: 8px; border-color: #ff4d4f; color: #ff4d4f; font-weight: 500;">
                <Trash2 style="width: 16px; height: 16px; margin-right: 6px;" />
                删除
              </Button>
            </td>
          </tr>
          <tr v-if="channels.length === 0">
            <td colspan="2" style="padding: 60px; text-align: center; color: #bbb; font-size: 18px;">暂无渠道数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 编辑弹窗 -->
    <transition name="fade">
      <div v-if="isEditModalVisible" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;" @click="isEditModalVisible = false">
        <div style="background: white; border-radius: 12px; width: 100%; max-width: 440px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);" @click.stop>
          <div style="padding: 24px 32px; border-bottom: 1px solid #e8e8e8;">
            <span style="font-size: 20px; font-weight: 600; color: #333;">编辑渠道名称</span>
          </div>
          <div style="padding: 32px;">
            <input
              v-model="editingChannel.name"
              placeholder="请输入新的渠道名称"
              style="width: 100%; padding: 12px 18px; border: 1px solid #d9d9d9; border-radius: 8px; font-size: 16px; box-sizing: border-box; transition: all 0.2s;"
              :style="{ boxShadow: '0 0 0 2px rgba(0,102,255,0.1)', borderColor: '#0066FF' }"
            />
          </div>
          <div style="padding: 20px 32px; border-top: 1px solid #e8e8e8; display: flex; justify-content: flex-end; gap: 12px;">
            <Button variant="outline" @click="isEditModalVisible = false" style="font-size: 16px; padding: 10px 24px; border-radius: 8px; border-color: #d9d9d9;">取消</Button>
            <Button @click="handleUpdateChannel" :loading="isUpdating" style="font-size: 16px; padding: 10px 24px; border-radius: 8px; background-color: #0066FF; border-color: #0066FF; font-weight: 500;">更新</Button>
          </div>
        </div>
      </div>
    </transition>
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

.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
