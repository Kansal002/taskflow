import { cn } from '../../lib/cn';
import { initials } from '../../lib/identity';

export interface AvatarProps {
  name: string;
  color: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  /** Decorative avatars (next to a visible name) should be hidden from assistive tech. */
  decorative?: boolean;
}

const sizes = {
  xs: 'size-5 text-[9px]',
  sm: 'size-7 text-[11px]',
  md: 'size-8 text-xs',
};

/** Initials avatar on a solid colour background. */
export function Avatar({ name, color, size = 'sm', className, decorative = false }: AvatarProps) {
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      title={name}
      style={{ backgroundColor: color }}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-white dark:ring-zinc-900',
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export interface AvatarGroupProps {
  users: readonly { id: string; name: string; color: string }[];
  max?: number;
  size?: AvatarProps['size'];
  label?: string;
}

/** Overlapping stack of avatars with a "+N" overflow chip. */
export function AvatarGroup({ users, max = 4, size = 'sm', label = 'Users' }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  return (
    <ul aria-label={label} className="flex items-center -space-x-1.5">
      {visible.map((user) => (
        <li key={user.id} className="flex">
          <Avatar name={user.name} color={user.color} size={size} />
        </li>
      ))}
      {overflow > 0 && (
        <li className="flex">
          <span
            role="img"
            aria-label={`and ${overflow} more`}
            title={users
              .slice(max)
              .map((u) => u.name)
              .join(', ')}
            className={cn(
              'inline-flex items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-700 ring-2 ring-white dark:bg-zinc-700 dark:text-zinc-200 dark:ring-zinc-900',
              sizes[size],
            )}
          >
            +{overflow}
          </span>
        </li>
      )}
    </ul>
  );
}
