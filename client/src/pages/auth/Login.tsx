import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { PageHeader, SectionCard } from '../../components/page';
import { Btn, Field, Tag, Toast, useToastState } from '../../components/ui';
import {
  buildApiErrorMessage,
  getApiErrorCode,
  getApiFieldErrors,
  getApiFormErrors,
} from '../../lib/api';
import { getSystemHealth, login, register, useAuthState } from '../../services/auth';
import { useTheme } from '../../hooks/useTheme';
import type { SystemHealthSnapshot } from '../../types/auth';

type AuthMode = 'login' | 'register';

/** 构建系统状态标签组 */
function buildAuthTags(snapshot: SystemHealthSnapshot | null, canRegister: boolean) {
  return (
    <div className="dashboard-header-tags">
      <Tag tone={snapshot?.databaseReady ? 'green' : 'red'}>
        {snapshot?.databaseReady ? '数据库已就绪' : '数据库待初始化'}
      </Tag>
      <Tag tone="blue">JWT 认证</Tag>
      <Tag tone={canRegister ? 'orange' : 'default'}>
        {canRegister ? '注册开放' : '注册已关闭'}
      </Tag>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const authState = useAuthState();
  const { toast, showToast } = useToastState();
  const { isDark, toggleTheme } = useTheme();
  const [mode, setMode] = useState<AuthMode>('login');
  const [submitting, setSubmitting] = useState(false);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState('');
  const [healthSnapshot, setHealthSnapshot] = useState<SystemHealthSnapshot | null>(null);
  const [pageError, setPageError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    username: '',
    email: '',
    nickname: '',
    password: '',
    confirmPassword: '',
  });

  const routeState = (location.state as { from?: string; reason?: string } | null) ?? null;
  const redirectTarget = routeState?.from || '/dashboard';

  /** 会话过期提示 */
  const sessionMessage = useMemo(() => {
    const reason = routeState?.reason ?? authState.reason;
    return reason === 'session_expired' ? '登录状态已失效，请重新登录后继续。' : '';
  }, [authState.reason, routeState]);

  /** 加载系统健康状态 */
  async function loadSystemHealth() {
    setHealthLoading(true);
    setHealthError('');

    try {
      const snapshot = await getSystemHealth();
      setHealthSnapshot(snapshot);

      if (snapshot.databaseReady && snapshot.bootstrapRequired) {
        setMode('register');
      } else {
        setMode('login');
      }
    } catch (error) {
      setHealthError(buildApiErrorMessage(error, '无法连接到服务器，请检查网络后重试。'));
    } finally {
      setHealthLoading(false);
    }
  }

  useEffect(() => {
    void loadSystemHealth();
  }, []);

  const canRegister = Boolean(healthSnapshot?.databaseReady && healthSnapshot.bootstrapRequired);
  const canLogin = Boolean(healthSnapshot?.databaseReady && healthSnapshot?.hasUsers);
  const showBootstrapBlocked = Boolean(healthSnapshot && !healthSnapshot.databaseReady);

  /** 页面标题 */
  const title = useMemo(() => {
    if (showBootstrapBlocked) return '系统初始化';
    return mode === 'login' ? '登录 LifeOS' : '创建管理员账号';
  }, [mode, showBootstrapBlocked]);

  /** 页面副标题 */
  const subtitle = useMemo(() => {
    if (healthLoading) return '正在连接服务器…';
    if (healthError) return '暂时无法连接到服务，请检查网络后重试。';
    if (showBootstrapBlocked) return '系统数据库尚未完成初始化，请稍后再试。';
    if (canRegister) return '欢迎使用 LifeOS，请先创建管理员账号以开始使用。';
    return '输入账号密码登录系统。';
  }, [canRegister, healthError, healthLoading, showBootstrapBlocked]);

  /** 前端表单校验 */
  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.username.trim()) {
      nextErrors.username = '请输入用户名。';
    } else if (mode === 'register' && form.username.trim().length < 3) {
      nextErrors.username = '用户名至少需要 3 个字符。';
    }

    if (!form.password.trim()) {
      nextErrors.password = '请输入密码。';
    } else if (mode === 'register' && form.password.length < 8) {
      nextErrors.password = '密码至少需要 8 个字符。';
    }

    if (mode === 'register') {
      if (!form.email.trim()) {
        nextErrors.email = '请输入邮箱。';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        nextErrors.email = '请输入有效的邮箱地址。';
      }
      if (form.nickname.trim().length > 64) {
        nextErrors.nickname = '昵称不能超过 64 个字符。';
      }
      if (!form.confirmPassword) {
        nextErrors.confirmPassword = '请再次输入密码。';
      } else if (form.confirmPassword !== form.password) {
        nextErrors.confirmPassword = '两次输入的密码不一致。';
      }
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  /** 提交登录/注册 */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageError('');
    setFieldErrors({});

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      if (mode === 'register') {
        await register({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          nickname: form.nickname.trim() || form.username.trim(),
        });
        showToast('管理员账号创建成功，已自动登录。');
      } else {
        await login({
          username: form.username.trim(),
          password: form.password,
        });
        showToast('登录成功，欢迎回来。');
      }

      navigate(redirectTarget, { replace: true });
    } catch (error) {
      const nextFieldErrors = getApiFieldErrors(error);
      const formErrors = getApiFormErrors(error);
      const errorCode = getApiErrorCode(error);

      if (Object.keys(nextFieldErrors).length) setFieldErrors(nextFieldErrors);

      if (errorCode === 'registration_closed') { setMode('login'); void loadSystemHealth(); }
      if (errorCode === 'bootstrap_required') { setMode('register'); void loadSystemHealth(); }
      if (errorCode === 'database_not_ready') { void loadSystemHealth(); }

      setPageError(formErrors[0] || buildApiErrorMessage(
        error,
        mode === 'login'
          ? '登录失败，请检查账号密码或稍后重试。'
          : '注册失败，请检查表单内容或稍后重试。',
      ));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-shell">
      <button
        className="auth-theme-toggle"
        type="button"
        aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
        title={isDark ? '切换到浅色模式' : '切换到深色模式'}
        onClick={toggleTheme}
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      <div className="auth-page-main">
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={buildAuthTags(healthSnapshot, canRegister)}
        />

        <div className="auth-layout-grid">
          {/* 左侧品牌面板 */}
          <section className="card auth-hero-panel">
            <div className="auth-hero-copy">
              <span className="auth-eyebrow">LifeOS Control Console</span>
              <h2>全生命周期数字化管理平台</h2>
              <p>
                统一管理健康、财务、生活和投资数据。登录后即可使用仪表盘、通知中心及各业务模块。
              </p>
            </div>

            <div className="auth-status-grid">
              <div className="auth-status-card">
                <span>数据库状态</span>
                <strong>{healthSnapshot?.databaseReady ? '已就绪' : '待初始化'}</strong>
                <p>{healthSnapshot ? (healthSnapshot.databaseReady ? '正常运行中' : '需要初始化') : '检测中…'}</p>
              </div>
              <div className="auth-status-card">
                <span>注册策略</span>
                <strong>仅首个管理员</strong>
                <p>{canRegister ? '当前允许创建管理员' : '已有管理员，入口已关闭'}</p>
              </div>
              <div className="auth-status-card">
                <span>业务模块</span>
                <strong>{healthSnapshot?.entityCount ?? 0} 个</strong>
                <p>系统已加载的业务模块数量</p>
              </div>
              <div className="auth-status-card">
                <span>运行模式</span>
                <strong>{healthSnapshot?.schemaMode ?? '检测中'}</strong>
                <p>当前数据库 Schema 模式</p>
              </div>
            </div>

            <div className="auth-page-note">
              <strong>系统已就绪</strong>
              <span>登录后即可使用仪表盘、通知中心、待办事项、物品追踪及各业务管理功能。</span>
            </div>
          </section>

          {/* 右侧登录/注册表单 */}
          <SectionCard
            title={showBootstrapBlocked ? '系统初始化' : mode === 'login' ? '账号登录' : '创建管理员'}
            description={showBootstrapBlocked
              ? '请等待数据库初始化完成后再进行操作。'
              : mode === 'login'
                ? '输入管理员账号和密码登录系统。'
                : '创建系统管理员账号，完成后即可正常使用。'}
          >
            <div className="page-stack">
              {/* 登录/注册切换 */}
              <div className="auth-mode-switch">
                <button
                  type="button"
                  className={`auth-mode-tab ${mode === 'login' ? 'is-active' : ''}`}
                  onClick={() => setMode('login')}
                >
                  登录
                </button>
                <button
                  type="button"
                  className={`auth-mode-tab ${mode === 'register' ? 'is-active' : ''}`}
                  onClick={() => { if (canRegister) setMode('register'); }}
                  disabled={!canRegister}
                >
                  注册
                </button>
              </div>

              {/* 消息提示 */}
              {sessionMessage ? <div className="auth-banner is-warning">{sessionMessage}</div> : null}
              {healthError ? <div className="auth-banner is-error">{healthError}</div> : null}
              {pageError ? <div className="auth-banner is-error">{pageError}</div> : null}

              {/* 表单内容 */}
              {showBootstrapBlocked ? (
                <div className="auth-bootstrap-panel">
                  <div className="auth-bootstrap-card">
                    <strong>系统尚未就绪</strong>
                    <p>数据库正在初始化中，请稍后再试。如问题持续存在，请联系系统管理员。</p>
                    <div className="auth-bootstrap-meta">
                      <span>原因：{healthSnapshot?.reason ?? '未知'}</span>
                    </div>
                    <Btn tone="secondary" onClick={() => void loadSystemHealth()} disabled={healthLoading}>
                      {healthLoading ? '检测中…' : '重新检测'}
                    </Btn>
                  </div>
                </div>
              ) : (
                <form className="auth-form-stack" onSubmit={handleSubmit}>
                  {canRegister ? (
                    <div className="auth-banner is-info">首次使用请先创建管理员账号，创建完成后注册入口将自动关闭。</div>
                  ) : null}

                  <div className="auth-form-grid">
                    {/* 用户名 */}
                    <div className="auth-field-stack">
                      <Field
                        label="用户名"
                        value={form.username}
                        aria-invalid={Boolean(fieldErrors.username)}
                        onChange={(event) => setForm((previous) => ({ ...previous, username: event.target.value }))}
                        placeholder={mode === 'login' ? '请输入用户名' : '至少 3 个字符'}
                      />
                      {fieldErrors.username ? <span className="auth-field-error">{fieldErrors.username}</span> : null}
                    </div>

                    {/* 邮箱（仅注册） */}
                    {mode === 'register' ? (
                      <div className="auth-field-stack">
                        <Field
                          label="邮箱"
                          type="email"
                          value={form.email}
                          aria-invalid={Boolean(fieldErrors.email)}
                          onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                          placeholder="请输入管理员邮箱"
                        />
                        {fieldErrors.email ? <span className="auth-field-error">{fieldErrors.email}</span> : null}
                      </div>
                    ) : null}

                    {/* 昵称（仅注册） */}
                    {mode === 'register' ? (
                      <div className="auth-field-stack">
                        <Field
                          label="昵称"
                          value={form.nickname}
                          aria-invalid={Boolean(fieldErrors.nickname)}
                          onChange={(event) => setForm((previous) => ({ ...previous, nickname: event.target.value }))}
                          placeholder="用于顶部用户区显示"
                          hint="不填时默认使用用户名"
                        />
                        {fieldErrors.nickname ? <span className="auth-field-error">{fieldErrors.nickname}</span> : null}
                      </div>
                    ) : null}

                    {/* 密码 */}
                    <div className="auth-field-stack">
                      <Field
                        label="密码"
                        type="password"
                        value={form.password}
                        aria-invalid={Boolean(fieldErrors.password)}
                        onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                        placeholder={mode === 'login' ? '请输入密码' : '至少 8 个字符'}
                        hint={mode === 'register' ? '密码长度至少 8 位' : undefined}
                      />
                      {fieldErrors.password ? <span className="auth-field-error">{fieldErrors.password}</span> : null}
                    </div>

                    {/* 确认密码（仅注册） */}
                    {mode === 'register' ? (
                      <div className="auth-field-stack">
                        <Field
                          label="确认密码"
                          type="password"
                          value={form.confirmPassword}
                          aria-invalid={Boolean(fieldErrors.confirmPassword)}
                          onChange={(event) => setForm((previous) => ({ ...previous, confirmPassword: event.target.value }))}
                          placeholder="请再次输入密码"
                        />
                        {fieldErrors.confirmPassword ? <span className="auth-field-error">{fieldErrors.confirmPassword}</span> : null}
                      </div>
                    ) : null}
                  </div>

                  {/* 提交按钮 */}
                  <div className="auth-submit-stack">
                    <Btn
                      tone="primary"
                      type="submit"
                      disabled={submitting || healthLoading || (mode === 'login' ? !canLogin : !canRegister)}
                    >
                      {submitting ? '提交中…' : mode === 'login' ? '登录' : '创建账号'}
                    </Btn>
                    <span className="auth-submit-note">
                      {mode === 'login'
                        ? (canRegister ? '请先创建管理员账号后再登录。' : '登录成功后进入系统首页。')
                        : '注册成功后将自动登录并进入系统。'}
                    </span>
                  </div>
                </form>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}
