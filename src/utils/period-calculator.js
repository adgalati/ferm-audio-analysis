import { format, startOfWeek, addWeeks, getWeek, getISOWeek, startOfDay } from 'date-fns';

/**
 * Calculates the time period for a given date.
 * @param {Date} date - The date to calculate the period for.
 * @param {string} periodType - 'weekly' or 'biweekly'.
 * @param {number} startDayOfWeek - 0 for Sunday, 1 for Monday, etc.
 * @returns {{period: string, periodStart: Date, periodEnd: Date, periodType: string}}
 */
export function calculatePeriod(date, periodType = 'weekly', startDayOfWeek = 1) {
  const d = startOfDay(date); // Ensure date is at the start of the day

  let periodStart;
  let periodEnd;
  let periodLabel;

  if (periodType === 'weekly') {
    periodStart = startOfWeek(d, { weekStartsOn: startDayOfWeek });
    periodEnd = addWeeks(periodStart, 1);
    periodEnd.setDate(periodEnd.getDate() - 1); // End of the week
    periodLabel = `Week of ${format(periodStart, 'MMM dd, yyyy')}`;
  } else if (periodType === 'biweekly') {
    const weekNum = getISOWeek(d);
    const biweekNum = Math.floor((weekNum - 1) / 2); // 0-indexed biweek number

    // Find the start of the first week of the year
    const yearStart = new Date(d.getFullYear(), 0, 1);
    let currentWeekStart = startOfWeek(yearStart, { weekStartsOn: startDayOfWeek });

    // Advance to the start of the correct bi-week
    currentWeekStart = addWeeks(currentWeekStart, biweekNum * 2);
    periodStart = currentWeekStart;
    periodEnd = addWeeks(periodStart, 2);
    periodEnd.setDate(periodEnd.getDate() - 1); // End of the bi-week

    periodLabel = `Bi-Week ${biweekNum + 1} of ${d.getFullYear()} (${format(periodStart, 'MMM dd')} - ${format(periodEnd, 'MMM dd')})`;
  } else {
    // Default to weekly if type is unknown
    return calculatePeriod(date, 'weekly', startDayOfWeek);
  }

  return {
    period: periodLabel,
    periodStart,
    periodEnd,
    periodType
  };
}
