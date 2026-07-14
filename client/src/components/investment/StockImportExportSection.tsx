import { useRef, useState } from 'react';
import { SectionCard } from '../page';
import { Btn, Modal, useToastState } from '../ui';
import { downloadStockTradeTemplate, importStockTrades } from '../../services/stockStorage';
import { type StockTradeDraft } from '../../types/investment';
import { type StockMarketType } from '../../services/stockStorage';

interface StockImportExportSectionProps {
  market: StockMarketType;
  onImport: (trades: StockTradeDraft[]) => void;
}

export function StockImportExportSection({ market, onImport }: StockImportExportSectionProps) {
  const { showToast } = useToastState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    skipped: number;
    failed: number;
  } | null>(null);

  const handleDownloadTemplate = () => {
    downloadStockTradeTemplate(market);
    showToast('模板已下载');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importStockTrades(file, market);
      const newTrades = result.filter((t) => t.status === 'new');
      const skipped = result.filter((t) => t.status === 'duplicate').length;
      const failed = result.filter((t) => t.status === 'error').length;

      if (newTrades.length > 0) {
        const drafts: StockTradeDraft[] = newTrades.map((t) => ({
          market,
          platformId: t.platformId || '',
          symbol: t.symbol,
          name: t.name || t.symbol,
          side: t.side,
          quantity: t.quantity,
          price: t.price,
          fee: t.fee || 0,
          tradeDate: t.tradeDate,
          tradeTime: t.tradeTime || '00:00:00',
          status: t.closePrice !== undefined ? 'closed' : 'open',
          closePrice: t.closePrice,
          closeDate: t.closeDate,
          closeTime: t.closeTime,
          closeFee: t.closeFee || 0,
          realizedPnl: t.realizedPnl,
        }));
        onImport(drafts);
      }

      setImportResult({
        success: newTrades.length,
        skipped,
        failed,
      });
      setShowResultModal(true);
    } catch (err) {
      showToast('导入失败：' + (err as Error).message, 'error');
    }

    e.target.value = '';
  };

  return (
    <>
      <SectionCard
        title="批量导入"
        description="通过Excel文件批量导入交易记录"
        action={
          <div className="invest-action-group">
            <Btn tone="secondary" onClick={handleDownloadTemplate}>下载模板</Btn>
            <Btn tone="primary" onClick={() => fileInputRef.current?.click()}>选择文件</Btn>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        }
      >
        <div className="invest-import-hints">
          <h4>导入说明</h4>
          <ul>
            <li>下载模板后按格式填写交易记录</li>
            <li>平台名称如果不存在会自动创建</li>
            <li>已存在的交易记录（相同平台、日期、标的、方向）会自动跳过</li>
            <li>支持 .xlsx 和 .xls 格式</li>
          </ul>
          <h4>模板字段说明</h4>
          <table className="invest-import-fields">
            <thead>
              <tr>
                <th>字段名</th>
                <th>必填</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>平台名称</td>
                <td>是</td>
                <td>交易平台名称，如"富途牛牛"</td>
              </tr>
              <tr>
                <td>标的代码</td>
                <td>是</td>
                <td>股票代码，如"AAPL"或"0700"</td>
              </tr>
              <tr>
                <td>标的名称</td>
                <td>否</td>
                <td>股票中文名称</td>
              </tr>
              <tr>
                <td>方向</td>
                <td>是</td>
                <td>买入或卖出</td>
              </tr>
              <tr>
                <td>数量</td>
                <td>是</td>
                <td>交易数量</td>
              </tr>
              <tr>
                <td>成交价</td>
                <td>是</td>
                <td>成交价格</td>
              </tr>
              <tr>
                <td>手续费</td>
                <td>否</td>
                <td>交易手续费</td>
              </tr>
              <tr>
                <td>交易日期</td>
                <td>是</td>
                <td>格式：YYYY-MM-DD</td>
              </tr>
              <tr>
                <td>交易时间</td>
                <td>否</td>
                <td>格式：HH:mm:ss，默认00:00:00</td>
              </tr>
              <tr>
                <td>状态</td>
                <td>否</td>
                <td>持仓中或已平仓，默认持仓中</td>
              </tr>
              <tr>
                <td>平仓价</td>
                <td>否</td>
                <td>状态为已平仓时必填</td>
              </tr>
              <tr>
                <td>平仓日期</td>
                <td>否</td>
                <td>状态为已平仓时填写</td>
              </tr>
              <tr>
                <td>平仓手续费</td>
                <td>否</td>
                <td>平仓时的手续费</td>
              </tr>
              <tr>
                <td>备注</td>
                <td>否</td>
                <td>备注信息</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <Modal
        open={showResultModal}
        onClose={() => setShowResultModal(false)}
        title="导入结果"
        footer={
          <Btn tone="primary" onClick={() => setShowResultModal(false)}>确定</Btn>
        }
      >
        {importResult && (
          <div className="invest-import-result">
            <div className="invest-import-result-item">
              <span className="invest-import-result-label">成功导入</span>
              <span className="invest-import-result-value success">{importResult.success} 条</span>
            </div>
            <div className="invest-import-result-item">
              <span className="invest-import-result-label">跳过重复</span>
              <span className="invest-import-result-value skipped">{importResult.skipped} 条</span>
            </div>
            <div className="invest-import-result-item">
              <span className="invest-import-result-label">导入失败</span>
              <span className="invest-import-result-value failed">{importResult.failed} 条</span>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}