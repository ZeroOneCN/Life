import { Link } from 'react-router-dom';

import { PageHeader } from '../components/page';
import { Btn } from '../components/ui';

const Icon404 = () => (
  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M16 16s-1.5-2-4-2-4 2-4 2"/>
    <line x1="9" y1="9" x2="9.01" y2="9"/>
    <line x1="15" y1="9" x2="15.01" y2="9"/>
  </svg>
);

/**
 * 404 页面 - 当用户访问不存在的路由时显示
 * 提供友好的错误提示和返回首页按钮
 */
export default function NotFound() {
  return (
    <div className="page-stack not-found-page">
      <PageHeader title="页面未找到" />

      <div className="not-found-content">
        <div className="not-found-icon">
          <Icon404 />
        </div>
        <div className="not-found-text">
          <h2>404</h2>
          <p>抱歉，您访问的页面不存在或已被移除</p>
        </div>
        <div className="not-found-actions">
          <Link to="/dashboard">
            <Btn tone="primary">返回首页</Btn>
          </Link>
          <Link to="javascript:history.back()">
            <Btn tone="default">返回上一页</Btn>
          </Link>
        </div>
      </div>
    </div>
  );
}