export function isPanelSender(
  sender: { id?: string; url?: string; tab?: unknown },
  extensionId: string,
  panelUrl: string,
): boolean {
  return (
    sender.id === extensionId &&
    sender.url === panelUrl &&
    sender.tab === undefined
  );
}
