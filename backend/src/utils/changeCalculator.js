export function calculateChange(changeAmount, drawerDenoms) {
  let remaining = Math.round(changeAmount * 100);

  const sorted = [...drawerDenoms].sort(
    (a, b) => b.note_value - a.note_value
  );

  const result = [];

  for (const denom of sorted) {
    if (remaining <= 0) break;

    const note = Math.round(denom.note_value * 100);

    const maxNotes = Math.floor(remaining / note);
    const usable = Math.min(maxNotes, denom.quantity);

    if (usable > 0) {
      result.push({
        note_value: denom.note_value,
        quantity: usable,
      });

      remaining -= usable * note;
    }
  }

  if (remaining !== 0) return null;

  return result;
}