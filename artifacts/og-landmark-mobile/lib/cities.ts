export const cities = [
  'Okara',
  'Depalpur',
  'Renala Khurd',
  'Hujra Shah Muqeem',
  'Basirpur',
  'Haveli Lakha',
] as const;

export type City = (typeof cities)[number];

export const okaraDistrict = {
  name: 'Okara District',
  cities: [...cities] as string[],
  tehsils: ['Okara', 'Depalpur', 'Renala Khurd'],
  areas: {
    Okara: [
      'Satellite Town', 'Model Town', 'Defence Colony', 'Gulshan-e-Iqbal',
      'Peoples Colony', 'Old City', 'Railway Colony', 'Aziz Colony',
      'Ghalla Mandi', 'Civil Lines', 'Cantonment', 'Noor Shah Road',
    ],
    Depalpur: [
      'Depalpur City', 'Lodhran Road Area', 'Pakpattan Road Area',
      'Iqbal Town', 'Civil Lines', 'New Town',
    ],
    'Renala Khurd': ['Renala City', 'Sugar Mill Area', 'Railway Station Area', 'New Colony'],
    'Hujra Shah Muqeem': ['Hujra City', 'Main Bazar', 'New Scheme'],
    Basirpur: ['Basirpur City', 'Main Bazar'],
    'Haveli Lakha': ['Haveli Lakha City', 'New Town', 'Main Bazar'],
  } as Record<string, string[]>,
  villages: [
    'Chak 4/4-R', 'Chak 8/4-R', 'Chak 13/4-R', 'Chak 22/4-R',
    'Chak 34/4-R', 'Chak 45/4-R', 'Moray Wala', 'Badar Pur',
    'Chak Bahar', 'Noorpur', 'Adda Niaz Baig', 'Tiba Sultan',
    'Manga Mandi', 'Shergarh', 'Dipalpur Road', 'Kot Momin',
  ],
};
