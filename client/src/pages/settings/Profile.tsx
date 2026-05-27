import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader, SectionCard } from '../../components/page';
import { Btn, Field, PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { buildApiErrorMessage, getApiFieldErrors } from '../../lib/api';
import { changePassword, updateAuthProfile, useAuthState } from '../../services/auth';

type ProfileTab = 'profile' | 'security';

const TAB_OPTIONS: Array<{ value: ProfileTab; label: string }> = [
  { value: 'profile', label: '个人资料' },
  { value: 'security', label: '账户安全' },
];

export default function ProfileSettingsPage() {
  const authState = useAuthState();
  const { toast, showToast } = useToastState();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') === 'security' ? 'security' : 'profile') as ProfileTab;
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [profileForm, setProfileForm] = useState({
    nickname: '',
    email: '',
    timezone: '',
    avatarUrl: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const user = authState.session?.user ?? null;

  useEffect(() => {
    if (!user) {
      return;
    }

    setProfileForm({
      nickname: user.nickname ?? '',
      email: user.email ?? '',
      timezone: user.timezone ?? 'Asia/Shanghai',
      avatarUrl: user.avatarUrl ?? '',
    });
  }, [user]);

  useEffect(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams, tab]);

  const avatarInitial = useMemo(() => {
    if (!user) {
      return 'U';
    }

    const seed = user.nickname?.trim() || user.username?.trim() || user.email?.trim() || 'U';
    return seed.slice(0, 1).toUpperCase();
  }, [user]);

  const validateProfileForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!profileForm.nickname.trim()) {
      nextErrors.nickname = '请输入昵称。';
    }
    if (!profileForm.email.trim()) {
      nextErrors.email = '请输入邮箱。';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email.trim())) {
      nextErrors.email = '请输入有效的邮箱地址。';
    }
    if (!profileForm.timezone.trim()) {
      nextErrors.timezone = '请输入时区。';
    }

    setProfileErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validatePasswordForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!passwordForm.currentPassword) {
      nextErrors.currentPassword = '请输入当前密码。';
    }
    if (!passwordForm.newPassword) {
      nextErrors.newPassword = '请输入新密码。';
    } else if (passwordForm.newPassword.length < 8) {
      nextErrors.newPassword = '新密码至少需要 8 位。';
    }
    if (!passwordForm.confirmPassword) {
      nextErrors.confirmPassword = '请再次输入新密码。';
    } else if (passwordForm.confirmPassword !== passwordForm.newPassword) {
      nextErrors.confirmPassword = '两次输入的新密码不一致。';
    }

    setPasswordErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileErrors({});

    if (!validateProfileForm()) {
      return;
    }

    setProfileSaving(true);
    try {
      await updateAuthProfile({
        nickname: profileForm.nickname.trim(),
        email: profileForm.email.trim(),
        timezone: profileForm.timezone.trim(),
        avatarUrl: profileForm.avatarUrl.trim(),
      });
      showToast('个人资料已更新。');
    } catch (error) {
      setProfileErrors(getApiFieldErrors(error));
      showToast(buildApiErrorMessage(error, '个人资料保存失败。'), 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordErrors({});

    if (!validatePasswordForm()) {
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword(passwordForm);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      showToast('密码已更新。');
    } catch (error) {
      setPasswordErrors(getApiFieldErrors(error));
      showToast(buildApiErrorMessage(error, '密码修改失败。'), 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="个人中心"
        subtitle="这里维护当前登录用户的资料、时区和账户安全设置。保存成功后，顶部用户区会立即同步。"
        actions={<Tag tone="blue">认证会话已接入</Tag>}
      />

      <SectionCard
        title="账户概览"
        description="当前页面只操作登录用户本人，不提供多用户切换。"
      >
        <div className="profile-shell">
          <div className="profile-avatar-panel">
            {user?.avatarUrl ? (
              <img className="profile-avatar" src={user.avatarUrl} alt={user.nickname} />
            ) : (
              <div className="profile-avatar profile-avatar-fallback">{avatarInitial}</div>
            )}
          </div>
          <div className="profile-meta-panel">
            <strong>{user?.nickname ?? user?.username ?? '当前用户'}</strong>
            <span>{user?.email ?? '-'}</span>
            <span>{user?.timezone ?? 'Asia/Shanghai'}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="设置分区"
        description="个人资料与账户安全分开保存，互不影响。"
      >
        <PillTabs
          options={TAB_OPTIONS}
          value={tab}
          onChange={(value) => setTab(value as ProfileTab)}
        />
      </SectionCard>

      {tab === 'profile' ? (
        <SectionCard
          title="个人资料"
          description="昵称、邮箱、时区和头像 URL 会直接写入当前用户资料。"
        >
          <form className="page-stack" onSubmit={handleProfileSubmit}>
            <div className="form-grid">
              <div className="auth-field-stack">
                <Field
                  label="昵称"
                  value={profileForm.nickname}
                  onChange={(event) => setProfileForm((previous) => ({ ...previous, nickname: event.target.value }))}
                />
                {profileErrors.nickname ? <span className="auth-field-error">{profileErrors.nickname}</span> : null}
              </div>
              <div className="auth-field-stack">
                <Field
                  label="邮箱"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) => setProfileForm((previous) => ({ ...previous, email: event.target.value }))}
                />
                {profileErrors.email ? <span className="auth-field-error">{profileErrors.email}</span> : null}
              </div>
              <div className="auth-field-stack">
                <Field
                  label="时区"
                  value={profileForm.timezone}
                  onChange={(event) => setProfileForm((previous) => ({ ...previous, timezone: event.target.value }))}
                  hint="例如 Asia/Shanghai、America/Los_Angeles。"
                />
                {profileErrors.timezone ? <span className="auth-field-error">{profileErrors.timezone}</span> : null}
              </div>
              <div className="auth-field-stack">
                <Field
                  label="头像 URL"
                  value={profileForm.avatarUrl}
                  onChange={(event) => setProfileForm((previous) => ({ ...previous, avatarUrl: event.target.value }))}
                  placeholder="https://example.com/avatar.png"
                />
                {profileErrors.avatarUrl ? <span className="auth-field-error">{profileErrors.avatarUrl}</span> : null}
              </div>
            </div>
            <div className="page-actions">
              <Btn tone="primary" type="submit" disabled={profileSaving}>
                {profileSaving ? '保存中...' : '保存资料'}
              </Btn>
            </div>
          </form>
        </SectionCard>
      ) : null}

      {tab === 'security' ? (
        <SectionCard
          title="账户安全"
          description="修改密码后当前会话继续保留，但后续登录将使用新密码。"
        >
          <form className="page-stack" onSubmit={handlePasswordSubmit}>
            <div className="form-grid">
              <div className="auth-field-stack">
                <Field
                  label="当前密码"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((previous) => ({ ...previous, currentPassword: event.target.value }))}
                />
                {passwordErrors.currentPassword ? <span className="auth-field-error">{passwordErrors.currentPassword}</span> : null}
              </div>
              <div className="auth-field-stack">
                <Field
                  label="新密码"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((previous) => ({ ...previous, newPassword: event.target.value }))}
                  hint="至少 8 位。"
                />
                {passwordErrors.newPassword ? <span className="auth-field-error">{passwordErrors.newPassword}</span> : null}
              </div>
              <div className="auth-field-stack">
                <Field
                  label="确认新密码"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((previous) => ({ ...previous, confirmPassword: event.target.value }))}
                />
                {passwordErrors.confirmPassword ? <span className="auth-field-error">{passwordErrors.confirmPassword}</span> : null}
              </div>
            </div>
            <div className="page-actions">
              <Btn tone="primary" type="submit" disabled={passwordSaving}>
                {passwordSaving ? '提交中...' : '修改密码'}
              </Btn>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
