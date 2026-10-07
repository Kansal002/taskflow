import type { PresenceUser } from '@taskflow/shared';
import { AvatarGroup } from '../../components/ui';

/** Avatars of everyone currently viewing this board (excluding you). */
export function PresenceAvatars({ users, selfId }: { users: PresenceUser[]; selfId: string }) {
  const others = users.filter((user) => user.id !== selfId);
  if (others.length === 0) return null;
  return (
    <div className="hidden items-center gap-2 sm:flex">
      <AvatarGroup
        users={others}
        max={4}
        label={`${others.length} other ${others.length === 1 ? 'person' : 'people'} viewing`}
      />
    </div>
  );
}
