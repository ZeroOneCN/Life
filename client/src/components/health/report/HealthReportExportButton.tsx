import { Btn } from '../../ui';
import { exportTravelReportAsPdf } from '../../../services/travel';

interface HealthReportExportButtonProps {
  targetRef: React.RefObject<HTMLDivElement>;
  fileName: string;
  disabled: boolean;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

/**
 * 报告导出按钮：将整个健康报告区域（通过 ref 引用）渲染为 PDF。
 * 复用 travel 模块的 PDF 导出工具（jsPDF + html2canvas）。
 * @param targetRef - 报告容器的 ref
 * @param fileName - 导出文件名
 * @param disabled - 是否禁用
 * @param showToast - 提示回调
 */
export function HealthReportExportButton({
  targetRef,
  fileName,
  disabled,
  showToast,
}: HealthReportExportButtonProps) {
  const handleExport = async () => {
    if (!targetRef.current) {
      showToast('报告内容尚未加载，无法导出。', 'error');
      return;
    }
    try {
      await exportTravelReportAsPdf(targetRef.current, fileName);
      showToast('PDF 报告已导出。');
    } catch (error) {
      showToast(`PDF 导出失败：${String(error)}`, 'error');
    }
  };

  return (
    <Btn type="button" tone="primary" onClick={handleExport} disabled={disabled}>
      导出 PDF
    </Btn>
  );
}
