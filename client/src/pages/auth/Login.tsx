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
import type { SystemHealthSnapshot } from '../../types/auth';

type AuthMode = 'login' | 'register';

function buildAuthTags(snapshot: SystemHealthSnapshot | null, canRegister: boolean) {
  return (
    <div className="dashboard-header-tags">
      <Tag tone={snapshot?.databaseReady ? 'green' : 'red'}>
        {snapshot?.databaseReady ? '数据库已就绪' : '数据库待初始化'}
      </Tag>
      <Tag tone="blue">JWT 会话</Tag>
      <Tag tone={canRegister ? 'orange' : 'default'}>
        {canRegister ? '首个管理员注册开放' : '首个管理员注册关闭'}
      </Tag>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const authState = useAuthState();
  const { toast, showToast } = useToastState();
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

  const sessionMessage = useMemo(() => {
    const reason = routeState?.reason ?? authState.reason;
    return reason === 'session_expired' ? '登录状态已失效，请重新登录后继续。' : '';
  }, [authState.reason, routeState]);

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
      setHealthError(buildApiErrorMessage(error, '系统状态读取失败，请确认后端和数据库已经正常启动。'));
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

  const title = useMemo(() => {
    if (showBootstrapBlocked) {
      return '初始化 LifeOS';
    }

    return mode === 'login' ? '登录 LifeOS' : '创建首个管理员';
  }, [mode, showBootstrapBlocked]);

  const subtitle = useMemo(() => {
    if (healthLoading) {
      return '正在检查数据库状态、管理员初始化进度和当前登录入口可用性。';
    }

    if (healthError) {
      return '暂时无法确认系统状态，请先检查后端服务、数据库连接和初始化配置。';
    }

    if (showBootstrapBlocked) {
      return '数据库核心表尚未就绪。系统会保持在线并通过健康探针反馈状态，便于先排查初始化配置。';
    }

    if (canRegister) {
      return '系统还没有管理员账号。完成首个管理员创建后，前台注册入口会自动关闭。';
    }

    return '数据库已经成为正式业务数据源，登录后即可进入统一控制台与各业务中心。';
  }, [canRegister, healthError, healthLoading, showBootstrapBlocked]);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageError('');
    setFieldErrors({});

    if (!validateForm()) {
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
        showToast('首个管理员创建成功，已自动登录。');
      } else {
        await login({
          username: form.username.trim(),
          password: form.password,
        });
        showToast('登录成功。');
      }

      navigate(redirectTarget, { replace: true });
    } catch (error) {
      const nextFieldErrors = getApiFieldErrors(error);
      const formErrors = getApiFormErrors(error);
      const errorCode = getApiErrorCode(error);

      if (Object.keys(nextFieldErrors).length) {
        setFieldErrors(nextFieldErrors);
      }

      if (errorCode === 'registration_closed') {
        setMode('login');
        void loadSystemHealth();
      }

      if (errorCode === 'bootstrap_required') {
        setMode('register');
        void loadSystemHealth();
      }

      if (errorCode === 'database_not_ready') {
        void loadSystemHealth();
      }

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
      <div className="auth-page-main">
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={buildAuthTags(healthSnapshot, canRegister)}
        />

        <div className="auth-layout-grid">
          <section className="card auth-hero-panel">
            <div className="auth-hero-copy">
              <span className="auth-eyebrow">LifeOS Control Console</span>
              <h2>把登录入口、数据库状态和首启初始化收敛到一个正式入口。</h2>
              <p>
                这一轮不再依赖浏览器示例数据。认证通过后，你看到的 dashboard、通知中心和首批核心业务页
                都以后端数据库为唯一来源。
              </p>
            </div>

            <div className="auth-status-grid">
              <div className="auth-status-card">
                <span>数据库状态</span>
                <strong>{healthSnapshot?.databaseReady ? '已就绪' : '待初始化'}</strong>
                <p>{healthSnapshot ? `核心表：${healthSnapshot.coreTable}` : '正在检测核心表状态'}</p>
              </div>
              <div className="auth-status-card">
                <span>注册策略</span>
                <strong>仅首个管理员</strong>
                <p>{canRegister ? '当前允许创建首个管理员' : '已有管理员后将关闭前台注册'}</p>
              </div>
              <div className="auth-status-card">
                <span>实体发现</span>
                <strong>{healthSnapshot?.entityCount ?? 0} 个</strong>
                <p>后端启动时自动发现实体模型，避免漏配数据源。</p>
              </div>
              <div className="auth-status-card">
                <span>Schema 模式</span>
                <strong>{healthSnapshot?.schemaMode ?? '检测中'}</strong>
                <p>健康探针会同步反馈当前建表策略和初始化状态。</p>
              </div>
            </div>

            <div className="auth-page-note">
              <strong>本轮已正式接管：</strong>
              <span>dashboard、通知中心、待办、物品追踪、号卡、订阅和贷款页面都将跟随当前登录用户读取后端数据。</span>
            </div>
          </section>

          <SectionCard
            title={showBootstrapBlocked ? '数据库初始化引导' : mode === 'login' ? '账号登录' : '创建首个管理员'}
            description={showBootstrapBlocked
              ? '先让核心表和数据源进入可用状态，再进行首个管理员注册。'
              : mode === 'login'
                ? '输入现有管理员账号后进入 LifeOS 控制台。'
                : '这个入口只在系统还没有任何用户时开放，用于创建首个管理员。'}
          >
            <div className="page-stack">
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
                  onClick={() => {
                    if (canRegister) {
                      setMode('register');
                    }
                  }}
                  disabled={!canRegister}
                >
                  注册首个管理员
                </button>
              </div>

              {sessionMessage ? <div className="auth-banner is-warning">{sessionMessage}</div> : null}
              {healthError ? <div className="auth-banner is-error">{healthError}</div> : null}
              {pageError ? <div className="auth-banner is-error">{pageError}</div> : null}

              {showBootstrapBlocked ? (
                <div className="auth-bootstrap-panel">
                  <div className="auth-bootstrap-card">
                    <strong>数据库核心表尚未就绪</strong>
                    <p>
                      当前健康探针返回 `databaseReady=false`。请先确认 MySQL 连接、`DB_SYNCHRONIZE` /
                      `DB_AUTO_BOOTSTRAP` 配置，或执行正式 migration 后再刷新本页。
                    </p>
                    <div className="auth-bootstrap-meta">
                      <span>原因：{healthSnapshot?.reason ?? 'unknown'}</span>
                      <span>核心表：{healthSnapshot?.coreTable ?? 'system_user_account'}</span>
                    </div>
                    <Btn tone="secondary" onClick={() => void loadSystemHealth()} disabled={healthLoading}>
                      {healthLoading ? '重新检测中...' : '重新检测系统状态'}
                    </Btn>
                  </div>
                </div>
              ) : (
                <form className="auth-form-stack" onSubmit={handleSubmit}>
                  {canRegister ? (
                    <div className="auth-banner is-info">
                      系统尚未创建管理员账号。完成这次注册后，前台注册入口会自动关闭，后续请直接登录。
                    </div>
                  ) : null}

                  <div className="auth-form-grid">
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

                    {mode === 'register' ? (
                      <div className="auth-field-stack">
                        <Field
                          label="昵称"
                          value={form.nickname}
                          aria-invalid={Boolean(fieldErrors.nickname)}
                          onChange={(event) => setForm((previous) => ({ ...previous, nickname: event.target.value }))}
                          placeholder="用于顶部用户区和系统壳显示"
                          hint="不填时默认使用用户名。"
                        />
                        {fieldErrors.nickname ? <span className="auth-field-error">{fieldErrors.nickname}</span> : null}
                      </div>
                    ) : null}

                    <div className="auth-field-stack">
                      <Field
                        label="密码"
                        type="password"
                        value={form.password}
                        aria-invalid={Boolean(fieldErrors.password)}
                        onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                        placeholder={mode === 'login' ? '请输入密码' : '至少 8 个字符'}
                        hint={mode === 'register' ? '密码长度至少 8 位。' : undefined}
                      />
                      {fieldErrors.password ? <span className="auth-field-error">{fieldErrors.password}</span> : null}
                    </div>

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

                  <div className="auth-submit-stack">
                    <Btn
                      tone="primary"
                      type="submit"
                      disabled={submitting || healthLoading || (mode === 'login' ? !canLogin : !canRegister)}
                    >
                      {submitting ? '提交中...' : mode === 'login' ? '登录并进入系统' : '创建首个管理员并进入系统'}
                    </Btn>

                    <span className="auth-submit-note">
                      {mode === 'login'
                        ? (canRegister
                          ? '系统尚未初始化完成，请先切换到注册首个管理员。'
                          : '登录成功后将直接跳转到 dashboard 首页。')
                        : '注册成功后会自动登录，并为当前用户创建通知场景、号卡运营商和订阅分类等默认资源。'}
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
