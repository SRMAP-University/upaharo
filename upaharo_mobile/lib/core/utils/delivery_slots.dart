/// Scheduled delivery windows, mirroring `lib/delivery-schedule.ts` on the
/// backend. Slot maths run in Nepal time (UTC+05:45) so the picker matches the
/// server no matter what timezone the phone is set to.
///
/// Windows are admin-configurable and arrive with the app settings payload;
/// [defaultDeliverySlots] is only the fallback used before settings load.
library;

const Duration _nepalOffset = Duration(hours: 5, minutes: 45);

/// Minimum notice before a window may be booked.
const Duration _minLeadTime = Duration(minutes: 60);

class DeliverySlot {
  final int startHour;
  final int endHour;
  final String label;

  const DeliverySlot({
    required this.startHour,
    required this.endHour,
    required this.label,
  });

  factory DeliverySlot.fromJson(Map<String, dynamic> json) {
    final startHour = (json['startHour'] as num?)?.toInt() ?? 0;
    final endHour = (json['endHour'] as num?)?.toInt() ?? 0;
    final label = (json['label'] as String? ?? '').trim();

    return DeliverySlot(
      startHour: startHour,
      endHour: endHour,
      label: label.isEmpty ? '$startHour:00 – $endHour:00' : label,
    );
  }

  Map<String, dynamic> toJson() => {
        'startHour': startHour,
        'endHour': endHour,
        'label': label,
      };
}

const List<DeliverySlot> defaultDeliverySlots = [
  DeliverySlot(startHour: 10, endHour: 12, label: '10 AM – 12 PM'),
  DeliverySlot(startHour: 12, endHour: 15, label: '12 – 3 PM'),
  DeliverySlot(startHour: 15, endHour: 18, label: '3 – 6 PM'),
  DeliverySlot(startHour: 18, endHour: 21, label: '6 – 9 PM'),
];

const int defaultScheduleDayCount = 3;
const int defaultScheduleMaxDaysAhead = 30;

/// The admin-configured windows plus how far ahead they run.
class DeliverySchedule {
  final List<DeliverySlot> slots;

  /// Quick day chips shown at checkout, including today.
  final int dayCount;

  /// Furthest bookable day index, reachable via the custom date picker.
  final int maxDaysAhead;

  const DeliverySchedule({
    this.slots = defaultDeliverySlots,
    this.dayCount = defaultScheduleDayCount,
    this.maxDaysAhead = defaultScheduleMaxDaysAhead,
  });

  /// Used until settings load; matches the server defaults.
  static const fallback = DeliverySchedule();

  /// Admins turn scheduling off by removing every window.
  bool get isEnabled => slots.isNotEmpty;

  /// A slot is bookable when it starts far enough in the future.
  bool isSlotBookable(int dayIndex, DeliverySlot slot) {
    return slotStartInstant(dayIndex, slot)
        .isAfter(DateTime.now().toUtc().add(_minLeadTime));
  }

  /// Quick-chip day indexes that still have at least one bookable window.
  List<int> bookableDayIndexes() {
    final chipDays = dayCount < maxDaysAhead ? dayCount : maxDaysAhead;
    return [
      for (var day = 0; day < chipDays; day++)
        if (slots.any((slot) => isSlotBookable(day, slot))) day,
    ];
  }

  /// Last day index a custom date may reach.
  int get lastBookableDayIndex => maxDaysAhead - 1;

  bool isDayBookable(int dayIndex) =>
      dayIndex >= 0 &&
      dayIndex < maxDaysAhead &&
      slots.any((slot) => isSlotBookable(dayIndex, slot));

  /// The day checkout pre-selects.
  ///
  /// Defaults to the next day so the order gets a full day of windows. An
  /// overnight order is the exception: none of today's windows have opened
  /// yet, so same-day delivery is still on the table.
  int? defaultDayIndex() {
    if (!isEnabled) return null;

    if (slots.every((slot) => isSlotBookable(0, slot))) return 0;
    if (isDayBookable(1)) return 1;
    return isDayBookable(0) ? 0 : null;
  }

  List<DeliverySlot> bookableSlots(int dayIndex) {
    return [
      for (final slot in slots)
        if (isSlotBookable(dayIndex, slot)) slot,
    ];
  }

  /// The stored slot matching [startHour], or null once admin removes it.
  DeliverySlot? slotByStartHour(int? startHour) {
    if (startHour == null) return null;
    for (final slot in slots) {
      if (slot.startHour == startHour) return slot;
    }
    return null;
  }

  /// Parses the `deliverySlots` array from the settings payload. A missing
  /// value falls back to the defaults; an explicit empty list disables
  /// scheduling, matching `normalizeDeliverySlots` on the server.
  static List<DeliverySlot> parseSlots(dynamic raw) {
    if (raw is! List) return defaultDeliverySlots;

    final slots = <DeliverySlot>[];
    final seenStarts = <int>{};

    for (final item in raw) {
      if (item is! Map) continue;
      final slot = DeliverySlot.fromJson(Map<String, dynamic>.from(item));
      if (slot.endHour <= slot.startHour) continue;
      if (!seenStarts.add(slot.startHour)) continue;
      slots.add(slot);
    }

    slots.sort((a, b) => a.startHour.compareTo(b.startHour));
    return slots;
  }
}

/// Current wall-clock time in Kathmandu, carried in a UTC `DateTime`.
DateTime nepalNow() => DateTime.now().toUtc().add(_nepalOffset);

/// The real instant at which [slot] starts on the Nepal day [dayIndex] days
/// from today.
DateTime slotStartInstant(int dayIndex, DeliverySlot slot) {
  final day = nepalNow().add(Duration(days: dayIndex));
  return DateTime.utc(day.year, day.month, day.day, slot.startHour)
      .subtract(_nepalOffset);
}

/// Nepal-day index for a calendar date, where 0 is today. Only the picked
/// year/month/day matter, so a local `DateTime` from the date picker is fine.
int dayIndexForDate(DateTime date) {
  final today = nepalNow();
  return DateTime.utc(date.year, date.month, date.day)
      .difference(DateTime.utc(today.year, today.month, today.day))
      .inDays;
}

/// Local calendar date for [dayIndex], for seeding the date picker.
DateTime dateForDayIndex(int dayIndex) {
  final day = nepalNow().add(Duration(days: dayIndex));
  return DateTime(day.year, day.month, day.day);
}

String dayLabel(int dayIndex) {
  if (dayIndex == 0) return 'Today';
  if (dayIndex == 1) return 'Tomorrow';

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final day = nepalNow().add(Duration(days: dayIndex));
  return '${weekdays[day.weekday - 1]} ${day.day} ${months[day.month - 1]}';
}

String slotSummary(int dayIndex, DeliverySlot slot) =>
    '${dayLabel(dayIndex)}, ${slot.label}';
