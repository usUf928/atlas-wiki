import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { ApiClientError } from '../lib/api';
import { passwordStrength } from '@atlas/shared';
import { InlineError, Modal } from './ui';
import { cn } from '../lib/utils';

export function ChangePasswordDialog() {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const strength = passwordStrength(newPassword);

  const submit = async () => {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 8) {
      setError('新密码至少 8 位');
      return;
    }
    setPending(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : '修改失败，请稍后再试');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => undefined}
      dismissible={false}
      title="请先修改初始密码"
      footer={
        <button type="button" className="btn btn-primary" onClick={submit} disabled={pending}>
          {pending ? '保存中…' : '更新密码并继续'}
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-secondary">
          当前账号仍在使用初始密码或管理员重置的密码。为了站点安全，修改后才能继续操作。
        </p>
        <label className="block space-y-1">
          <span className="text-[12px] text-tertiary">当前密码</span>
          <input
            type="password"
            className="field"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[12px] text-tertiary">新密码</span>
          <input
            type="password"
            className="field"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        {newPassword ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={cn(
                    'h-1 flex-1 rounded-sm',
                    index < strength.score ? 'bg-accent' : 'bg-line',
                  )}
                />
              ))}
            </div>
            <span className="w-10 text-right text-[12px] text-tertiary">{strength.label}</span>
          </div>
        ) : null}
        <label className="block space-y-1">
          <span className="text-[12px] text-tertiary">确认新密码</span>
          <input
            type="password"
            className="field"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
        <InlineError message={error} />
      </div>
    </Modal>
  );
}
