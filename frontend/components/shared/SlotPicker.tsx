import { cn } from '@/lib/utils';

interface Slot { start_time: string; end_time: string }

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

function groupSlots(slots: Slot[]) {
  const groups: Record<string, Slot[]> = { Morning: [], Afternoon: [], Evening: [] };
  for (const slot of slots) {
    const mins = toMinutes(slot.start_time);
    if (mins < 12 * 60) groups.Morning.push(slot);
    else if (mins < 17 * 60) groups.Afternoon.push(slot);
    else groups.Evening.push(slot);
  }
  return groups;
}

export function SlotPicker({ slots, value, onChange }: { slots: Slot[]; value?: string; onChange: (v: string) => void }) {
  if (!slots.length) {
    return (
      <div className='rounded-xl border border-dashed border-border p-6 text-center'>
        <p className='text-sm text-muted-foreground'>No available slots for this date.</p>
        <p className='mt-1 text-xs text-muted-foreground'>Try selecting a different date.</p>
      </div>
    );
  }

  const groups = groupSlots(slots);

  return (
    <div className='space-y-4'>
      {(Object.entries(groups) as [string, Slot[]][]).map(([group, groupSlots]) => {
        if (!groupSlots.length) return null;
        return (
          <div key={group}>
            <p className='mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>{group}</p>
            <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
              {groupSlots.map((slot) => {
                const selected = value === slot.start_time;
                return (
                  <button
                    key={slot.start_time}
                    onClick={() => onChange(slot.start_time)}
                    className={cn(
                      'h-11 rounded-xl border text-sm font-medium transition-all',
                      selected
                        ? 'border-brand-ink bg-brand-ink text-white shadow-sm'
                        : 'border-border bg-white text-foreground hover:border-brand-sage/50 hover:bg-brand-peach/30',
                    )}
                  >
                    {formatTime(slot.start_time)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
