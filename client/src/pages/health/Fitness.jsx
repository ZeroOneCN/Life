import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Input, Button, Select, Table, Modal, message,
  Popconfirm, Tag, Segmented,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import * as echarts from 'echarts';
import dayjs from 'dayjs';

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */
const PAGE_SIZE = 10;
const STORAGE_KEY = 'lifeos_fitness_data';

const MEAL_TYPES = [
  { value: 'breakfast', label: '早餐', color: '#F0B90B' },
  { value: 'lunch', label: '午餐', color: '#0ECB81' },
  { value: 'dinner', label: '晚餐', color: '#F6465D' },
  { value: 'snack', label: '加餐', color: '#1EAEDB' },
];

const INTENSITY_LEVELS = [
  { value: 'low', label: '低', color: '#848E9C' },
  { value: 'medium', label: '中', color: '#F0B90B' },
  { value: 'high', label: '高', color: '#F6465D' },
];

/* ── helpers ── */
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function todayStr() { return dayjs().format('YYYY-MM-DD'); }
function formatDT(iso) { return iso ? iso.replace('T', ' ').slice(0, 16) : ''; }

/* ── mock seed ── */
function seedMock() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch {} }

  let id = 1;
  const today = dayjs();
  const diet = [];
  const exercise = [];
  const shopping = [];
  const weight = [];

  const foods = [
    { name: '鸡胸肉', cal: 165, protein: 31, carbs: 0, fat: 3.6 },
    { name: '糙米饭', cal: 130, protein: 2.7, carbs: 28, fat: 1 },
    { name: '西兰花', cal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
    { name: '鸡蛋', cal: 155, protein: 13, carbs: 1.1, fat: 11 },
    { name: '牛奶', cal: 42, protein: 3.4, carbs: 5, fat: 1 },
    { name: '香蕉', cal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
    { name: '牛肉', cal: 250, protein: 26, carbs: 0, fat: 15 },
    { name: '三文鱼', cal: 208, protein: 20, carbs: 0, fat: 13 },
    { name: '豆腐', cal: 76, protein: 8, carbs: 2, fat: 4.8 },
    { name: '燕麦', cal: 389, protein: 17, carbs: 66, fat: 6.9 },
  ];

  // diet records: 2-4 meals per day for 30 days
  for (let d = 29; d >= 0; d--) {
    const date = today.subtract(d, 'day');
    const mealCount = rand(2, 4);
    const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
    for (let m = 0; m < mealCount; m++) {
      const food = foods[rand(0, foods.length - 1)];
      const grams = rand(80, 300);
      diet.push({
        id: id++, date: date.format('YYYY-MM-DD'), mealType: meals[m],
        foodName: food.name, grams,
        calories: Math.round(food.cal * grams / 100),
        protein: +(food.protein * grams / 100).toFixed(1),
        carbs: +(food.carbs * grams / 100).toFixed(1),
        fat: +(food.fat * grams / 100).toFixed(1),
      });
    }
  }

  // exercise: ~60% days have exercise
  const exTypes = [
    { name: '跑步', cat: 'cardio', calPerMin: 8 },
    { name: '游泳', cat: 'cardio', calPerMin: 7 },
    { name: '骑行', cat: 'cardio', calPerMin: 6 },
    { name: '跳绳', cat: 'cardio', calPerMin: 10 },
    { name: '力量训练', cat: 'strength', calPerMin: 5 },
    { name: '瑜伽', cat: 'flexibility', calPerMin: 3 },
    { name: '篮球', cat: 'cardio', calPerMin: 7 },
  ];
  for (let d = 29; d >= 0; d--) {
    if (Math.random() > 0.4) {
      const date = today.subtract(d, 'day');
      const et = exTypes[rand(0, exTypes.length - 1)];
      const dur = rand(15, 75);
      const intIdx = rand(0, 2);
      const mul = [0.7, 1.0, 1.3][intIdx];
      exercise.push({
        id: id++, date: date.format('YYYY-MM-DD'),
        type: et.cat, name: et.name,
        duration: dur, intensity: INTENSITY_LEVELS[intIdx].value,
        calories: Math.round(dur * et.calPerMin * mul),
      });
    }
  }

  // shopping: every few days
  const shopItems = [
    { name: '鸡胸肉', unit: 500, price: 25 },
    { name: '糙米', unit: 1000, price: 18 },
    { name: '西兰花', unit: 500, price: 8 },
    { name: '鸡蛋', unit: 60, price: 1.5 },
    { name: '牛奶', unit: 1000, price: 12 },
    { name: '牛肉', unit: 500, price: 45 },
    { name: '三文鱼', unit: 200, price: 35 },
    { name: '豆腐', unit: 400, price: 4 },
    { name: '燕麦', unit: 500, price: 15 },
  ];
  for (let d = 29; d >= 0; d -= rand(2, 4)) {
    const date = today.subtract(d, 'day');
    const item = shopItems[rand(0, shopItems.length - 1)];
    const qty = rand(1, 3);
    shopping.push({
      id: id++, date: date.format('YYYY-MM-DD'),
      itemName: item.name, unit: `${item.unit}g`,
      quantity: qty, price: item.price,
      total: qty * item.price, location: '',
    });
  }

  // weight: every 2-3 days
  let baseWeight = 72;
  for (let d = 29; d >= 0; d -= rand(2, 3)) {
    const date = today.subtract(d, 'day');
    baseWeight += (Math.random() > 0.5 ? -1 : 1) * (Math.random() * 0.3);
    weight.push({
      id: id++, date: date.format('YYYY-MM-DD'),
      weight: +baseWeight.toFixed(1),
      height: 170, bodyFat: +(18 + Math.random() * 5).toFixed(1),
    });
  }

  const data = { diet, exercise, shopping, weight };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

/* ── theme hook ── */
function useIsLight() {
  const [isLight, setIsLight] = useState(() => {
    try { return localStorage.getItem('theme') === 'light'; } catch { return false; }
  });
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => setIsLight(el.classList.contains('light')));
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isLight;
}

/* ═══════════════════════════════════════
   Component
   ═══════════════════════════════════════ */
export default function Fitness() {
  const isLight = useIsLight();
  const c = useMemo(() => ({
    text: isLight ? '#1d1d1f' : '#f7f8f8',
    textSecondary: isLight ? '#62666d' : '#d0d6e0',
    muted: '#8a8f98',
    muted2: isLight ? '#9ca3af' : '#62666d',
    border: isLight ? '#e5e7eb' : '#23252a',
    surface: isLight ? '#ffffff' : '#0f1011',
    surfaceTint: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
    surfaceTint2: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
    dropdownBg: isLight ? '#f0f1f2' : '#18191a',
  }), [isLight]);

  /* ── state ── */
  const [data, setData] = useState(seedMock);
  const [activeTab, setActiveTab] = useState('diet');

  /* pagination per tab */
  const [pages, setPages] = useState({ diet: 1, exercise: 1, shopping: 1, weight: 1 });

  /* selection per tab (for batch delete) */
  const [selIds, setSelIds] = useState([]);

  /* edit modal */
  const [editOpen, setEditOpen] = useState(false);
  const [editRec, setEditRec] = useState(null);
  const [editType, setEditType] = useState(null);

  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  /* ── persist ── */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  /* ── today / now ── */
  const today = todayStr();

  /* ── stats ── */
  const stats = useMemo(() => {
    const todayDiet = data.diet.filter(r => r.date === today);
    const todayEx = data.exercise.filter(r => r.date === today);
    const todayCalIn = todayDiet.reduce((s, r) => s + (r.calories || 0), 0);
    const todayCalOut = todayEx.reduce((s, r) => s + (r.calories || 0), 0);
    const todayNet = todayCalIn - todayCalOut;

    // week avg
    const weekAgo = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
    const weekDiet = data.diet.filter(r => r.date >= weekAgo);
    const weekEx = data.exercise.filter(r => r.date >= weekAgo);
    const weekDays = new Set(weekDiet.map(r => r.date)).size || 1;
    const weekCalIn = weekDiet.reduce((s, r) => s + (r.calories || 0), 0);
    const weekCalOut = weekEx.reduce((s, r) => s + (r.calories || 0), 0);
    const weekAvg = Math.round((weekCalIn - weekCalOut) / weekDays);

    // weight
    const sortedW = [...data.weight].sort((a, b) => b.date.localeCompare(a.date));
    const latestW = sortedW[0] || null;
    const bmi = latestW ? (+latestW.weight / ((latestW.height || 170) / 100) ** 2).toFixed(1) : '-';

    // month expense
    const month = dayjs().format('YYYY-MM');
    const monthShop = data.shopping.filter(r => r.date.startsWith(month));
    const monthExpense = monthShop.reduce((s, r) => s + (r.total || 0), 0);

    // today food cost
    const todayFoodCost = todayDiet.reduce((s, r) => s + (r.foodCost || 0), 0);

    return {
      todayCalIn, todayCalOut, todayNet, weekAvg,
      latestWeight: latestW, bmi, monthExpense, todayFoodCost,
    };
  }, [data, today]);

  /* ── CRUD helpers ── */
  const addRecord = useCallback((type, record) => {
    const maxId = [].concat(...Object.values(data)).reduce((m, r) => Math.max(m, r.id || 0), 0);
    const newRec = { id: maxId + 1, ...record };
    setData(prev => ({ ...prev, [type]: [newRec, ...prev[type]] }));
    message.success('记录已添加');
    setPages(p => ({ ...p, [type]: 1 }));
  }, [data]);

  const deleteRecord = useCallback((type, id) => {
    setData(prev => ({ ...prev, [type]: prev[type].filter(r => r.id !== id) }));
    setSelIds(prev => prev.filter(s => s !== id));
    message.success('记录已删除');
  }, []);

  const updateRecord = useCallback((type, id, updates) => {
    setData(prev => ({
      ...prev,
      [type]: prev[type].map(r => r.id === id ? { ...r, ...updates } : r),
    }));
  }, []);

  function batchDelete(type) {
    if (!selIds.length) { message.warning('请选择要删除的记录'); return; }
    Modal.confirm({
      title: '确认删除', content: `确定要删除选中的 ${selIds.length} 条记录吗？`,
      okText: '确定', cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        const idset = new Set(selIds);
        setData(prev => ({ ...prev, [type]: prev[type].filter(r => !idset.has(r.id)) }));
        setSelIds([]); message.success(`成功删除 ${idset.size} 条记录`);
      },
    });
  }

  function openEdit(type, rec) { setEditType(type); setEditRec({ ...rec }); setEditOpen(true); }
  function saveEdit() {
    if (!editRec || !editType) return;
    updateRecord(editType, editRec.id, editRec);
    setEditOpen(false); setEditRec(null); setEditType(null);
    message.success('记录已更新');
  }

  /* ── render styles ── */
  const inputStyle = {
    background: c.surfaceTint, border: '1px solid ' + c.border,
    borderRadius: 8, color: c.text, height: 42,
  };
  const labelStyle = { color: c.textSecondary, fontWeight: 500, fontSize: 14, marginBottom: 6, display: 'block' };

  /* ── stat card component ── */
  const StatCard = ({ label, value, unit, color, accent, children }) => (
    <div className="linear-card" style={{ padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: c.muted, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent || c.text, lineHeight: 1.2 }}>
        {value ?? '-'}
      </div>
      {unit && <div style={{ fontSize: 12, color: c.muted2, marginTop: 4 }}>{unit}</div>}
      {children}
    </div>
  );

  /* ═══════════════════════════════════════
     Render
     ═══════════════════════════════════════ */
  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>健身减肥</h1>

      {/* ═══════ 8 Dashboard Cards ═══════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="今日摄入" value={stats.todayCalIn.toLocaleString()} unit="千卡" accent="#F0B90B" />
        <StatCard label="今日消耗" value={stats.todayCalOut.toLocaleString()} unit="千卡" accent="#1EAEDB" />
        <StatCard label="今日热量" value={stats.todayNet.toLocaleString()} unit="千卡" accent={stats.todayNet > 0 ? '#F6465D' : '#0ECB81'} />
        <StatCard label="本周日均" value={stats.weekAvg.toLocaleString()} unit="千卡/天" accent="#A855F7" />
        <StatCard label="最新体重" value={stats.latestWeight?.weight?.toFixed(1)} unit="kg" accent="#5e6ad2" />
        <StatCard label="BMI 指数" value={stats.bmi} />
        <StatCard label="本月总花销" value={`¥${stats.monthExpense.toFixed(0)}`} unit="元" accent="#ff6b6b" />
        <StatCard label="今日饮食" value={`¥${stats.todayFoodCost.toFixed(0)}` || '¥0'} unit="元" accent="#52c41a" />
      </div>

      {/* ═══════ Tabs ═══════ */}
      <div style={{ marginBottom: 24 }}>
        <style>{`.fit-tabs .ant-segmented-item { margin-right: 4px; } .fit-tabs .ant-segmented-item:last-child { margin-right: 0; }`}</style>
        <Segmented value={activeTab} onChange={v => { setActiveTab(v); setSelIds([]); setPages(p => ({ ...p, [v]: 1 })); }}
          options={[
            { value: 'diet', label: '饮食记录' },
            { value: 'exercise', label: '运动记录' },
            { value: 'shopping', label: '食材购买' },
            { value: 'weight', label: '体重记录' },
            { value: 'charts', label: '数据看板' },
          ]}
          className="fit-tabs"
          style={{ background: c.surfaceTint, borderRadius: 8, padding: '3px 4px', fontSize: 14 }}
        />
      </div>

      {/* ═══════════════════════════════════
          Tab Content: Diet
          ═══════════════════════════════════ */}
      {activeTab === 'diet' && <DietTab
        c={c} data={data} inputStyle={inputStyle} labelStyle={labelStyle}
        pages={pages} setPages={setPages} selIds={selIds} setSelIds={setSelIds}
        addRecord={addRecord} deleteRecord={deleteRecord}
        openEdit={openEdit} batchDelete={batchDelete}
      />}

      {/* ═══════════════════════════════════
          Tab Content: Exercise
          ═══════════════════════════════════ */}
      {activeTab === 'exercise' && <ExerciseTab
        c={c} data={data} inputStyle={inputStyle} labelStyle={labelStyle}
        pages={pages} setPages={setPages} selIds={selIds} setSelIds={setSelIds}
        addRecord={addRecord} deleteRecord={deleteRecord}
        openEdit={openEdit} batchDelete={batchDelete}
      />}

      {/* ═══════════════════════════════════
          Tab Content: Shopping
          ═══════════════════════════════════ */}
      {activeTab === 'shopping' && <ShoppingTab
        c={c} data={data} inputStyle={inputStyle} labelStyle={labelStyle}
        pages={pages} setPages={setPages} selIds={selIds} setSelIds={setSelIds}
        addRecord={addRecord} deleteRecord={deleteRecord}
        openEdit={openEdit} batchDelete={batchDelete}
      />}

      {/* ═══════════════════════════════════
          Tab Content: Weight
          ═══════════════════════════════════ */}
      {activeTab === 'weight' && <WeightTab
        c={c} data={data} inputStyle={inputStyle} labelStyle={labelStyle}
        pages={pages} setPages={setPages} selIds={selIds} setSelIds={setSelIds}
        addRecord={addRecord} deleteRecord={deleteRecord}
        openEdit={openEdit} batchDelete={batchDelete}
      />}

      {/* ═══════════════════════════════════
          Tab Content: Charts Dashboard
          ═══════════════════════════════════ */}
      {activeTab === 'charts' && <ChartsTab
        c={c} isLight={isLight} data={data}
        chartRef={chartRef} chartInstance={chartInstance}
      />}

      {/* ═══════ Edit Modal ═══════ */}
      <Modal
        title={<span style={{ color: c.text, fontWeight: 600 }}>编辑记录</span>}
        open={editOpen}
        onCancel={() => { setEditOpen(false); setEditRec(null); setEditType(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setEditOpen(false); setEditRec(null); setEditType(null); }}
            style={{ background: c.surfaceTint, borderColor: c.border, color: c.text, borderRadius: 8 }}>取消</Button>,
          <Button key="save" type="primary" onClick={saveEdit}
            style={{ background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8 }}>保存</Button>,
        ]}
        styles={{
          content: { background: c.surface, border: '1px solid ' + c.border, borderRadius: 16 },
          header: { background: 'transparent', borderBottom: '1px solid ' + c.border, paddingBottom: 16 },
          mask: { backdropFilter: 'blur(4px)' },
        }}
        width={500}
      >
        {editRec && editType && (editType === 'diet' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>食物名称</label>
                <Input value={editRec.foodName} onChange={e => setEditRec(p => ({ ...p, foodName: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>分量 (g)</label>
                <Input value={editRec.grams} onChange={e => setEditRec(p => ({ ...p, grams: parseInt(e.target.value) || 0 }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>热量 (kcal)</label>
                <Input value={editRec.calories} onChange={e => setEditRec(p => ({ ...p, calories: parseInt(e.target.value) || 0 }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>餐别</label>
                <Select value={editRec.mealType} onChange={v => setEditRec(p => ({ ...p, mealType: v }))}
                  style={{ width: '100%', height: 42 }}
                  popupStyle={{ background: c.dropdownBg }}
                  dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
                  options={MEAL_TYPES} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>日期</label>
              <Input type="date" value={editRec.date} onChange={e => setEditRec(p => ({ ...p, date: e.target.value }))} style={inputStyle} />
            </div>
          </div>
        ) : editType === 'exercise' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>运动名称</label>
                <Input value={editRec.name} onChange={e => setEditRec(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>类型</label>
                <Select value={editRec.type} onChange={v => setEditRec(p => ({ ...p, type: v }))}
                  style={{ width: '100%', height: 42 }}
                  popupStyle={{ background: c.dropdownBg }}
                  dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
                  options={[
                    { value: 'cardio', label: '有氧' },
                    { value: 'strength', label: '力量' },
                    { value: 'flexibility', label: '柔韧' },
                  ]} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>时长 (分钟)</label>
                <Input value={editRec.duration} onChange={e => setEditRec(p => ({ ...p, duration: parseInt(e.target.value) || 0 }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>消耗 (kcal)</label>
                <Input value={editRec.calories} onChange={e => setEditRec(p => ({ ...p, calories: parseInt(e.target.value) || 0 }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>日期</label>
              <Input type="date" value={editRec.date} onChange={e => setEditRec(p => ({ ...p, date: e.target.value }))} style={inputStyle} />
            </div>
          </div>
        ) : editType === 'shopping' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>食材名称</label>
                <Input value={editRec.itemName} onChange={e => setEditRec(p => ({ ...p, itemName: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>数量</label>
                <Input value={editRec.quantity} onChange={e => setEditRec(p => ({ ...p, quantity: parseInt(e.target.value) || 0 }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>规格</label>
                <Input value={editRec.unit} onChange={e => setEditRec(p => ({ ...p, unit: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>单价 (元)</label>
                <Input value={editRec.price} onChange={e => setEditRec(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>总额</label>
                <Input value={editRec.total} onChange={e => setEditRec(p => ({ ...p, total: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>日期</label>
              <Input type="date" value={editRec.date} onChange={e => setEditRec(p => ({ ...p, date: e.target.value }))} style={inputStyle} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>体重 (kg)</label>
                <Input value={editRec.weight} onChange={e => setEditRec(p => ({ ...p, weight: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>体脂率 (%)</label>
                <Input value={editRec.bodyFat || ''} onChange={e => setEditRec(p => ({ ...p, bodyFat: parseFloat(e.target.value) || null }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>身高 (cm)</label>
                <Input value={editRec.height} onChange={e => setEditRec(p => ({ ...p, height: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>日期</label>
                <Input type="date" value={editRec.date} onChange={e => setEditRec(p => ({ ...p, date: e.target.value }))} style={inputStyle} />
              </div>
            </div>
          </div>
        ))}
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════
   Tab Sub-Components
   ═══════════════════════════════════════ */

/* ── Pagination widget ── */
function TablePagination({ c, inputStyle, page, totalPages, onPageChange, pageSize, onPageSizeChange, total }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
      <Select value={pageSize} onChange={v => { onPageSizeChange(v); onPageChange(1); }}
        style={{ width: 120 }}
        popupStyle={{ background: c.dropdownBg }}
        dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
        options={[
          { value: 10, label: '10 条/页' },
          { value: 20, label: '20 条/页' },
          { value: 50, label: '50 条/页' },
          { value: 100, label: '100 条/页' },
        ]} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button disabled={page <= 1} onClick={() => onPageChange(1)}
          style={{ ...inputStyle, height: 36, fontSize: 13 }}>首页</Button>
        <Button disabled={page <= 1} onClick={() => onPageChange(p => p - 1)}
          style={{ ...inputStyle, height: 36, fontSize: 13 }}>上一页</Button>
        <span style={{ color: c.muted, fontSize: 14, whiteSpace: 'nowrap' }}>第 {page} / {totalPages} 页</span>
        <Input type="number" min={1} max={totalPages}
          onPressEnter={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) onPageChange(v); }}
          style={{ ...inputStyle, width: 56, height: 36, textAlign: 'center' }} placeholder="页" />
        <Button disabled={page >= totalPages} onClick={() => onPageChange(p => p + 1)}
          style={{ ...inputStyle, height: 36, fontSize: 13 }}>下一页</Button>
        <Button disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}
          style={{ ...inputStyle, height: 36, fontSize: 13 }}>末页</Button>
      </div>
      <span style={{ color: c.muted, fontSize: 13 }}>共 {total} 条</span>
    </div>
  );
}

/* ── Diet Tab ── */
function DietTab({ c, data, inputStyle, labelStyle, pages, setPages, selIds, setSelIds, addRecord, deleteRecord, openEdit, batchDelete }) {
  const [form, setForm] = useState({ date: todayStr(), mealType: 'lunch', foodName: '', grams: 100, calories: '', protein: '', carbs: '', fat: '' });
  const [filterMeal, setFilterMeal] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const page = pages.diet;

  const list = useMemo(() => {
    let l = [...data.diet];
    if (filterMeal) l = l.filter(r => r.mealType === filterMeal);
    return l.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.diet, filterMeal]);

  const totalPages = Math.ceil(list.length / pageSize);
  const pageData = list.slice((page - 1) * pageSize, page * pageSize);

  function handleAdd() {
    if (!form.foodName) { message.error('请输入食物名称'); return; }
    const cal = parseInt(form.calories) || 0;
    addRecord('diet', {
      date: form.date, mealType: form.mealType, foodName: form.foodName,
      grams: parseInt(form.grams) || 100, calories: cal,
      protein: parseFloat(form.protein) || 0, carbs: parseFloat(form.carbs) || 0,
      fat: parseFloat(form.fat) || 0,
    });
    setForm(f => ({ ...f, foodName: '', calories: '', protein: '', carbs: '', fat: '' }));
  }

  const columns = [
    { title: '日期', dataIndex: 'date', width: 110, render: v => <span style={{ color: c.textSecondary }}>{v}</span> },
    {
      title: '餐别', dataIndex: 'mealType', width: 80,
      render: v => { const mt = MEAL_TYPES.find(m => m.value === v); return <Tag color={mt?.color} bordered={false}>{mt?.label || v}</Tag>; },
    },
    { title: '食物', dataIndex: 'foodName', width: 120, render: v => <span style={{ fontWeight: 500, color: c.text }}>{v}</span> },
    { title: '分量', dataIndex: 'grams', width: 80, render: v => <span style={{ color: c.textSecondary }}>{v}g</span> },
    { title: '热量', dataIndex: 'calories', width: 80, render: v => <span style={{ fontWeight: 600, color: '#F0B90B' }}>{v} kcal</span> },
    { title: '蛋白质', dataIndex: 'protein', width: 80, render: v => <span style={{ color: c.textSecondary }}>{v}g</span> },
    { title: '碳水', dataIndex: 'carbs', width: 80, render: v => <span style={{ color: c.textSecondary }}>{v}g</span> },
    { title: '脂肪', dataIndex: 'fat', width: 70, render: v => <span style={{ color: c.textSecondary }}>{v}g</span> },
    {
      title: '操作', width: 160,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit('diet', rec)} style={{ color: c.muted, fontSize: 13 }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => deleteRecord('diet', rec.id)} okText="确定" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 13 }}>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="linear-card" style={{ padding: 24 }}>
      {/* Add form — single row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr) auto', gap: 12, marginBottom: 20, alignItems: 'end' }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>食物名称</label>
          <Input value={form.foodName} onChange={e => setForm(f => ({ ...f, foodName: e.target.value }))} placeholder="如：鸡胸肉" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>餐别</label>
          <Select value={form.mealType} onChange={v => setForm(f => ({ ...f, mealType: v }))}
            style={{ width: '100%', height: 42 }}
            popupStyle={{ background: c.dropdownBg }}
            dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
            options={MEAL_TYPES} />
        </div>
        <div>
          <label style={labelStyle}>分量 (g)</label>
          <Input value={form.grams} onChange={e => setForm(f => ({ ...f, grams: e.target.value.replace(/\D/g, '') }))} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>热量</label>
          <Input value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value.replace(/\D/g, '') }))} placeholder="可选" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>蛋白质</label>
          <Input value={form.protein} onChange={e => setForm(f => ({ ...f, protein: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="可选" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>碳水</label>
          <Input value={form.carbs} onChange={e => setForm(f => ({ ...f, carbs: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="可选" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>脂肪</label>
          <Input value={form.fat} onChange={e => setForm(f => ({ ...f, fat: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="可选" style={inputStyle} />
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}
          style={{ background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8, height: 42, padding: '0 20px', marginBottom: 0 }}>添加</Button>
      </div>

      {/* Table controls */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle}>餐别筛选</label>
          <Select value={filterMeal} onChange={v => { setFilterMeal(v); setPages(p => ({ ...p, diet: 1 })); }}
            style={{ width: 120, height: 42 }}
            popupStyle={{ background: c.dropdownBg }}
            dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
            options={[{ value: null, label: '全部' }, ...MEAL_TYPES]} />
        </div>
        <Button danger disabled={!selIds.length} onClick={() => batchDelete('diet')}
          icon={<DeleteOutlined />} style={{ borderRadius: 8, height: 42 }}>批量删除</Button>
        {selIds.length > 0 && <span style={{ color: c.muted, fontSize: 13 }}>已选 {selIds.length} 条</span>}
      </div>

      <Table dataSource={pageData} columns={columns} rowKey="id" pagination={false}
        rowSelection={{ type: 'checkbox', selectedRowKeys: selIds, onChange: keys => setSelIds(keys) }}
        style={{ background: 'transparent' }}
        locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无饮食记录</span> }}
        scroll={{ x: 800 }} size="middle" />
      <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
        onPageChange={fn => setPages(p => ({ ...p, diet: typeof fn === 'function' ? fn(p.diet) : fn }))}
        pageSize={pageSize} onPageSizeChange={setPageSize} total={list.length} />
    </div>
  );
}

/* ── Exercise Tab ── */
function ExerciseTab({ c, data, inputStyle, labelStyle, pages, setPages, selIds, setSelIds, addRecord, deleteRecord, openEdit, batchDelete }) {
  const [form, setForm] = useState({ date: todayStr(), name: '', type: 'cardio', duration: '', intensity: 'medium', calories: '' });
  const [filterType, setFilterType] = useState(null);
  const [pageSize, setPageSize] = useState(10);
  const page = pages.exercise;

  const list = useMemo(() => {
    let l = [...data.exercise];
    if (filterType) l = l.filter(r => r.type === filterType);
    return l.sort((a, b) => b.date.localeCompare(a.date));
  }, [data.exercise, filterType]);

  const totalPages = Math.ceil(list.length / pageSize);
  const pageData = list.slice((page - 1) * pageSize, page * pageSize);

  function handleAdd() {
    if (!form.name || !form.duration) { message.error('请填写运动名称和时长'); return; }
    addRecord('exercise', {
      date: form.date, name: form.name, type: form.type,
      duration: parseInt(form.duration), intensity: form.intensity,
      calories: parseInt(form.calories) || 0,
    });
    setForm(f => ({ ...f, name: '', duration: '', calories: '' }));
  }

  const columns = [
    { title: '日期', dataIndex: 'date', width: 110, render: v => <span style={{ color: c.textSecondary }}>{v}</span> },
    { title: '运动', dataIndex: 'name', width: 120, render: v => <span style={{ fontWeight: 500, color: c.text }}>{v}</span> },
    {
      title: '类型', dataIndex: 'type', width: 80,
      render: v => {
        const map = { cardio: '有氧', strength: '力量', flexibility: '柔韧' };
        return <Tag bordered={false} style={{ color: '#5e6ad2' }}>{map[v] || v}</Tag>;
      },
    },
    { title: '时长', dataIndex: 'duration', width: 80, render: v => <span style={{ color: c.textSecondary }}>{v} 分钟</span> },
    {
      title: '强度', dataIndex: 'intensity', width: 70,
      render: v => { const opt = INTENSITY_LEVELS.find(o => o.value === v); return <Tag color={opt?.color} bordered={false}>{opt?.label || v}</Tag>; },
    },
    { title: '消耗', dataIndex: 'calories', width: 80, render: v => <span style={{ fontWeight: 600, color: '#ff6b6b' }}>{v} kcal</span> },
    {
      title: '操作', width: 160,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit('exercise', rec)} style={{ color: c.muted, fontSize: 13 }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => deleteRecord('exercise', rec.id)} okText="确定" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 13 }}>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="linear-card" style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr) auto', gap: 12, marginBottom: 20, alignItems: 'end' }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>运动名称</label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如：跑步" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>类型</label>
          <Select value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))}
            style={{ width: '100%', height: 42 }}
            popupStyle={{ background: c.dropdownBg }}
            dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
            options={[
              { value: 'cardio', label: '有氧' },
              { value: 'strength', label: '力量' },
              { value: 'flexibility', label: '柔韧' },
            ]} />
        </div>
        <div>
          <label style={labelStyle}>时长 (分钟)</label>
          <Input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value.replace(/\D/g, '') }))} placeholder="如：30" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>强度</label>
          <Select value={form.intensity} onChange={v => setForm(f => ({ ...f, intensity: v }))}
            style={{ width: '100%', height: 42 }}
            popupStyle={{ background: c.dropdownBg }}
            dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
            options={INTENSITY_LEVELS.map(o => ({ value: o.value, label: o.label }))} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>消耗 (kcal)</label>
          <Input value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value.replace(/\D/g, '') }))} placeholder="自动估算" style={inputStyle} />
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}
          style={{ background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8, height: 42, padding: '0 20px' }}>添加</Button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle}>类型筛选</label>
          <Select value={filterType} onChange={v => { setFilterType(v); setPages(p => ({ ...p, exercise: 1 })); }}
            style={{ width: 120, height: 42 }}
            popupStyle={{ background: c.dropdownBg }}
            dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
            options={[
              { value: null, label: '全部' },
              { value: 'cardio', label: '有氧' },
              { value: 'strength', label: '力量' },
              { value: 'flexibility', label: '柔韧' },
            ]} />
        </div>
        <Button danger disabled={!selIds.length} onClick={() => batchDelete('exercise')}
          icon={<DeleteOutlined />} style={{ borderRadius: 8, height: 42 }}>批量删除</Button>
        {selIds.length > 0 && <span style={{ color: c.muted, fontSize: 13 }}>已选 {selIds.length} 条</span>}
      </div>

      <Table dataSource={pageData} columns={columns} rowKey="id" pagination={false}
        rowSelection={{ type: 'checkbox', selectedRowKeys: selIds, onChange: keys => setSelIds(keys) }}
        style={{ background: 'transparent' }}
        locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无运动记录</span> }}
        scroll={{ x: 700 }} size="middle" />
      <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
        onPageChange={fn => setPages(p => ({ ...p, exercise: typeof fn === 'function' ? fn(p.exercise) : fn }))}
        pageSize={pageSize} onPageSizeChange={setPageSize} total={list.length} />
    </div>
  );
}

/* ── Shopping Tab ── */
function ShoppingTab({ c, data, inputStyle, labelStyle, pages, setPages, selIds, setSelIds, addRecord, deleteRecord, openEdit, batchDelete }) {
  const [form, setForm] = useState({ date: todayStr(), itemName: '', unit: '500g', quantity: 1, price: '', location: '' });
  const [pageSize, setPageSize] = useState(10);
  const page = pages.shopping;

  const list = useMemo(() =>
    [...data.shopping].sort((a, b) => b.date.localeCompare(a.date)),
  [data.shopping]);

  const totalPages = Math.ceil(list.length / pageSize);
  const pageData = list.slice((page - 1) * pageSize, page * pageSize);

  function handleAdd() {
    if (!form.itemName || !form.price) { message.error('请填写食材名称和价格'); return; }
    const qty = parseInt(form.quantity) || 1;
    const price = parseFloat(form.price) || 0;
    addRecord('shopping', {
      date: form.date, itemName: form.itemName, unit: form.unit,
      quantity: qty, price, total: qty * price, location: form.location,
    });
    setForm(f => ({ ...f, itemName: '', price: '' }));
  }

  const columns = [
    { title: '日期', dataIndex: 'date', width: 110, render: v => <span style={{ color: c.textSecondary }}>{v}</span> },
    { title: '食材', dataIndex: 'itemName', width: 130, render: v => <span style={{ fontWeight: 500, color: c.text }}>{v}</span> },
    { title: '规格', dataIndex: 'unit', width: 80, render: v => <span style={{ color: c.muted }}>{v}</span> },
    { title: '数量', dataIndex: 'quantity', width: 70, render: v => <span style={{ color: c.textSecondary }}>{v}</span> },
    { title: '单价', dataIndex: 'price', width: 80, render: v => <span style={{ color: c.textSecondary }}>¥{v}</span> },
    { title: '总额', dataIndex: 'total', width: 90, render: v => <span style={{ fontWeight: 600, color: '#ff6b6b' }}>¥{v?.toFixed(2)}</span> },
    { title: '地点', dataIndex: 'location', width: 100, render: v => <span style={{ color: c.muted2 }}>{v || '-'}</span> },
    {
      title: '操作', width: 160,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit('shopping', rec)} style={{ color: c.muted, fontSize: 13 }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => deleteRecord('shopping', rec.id)} okText="确定" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 13 }}>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="linear-card" style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr) auto', gap: 12, marginBottom: 20, alignItems: 'end' }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>食材名称</label>
          <Input value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} placeholder="如：鸡胸肉" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>规格</label>
          <Select value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))}
            style={{ width: '100%', height: 42 }}
            popupStyle={{ background: c.dropdownBg }}
            dropdownStyle={{ background: c.dropdownBg, border: '1px solid ' + c.border }}
            options={[
              { value: '500g', label: '500g' },
              { value: '1000g', label: '1000g' },
              { value: '个', label: '个' },
              { value: '袋', label: '袋' },
              { value: '瓶', label: '瓶' },
            ]} />
        </div>
        <div>
          <label style={labelStyle}>数量</label>
          <Input value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value.replace(/\D/g, '') }))} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>单价 (元)</label>
          <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="如：25" style={inputStyle} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>地点（可选）</label>
          <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="如：盒马" style={inputStyle} />
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}
          style={{ background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8, height: 42, padding: '0 20px' }}>添加</Button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Button danger disabled={!selIds.length} onClick={() => batchDelete('shopping')}
          icon={<DeleteOutlined />} style={{ borderRadius: 8, height: 42 }}>批量删除</Button>
        {selIds.length > 0 && <span style={{ color: c.muted, fontSize: 13 }}>已选 {selIds.length} 条</span>}
      </div>

      <Table dataSource={pageData} columns={columns} rowKey="id" pagination={false}
        rowSelection={{ type: 'checkbox', selectedRowKeys: selIds, onChange: keys => setSelIds(keys) }}
        style={{ background: 'transparent' }}
        locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无购买记录</span> }}
        scroll={{ x: 800 }} size="middle" />
      <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
        onPageChange={fn => setPages(p => ({ ...p, shopping: typeof fn === 'function' ? fn(p.shopping) : fn }))}
        pageSize={pageSize} onPageSizeChange={setPageSize} total={list.length} />
    </div>
  );
}

/* ── Weight Tab ── */
function WeightTab({ c, data, inputStyle, labelStyle, pages, setPages, selIds, setSelIds, addRecord, deleteRecord, openEdit, batchDelete }) {
  const [form, setForm] = useState({ date: todayStr(), weight: '', height: '170', bodyFat: '' });
  const [pageSize, setPageSize] = useState(10);
  const page = pages.weight;

  const list = useMemo(() =>
    [...data.weight].sort((a, b) => b.date.localeCompare(a.date)),
  [data.weight]);

  const totalPages = Math.ceil(list.length / pageSize);
  const pageData = list.slice((page - 1) * pageSize, page * pageSize);

  function handleAdd() {
    if (!form.weight) { message.error('请填写体重'); return; }
    addRecord('weight', {
      date: form.date, weight: parseFloat(form.weight),
      height: parseFloat(form.height) || 170,
      bodyFat: form.bodyFat ? parseFloat(form.bodyFat) : null,
    });
    setForm(f => ({ ...f, weight: '', bodyFat: '' }));
  }

  const columns = [
    { title: '日期', dataIndex: 'date', width: 110, render: v => <span style={{ color: c.textSecondary }}>{v}</span> },
    { title: '体重', dataIndex: 'weight', width: 100, render: v => <span style={{ fontWeight: 600, color: c.text, fontSize: 15 }}>{v?.toFixed(1)} kg</span> },
    { title: '体脂率', dataIndex: 'bodyFat', width: 100, render: v => v ? <span style={{ color: c.textSecondary }}>{v.toFixed(1)}%</span> : <span style={{ color: c.muted2 }}>-</span> },
    { title: '身高', dataIndex: 'height', width: 80, render: v => <span style={{ color: c.muted }}>{v} cm</span> },
    {
      title: '操作', width: 160,
      render: (_, rec) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit('weight', rec)} style={{ color: c.muted, fontSize: 13 }}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => deleteRecord('weight', rec.id)} okText="确定" cancelText="取消">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 13 }}>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="linear-card" style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr) auto', gap: 12, marginBottom: 20, alignItems: 'end' }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>日期</label>
          <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>体重 (kg)</label>
          <Input value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="如：72.5" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>身高 (cm)</label>
          <Input value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value.replace(/[^0-9.]/g, '') }))} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>体脂率 (%)</label>
          <Input value={form.bodyFat} onChange={e => setForm(f => ({ ...f, bodyFat: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="可选" style={inputStyle} />
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}
          style={{ background: '#5e6ad2', borderColor: '#5e6ad2', borderRadius: 8, height: 42, padding: '0 20px' }}>添加</Button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Button danger disabled={!selIds.length} onClick={() => batchDelete('weight')}
          icon={<DeleteOutlined />} style={{ borderRadius: 8, height: 42 }}>批量删除</Button>
        {selIds.length > 0 && <span style={{ color: c.muted, fontSize: 13 }}>已选 {selIds.length} 条</span>}
      </div>

      <Table dataSource={pageData} columns={columns} rowKey="id" pagination={false}
        rowSelection={{ type: 'checkbox', selectedRowKeys: selIds, onChange: keys => setSelIds(keys) }}
        style={{ background: 'transparent' }}
        locale={{ emptyText: <span style={{ color: c.muted2 }}>暂无体重记录</span> }}
        scroll={{ x: 500 }} size="middle" />
      <TablePagination c={c} inputStyle={inputStyle} page={page} totalPages={totalPages}
        onPageChange={fn => setPages(p => ({ ...p, weight: typeof fn === 'function' ? fn(p.weight) : fn }))}
        pageSize={pageSize} onPageSizeChange={setPageSize} total={list.length} />
    </div>
  );
}

/* ── Charts Dashboard Tab ── */
function ChartsTab({ c, isLight, data, chartRef, chartInstance }) {
  const chartInited = useRef(false);

  const dietChartRef = useRef(null);
  const weightChartRef = useRef(null);
  const weightChartInstance = useRef(null);

  /* calorie comparison chart (last 30 days) */
  const calData = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      const intake = data.diet.filter(r => r.date === date).reduce((s, r) => s + (r.calories || 0), 0);
      const burn = data.exercise.filter(r => r.date === date).reduce((s, r) => s + (r.calories || 0), 0);
      days.push({ date: date.slice(5), intake, burn, net: intake - burn });
    }
    return days;
  }, [data]);

  useEffect(() => {
    if (!dietChartRef.current || !calData.length) return;
    const chart = echarts.init(dietChartRef.current);
    chart.setOption({
      tooltip: { trigger: 'axis', backgroundColor: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)', borderWidth: 0, textStyle: { color: c.text, fontSize: 13 } },
      legend: { data: ['摄入', '消耗', '净热量'], textStyle: { color: c.muted, fontSize: 12 }, top: 0 },
      grid: { left: 60, right: 20, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: calData.map(d => d.date), axisLabel: { color: c.muted, fontSize: 10 }, axisLine: { lineStyle: { color: c.border } }, axisTick: { show: false } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' } }, axisLabel: { color: c.muted, fontSize: 11, formatter: v => v.toLocaleString() } },
      series: [
        { name: '摄入', type: 'bar', barWidth: '20%', data: calData.map(d => d.intake), itemStyle: { color: '#F0B90B', borderRadius: [3, 3, 0, 0] } },
        { name: '消耗', type: 'bar', barWidth: '20%', data: calData.map(d => d.burn), itemStyle: { color: '#1EAEDB', borderRadius: [3, 3, 0, 0] } },
        { name: '净热量', type: 'line', data: calData.map(d => d.net), smooth: true, symbol: 'circle', symbolSize: 4, lineStyle: { color: '#F6465D', width: 2 }, itemStyle: { color: '#F6465D' } },
      ],
    });
    return () => chart.dispose();
  }, [calData, c, isLight]);

  /* weight trend chart */
  useEffect(() => {
    if (!weightChartRef.current || !data.weight.length) return;
    const chart = echarts.init(weightChartRef.current);
    const sorted = [...data.weight].sort((a, b) => a.date.localeCompare(b.date));
    chart.setOption({
      tooltip: { trigger: 'axis', backgroundColor: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)', borderWidth: 0, textStyle: { color: c.text, fontSize: 13 } },
      legend: { data: ['体重 (kg)', '体脂率 (%)'], textStyle: { color: c.muted, fontSize: 12 }, top: 0 },
      grid: { left: 60, right: 30, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: sorted.map(d => d.date.slice(5)), axisLabel: { color: c.muted, fontSize: 11 }, axisLine: { lineStyle: { color: c.border } }, axisTick: { show: false } },
      yAxis: [
        { type: 'value', name: 'kg', nameTextStyle: { color: c.muted, fontSize: 11 }, splitLine: { lineStyle: { color: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' } }, axisLabel: { color: c.muted, fontSize: 11 } },
        { type: 'value', name: '%', nameTextStyle: { color: c.muted, fontSize: 11 }, splitLine: { show: false }, axisLabel: { color: c.muted, fontSize: 11 } },
      ],
      series: [
        { name: '体重 (kg)', type: 'line', data: sorted.map(d => d.weight), smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { color: '#5e6ad2', width: 2 }, itemStyle: { color: '#5e6ad2' }, yAxisIndex: 0 },
        { name: '体脂率 (%)', type: 'line', data: sorted.map(d => d.bodyFat || null), smooth: true, symbol: 'diamond', symbolSize: 6, lineStyle: { color: '#ff6b6b', width: 2 }, itemStyle: { color: '#ff6b6b' }, yAxisIndex: 1 },
      ],
    });
    return () => chart.dispose();
  }, [data.weight, c, isLight]);

  /* macro pie (today) */
  const macroData = useMemo(() => {
    const todayDiet = data.diet.filter(r => r.date === todayStr());
    const p = todayDiet.reduce((s, r) => s + (r.protein || 0), 0);
    const c_ = todayDiet.reduce((s, r) => s + (r.carbs || 0), 0);
    const f = todayDiet.reduce((s, r) => s + (r.fat || 0), 0);
    const total = p + c_ + f;
    if (!total) return [];
    return [
      { name: '蛋白质', value: p, percentage: ((p / total) * 100).toFixed(0), color: '#F6465D' },
      { name: '碳水', value: c_, percentage: ((c_ / total) * 100).toFixed(0), color: '#F0B90B' },
      { name: '脂肪', value: f, percentage: ((f / total) * 100).toFixed(0), color: '#1EAEDB' },
    ];
  }, [data.diet]);

  return (
    <div>
      {/* Calorie chart */}
      <div className="linear-card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: c.text, marginBottom: 24 }}>热量对比（近 30 天）</h2>
        <div ref={dietChartRef} style={{ height: 260, padding: 20, background: c.surfaceTint2, borderRadius: 12 }} />
      </div>

      {/* Weight chart */}
      <div className="linear-card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: c.text, marginBottom: 24 }}>体重趋势</h2>
        <div ref={weightChartRef} style={{ height: 260, padding: 20, background: c.surfaceTint2, borderRadius: 12 }} />
      </div>

      {/* Macro pie */}
      <div className="linear-card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: c.text, marginBottom: 24 }}>今日营养构成</h2>
        {macroData.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {macroData.map(m => (
              <div key={m.name} style={{ textAlign: 'center', padding: 20, background: c.surfaceTint2, borderRadius: 12 }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: m.color }}>{m.percentage}%</div>
                <div style={{ fontSize: 14, color: c.textSecondary, marginTop: 8 }}>{m.name}</div>
                <div style={{ fontSize: 13, color: c.muted, marginTop: 4 }}>{m.value.toFixed(1)}g</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: c.muted2, padding: '40px 0' }}>今天还没有饮食记录</div>
        )}
      </div>
    </div>
  );
}
