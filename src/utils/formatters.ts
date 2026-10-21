export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatExpectedDcsNickname(
  callsign: string,
  discordServerNick?: string | null
): string {
  if (discordServerNick && discordServerNick.trim()) {
    const nick = discordServerNick.trim();
    if (nick.startsWith('GTFO | ')) {
      return nick;
    }
    if (/^GTFO\s*\|\s*/i.test(nick)) {
      return `GTFO | ${nick.replace(/^GTFO\s*\|\s*/i, '').trim()}`;
    }
    return `GTFO | ${nick}`;
  }

  const clean = (callsign || 'Aviator').trim();
  if (clean.startsWith('GTFO | ')) {
    return clean;
  }
  if (/^GTFO\s*\|\s*/i.test(clean)) {
    return `GTFO | ${clean.replace(/^GTFO\s*\|\s*/i, '').trim()}`;
  }
  return `GTFO | ${clean}`;
}

