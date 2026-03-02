export function formatDateTime(dateInput) {
  if (!dateInput) return "—";

  try {
    // Check if it's a Firestore Timestamp and convert it
    const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
    
    // Check if Date is valid
    if (isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch (error) {
    console.warn("Date formatting error:", error);
    return "—";
  }
}
