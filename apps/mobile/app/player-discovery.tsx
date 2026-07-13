import { colors, radii, spacing } from '@squash/design-tokens';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/src/components/screen';
import { api } from '@/src/lib/api';
import { t } from '@/src/lib/i18n';

export default function PlayerDiscoveryScreen() {
  const [username, setUsername] = useState('');
  const lookup = useMutation({ mutationFn: (value: string) => api.findPlayerByUsername(value) });

  return (
    <Screen>
      <Text style={styles.heading}>{t('discovery.heading')}</Text>
      <Text style={styles.description}>{t('discovery.description')}</Text>
      <TextInput
        accessibilityLabel={t('profile.username')}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setUsername}
        style={styles.input}
        value={username}
      />
      <Pressable
        accessibilityRole="button"
        disabled={lookup.isPending}
        onPress={() => lookup.mutate(username)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>{t('discovery.search')}</Text>
      </Pressable>
      {lookup.isPending ? <ActivityIndicator color={colors.primary} /> : null}
      {lookup.isError ? <Text accessibilityRole="alert">{t('discovery.error')}</Text> : null}
      {lookup.isSuccess && !lookup.data.data ? <Text>{t('discovery.noMatch')}</Text> : null}
      {lookup.data?.data ? (
        <View style={styles.result}>
          {lookup.data.data.avatar ? (
            <Image source={{ uri: lookup.data.data.avatar }} style={styles.avatar} />
          ) : null}
          <Text style={styles.name}>{lookup.data.data.displayName}</Text>
          <Text>{lookup.data.data.username}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.foreground, fontSize: 28, fontWeight: '800' },
  description: { color: colors.muted, lineHeight: 21 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.foreground,
    paddingHorizontal: spacing.md,
  },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  buttonText: { color: colors.background, fontWeight: '800', textAlign: 'center' },
  result: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  name: { color: colors.foreground, fontSize: 20, fontWeight: '800' },
});
