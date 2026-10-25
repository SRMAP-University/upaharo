import 'package:flutter_test/flutter_test.dart';

import 'package:upaharo_mobile/data/repositories/festive_repository.dart';

void main() {
  test('parses the /api/festive response', () {
    final c = FestiveCollection.fromJson({
      'festivalMode': true,
      'personalised': true,
      'countdown': {'daysLeft': 17, 'dateLabel': 'Wednesday 11 November'},
      'forYou': [
        {
          'id': 'p1',
          'name': 'Bhai Tika Masala Box',
          'price': 999,
          'discount': 20,
          'image': '/api/uploads?key=a.png',
          'category': 'Dasahin & Tihar',
          'isVeg': true,
          'prepTime': 1440,
          'tags': ['Bhai Tika'],
        },
      ],
      'sections': [],
    });
    expect(c.festivalMode, isTrue);
    expect(c.personalised, isTrue);
    expect(c.daysLeft, 17);
    expect(c.forYou.single.name, 'Bhai Tika Masala Box');
  });

  test('no countdown and festival mode off', () {
    final c = FestiveCollection.fromJson({'festivalMode': false, 'countdown': null, 'forYou': []});
    expect(c.festivalMode, isFalse);
    expect(c.daysLeft, isNull);
    expect(c.forYou, isEmpty);
  });
}
