import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { PageHeader, SectionCard } from '../../components/page';
import { Btn, Field, Tag, Toast, useToastState } from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { login, register } from '../../services/auth';

type AuthMode = 'login' | 'register';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, showToast } = useToastState();
  const [mode, setMode] = useState<AuthMode>('login');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    nickname: '',
  });

  const title = useMemo(
    () => (mode === 'login' ? '登录 LifeOS' : '注册 LifeOS'),
    [mode],
  );

  const subtitle = useMemo(
    () => (
      mode === 'login'
        ? '数据库已经成为正式业务数据源，登录后即可进入统一控制台与各业务中心。'
        : '注册完成后会直接写入后端用户体系，后续所有业务数据都会按当前登录用户隔离。'
    ),
    [mode],
  );

  const handleSubmit = async () => {
    if (!form.username.trim() || !form.password.trim()) {
      showToast('请先填写用户名和密码。', 'error');
      return;
    }

    if (mode === 'register' && !form.email.trim()) {
      showToast('注册需要填写邮箱。', 'error');
      return;
    }

    setSubmitting(true);

    try {
      if (mode === 'register') {
        await register({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          nickname: form.nickname.trim() || form.username.trim(),
        });
        showToast('注册成功，已自动登录。');
      } else {
        await login({
          username: form.username.trim(),
          password: form.password,
        });
        showToast('登录成功。');
      }

      const redirectTarget = (location.state as { from?: string } | null)?.from || '/dashboard';
      navigate(redirectTarget, { replace: true });
    } catch (error) {
      showToast(buildApiErrorMessage(error, '登录失败，请检查账号密码或稍后重试。'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-shell">
      <div className="auth-page-panel">
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={(
            <div className="dashboard-header-tags">
              <Tag tone="green">数据库在线</Tag>
              <Tag tone="blue">JWT 会话</Tag>
              <Tag tone="default">通知中心已接入</Tag>
            </div>
          )}
        />

        <SectionCard
          title={mode === 'login' ? '账号登录' : '创建账号'}
          description={mode === 'login'
            ? '默认演示账号可使用 `demo / 12345678`。'
            : '注册后会同步创建用户资料，并直接进入控制台。'}
        >
          <div className="page-stack">
            <div className="auth-form-grid">
              <Field
                label="用户名"
                value={form.username}
                onChange={(event) => setForm((previous) => ({ ...previous, username: event.target.value }))}
                placeholder="请输入用户名"
              />
              {mode === 'register' ? (
                <Field
                  label="邮箱"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                  placeholder="请输入邮箱"
                />
              ) : null}
              {mode === 'register' ? (
                <Field
                  label="昵称"
                  value={form.nickname}
                  onChange={(event) => setForm((previous) => ({ ...previous, nickname: event.target.value }))}
                  placeholder="请输入昵称"
                />
              ) : null}
              <Field
                label="密码"
                type="password"
                value={form.password}
                onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                placeholder="请输入密码"
              />
            </div>

            <div className="auth-form-actions">
              <Btn tone="primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? '提交中...' : mode === 'login' ? '登录并进入系统' : '注册并进入系统'}
              </Btn>
              <Btn
                tone="ghost"
                disabled={submitting}
                onClick={() => setMode((previous) => (previous === 'login' ? 'register' : 'login'))}
              >
                {mode === 'login' ? '没有账号，去注册' : '已有账号，去登录'}
              </Btn>
            </div>
          </div>
        </SectionCard>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
