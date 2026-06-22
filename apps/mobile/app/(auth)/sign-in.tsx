import { colors, radii, spacing } from '@squash/design-tokens';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { Screen } from '@/src/components/screen';
import { authClient } from '@/src/lib/auth-client';
import { t } from '@/src/lib/i18n';

const schema = z.object({ email: z.email(), password: z.string().min(8) });
type FormValues = z.infer<typeof schema>;

export default function SignInScreen() {
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  const signIn = handleSubmit(async (values) => {
    const result = await authClient.signIn.email(values);
    if (!result.error) router.replace('/(tabs)');
  });
  const social = async (provider: 'google' | 'apple') => {
    const result = await authClient.signIn.social({ provider, callbackURL: '/(tabs)' });
    if (!result.error) router.replace('/(tabs)');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t('app.name').toUpperCase()}</Text>
        <Text style={styles.title}>{t('auth.heading')}</Text>
      </View>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t('auth.email')}
            style={styles.input}
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextInput
            placeholder={t('auth.password')}
            secureTextEntry
            style={styles.input}
            value={field.value}
            onBlur={field.onBlur}
            onChangeText={field.onChange}
          />
        )}
      />
      <Pressable disabled={formState.isSubmitting} onPress={signIn} style={styles.primaryButton}>
        <Text style={styles.primaryText}>{t('auth.signIn')}</Text>
      </Pressable>
      <Pressable onPress={() => social('google')} style={styles.secondaryButton}>
        <Text>{t('auth.google')}</Text>
      </Pressable>
      <Pressable onPress={() => social('apple')} style={styles.secondaryButton}>
        <Text>{t('auth.apple')}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 60, marginBottom: spacing.lg, gap: spacing.sm },
  eyebrow: { color: colors.primary, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.foreground, fontSize: 32, fontWeight: '800' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  primaryText: { color: colors.primaryForeground, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
});
