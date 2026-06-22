import { Text } from 'react-native';
import { Screen } from '@/src/components/screen';
import { t } from '@/src/lib/i18n';

export default function PlayScreen() {
  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '800' }}>{t('play.heading')}</Text>
      <Text>{t('play.description')}</Text>
    </Screen>
  );
}
