import 'package:intl/intl.dart';

import '../../config/app_constants.dart';

class PriceFormatter {
  PriceFormatter._();

  static final _noDecimal = NumberFormat.currency(
    locale: AppConstants.locale,
    symbol: '${AppConstants.currencySymbol} ',
    decimalDigits: 0,
  );

  static String format(double price) => _noDecimal.format(price);

  static String formatInt(int price) => _noDecimal.format(price);
}
