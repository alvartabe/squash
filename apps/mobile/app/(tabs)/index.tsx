import { CalendarClock, Swords, Trophy } from 'lucide-react-native';
import { StyleSheet, Text } from 'react-native';
import { DashboardCard } from '@/src/components/dashboard-card';
import { Screen } from '@/src/components/screen';
import { colors } from '@squash/design-tokens';
import { t } from '@/src/lib/i18n';

export default function HomeScreen() {
  return (
    <Screen>
      <Text style={styles.kicker}>{t('dashboard.kicker')}</Text>
      <Text style={styles.heading}>{t('dashboard.heading')}</Text>
      <Text style={styles.description}>{t('dashboard.description')}</Text>
      <DashboardCard
        icon={CalendarClock}
        title={t('dashboard.openPlay')}
        description={t('dashboard.openPlayDescription')}
      />
      <DashboardCard
        icon={Swords}
        title={t('dashboard.challenges')}
        description={t('dashboard.challengesDescription')}
      />
      <DashboardCard
        icon={Trophy}
        title={t('dashboard.tournaments')}
        description={t('dashboard.tournamentsDescription')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.primary, fontWeight: '800', letterSpacing: 1.5, marginTop: 24 },
  heading: { color: colors.foreground, fontSize: 30, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 16, lineHeight: 24, marginBottom: 8 },
});
