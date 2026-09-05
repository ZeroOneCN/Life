import { useCallback, useEffect, useRef, useState } from 'react';

import { Grid, Radio } from '@arco-design/web-react';

import { PageHeader, SectionCard } from '../../components/page';
import { Btn, useToastState } from '../../components/ui';
import { useBreadcrumbTail } from '../../hooks/useBreadcrumbTail';
import { apiClient, buildApiErrorMessage } from '../../lib/api';

const { Row, Col } = Grid;

/**
 * 可导出的模块信息
 */
interface ExportModule {
  moduleName: string;
  entities: string[];
  totalEntities: number;
}

/**
 * 模块显示名称映射
 */
const MODULE_LABELS: Record<string, string> = {
  finance: '财务中心',
  health: '健康中心',
  life: '生活中心',
  investment: '投资中心',
  notifications: '通知中心',
  system: '系统管理',
};

/**
 * 模块图标映射
 */
const MODULE_ICONS: Record<string, string> = {
  finance: '💰',
  health: '❤️',
  life: '📋',
  investment: '📈',
  notifications: '🔔',
  system: '⚙️',
};

/**
 * 数据导出页面
 * 支持选择模块一键导出为 ZIP 包，便于局域网访问和数据迁移
 */
export default function DataExportPage() {
  useBreadcrumbTail('数据导出');
  const { showToast } = useToastState();

  const [modules, setModules] = useState<ExportModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [totalEntities, setTotalEntities] = useState(0);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const formRef = useRef<HTMLFormElement>(null);

  // 加载可导出的模块列表
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .get('/system/export/modules')
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        if (data?.modules) {
          setModules(data.modules);
          setTotalEntities(data.totalEntities);
          // 默认全选
          setSelectedModules(new Set(data.modules.map((m: ExportModule) => m.moduleName)));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        showToast(buildApiErrorMessage(err, '加载模块列表失败'), 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // 切换全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedModules.size === modules.length) {
      setSelectedModules(new Set());
    } else {
      setSelectedModules(new Set(modules.map((m) => m.moduleName)));
    }
  }, [selectedModules, modules]);

  // 切换单个模块
  const toggleModule = useCallback(
    (moduleName: string) => {
      setSelectedModules((prev) => {
        const next = new Set(prev);
        if (next.has(moduleName)) {
          next.delete(moduleName);
        } else {
          next.add(moduleName);
        }
        return next;
      });
    },
    [],
  );

  // 导出数据
  const handleExport = useCallback(async () => {
    if (selectedModules.size === 0) {
      showToast('请至少选择一个模块', 'warning');
      return;
    }

    setExporting(true);
    try {
      const response = await apiClient.post(
        '/system/export/export',
        { modules: Array.from(selectedModules), format: exportFormat },
        { responseType: 'blob' },
      );

      const blob = response.data as Blob;

      // 从响应头中获取文件名
      const disposition = response.headers['content-disposition'];
      let filename = `lifeos-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.zip`;
      if (disposition) {
        const match = disposition.match(/filename="?(.+?)"?$/);
        if (match) {
          filename = match[1];
        }
      }

      // 下载文件
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`数据导出成功！共导出 ${Array.from(selectedModules).length} 个模块`, 'success');
    } catch (error) {
      // 如果 blob 是 JSON 格式的错误响应，尝试解析
      if (error instanceof Blob) {
        try {
          const text = await error.text();
          const parsed = JSON.parse(text);
          showToast(parsed.message || '导出失败', 'error');
        } catch {
          showToast(buildApiErrorMessage(error, '导出失败'), 'error');
        }
      } else {
        showToast(buildApiErrorMessage(error, '导出失败'), 'error');
      }
    } finally {
      setExporting(false);
    }
  }, [selectedModules, showToast, exportFormat]);

  // 计算选中模块的实体总数
  const selectedEntityCount = modules
    .filter((m) => selectedModules.has(m.moduleName))
    .reduce((sum, m) => sum + m.totalEntities, 0);

  return (
    <div className="page-stack">
      <PageHeader title="数据导出" subtitle="导出全量数据为 ZIP 包，便于数据迁移和备份" />

      <SectionCard
        title="选择导出模块"
        description={`共 ${modules.length} 个模块，${totalEntities} 个数据表`}
        action={
          <Btn tone="primary" onClick={handleExport} loading={exporting}>
            {exporting ? '正在导出...' : '一键导出'}
          </Btn>
        }
      >
        <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
          {/* 全选/取消 */}
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--color-fill-1)',
              borderRadius: 6,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={selectedModules.size === modules.length && modules.length > 0}
                onChange={toggleSelectAll}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              全选 / 取消全选
            </label>
            <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
              已选 {selectedModules.size} 个模块，{selectedEntityCount} 个数据表
            </span>
          </div>

          {/* 导出格式选择 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              padding: '10px 16px',
              background: 'var(--color-bg-2)',
              border: '1px solid var(--color-border-2)',
              borderRadius: 6,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}>导出格式：</span>
            <Radio.Group
              type="button"
              value={exportFormat}
              onChange={(val) => setExportFormat(val as 'json' | 'csv')}
              options={[
                { label: 'JSON', value: 'json' },
                { label: 'CSV', value: 'csv' },
              ]}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
              {exportFormat === 'csv'
                ? 'CSV 文件可直接用 Excel 打开，适合数据查看与分享'
                : 'JSON 保留完整数据结构，适合数据迁移与二次导入'}
            </span>
          </div>

          {/* 模块列表 */}
          <Row gutter={[16, 16]}>
            {modules.map((mod) => {
              const isSelected = selectedModules.has(mod.moduleName);
              return (
                <Col key={mod.moduleName} xs={24} sm={12} md={8} lg={6}>
                  <div
                    className={`export-module-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => toggleModule(mod.moduleName)}
                    style={{
                      padding: 16,
                      borderRadius: 8,
                      border: `2px solid ${
                        isSelected ? 'var(--color-primary-6)' : 'var(--color-border-2)'
                      }`,
                      background: isSelected
                        ? 'var(--color-primary-1)'
                        : 'var(--color-bg-2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      userSelect: 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{MODULE_ICONS[mod.moduleName] ?? '📁'}</span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleModule(mod.moduleName)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                      {MODULE_LABELS[mod.moduleName] ?? mod.moduleName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                      {mod.totalEntities} 个数据表
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        </form>
      </SectionCard>

      {/* 导出说明 */}
      <SectionCard title="导出说明">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 13,
            color: 'var(--color-text-2)',
            lineHeight: 1.8,
          }}
        >
          <p>• 导出格式为 ZIP 压缩包，每个模块一个目录，每个数据表一个单独文件</p>
          <p>• JSON 格式保留完整数据结构，适合数据迁移与备份；CSV 格式可直接用 Excel 打开，适合数据查看与分享</p>
          <p>• CSV 文件采用 UTF-8 BOM 编码，支持中文，可直接用 Excel/WPS 打开</p>
          <p>• 导出的数据包含所选模块的<strong>全部记录</strong>，不分页，适合数据迁移与备份</p>
          <p>• 压缩包内包含 metadata.json 元数据文件，记录导出时间、格式、模块信息等</p>
          <p>• 投资模块的部分本地缓存数据不包含在导出中</p>
        </div>
      </SectionCard>
    </div>
  );
}