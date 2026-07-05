import { queryKeys } from '@squash/api-client';
import type { ClubDiscoveryItem } from '@squash/contracts';
import { colors, radii, spacing } from '@squash/design-tokens';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Redirect, type Href, router } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ClubRelationshipBadge } from '@/src/components/club-relationship-card';
import { api } from '@/src/lib/api';
import { authClient } from '@/src/lib/auth-client';
import { t } from '@/src/lib/i18n';

const PAGE_SIZE = 15;

function ClubRow({ club }: { club: ClubDiscoveryItem }) {
  const openProfile = () => router.push(`/clubs/${club.id}` as Href);

  return (
    <Pressable
      accessibilityHint={t('playerClubs.openProfile')}
      accessibilityRole="button"
      onPress={openProfile}
      style={({ pressed }) => [styles.clubCard, pressed ? styles.pressed : undefined]}
    >
      <Text style={styles.clubName}>{club.name}</Text>
      <ClubRelationshipBadge relationship={club.relationship} />
    </Pressable>
  );
}

export default function ClubsScreen() {
  const session = authClient.useSession();
  const playerId = session.data?.user.id;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const clubsQuery = useInfiniteQuery({
    queryKey: [...queryKeys.clubDiscovery(), playerId ?? 'signed-out', debouncedSearch],
    initialPageParam: 0,
    enabled: Boolean(playerId),
    queryFn: ({ pageParam }) =>
      api.discoverClubs({
        page: pageParam,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
      }),
    getNextPageParam: (lastPage) => {
      const page = lastPage.data;
      return page.page + 1 < page.totalPages ? page.page + 1 : undefined;
    },
  });

  const clubs = useMemo(
    () => clubsQuery.data?.pages.flatMap((page) => page.data.items) ?? [],
    [clubsQuery.data],
  );
  const refreshing = clubsQuery.isRefetching && !clubsQuery.isFetchingNextPage;
  const emptyCopy = debouncedSearch ? t('playerClubs.noSearchResults') : t('playerClubs.empty');

  if (!session.isPending && !playerId) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={clubs}
        keyExtractor={(club) => club.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heading}>{t('playerClubs.heading')}</Text>
            <Text style={styles.description}>{t('playerClubs.description')}</Text>
            <View style={styles.search}>
              <Search accessibilityElementsHidden color={colors.muted} size={20} />
              <TextInput
                accessibilityLabel={t('playerClubs.searchPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                onChangeText={setSearch}
                placeholder={t('playerClubs.searchPlaceholder')}
                returnKeyType="search"
                style={styles.searchInput}
                value={search}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          clubsQuery.isPending ? (
            <View style={styles.state}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.stateText}>{t('common.loading')}</Text>
            </View>
          ) : clubsQuery.isError ? (
            <View style={styles.state}>
              <Text accessibilityRole="alert" style={styles.errorText}>
                {t('playerClubs.loadError')}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => clubsQuery.refetch()}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.state}>
              <Text style={styles.stateText}>{emptyCopy}</Text>
            </View>
          )
        }
        ListFooterComponent={
          clubsQuery.isFetchingNextPage ? (
            <ActivityIndicator
              accessibilityLabel={t('playerClubs.loadMore')}
              color={colors.primary}
              style={styles.footer}
            />
          ) : clubs.length > 0 && clubsQuery.isError ? (
            <View style={styles.footerError}>
              <Text accessibilityRole="alert" style={styles.errorText}>
                {t('playerClubs.loadError')}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  clubsQuery.isFetchNextPageError
                    ? clubsQuery.fetchNextPage()
                    : clubsQuery.refetch()
                }
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : null
        }
        onEndReached={() => {
          if (clubsQuery.hasNextPage && !clubsQuery.isFetchingNextPage) {
            void clubsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => clubsQuery.refetch()}
            refreshing={refreshing}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => <ClubRow club={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heading: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: '800',
  },
  description: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
  },
  search: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 16,
  },
  clubCard: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  clubName: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  stateText: {
    color: colors.muted,
    textAlign: 'center',
  },
  errorText: {
    color: colors.destructive,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  retryText: {
    color: colors.primary,
    fontWeight: '700',
  },
  footer: {
    padding: spacing.md,
  },
  footerError: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
});
