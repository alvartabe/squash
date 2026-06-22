import { Text } from 'react-native';
import { Screen } from '@/src/components/screen';
import { t } from '@/src/lib/i18n';

export default function TournamentsScreen() {
  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '800' }}>{t('tournaments.heading')}</Text>
      <Text>{t('tournaments.description')}</Text>
    </Screen>
  );
}
