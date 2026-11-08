import { pageIdentity } from '@plant/server';
import { Shell, PortalHub } from '@plant/ui';
export const dynamic = 'force-dynamic';
const wibDateFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
export default async function Portal() {
  const identity = await pageIdentity('/');
  const now = Date.now();
  const hour = new Date(now + 7 * 3600000).getUTCHours();
  const greeting =
    hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  const dateLabel = `${wibDateFormatter.format(new Date(now))} · WIB`;
  return (
    <Shell identity={identity} active="portal">
      <PortalHub
        identity={identity}
        greeting={`${greeting}, ${identity.name.split(' ')[0]}.`}
        dateLabel={dateLabel}
      />
    </Shell>
  );
}
