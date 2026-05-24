// @ts-nocheck
import { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, RefreshCw, Package, DollarSign, Store, Calendar, Upload, X, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Palette, Book, BookOpen, MoreVertical, Settings } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface ShoppingRecord {
  id: number
  name: string
  spec: string | null
  price: number
  unit_price: number | null
  platform: string
  date: string
  order_no: string | null
  note: string | null
  ledger_id: number
}

interface Ledger {
  id: number
  name: string
  description: string | null
  start_date: string
  end_date: string | null
  is_active: number
  total_records: number
  total_amount: number
}

interface Stats {
  total: number
  amount: number
  platforms: { platform: string; count: number; amount: number }[]
  months: { month: string; count: number; amount: number }[]
}

const PLATFORM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '拼多多': { bg: 'bg-red-900', text: 'text-red-100', border: 'border-red-700' },
  '淘宝': { bg: 'bg-orange-900', text: 'text-orange-100', border: 'border-orange-700' },
  '京东': { bg: 'bg-blue-900', text: 'text-blue-100', border: 'border-blue-700' },
  '抖音': { bg: 'bg-pink-900', text: 'text-pink-100', border: 'border-pink-700' },
  '唯品会': { bg: 'bg-purple-900', text: 'text-purple-100', border: 'border-purple-700' },
  '美团': { bg: 'bg-yellow-900', text: 'text-yellow-100', border: 'border-yellow-700' },
  '苏宁': { bg: 'bg-green-900', text: 'text-green-100', border: 'border-green-700' },
  '其他': { bg: 'bg-gray-700', text: 'text-gray-100', border: 'border-gray-600' },
}

const EXCHANGE_RATES = {
  USDT: { rate: 1 / 7.0, symbol: '₮', name: 'USDT' },
}

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`}>
      {type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

interface ConfirmProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmDialog = ({ title, message, onConfirm, onCancel }: ConfirmProps) => {
  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button variant="destructive" onClick={onConfirm}>确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const ITEMS_PER_PAGE = 10

function App() {
  const [records, setRecords] = useState<ShoppingRecord[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [platforms, setPlatforms] = useState<{ name: string }[]>([])
  const [ledgers, setLedgers] = useState<Ledger[]>([])
  const [currentLedger, setCurrentLedger] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [platformDialogOpen, setPlatformDialogOpen] = useState(false)
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false)
  const [ledgerListOpen, setLedgerListOpen] = useState(false)
  const [editingPlatform, setEditingPlatform] = useState<{ name: string } | null>(null)
  const [newPlatform, setNewPlatform] = useState('')
  const [currencyMode, setCurrencyMode] = useState<'CNY' | 'USDT'>('CNY')
  
  const [searchTerm, setSearchTerm] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ShoppingRecord | null>(null)
  
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('shopping_current_page')
    return saved ? parseInt(saved) : 1
  })
  const [totalPages, setTotalPages] = useState(1)

  const [formData, setFormData] = useState({
    name: '',
    spec: '',
    price: '',
    unit_price: '',
    platform: '拼多多',
    date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    order_no: '',
    note: '',
    ledger_id: 1,
  })
  
  const [ledgerForm, setLedgerForm] = useState({
    id: 0,
    name: '',
    description: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    is_active: 1,
  })
  
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [userSettings, setUserSettings] = useState({
    usdtRate: 7.0,
  })

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  // 加载用户设置
  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.success) {
        setUserSettings(data.data)
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  }

  // 保存用户设置
  const saveSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usdtRate: userSettings.usdtRate }),
      })
      const data = await res.json()
      if (data.success) {
        setToast({ message: '设置已保存', type: 'success' })
        setSettingsOpen(false)
      } else {
        setToast({ message: data.message, type: 'error' })
      }
    } catch (error) {
      setToast({ message: '保存失败：' + error, type: 'error' })
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const ledgerParam = currentLedger ? `?ledger_id=${currentLedger}` : ''
      
      const [recordsRes, statsRes, platformsRes, ledgersRes] = await Promise.all([
        fetch(`/api/records${ledgerParam}`),
        fetch(`/api/stats${ledgerParam}`),
        fetch('/api/platforms'),
        fetch('/api/ledgers'),
      ])
      
      const recordsData = await recordsRes.json()
      const statsData = await statsRes.json()
      const platformsData = await platformsRes.json()
      const ledgersData = await ledgersRes.json()
      
      if (recordsData.success) setRecords(recordsData.data)
      if (statsData.success) setStats(statsData.data)
      if (platformsData.success) setPlatforms(platformsData.data.map((name: string) => ({ name })))
      
      // 账本 API 可能不可用，使用备用方案
      if (ledgersData.success && ledgersData.data) {
        setLedgers(ledgersData.data)
        if (!currentLedger && ledgersData.data.length > 0) {
          setCurrentLedger(ledgersData.data[0].id)
          setFormData(prev => ({ ...prev, ledger_id: ledgersData.data[0].id }))
        }
      } else {
        // 备用：创建默认账本
        console.log('账本 API 不可用，使用默认账本')
        const defaultLedger = {
          id: 1,
          name: '默认账本',
          description: '默认购物记录',
          start_date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
          end_date: null,
          is_active: 1,
          total_records: statsData.data?.total || 0,
          total_amount: statsData.data?.amount || 0,
        }
        setLedgers([defaultLedger])
        if (!currentLedger) {
          setCurrentLedger(1)
          setFormData(prev => ({ ...prev, ledger_id: 1 }))
        }
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    loadSettings()
  }, [currentLedger])

  useEffect(() => {
    const filtered = records.filter(record => {
      const matchSearch = !searchTerm || 
        record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.order_no?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchPlatform = platformFilter === 'all' || record.platform === platformFilter
      const matchDate = !dateFilter || record.date.startsWith(dateFilter.replace(/-/g, ''))
      return matchSearch && matchPlatform && matchDate
    })
    
    const newTotalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
    setTotalPages(newTotalPages || 1)
    
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages)
    }
  }, [records, searchTerm, platformFilter, dateFilter])

  useEffect(() => {
    localStorage.setItem('shopping_current_page', currentPage.toString())
  }, [currentPage])

  const filteredRecords = records.filter(record => {
    const matchSearch = !searchTerm || 
      record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.order_no?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchPlatform = platformFilter === 'all' || record.platform === platformFilter
    const matchDate = !dateFilter || record.date.startsWith(dateFilter.replace(/-/g, ''))
    return matchSearch && matchPlatform && matchDate
  })

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentRecords = filteredRecords.slice(startIndex, endIndex)

  const handleAdd = () => {
    setEditingRecord(null)
    setFormData({
      name: '',
      spec: '',
      price: '',
      unit_price: '',
      platform: platforms[0]?.name || '拼多多',
      date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      order_no: '',
      note: '',
      ledger_id: currentLedger || 1,
    })
    setIsDialogOpen(true)
  }

  const handleEdit = (record: ShoppingRecord) => {
    setEditingRecord(record)
    setFormData({
      name: record.name,
      spec: record.spec || '',
      price: record.price.toString(),
      unit_price: record.unit_price?.toString() || '',
      platform: record.platform,
      date: record.date.length === 8 ? `${record.date.slice(0,4)}-${record.date.slice(4,6)}-${record.date.slice(6,8)}` : record.date,
      order_no: record.order_no || '',
      note: record.note || '',
      ledger_id: record.ledger_id,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (id: number) => {
    setConfirm({
      title: '确认删除',
      message: '确定要删除这条记录吗？此操作不可恢复。',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/records/${id}`, { method: 'DELETE' })
          const data = await res.json()
          if (data.success) {
            setToast({ message: '删除成功', type: 'success' })
            loadData()
          } else {
            setToast({ message: '删除失败：' + data.message, type: 'error' })
          }
        } catch (error) {
          setToast({ message: '删除失败：' + error, type: 'error' })
        }
        setConfirm(null)
      }
    })
  }

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      setToast({ message: '请填写名称和价格', type: 'error' })
      return
    }

    try {
      const url = editingRecord ? `/api/records/${editingRecord.id}` : '/api/records'
      const method = editingRecord ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          unit_price: formData.unit_price ? parseFloat(formData.unit_price) : null,
          date: formData.date.replace(/-/g, ''),
        }),
      })
      
      const data = await res.json()
      if (data.success) {
        setToast({ message: '保存成功', type: 'success' })
        setIsDialogOpen(false)
        loadData()
      } else {
        setToast({ message: '保存失败：' + data.message, type: 'error' })
      }
    } catch (error) {
      setToast({ message: '保存失败：' + error, type: 'error' })
    }
  }

  const handleImport = async (file: File) => {
    try {
      setImporting(true)
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      })

      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text()
        console.error('非 JSON 响应:', text)
        setToast({ message: '导入失败：服务器响应格式错误', type: 'error' })
        return
      }

      const data = await res.json()
      if (data.success) {
        setToast({ message: data.message, type: 'success' })
        setImportDialogOpen(false)
        loadData()
      } else {
        setToast({ message: '导入失败：' + data.message, type: 'error' })
      }
    } catch (error) {
      console.error('导入失败:', error)
      setToast({ message: '导入失败：' + error, type: 'error' })
    } finally {
      setImporting(false)
    }
  }

  const handleAddPlatform = () => {
    if (!newPlatform.trim()) {
      setToast({ message: '请输入平台名称', type: 'error' })
      return
    }
    
    if (platforms.some(p => p.name === newPlatform.trim())) {
      setToast({ message: '平台已存在', type: 'error' })
      return
    }
    
    setPlatforms([...platforms, { name: newPlatform.trim() }])
    setNewPlatform('')
    setPlatformDialogOpen(false)
    setToast({ message: '平台添加成功', type: 'success' })
  }

  const handleEditPlatform = (platform: { name: string }) => {
    setEditingPlatform(platform)
    setNewPlatform(platform.name)
  }

  const handleSavePlatform = () => {
    if (!newPlatform.trim()) {
      setToast({ message: '请输入平台名称', type: 'error' })
      return
    }
    
    if (!editingPlatform) return
    
    if (platforms.some(p => p.name === newPlatform.trim() && p.name !== editingPlatform.name)) {
      setToast({ message: '平台名称已存在', type: 'error' })
      return
    }
    
    setPlatforms(platforms.map(p => 
      p.name === editingPlatform.name ? { name: newPlatform.trim() } : p
    ))
    setEditingPlatform(null)
    setNewPlatform('')
    setToast({ message: '平台已更新', type: 'success' })
  }

  const handleCancelEditPlatform = () => {
    setEditingPlatform(null)
    setNewPlatform('')
  }

  const handleDeletePlatform = (platformName: string) => {
    setConfirm({
      title: '确认删除平台',
      message: `确定要删除平台"${platformName}"吗？这不会影响已有的记录。`,
      onConfirm: () => {
        setPlatforms(platforms.filter(p => p.name !== platformName))
        setToast({ message: '平台已删除', type: 'success' })
        setConfirm(null)
      }
    })
  }

  const handleAddLedger = () => {
    setLedgerForm({
      id: 0,
      name: '',
      description: '',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      is_active: 1,
    })
    setLedgerDialogOpen(true)
  }

  const handleEditLedger = (ledger: Ledger) => {
    setLedgerForm({
      id: ledger.id,
      name: ledger.name,
      description: ledger.description || '',
      start_date: ledger.start_date.length === 8 ? `${ledger.start_date.slice(0,4)}-${ledger.start_date.slice(4,6)}-${ledger.start_date.slice(6,8)}` : ledger.start_date,
      end_date: ledger.end_date ? (ledger.end_date.length === 8 ? `${ledger.end_date.slice(0,4)}-${ledger.end_date.slice(4,6)}-${ledger.end_date.slice(6,8)}` : ledger.end_date) : '',
      is_active: ledger.is_active,
    })
    setLedgerDialogOpen(true)
  }

  const handleSaveLedger = async () => {
    if (!ledgerForm.name.trim()) {
      setToast({ message: '请输入账本名称', type: 'error' })
      return
    }

    try {
      const url = ledgerForm.id ? `/api/ledgers/${ledgerForm.id}` : '/api/ledgers'
      const method = ledgerForm.id ? 'PUT' : 'POST'
      
      const requestBody = {
        id: ledgerForm.id,
        name: ledgerForm.name,
        description: ledgerForm.description,
        start_date: ledgerForm.start_date,
        end_date: ledgerForm.end_date,
        is_active: ledgerForm.is_active,
      }
      
      console.log('更新账本:', { url, method, body: requestBody })
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      
      console.log('响应状态:', res.status)
      const responseData = await res.json()
      console.log('响应数据:', responseData)
      
      // 检查是否是 404（API 未实现）
      if (res.status === 404) {
        setToast({ 
          message: '账本功能需要重启后端服务才能使用，当前使用默认账本', 
          type: 'error' 
        })
        setLedgerDialogOpen(false)
        return
      }
      
      if (responseData.success) {
        setToast({ message: ledgerForm.id ? '账本已更新' : '账本已创建', type: 'success' })
        setLedgerDialogOpen(false)
        // 重新加载账本列表
        console.log('重新加载账本列表...')
        const ledgersRes = await fetch('/api/ledgers')
        const ledgersData = await ledgersRes.json()
        console.log('账本列表数据:', ledgersData)
        if (ledgersData.success && ledgersData.data) {
          setLedgers(ledgersData.data)
        }
      } else {
        setToast({ message: '操作失败：' + responseData.message, type: 'error' })
      }
    } catch (error) {
      console.error('操作失败:', error)
      setToast({ message: '操作失败：' + error, type: 'error' })
    }
  }

  const handleDeleteLedger = (ledger: Ledger) => {
    setConfirm({
      title: '确认删除账本',
      message: ledger.total_records > 0 
        ? `该账本下有 ${ledger.total_records} 条记录（金额：¥${ledger.total_amount.toFixed(2)}），请先删除或转移记录。`
        : `确定要删除账本"${ledger.name}"吗？`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/ledgers/${ledger.id}`, { method: 'DELETE' })
          const data = await res.json()
          if (data.success) {
            setToast({ message: '账本已删除', type: 'success' })
            if (currentLedger === ledger.id) {
              setCurrentLedger(null)
            }
            loadData()
          } else {
            setToast({ message: data.message, type: 'error' })
          }
        } catch (error) {
          setToast({ message: '删除失败：' + error, type: 'error' })
        }
        setConfirm(null)
      }
    })
  }

  const handleSwitchLedger = (ledgerId: number | null) => {
    setCurrentLedger(ledgerId)
    setLedgerListOpen(false)
    setCurrentPage(1)
  }

  const getRecentDate = () => {
    if (records.length === 0) return '-'
    
    let recentDate = ''
    let maxDate = 0
    
    for (const record of records) {
      if (record.order_no) {
        const match = record.order_no.match(/^(\d{6})-/)
        if (match) {
          const dateNum = parseInt(match[1])
          if (dateNum > maxDate) {
            maxDate = dateNum
            const year = '20' + match[1].slice(0, 2)
            const month = match[1].slice(2, 4)
            const day = match[1].slice(4, 6)
            recentDate = `${year}年${month}月${day}日`
          }
        }
      }
    }
    
    return recentDate || '-'
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    if (dateStr.length === 8) {
      const year = dateStr.slice(0, 4)
      const month = dateStr.slice(4, 6)
      const day = dateStr.slice(6, 8)
      return `${year}年${month}月${day}日`
    }
    return dateStr
  }

  const formatCurrency = (amount: number, currency = 'CNY') => {
    if (currency === 'CNY') return `¥${amount.toFixed(2)}`
    const rate = userSettings.usdtRate || 7.0
    const converted = amount / rate
    return `₮${converted.toFixed(2)}`
  }

  const formatLedgerDate = (dateStr: string) => {
    if (!dateStr) return '无限制'
    if (dateStr.length === 8) {
      return `${dateStr.slice(0, 4)}年${dateStr.slice(4, 6)}月${dateStr.slice(6, 8)}日`
    }
    return dateStr
  }

  const toggleCurrency = () => {
    setCurrencyMode(prev => prev === 'CNY' ? 'USDT' : 'CNY')
  }

  const getCurrentCurrency = () => {
    return currencyMode === 'CNY' ? 'CNY' : 'USDT'
  }

  const StatCard = ({ title, value, icon: Icon, subtext }: { title: string; value: string | number; icon: any; subtext?: React.ReactNode }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-secondary rounded-lg">
            <Icon className="w-6 h-6 text-secondary-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold">{value}</p>
            {subtext && <div className="text-xs text-muted-foreground mt-0.5">{subtext}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const getPlatformStyle = (platformName: string) => {
    return PLATFORM_COLORS[platformName] || PLATFORM_COLORS['其他']
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const currentLedgerData = ledgers.find(l => l.id === currentLedger)

  return (
    <div className="min-h-screen bg-background">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            <div>
              <h1 className="text-base sm:text-xl font-semibold">购物账本</h1>
              {currentLedgerData && (
                <p className="text-xs text-muted-foreground hidden sm:block">{currentLedgerData.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="icon" onClick={loadData} className="h-8 w-8 sm:h-10 sm:w-10">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setSettingsOpen(true)} className="hidden sm:flex">
              <Settings className="w-4 h-4 mr-2" />
              设置
            </Button>
            <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)} className="sm:hidden h-8 w-8">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setLedgerListOpen(true)} className="hidden sm:flex">
              <Book className="w-4 h-4 mr-2" />
              账本
            </Button>
            <Button variant="outline" size="icon" onClick={() => setLedgerListOpen(true)} className="sm:hidden h-8 w-8">
              <Book className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setPlatformDialogOpen(true)} className="hidden sm:flex">
              <Palette className="w-4 h-4 mr-2" />
              平台
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPlatformDialogOpen(true)} className="sm:hidden h-8 w-8">
              <Palette className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="hidden sm:flex">
              <Upload className="w-4 h-4 mr-2" />
              导入
            </Button>
            <Button variant="outline" size="icon" onClick={() => setImportDialogOpen(true)} className="sm:hidden h-8 w-8">
              <Upload className="w-4 h-4" />
            </Button>
            <Button onClick={handleAdd} className="h-8 sm:h-10">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">新增</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <StatCard 
            title="总记录数" 
            value={stats?.total || 0} 
            icon={Package}
          />
          <StatCard
            title="总消费金额"
            value={formatCurrency(stats?.amount || 0, getCurrentCurrency())}
            icon={DollarSign}
            subtext={
              <button
                onClick={toggleCurrency}
                className="text-xs text-primary hover:underline cursor-pointer block"
              >
                切换到 {currencyMode === 'CNY' ? 'USDT' : '人民币'} (1 USDT = ¥{userSettings.usdtRate?.toFixed(2) || '7.00'})
              </button>
            }
          />
          <StatCard 
            title="平台数量" 
            value={stats?.platforms.length || 0} 
            icon={Store}
          />
          <StatCard 
            title="最近日期" 
            value={getRecentDate()} 
            icon={Calendar}
          />
        </div>

        {/* 筛选工具栏 */}
        <Card className="mb-4 sm:mb-6">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索商品名称、订单号..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 sm:h-10"
                  />
                </div>
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-full sm:w-[130px] h-9 sm:h-10">
                  <SelectValue placeholder="平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部平台</SelectItem>
                  {platforms.map(p => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="month"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full sm:w-[160px] h-9 sm:h-10"
              />
              {(searchTerm || platformFilter !== 'all' || dateFilter) && (
                <Button variant="outline" onClick={() => {
                  setSearchTerm('')
                  setPlatformFilter('all')
                  setDateFilter('')
                  setCurrentPage(1)
                }} className="h-9 sm:h-10">
                  清除筛选
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 数据表格 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                共 {filteredRecords.length} 条记录
              </p>
              <p className="text-sm text-muted-foreground">
                第 {currentPage} / {totalPages} 页
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">加载中...</div>
            ) : currentRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">暂无数据</div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">名称</TableHead>
                      <TableHead className="w-[100px]">规格</TableHead>
                      <TableHead className="w-[90px] text-right">价格</TableHead>
                      <TableHead className="w-[90px] text-right">单价</TableHead>
                      <TableHead className="w-[90px]">平台</TableHead>
                      <TableHead className="w-[120px]">日期</TableHead>
                      <TableHead>订单号</TableHead>
                      <TableHead className="w-[100px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentRecords.map((record) => {
                      const platformStyle = getPlatformStyle(record.platform)
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium max-w-[250px] truncate" title={record.name}>
                            {record.name}
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">{record.spec || '-'}</span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(record.price, getCurrentCurrency())}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-muted-foreground">
                              {record.unit_price ? formatCurrency(record.unit_price, getCurrentCurrency()) : '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium border ${platformStyle.bg} ${platformStyle.text} ${platformStyle.border}`}>
                              {record.platform}
                            </span>
                          </TableCell>
                          <TableCell>{formatDate(record.date)}</TableCell>
                          <TableCell className="max-w-[150px] truncate text-muted-foreground" title={record.order_no || ''}>
                            {record.order_no || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(record)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(record.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          
          {/* 分页控制 */}
          <CardContent className="pt-4 pb-4 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 sm:px-4"
                >
                  首页
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2 min-w-[100px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 sm:h-9 sm:w-9"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 sm:px-4"
                >
                  末页
                </Button>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground">跳转</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  className="w-16 sm:w-20 h-8 sm:h-9"
                  placeholder="页码"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const page = parseInt((e.target as HTMLInputElement).value)
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page)
                      }
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.querySelector('input[type="number"]') as HTMLInputElement
                    if (input) {
                      const page = parseInt(input.value)
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page)
                      }
                    }
                  }}
                >
                  跳转
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* 新增/编辑记录对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecord ? '编辑记录' : '新增记录'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">商品名称 <span className="text-red-500">*</span></label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入商品名称"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">规格</label>
              <Input
                value={formData.spec}
                onChange={(e) => setFormData({ ...formData, spec: e.target.value })}
                placeholder="如：XL、红色、500ml"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">价格 <span className="text-red-500">*</span></label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">单价</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                  placeholder="可选"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">购买平台 <span className="text-red-500">*</span></label>
                <Select value={formData.platform} onValueChange={(v) => setFormData({ ...formData, platform: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map(p => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">日期 <span className="text-red-500">*</span></label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">所属账本</label>
              <Select value={String(formData.ledger_id)} onValueChange={(v) => setFormData({ ...formData, ledger_id: parseInt(v) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ledgers.map(l => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">订单号</label>
              <Input
                value={formData.order_no}
                onChange={(e) => setFormData({ ...formData, order_no: e.target.value })}
                placeholder="可选"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">备注</label>
              <Input
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="可选"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入 Excel 数据</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                选择 Excel 文件导入，数据将自动去重
              </p>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImport(file)
                }}
                disabled={importing}
                className="max-w-xs mx-auto"
              />
              {importing && (
                <p className="text-sm text-muted-foreground mt-4">导入中...</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 平台管理对话框 */}
      <Dialog open={platformDialogOpen} onOpenChange={setPlatformDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlatform ? '编辑平台' : '平台管理'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex gap-2 mb-4">
              <Input
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
                placeholder="输入新平台名称"
                onKeyDown={(e) => e.key === 'Enter' && (editingPlatform ? handleSavePlatform() : handleAddPlatform())}
              />
              {editingPlatform ? (
                <>
                  <Button onClick={handleSavePlatform}>保存</Button>
                  <Button variant="outline" onClick={handleCancelEditPlatform}>取消</Button>
                </>
              ) : (
                <Button onClick={handleAddPlatform}>
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="grid gap-2 max-h-64 overflow-auto">
              {platforms.map((platform) => {
                const style = getPlatformStyle(platform.name)
                return (
                  <div key={platform.name} className={`flex items-center justify-between p-3 rounded-lg border ${style.bg} ${style.border}`}>
                    <span className={`font-medium ${style.text}`}>{platform.name}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                        onClick={() => handleEditPlatform(platform)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                        onClick={() => handleDeletePlatform(platform.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingPlatform(null); setNewPlatform(''); setPlatformDialogOpen(false); }}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 账本列表对话框 */}
      <Dialog open={ledgerListOpen} onOpenChange={setLedgerListOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>账本管理</DialogTitle>
            <DialogDescription>
              管理您的购物账本，每个账本可记录特定时期或事件的消费
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex justify-end mb-4">
              <Button onClick={handleAddLedger}>
                <Plus className="w-4 h-4 mr-2" />
                新建账本
              </Button>
            </div>
            <div className="grid gap-3 max-h-96 overflow-auto">
              {ledgers.map((ledger) => (
                <div 
                  key={ledger.id} 
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    currentLedger === ledger.id ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{ledger.name}</h3>
                      {ledger.is_active && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">使用中</span>
                      )}
                    </div>
                    {ledger.description && (
                      <p className="text-sm text-muted-foreground mt-1">{ledger.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>开始：{formatLedgerDate(ledger.start_date)}</span>
                      <span>结束：{formatLedgerDate(ledger.end_date || '')}</span>
                      <span>{ledger.total_records} 条记录</span>
                      <span className="text-red-500">¥{ledger.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={currentLedger === ledger.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleSwitchLedger(ledger.id)}
                    >
                      {currentLedger === ledger.id ? '当前账本' : '切换'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditLedger(ledger)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteLedger(ledger)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLedgerListOpen(false)}>完成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建/编辑账本对话框 */}
      <Dialog open={ledgerDialogOpen} onOpenChange={setLedgerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ledgerForm.id ? '编辑账本' : '新建账本'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">账本名称 <span className="text-red-500">*</span></label>
              <Input
                value={ledgerForm.name}
                onChange={(e) => setLedgerForm({ ...ledgerForm, name: e.target.value })}
                placeholder="如：搬家后购物、2024 年购物"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">描述</label>
              <Input
                value={ledgerForm.description}
                onChange={(e) => setLedgerForm({ ...ledgerForm, description: e.target.value })}
                placeholder="可选，如：搬家后购置的物品"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">开始日期 <span className="text-red-500">*</span></label>
                <Input
                  type="date"
                  value={ledgerForm.start_date}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">结束日期</label>
                <Input
                  type="date"
                  value={ledgerForm.end_date}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, end_date: e.target.value })}
                  placeholder="可选"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={ledgerForm.is_active === 1}
                onChange={(e) => setLedgerForm({ ...ledgerForm, is_active: e.target.checked ? 1 : 0 })}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm">启用此账本</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLedgerDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveLedger}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 设置对话框 */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>设置</DialogTitle>
            <DialogDescription>
              自定义汇率等设置
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">USDT/CNY 汇率</label>
                <Input
                  type="number"
                  step="0.01"
                  value={userSettings.usdtRate}
                  onChange={(e) => setUserSettings({ ...userSettings, usdtRate: parseFloat(e.target.value) || 7.0 })}
                  placeholder="7.0"
                />
                <p className="text-xs text-muted-foreground">
                  用于将人民币金额转换为 USDT 显示
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>取消</Button>
            <Button onClick={saveSettings}>保存设置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
