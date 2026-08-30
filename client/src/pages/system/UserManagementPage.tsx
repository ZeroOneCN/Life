import { useEffect, useMemo, useRef, useState } from 'react';

import { Select } from '@arco-design/web-react';

import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Btn, DataTable, Modal, Pagination, SearchInput, Switch, Tag, Toast, useToastState } from '../../components/ui';
import { useBreadcrumbTail } from '../../hooks/useBreadcrumbTail';
import { buildApiErrorMessage } from '../../lib/api';
import { useAuthState } from '../../services/auth';
import {
  getAdminUsers,
  roleColors,
  roleLabels,
  toggleUserActive,
  updateUserRole,
  type AdminUserEntry,
} from '../../services/admin';
import dayjs from 'dayjs';

/**
 * 用户管理页面（B 端权限管理）。
 * 仅 admin 角色可访问，支持查看用户列表、修改角色、启用/停用用户。
 */
export default function UserManagementPage() {
  useBreadcrumbTail('用户管理');
  const authState = useAuthState();
  const currentUser = authState.session?.user;
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [roleModalUser, setRoleModalUser] = useState<AdminUserEntry | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const fetchUsers = async (currentPage: number) => {
    setLoading(true);
    try {
      const result = await getAdminUsers({
        page: currentPage,
        page_size: pageSize,
        keyword: keyword || undefined,
        role: roleFilter || undefined,
      });
      setUsers(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      showToastRef.current(buildApiErrorMessage(error, '用户列表加载失败。'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    void fetchUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, roleFilter]);

  useEffect(() => {
    void fetchUsers(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const metrics = useMemo(() => {
    return {
      total,
      admins: users.filter((u) => u.role === 'admin').length,
      active: users.filter((u) => u.is_active).length,
      inactive: users.filter((u) => !u.is_active).length,
    };
  }, [users, total]);

  const columns = useMemo(() => [
    { key: 'username' as const, title: '用户名', width: 120 },
    { key: 'nickname' as const, title: '昵称', width: 120 },
    { key: 'email' as const, title: '邮箱', width: 200 },
    {
      key: 'role' as const,
      title: '角色',
      width: 100,
      render: (_: unknown, row: AdminUserEntry) => (
        <Tag tone={roleColors[row.role] ?? 'default'}>{roleLabels[row.role] ?? row.role}</Tag>
      ),
    },
    {
      key: 'is_active' as const,
      title: '状态',
      width: 80,
      render: (_: unknown, row: AdminUserEntry) => (
        <Tag tone={row.is_active ? 'green' : 'default'}>{row.is_active ? '启用' : '停用'}</Tag>
      ),
    },
    {
      key: 'created_at' as const,
      title: '注册时间',
      width: 160,
      render: (_: unknown, _row: unknown, value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      key: 'actions' as const,
      title: '操作',
      width: 180,
      render: (_: unknown, row: AdminUserEntry) => {
        const isSelf = row.id === currentUser?.id;
        return (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn
              tone="secondary"
              disabled={isSelf}
              title={isSelf ? '不能修改自己的角色' : '修改角色'}
              onClick={() => setRoleModalUser(row)}
            >
              角色
            </Btn>
            <Switch
              checked={row.is_active}
              disabled={isSelf}
              onChange={async () => {
                try {
                  await toggleUserActive(row.id);
                  showToastRef.current(`${row.username} 已${row.is_active ? '停用' : '启用'}。`);
                  void fetchUsers(page);
                } catch (error) {
                  showToastRef.current(buildApiErrorMessage(error, '操作失败。'), 'error');
                }
              }}
            />
          </div>
        );
      },
    },
  ] as const, [currentUser, page]);

  const handleRoleChange = async () => {
    if (!roleModalUser) return;
    setRoleLoading(true);
    try {
      const result = await updateUserRole(roleModalUser.id, roleModalUser.role);
      showToast(`用户角色已更新为 ${roleLabels[result.role] ?? result.role}。`);
      setRoleModalUser(null);
      void fetchUsers(page);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '角色更新失败。'), 'error');
    } finally {
      setRoleLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="用户管理"
        subtitle="管理系统用户和角色权限"
      />

      <StatGrid
        items={[
          { label: '用户总数', value: `${metrics.total}` },
          { label: '管理员', value: `${metrics.admins}` },
          { label: '活跃用户', value: `${metrics.active}` },
          { label: '已停用', value: `${metrics.inactive}` },
        ]}
      />

      <SectionCard
        title="用户列表"
        description="管理所有注册用户"
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ width: 240 }}>
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="搜索用户名或邮箱..."
            />
          </div>
          <Select
            placeholder="角色筛选"
            value={roleFilter || undefined}
            onChange={(val) => setRoleFilter(val as string ?? '')}
            allowClear
            style={{ width: 140 }}
          >
            <Select.Option value="admin">管理员</Select.Option>
            <Select.Option value="user">普通用户</Select.Option>
            <Select.Option value="readonly">只读用户</Select.Option>
          </Select>
        </div>

        <DataTable
          columns={columns as any}
          data={users}
          rowKey="id"
          emptyText="暂无用户数据"
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(next) => setPage(next)}
          />
        </div>
      </SectionCard>

      {/* 角色修改 Modal */}
      {roleModalUser && (
        <Modal
          open
          onClose={() => setRoleModalUser(null)}
          title={`修改角色 - ${roleModalUser.username}`}
          footer={(
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn tone="ghost" onClick={() => setRoleModalUser(null)}>取消</Btn>
              <Btn tone="primary" loading={roleLoading} onClick={handleRoleChange}>保存</Btn>
            </div>
          )}
        >
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: 'var(--color-text-3)', marginBottom: 8, fontSize: 13 }}>当前角色</div>
            <Tag tone={roleColors[roleModalUser.role] ?? 'default'}>{roleLabels[roleModalUser.role] ?? roleModalUser.role}</Tag>
          </div>
          <div>
            <div style={{ color: 'var(--color-text-3)', marginBottom: 8, fontSize: 13 }}>新角色</div>
            <Select
              value={roleModalUser.role}
              onChange={(val) => setRoleModalUser({ ...roleModalUser, role: val as 'admin' | 'user' | 'readonly' })}
              style={{ width: '100%' }}
            >
              <Select.Option value="admin">管理员</Select.Option>
              <Select.Option value="user">普通用户</Select.Option>
              <Select.Option value="readonly">只读用户</Select.Option>
            </Select>
          </div>
        </Modal>
      )}

      <Toast toast={toast} />
    </div>
  );
}