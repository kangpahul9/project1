export function calculateChange(changeAmount, drawerDenoms) {
  const sorted = [...drawerDenoms].sort(
    (a, b) => b.note_value - a.note_value
  );

  const result = [];

  for (const denom of sorted) {
    if (changeAmount <= 0) break;

    const maxNotes = Math.floor(changeAmount / denom.note_value);
    const usable = Math.min(maxNotes, denom.quantity);

    if (usable > 0) {
      result.push({
        note_value: denom.note_value,
        quantity: usable,
      });

      changeAmount -= usable * denom.note_value;
    }
  }

  if (changeAmount !== 0) {
    return null; // not possible
  }

  return result;
}
