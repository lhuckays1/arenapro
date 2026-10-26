export type ConfirmationButton = {
  confirmationCode: string;
  title: string;
  description: string;
};

export function buildConfirmationButton(text: string): ConfirmationButton | null {
  const match = text.match(/\bSIM\s+\*?([A-F0-9]{8})\*?\b/i);
  if (!match || !/\b(?:oferta|reserva)\b/i.test(text) || !/\bconfirm\w*\b/i.test(text)) {
    return null;
  }

  const confirmationCode = match[1].toUpperCase();
  const codePattern = new RegExp('\\bSIM\\s+\\*?' + confirmationCode + '\\*?\\b', 'i');
  const visibleText = text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => !codePattern.test(sentence))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    confirmationCode,
    title: 'Sua reserva está quase confirmada',
    description: (visibleText || 'Sua oferta foi criada.')
      + '\n\nToque no botão “Confirmar reserva” em até 15 minutos.',
  };
}
